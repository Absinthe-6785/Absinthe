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
import type { NoteBase, NoteFolderBase } from '../components/views/noteUtils';

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
    /** True only when a verified local folder is intentionally omitted from the cloud text snapshot. */
    folderExcludedFromSnapshot: boolean;
    snapshot: NotesCloudCopySnapshot;
    sourceRevision: NotesCloudCopySourceRevision;
    /** Synchronous fence for the final authenticated request-start callback. */
    isCurrentInMemory: () => boolean;
    /** Revalidates the in-memory publication and both durable local owner surfaces. */
    isCurrent: () => Promise<boolean>;
    /** Returns the first safe diagnostic when the prepared source is no longer eligible. */
    checkCurrent: () => Promise<NotesCloudCopyPreflightReason | null>;
  }>;

interface NotesPreflightStoreState {
  readonly notes: NoteBase[];
  readonly folders: NoteFolderBase[];
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

export interface NotesCloudCopyLocalPreflightOptions {
  /** Opt-in for initial laptop text publication after explicit UI confirmation of folder omission. */
  readonly folderDisposition?: 'omit-from-cloud-text';
  /** Initial laptop text publication only: omit a proven empty plain properties record. */
  readonly omitEmptyProperties?: true;
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
const EMPTY_PROPERTIES = Object.freeze({});

function isEmptyProperties(value: unknown): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype && Reflect.ownKeys(value).length === 0;
}
type CapturedFolderSource = Readonly<{
  folder: NoteFolderBase;
  id: string;
  name: string;
  createdAt: number;
}>;

function captureFolderSource(folders: unknown, folderId: string): CapturedFolderSource | null {
  try {
    if (!Array.isArray(folders)) return null;
    const matches = folders.filter(folder => {
      if (!folder || typeof folder !== 'object' || Array.isArray(folder)
        || Object.getPrototypeOf(folder) !== Object.prototype) return false;
      const candidateId = Object.getOwnPropertyDescriptor(folder, 'id');
      return !!candidateId && 'value' in candidateId && candidateId.value === folderId;
    });
    if (matches.length !== 1) return null;
    const folder = matches[0] as NoteFolderBase;
    if (Object.getPrototypeOf(folder) !== Object.prototype) return null;
    const id = Object.getOwnPropertyDescriptor(folder, 'id');
    const name = Object.getOwnPropertyDescriptor(folder, 'name');
    const createdAt = Object.getOwnPropertyDescriptor(folder, 'createdAt');
    if (!id || !('value' in id) || id.value !== folderId
      || !name || !('value' in name) || typeof name.value !== 'string'
      || !createdAt || !('value' in createdAt) || typeof createdAt.value !== 'number'
      || !Number.isFinite(createdAt.value)) return null;
    return Object.freeze({ folder, id: id.value, name: name.value, createdAt: createdAt.value });
  } catch { return null; }
}

function matchesCapturedFolder(value: unknown, captured: CapturedFolderSource): boolean {
  const next = captureFolderSource(value, captured.id);
  return !!next && next.folder === captured.folder && next.id === captured.id
    && next.name === captured.name && Object.is(next.createdAt, captured.createdAt);
}

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
        // Compare empty records by shape across JSON readback, not object identity.
        // Re-evaluate this on every source check so adding any property invalidates it.
        values[key] = key === 'properties' && isEmptyProperties(item) ? EMPTY_PROPERTIES : item;
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

function validateSelectedNote(
  note: unknown,
  localNoteId: string,
  options: NotesCloudCopyLocalPreflightOptions,
): NotesCloudCopyPreflightReason[] {
  const reasons: NotesCloudCopyPreflightReason[] = [];
  if (!captureSource(note) || !isCompleteLocalNote(note as NoteBase)
    || (note as NoteBase).id !== localNoteId || typeof (note as NoteBase).starred !== 'boolean') {
    reasons.push('NOTE_INCOMPLETE');
    return reasons;
  }
  const source = note as NoteBase;
  if (source.deletedAt !== null) reasons.push('NOTE_NOT_ACTIVE');
  if (source.folderId !== null && options.folderDisposition !== 'omit-from-cloud-text') reasons.push('FOLDER_UNSUPPORTED');
  if (source.properties !== undefined
    && !(options.omitEmptyProperties === true && isEmptyProperties(source.properties))) reasons.push('PROPERTIES_UNSUPPORTED');
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
  options: NotesCloudCopyLocalPreflightOptions = {},
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
    || !Array.isArray(state.notes) || !Array.isArray(state.folders) || !Number.isSafeInteger(state.vaultStructureVersion)
    || !Number.isSafeInteger(state.indexContentVersion)
    || !['LOADED_EMPTY', 'LOADED_POPULATED'].includes(state.foldersAuthorityState)) {
    return ineligible('NOTES_AUTHORITY_UNAVAILABLE');
  }

  const matches = state.notes.filter(note => note && note.id === localNoteId);
  if (matches.length === 0) return ineligible('NOTE_NOT_FOUND');
  if (matches.length !== 1) return ineligible('NOTE_ID_AMBIGUOUS');
  const note = matches[0];
  const reasons = validateSelectedNote(note, localNoteId, options);
  if (reasons.length) return ineligible(...reasons);
  const sourceFolderId = note.folderId;
  const foldersArray = state.folders;
  let capturedFolder: CapturedFolderSource | null = null;
  if (sourceFolderId !== null) {
    if (options.folderDisposition !== 'omit-from-cloud-text' || state.foldersAuthorityState !== 'LOADED_POPULATED') {
      return ineligible('FOLDER_UNSUPPORTED');
    }
    capturedFolder = captureFolderSource(foldersArray, sourceFolderId);
    if (!capturedFolder) return ineligible('FOLDER_UNSUPPORTED');
  }
  const folderExcludedFromSnapshot = capturedFolder !== null;
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
        && (!capturedFolder || (latest.folders === foldersArray && matchesCapturedFolder(latest.folders, capturedFolder)))
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
    return ineligible('LOCAL_PERSISTENCE_UNVERIFIED');
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
  const checkCurrent = async (): Promise<NotesCloudCopyPreflightReason | null> => {
    if (!sourceIsCurrent()) return 'SOURCE_CHANGED';
    const [metadataResult, persistedResult] = await Promise.allSettled([
      dependencies.inspectAttachmentMetadata(request.accountId, localNoteId),
      dependencies.observePersistedNotes(request, sourceIsCurrent),
    ]);
    if (!sourceIsCurrent()) return 'SOURCE_CHANGED';
    if (metadataResult.status === 'rejected') return 'ATTACHMENT_METADATA_INCOMPLETE';
    if (persistedResult.status === 'rejected') return 'LOCAL_PERSISTENCE_UNVERIFIED';
    const latestMetadata: AttachmentMetadataInspection = metadataResult.value;
    const latestPersisted: AccountScopedNotesReadback = persistedResult.value;
    if (latestMetadata.status !== 'COMPLETE') return 'ATTACHMENT_METADATA_INCOMPLETE';
    if (latestMetadata.matchingRecords !== 0) return 'ATTACHMENT_ORIGINALS_PRESENT';
    if (latestPersisted.status !== 'CURRENT') {
      return latestPersisted.reason === 'STALE_REQUEST' ? 'SOURCE_CHANGED' : 'LOCAL_PERSISTENCE_UNVERIFIED';
    }
    const latestMatches = latestPersisted.notes.filter(item => item.id === localNoteId);
    if (latestMatches.length !== 1 || !matchesCapturedSource(latestMatches[0], capturedSource)) {
      return 'LOCAL_PERSISTENCE_UNVERIFIED';
    }
    return sourceIsCurrent() ? null : 'SOURCE_CHANGED';
  };
  const isCurrent = async (): Promise<boolean> => (await checkCurrent()) === null;
  if (!sourceIsCurrent()) return ineligible('SOURCE_CHANGED');
  return Object.freeze({
    status: 'ELIGIBLE_PREVIEW_ONLY',
    authority: 'NONE',
    localNoteId,
    folderExcludedFromSnapshot,
    snapshot,
    sourceRevision,
    isCurrentInMemory: sourceIsCurrent,
    isCurrent,
    checkCurrent,
  });
}
