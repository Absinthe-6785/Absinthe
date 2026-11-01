import { attachmentMetadataAccountId, attachmentReference, findAttachmentReferencesInText, isAttachmentReference, type AccountScopedAttachmentMetadata, type AttachmentRepository, type BlobStorageAdapter } from './attachmentRepository';
import { scopedAttachmentBlobKey } from './attachmentScopedCreate';
import { admitLocalDocumentDeclaration, admitLocalDocumentFile, type LocalDocumentFormat } from './localDocumentAttachmentAdmission';
import { LOCAL_ATTACHMENT_FILE_MAX_BYTES } from './localAttachmentFilePolicy';
import { stageLocalAttachmentToNote, checksumLocalAttachmentBytes, type AttachLocalImageInput, type AttachLocalImageResult } from './localImageAttachments';
import { createLocalAttachmentBlobAdapter } from './attachmentBlobIndexedDb';
import { createLocalAttachmentMetadataRepository } from './attachmentMetadataIndexedDb';
import { observePublishedNotesHydration, useNotesStore } from '../store/useNotesStore';
import { isCompleteLocalNote } from './notesBootstrapAuthority';
import { isReturnToUseAttachmentIsolationEnabled } from './returnToUseAttachmentIsolation';
import type { NotesAuthorityRequest } from './notesAccountAuthority';

/** Dormant operation: STAGED is not Note publication or full attachment completion. */
export function stageLocalDocumentOriginal(input: AttachLocalImageInput): Promise<AttachLocalImageResult> {
  return stageLocalAttachmentToNote(input, 'document');
}

interface ReadLocalDocumentInput {
  accountId: string;
  noteId: string;
  attachmentId: string;
  /** Without a live staging receipt, an exact reference on the current Note is required. */
  staged?: AttachLocalImageResult;
  repository?: AttachmentRepository;
  blobAdapter?: BlobStorageAdapter;
}
export interface PublishedLocalDocumentOriginal {
  readonly attachmentId: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly size: number;
  readonly format: LocalDocumentFormat;
  /** Internal point-in-time binding; never rendered or logged. */
  readonly metadataSnapshot: string;
  readonly request: NotesAuthorityRequest;
}
export type PublishedLocalDocumentOriginalList =
  | Readonly<{ status: 'VERIFIED'; documents: readonly PublishedLocalDocumentOriginal[] }>
  | Readonly<{ status: 'DENIED' | 'UNAVAILABLE'; reason: string }>;
export type LocalDocumentReadback =
  | Readonly<{ status: 'VERIFIED'; file: File; checksum: string; integrity: 'SHA256_MATCHED'; formatIntegrity: 'UNVERIFIED' }>
  | Readonly<{ status: 'DENIED' | 'UNAVAILABLE'; reason: string }>;

/** Bounded point-in-time local readback; no parsing, repair, remote access, or future-retention claim. */
async function readLocalDocumentOriginalCore(
  input: ReadLocalDocumentInput,
  policy: Readonly<{ kind: 'existing' } | { kind: 'published'; request: NotesAuthorityRequest; metadataSnapshot: string }>,
): Promise<LocalDocumentReadback> {
  const { accountId, noteId, attachmentId, staged } = input;
  const denied = (reason: string): LocalDocumentReadback => Object.freeze({ status: 'DENIED', reason });
  const unavailable = (reason: string): LocalDocumentReadback => Object.freeze({ status: 'UNAVAILABLE', reason });
  const observation = observePublishedNotesHydration();
  const request = policy.kind === 'published' ? policy.request : observation.status === 'CURRENT' ? observation.request : null;
  const store = useNotesStore.getState();
  const note = store.notes.find(item => item.id === noteId);
  const current = () => {
    const latest = observePublishedNotesHydration(), currentStore = useNotesStore.getState();
    const readPolicyAllows = !isReturnToUseAttachmentIsolationEnabled()
      || (policy.kind === 'published' && staged === undefined);
    return readPolicyAllows && request !== null && latest.status === 'CURRENT' && latest.request === request
      && (policy.kind !== 'published' || request === policy.request)
      && request.accountId === accountId && currentStore.activeAccountId === accountId
      && currentStore.activeNoteId === noteId && currentStore.notes.filter(item => item.id === noteId).length === 1
      && currentStore.notes.find(item => item.id === noteId) === note && !!note && note.deletedAt === null && isCompleteLocalNote(note)
      && (staged ? staged.status === 'STAGED' && staged.isCurrent() : findAttachmentReferencesInText(note.body).includes(attachmentId));
  };
  try {
    if (!accountId || accountId !== accountId.trim() || !noteId || noteId !== noteId.trim()
      || attachmentReference(attachmentId) !== `attachment://${attachmentId}` || !current()) return denied('document_context_unavailable');
    const repo = input.repository ?? createLocalAttachmentMetadataRepository();
    const blobs = input.blobAdapter ?? createLocalAttachmentBlobAdapter();
    const metadata = structuredClone(await repo.getAttachment(attachmentId)) as AccountScopedAttachmentMetadata | null;
    if (!current()) return denied('document_context_stale');
    if (!metadata || metadata.id !== attachmentId || metadata.noteId !== noteId || metadata.accountId !== accountId
      || metadata.deletedAt !== null || metadata.syncStatus === 'deleted' || metadata.source !== 'local'
      || !Number.isSafeInteger(metadata.size) || metadata.size <= 0 || metadata.size > LOCAL_ATTACHMENT_FILE_MAX_BYTES
      || !metadata.localBlobKey
      || metadata.localBlobKey !== scopedAttachmentBlobKey({ accountId, attachmentId, namespace: 'local-document' })
      || !/^sha256:[a-f0-9]{64}$/.test(metadata.checksum ?? '')) return unavailable('document_metadata_mismatch');
    const snapshot = JSON.stringify(metadata);
    if (policy.kind === 'published' && snapshot !== policy.metadataSnapshot) return unavailable('document_candidate_changed');
    if (staged && (staged.reference !== attachmentReference(attachmentId)
      || JSON.stringify(staged.metadata) !== snapshot)) return denied('document_staging_mismatch');
    const record = await blobs.getBlob(metadata.localBlobKey);
    if (!current()) return denied('document_context_stale');
    if (!record || record.key !== metadata.localBlobKey || record.size !== metadata.size || record.blob.size !== metadata.size
      || record.mimeType !== metadata.mimeType || record.blob.type !== metadata.mimeType || record.checksum !== metadata.checksum) {
      return unavailable('document_blob_mismatch');
    }
    const file = new File([record.blob], metadata.fileName, { type: metadata.mimeType });
    if (admitLocalDocumentFile(file).status !== 'ELIGIBLE_BY_DECLARATION') return unavailable('document_declaration_rejected');
    const bytes = await file.arrayBuffer();
    const checksum = await checksumLocalAttachmentBytes(bytes);
    if (!current()) return denied('document_context_stale');
    if (bytes.byteLength !== metadata.size || !checksum || checksum !== metadata.checksum) return unavailable('document_integrity_mismatch');
    const latest = await repo.getAttachment(attachmentId);
    if (!current()) return denied('document_context_stale');
    if (JSON.stringify(latest) !== snapshot) return unavailable('document_metadata_changed');
    return Object.freeze({ status: 'VERIFIED', file, checksum, integrity: 'SHA256_MATCHED', formatIntegrity: 'UNVERIFIED' });
  } catch { return unavailable('document_original_unreadable'); }
}

/** Existing staged/document readback contract; isolation continues to deny it exactly as before. */
export function readLocalDocumentOriginal(input: ReadLocalDocumentInput): Promise<LocalDocumentReadback> {
  return readLocalDocumentOriginalCore(input, { kind: 'existing' });
}

function isPublishedLocalDocumentMetadata(
  metadata: AccountScopedAttachmentMetadata,
  accountId: string,
  noteId: string,
  referencedIds: ReadonlySet<string>,
): LocalDocumentFormat | null {
  if (typeof metadata.id !== 'string' || !referencedIds.has(metadata.id) || !isAttachmentReference(`attachment://${metadata.id}`)
    || attachmentMetadataAccountId(metadata) !== accountId || metadata.accountId !== accountId || metadata.noteId !== noteId
    || metadata.deletedAt !== null || metadata.syncStatus === 'deleted' || metadata.source !== 'local'
    || metadata.localBlobKey !== scopedAttachmentBlobKey({ accountId, attachmentId: metadata.id, namespace: 'local-document' })
    || !/^sha256:[a-f0-9]{64}$/.test(metadata.checksum ?? '')) return null;
  const declaration = admitLocalDocumentDeclaration({ name: metadata.fileName, type: metadata.mimeType, size: metadata.size });
  return declaration.status === 'ELIGIBLE_BY_DECLARATION' ? declaration.format : null;
}

/**
 * Lists only declared local PDF/DOCX records referenced by the exact current Note.
 * This read-only path intentionally remains available during attachment write isolation.
 */
export async function listPublishedLocalDocumentOriginals(input: {
  accountId: string;
  noteId: string;
  repository?: AttachmentRepository;
}): Promise<PublishedLocalDocumentOriginalList> {
  const denied = (reason: string): PublishedLocalDocumentOriginalList => Object.freeze({ status: 'DENIED', reason });
  const unavailable = (reason: string): PublishedLocalDocumentOriginalList => Object.freeze({ status: 'UNAVAILABLE', reason });
  const observation = observePublishedNotesHydration();
  const store = useNotesStore.getState();
  const request = observation.status === 'CURRENT' ? observation.request : null;
  const note = store.notes.find(item => item.id === input.noteId);
  const current = () => {
    const latest = observePublishedNotesHydration(), currentStore = useNotesStore.getState();
    return request !== null && latest.status === 'CURRENT' && latest.request === request
      && request.accountId === input.accountId && currentStore.activeAccountId === input.accountId
      && currentStore.activeNoteId === input.noteId && currentStore.notes.filter(item => item.id === input.noteId).length === 1
      && currentStore.notes.find(item => item.id === input.noteId) === note && !!note && note.deletedAt === null
      && isCompleteLocalNote(note);
  };
  if (!input.accountId || input.accountId !== input.accountId.trim() || !input.noteId || input.noteId !== input.noteId.trim()
    || !request || !note || !current()) {
    return denied('document_context_unavailable');
  }
  const referencedIds = findAttachmentReferencesInText(note.body);
  if (referencedIds.length === 0) return Object.freeze({ status: 'VERIFIED', documents: Object.freeze([]) });
  try {
    const repository = input.repository ?? createLocalAttachmentMetadataRepository();
    if (!repository.listAttachmentsForAccountNote) return unavailable('document_metadata_unavailable');
    const records = await repository.listAttachmentsForAccountNote(input.accountId, input.noteId);
    if (!current()) return denied('document_context_stale');
    const referencedIdSet = new Set(referencedIds);
    const byId = new Map<string, AccountScopedAttachmentMetadata[]>();
    for (const metadata of records) {
      if (!referencedIdSet.has(metadata.id)) continue;
      const group = byId.get(metadata.id) ?? [];
      group.push(structuredClone(metadata));
      byId.set(metadata.id, group);
    }
    const documents: PublishedLocalDocumentOriginal[] = [];
    for (const attachmentId of referencedIds) {
      const group = byId.get(attachmentId);
      if (!group || group.length !== 1) continue;
      const metadata = group[0]!;
      const format = isPublishedLocalDocumentMetadata(metadata, input.accountId, input.noteId, referencedIdSet);
      if (!format) continue;
      documents.push(Object.freeze({
        attachmentId,
        fileName: metadata.fileName,
        mimeType: metadata.mimeType,
        size: metadata.size,
        format,
        metadataSnapshot: JSON.stringify(metadata),
        request,
      }));
    }
    if (!current()) return denied('document_context_stale');
    return Object.freeze({ status: 'VERIFIED', documents: Object.freeze(documents) });
  } catch { return unavailable('document_metadata_unavailable'); }
}

/** Point-in-time read for one listed candidate; never accepts a staging receipt. */
export function readPublishedLocalDocumentOriginal(input: {
  accountId: string;
  noteId: string;
  candidate: PublishedLocalDocumentOriginal;
  repository?: AttachmentRepository;
  blobAdapter?: BlobStorageAdapter;
}): Promise<LocalDocumentReadback> {
  const { candidate } = input;
  if (!candidate || candidate.request?.accountId !== input.accountId || !candidate.metadataSnapshot) {
    return Promise.resolve(Object.freeze({ status: 'DENIED', reason: 'document_candidate_invalid' }));
  }
  return readLocalDocumentOriginalCore({
    accountId: input.accountId,
    noteId: input.noteId,
    attachmentId: candidate.attachmentId,
    repository: input.repository,
    blobAdapter: input.blobAdapter,
  }, { kind: 'published', request: candidate.request, metadataSnapshot: candidate.metadataSnapshot });
}
