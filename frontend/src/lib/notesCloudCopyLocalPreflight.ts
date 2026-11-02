import { isCompleteLocalNote } from './notesBootstrapAuthority';
import {
  getActiveNotesAuthorityAccountId,
  getActiveNotesAuthorityRequest,
  observeAccountScopedNotesReadback,
  type AccountScopedNotesReadback,
  type NotesAuthorityRequest,
} from './notesAccountAuthority';
import {
  createLocalAttachmentMetadataRepository,
} from './attachmentMetadataIndexedDb';
import type { AttachmentMetadataInspection } from './attachmentRepository';
import { findAttachmentReferencesInText, noteBodyContainsRawBlob } from './attachmentRepository';
import { observePublishedNotesHydration, useNotesStore } from '../store/useNotesStore';
import type { NoteBase } from '../components/views/noteUtils';

export type NotesCloudCopyPreflightReason =
  | 'INVALID_LOCAL_NOTE_ID'
  | 'NOTES_AUTHORITY_UNAVAILABLE'
  | 'NOTE_NOT_FOUND'
  | 'NOTE_ID_AMBIGUOUS'
  | 'NOTE_INCOMPLETE'
  | 'NOTE_NOT_ACTIVE'
  | 'FOLDER_UNSUPPORTED'
  | 'PROPERTIES_UNSUPPORTED'
  | 'RELATIONS_UNSUPPORTED'
  | 'ATTACHMENT_CONTENT_UNSUPPORTED'
  | 'ATTACHMENT_METADATA_INCOMPLETE'
  | 'ATTACHMENT_ORIGINALS_PRESENT'
  | 'LOCAL_PERSISTENCE_UNVERIFIED'
  | 'SOURCE_CHANGED';

export interface NotesCloudCopySnapshot {
  readonly title: string;
  readonly body: string;
  readonly updated_at: number;
  readonly starred: boolean;
}

export interface NotesCloudCopySourceRevision {
  readonly authorityGeneration: number;
  readonly vaultStructureVersion: number;
  readonly indexContentVersion: number;
  readonly noteUpdatedAt: number;
  readonly durableReadback: 'MATCHED';
  readonly attachmentMetadata: 'COMPLETE_EMPTY';
}

export type NotesCloudCopyLocalPreflightResult =
  | Readonly<{
    status: 'INELIGIBLE';
    reasons: readonly NotesCloudCopyPreflightReason[];
  }>
  | Readonly<{
    status: 'ELIGIBLE_PREVIEW_ONLY';
    authority: 'NONE';
    localNoteId: string;
    snapshot: NotesCloudCopySnapshot;
    sourceRevision: NotesCloudCopySourceRevision;
    /** Synchronous fence for the final authenticated request-start callback. */
    isCurrentInMemory: () => boolean;
    /** Revalidates the in-memory publication and both durable local owner surfaces. */
    isCurrent: () => Promise<boolean>;
  }>;

interface NotesPreflightStoreState {
  readonly notes: NoteBase[];
  readonly activeAccountId: string | null;
  readonly notesAuthorityState: string;
  readonly foldersAuthorityState: string;
  readonly vaultStructureVersion: number;
  readonly indexContentVersion: number;
}

export interface NotesCloudCopyLocalPreflightDependencies {
  readonly observePublication: () => ReturnType<typeof observePublishedNotesHydration>;
  readonly getActiveRequest: () => NotesAuthorityRequest | null;
  readonly getActiveAccountId: () => string | null;
  readonly getStoreState: () => NotesPreflightStoreState;
  readonly observePersistedNotes: (
    request: NotesAuthorityRequest,
    isCurrent: () => boolean,
  ) => Promise<AccountScopedNotesReadback>;
  readonly inspectAttachmentMetadata: (accountId: string, noteId: string) => Promise<AttachmentMetadataInspection>;
}

const metadataRepository = createLocalAttachmentMetadataRepository();

const defaultDependencies: NotesCloudCopyLocalPreflightDependencies = {
  observePublication: observePublishedNotesHydration,
  getActiveRequest: getActiveNotesAuthorityRequest,
  getActiveAccountId: getActiveNotesAuthorityAccountId,
  getStoreState: () => useNotesStore.getState(),
  observePersistedNotes: observeAccountScopedNotesReadback,
  inspectAttachmentMetadata: async (accountId, noteId) => {
    if (!metadataRepository.inspectAccountNoteMetadata) return Object.freeze({ status: 'INCOMPLETE' });
    return metadataRepository.inspectAccountNoteMetadata(accountId, noteId);
  },
};

const SUPPORTED_NOTE_KEYS = new Set([
  'id', 'title', 'body', 'createdAt', 'lastOpenedAt', 'updatedAt', 'folderId', 'deletedAt',
  'starred', 'properties', 'relations',
]);

// This is deliberately the same deny boundary as the inactive server candidate:
// no image, attachment, resource, raw data, or embedded binary is rewritten.
const UNSUPPORTED_CLOUD_BODY = /(data:|blob:|attachment:|resource:|!\[|<(?:img|video|audio|object|embed|iframe)\b)/i;

type CapturedSource = Readonly<{ keys: readonly string[]; values: Readonly<Record<string, unknown>> }>;

function captureSource(value: unknown): CapturedSource | null {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key !== 'string' || !SUPPORTED_NOTE_KEYS.has(key))) return null;
    const values: Record<string, unknown> = {};
    for (const key of keys as string[]) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) return null;
      const item = descriptor.value;
      // These unsupported metadata domains are rejected by validation before
      // captureSource is retained or any source value is returned.
      if ((key === 'properties' || key === 'relations') && item !== undefined) {
        values[key] = item;
        continue;
      }
      // JSON persistence omits optional undefined fields. Treat that as the
      // same absent value while still comparing every concrete source field.
      if (item === undefined && ['createdAt', 'lastOpenedAt', 'properties', 'relations'].includes(key)) continue;
      if (item !== null && item !== undefined && !['string', 'number', 'boolean'].includes(typeof item)) return null;
      values[key] = item;
    }
    return Object.freeze({ keys: Object.freeze(Object.keys(values).sort()), values: Object.freeze(values) });
  } catch { return null; }
}

function matchesCapturedSource(value: unknown, captured: CapturedSource): boolean {
  const next = captureSource(value);
  if (!next || next.keys.length !== captured.keys.length
    || next.keys.some((key, index) => key !== captured.keys[index])) return false;
  return next.keys.every(key => Object.is(next.values[key], captured.values[key]));
}

function validateSelectedNote(note: unknown, localNoteId: string): NotesCloudCopyPreflightReason[] {
  const reasons: NotesCloudCopyPreflightReason[] = [];
  if (!captureSource(note) || !isCompleteLocalNote(note as NoteBase)
    || (note as NoteBase).id !== localNoteId || typeof (note as NoteBase).starred !== 'boolean') {
    reasons.push('NOTE_INCOMPLETE');
    return reasons;
  }
  const source = note as NoteBase;
  if (source.deletedAt !== null) reasons.push('NOTE_NOT_ACTIVE');
  if (source.folderId !== null) reasons.push('FOLDER_UNSUPPORTED');
  if (source.properties !== undefined) reasons.push('PROPERTIES_UNSUPPORTED');
  if (source.relations !== undefined) reasons.push('RELATIONS_UNSUPPORTED');
  if (typeof source.body !== 'string' || noteBodyContainsRawBlob(source.body)
    || findAttachmentReferencesInText(source.body).length > 0 || UNSUPPORTED_CLOUD_BODY.test(source.body)) {
    reasons.push('ATTACHMENT_CONTENT_UNSUPPORTED');
  }
  return reasons;
}

function ineligible(...reasons: NotesCloudCopyPreflightReason[]): NotesCloudCopyLocalPreflightResult {
  return Object.freeze({ status: 'INELIGIBLE', reasons: Object.freeze([...new Set(reasons)]) });
}

/**
 * Read-only preview of one exact local Note. It never allocates an ID,
 * contacts the Private Gateway, changes Notes/attachment storage, or returns
 * publication authority. Callers must treat the result as transient.
 */
export async function preflightLocalNoteForCloudCopy(
  localNoteId: unknown,
  dependencies: NotesCloudCopyLocalPreflightDependencies = defaultDependencies,
): Promise<NotesCloudCopyLocalPreflightResult> {
  if (typeof localNoteId !== 'string' || localNoteId.length === 0 || localNoteId !== localNoteId.trim()) {
    return ineligible('INVALID_LOCAL_NOTE_ID');
  }

  let publication: ReturnType<typeof observePublishedNotesHydration>;
  let state: NotesPreflightStoreState;
  try {
    publication = dependencies.observePublication();
    state = dependencies.getStoreState();
  } catch { return ineligible('NOTES_AUTHORITY_UNAVAILABLE'); }
  if (publication.status !== 'CURRENT') return ineligible('NOTES_AUTHORITY_UNAVAILABLE');
  const request = publication.request;
  if (dependencies.getActiveRequest() !== request || dependencies.getActiveAccountId() !== request.accountId
    || state.activeAccountId !== request.accountId || state.notesAuthorityState !== 'LOADED_POPULATED'
    || !Array.isArray(state.notes) || !Number.isSafeInteger(state.vaultStructureVersion)
    || !Number.isSafeInteger(state.indexContentVersion)
    || !['LOADED_EMPTY', 'LOADED_POPULATED'].includes(state.foldersAuthorityState)) {
    return ineligible('NOTES_AUTHORITY_UNAVAILABLE');
  }

  const matches = state.notes.filter(note => note && note.id === localNoteId);
  if (matches.length === 0) return ineligible('NOTE_NOT_FOUND');
  if (matches.length !== 1) return ineligible('NOTE_ID_AMBIGUOUS');
  const note = matches[0];
  const reasons = validateSelectedNote(note, localNoteId);
  if (reasons.length) return ineligible(...reasons);
  const capturedSource = captureSource(note);
  if (!capturedSource) return ineligible('NOTE_INCOMPLETE');
  const notesArray = state.notes;
  const sourceIsCurrent = (): boolean => {
    try {
      const observed = dependencies.observePublication();
      const latest = dependencies.getStoreState();
      return observed.status === 'CURRENT' && observed.request === request
        && dependencies.getActiveRequest() === request
        && dependencies.getActiveAccountId() === request.accountId
        && latest.activeAccountId === request.accountId
        && latest.notesAuthorityState === state.notesAuthorityState
        && latest.notesAuthorityState === 'LOADED_POPULATED'
        && latest.foldersAuthorityState === state.foldersAuthorityState
        && ['LOADED_EMPTY', 'LOADED_POPULATED'].includes(latest.foldersAuthorityState)
        && latest.vaultStructureVersion === state.vaultStructureVersion
        && latest.indexContentVersion === state.indexContentVersion
        && latest.notes === notesArray
        && latest.notes.filter(item => item && item.id === localNoteId).length === 1
        && latest.notes.find(item => item && item.id === localNoteId) === note
        && matchesCapturedSource(note, capturedSource);
    } catch { return false; }
  };
  if (!sourceIsCurrent()) return ineligible('SOURCE_CHANGED');

  let metadata: AttachmentMetadataInspection;
  let persisted: AccountScopedNotesReadback;
  try {
    [metadata, persisted] = await Promise.all([
      dependencies.inspectAttachmentMetadata(request.accountId, localNoteId),
      dependencies.observePersistedNotes(request, sourceIsCurrent),
    ]);
  } catch { return ineligible(sourceIsCurrent() ? 'LOCAL_PERSISTENCE_UNVERIFIED' : 'SOURCE_CHANGED'); }
  if (!sourceIsCurrent()) return ineligible('SOURCE_CHANGED');
  if (metadata.status !== 'COMPLETE') return ineligible('ATTACHMENT_METADATA_INCOMPLETE');
  if (metadata.matchingRecords !== 0) return ineligible('ATTACHMENT_ORIGINALS_PRESENT');
  if (persisted.status !== 'CURRENT') {
    return ineligible(persisted.reason === 'STALE_REQUEST' ? 'SOURCE_CHANGED' : 'LOCAL_PERSISTENCE_UNVERIFIED');
  }
  const durableMatches = persisted.notes.filter(item => item.id === localNoteId);
  if (durableMatches.length !== 1 || !matchesCapturedSource(durableMatches[0], capturedSource)) {
    return ineligible('LOCAL_PERSISTENCE_UNVERIFIED');
  }

  // Recheck both durable owner surfaces after the asynchronous Note readback.
  // A target attachment added while that read was pending invalidates the preview.
  let finalMetadata: AttachmentMetadataInspection;
  let finalPersisted: AccountScopedNotesReadback;
  try {
    [finalMetadata, finalPersisted] = await Promise.all([
      dependencies.inspectAttachmentMetadata(request.accountId, localNoteId),
      dependencies.observePersistedNotes(request, sourceIsCurrent),
    ]);
  } catch { return ineligible(sourceIsCurrent() ? 'LOCAL_PERSISTENCE_UNVERIFIED' : 'SOURCE_CHANGED'); }
  if (!sourceIsCurrent()) return ineligible('SOURCE_CHANGED');
  if (finalMetadata.status !== 'COMPLETE') return ineligible('ATTACHMENT_METADATA_INCOMPLETE');
  if (finalMetadata.matchingRecords !== 0) return ineligible('ATTACHMENT_ORIGINALS_PRESENT');
  if (finalPersisted.status !== 'CURRENT') {
    return ineligible(finalPersisted.reason === 'STALE_REQUEST' ? 'SOURCE_CHANGED' : 'LOCAL_PERSISTENCE_UNVERIFIED');
  }
  const finalMatches = finalPersisted.notes.filter(item => item.id === localNoteId);
  if (finalMatches.length !== 1 || !matchesCapturedSource(finalMatches[0], capturedSource)) {
    return ineligible('SOURCE_CHANGED');
  }

  const snapshot = Object.freeze({
    title: note.title,
    body: note.body,
    updated_at: note.updatedAt,
    starred: note.starred as boolean,
  });
  const sourceRevision = Object.freeze({
    authorityGeneration: request.generation,
    vaultStructureVersion: state.vaultStructureVersion,
    indexContentVersion: state.indexContentVersion,
    noteUpdatedAt: note.updatedAt,
    durableReadback: 'MATCHED' as const,
    attachmentMetadata: 'COMPLETE_EMPTY' as const,
  });
  const isCurrent = async (): Promise<boolean> => {
    if (!sourceIsCurrent()) return false;
    try {
      const [latestMetadata, latestPersisted] = await Promise.all([
        dependencies.inspectAttachmentMetadata(request.accountId, localNoteId),
        dependencies.observePersistedNotes(request, sourceIsCurrent),
      ]);
      if (!sourceIsCurrent() || latestMetadata.status !== 'COMPLETE' || latestMetadata.matchingRecords !== 0
        || latestPersisted.status !== 'CURRENT') return false;
      const latestMatches = latestPersisted.notes.filter(item => item.id === localNoteId);
      return latestMatches.length === 1 && matchesCapturedSource(latestMatches[0], capturedSource)
        && sourceIsCurrent();
    } catch { return false; }
  };
  if (!sourceIsCurrent()) return ineligible('SOURCE_CHANGED');
  return Object.freeze({
    status: 'ELIGIBLE_PREVIEW_ONLY',
    authority: 'NONE',
    localNoteId,
    snapshot,
    sourceRevision,
    isCurrentInMemory: sourceIsCurrent,
    isCurrent,
  });
}
