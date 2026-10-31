import {
  attachmentReference,
  appendAttachmentReferenceToBody,
  type AccountScopedAttachmentMetadata,
  type AttachmentRepository,
  type BlobStorageAdapter,
  type AttachmentCreateStage,
} from './attachmentRepository';
import { observePublishedNotesHydration, useNotesStore } from '../store/useNotesStore';
import { isCompleteLocalNote } from './notesBootstrapAuthority';
import { createLocalAttachmentBlobAdapter } from './attachmentBlobIndexedDb';
import { createLocalAttachmentMetadataRepository } from './attachmentMetadataIndexedDb';
import {
  isReturnToUseAttachmentIsolationEnabled,
  returnToUseAttachmentIsolationError,
} from './returnToUseAttachmentIsolation';
import { LOCAL_ATTACHMENT_FILE_MAX_BYTES } from './localAttachmentFilePolicy';
import { admitLocalDocumentFile } from './localDocumentAttachmentAdmission';
import { scopedAttachmentBlobKey } from './attachmentScopedCreate';

export const SUPPORTED_LOCAL_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);
export const LOCAL_IMAGE_ATTACHMENT_MAX_BYTES = LOCAL_ATTACHMENT_FILE_MAX_BYTES;

export interface AttachLocalImageInput {
  accountId: string;
  noteId: string;
  file: File;
  currentBody: string;
  repository?: AttachmentRepository;
  blobAdapter?: BlobStorageAdapter;
  now?: () => string;
  idFactory?: () => string;
}

export interface AttachLocalImageResult {
  /** Both attachment stores committed; the Note body itself has NOT been persisted. */
  status: 'STAGED';
  isCurrent: () => boolean;
  metadata: AccountScopedAttachmentMetadata;
  body: string;
  reference: string;
}

export class LocalImageAttachmentWriteError extends Error {
  constructor(readonly lifecycle: Readonly<{ blob: AttachmentCreateStage; metadata: AttachmentCreateStage }>, reason: string) {
    super(reason);
    this.name = 'LocalImageAttachmentWriteError';
  }
}

export class LocalDocumentAttachmentWriteError extends LocalImageAttachmentWriteError {
  constructor(lifecycle: LocalImageAttachmentWriteError['lifecycle'], reason: string) {
    super(lifecycle, reason);
    this.name = 'LocalDocumentAttachmentWriteError';
  }
}

export function localAttachmentBlobKey(accountId: string, attachmentId: string): string {
  const normalizedAccountId = accountId.trim();
  if (!normalizedAccountId) throw new Error('Local attachment requires an account id');
  return `local-image/${encodeURIComponent(normalizedAccountId)}/${attachmentId}`;
}

function randomId(): string {
  const fromCrypto = globalThis.crypto?.randomUUID?.();
  if (fromCrypto) return `att-${fromCrypto}`;
  return `att-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function validateLocalImageFile(file: File): string | null {
  if (!SUPPORTED_LOCAL_IMAGE_TYPES.has(file.type)) return 'Unsupported image type';
  if (!Number.isFinite(file.size) || file.size <= 0) return 'Image file is empty';
  if (file.size > LOCAL_IMAGE_ATTACHMENT_MAX_BYTES) return 'Image file is too large';
  return null;
}

export async function checksumLocalAttachmentBytes(bytes: ArrayBuffer): Promise<string | undefined> {
  if (!globalThis.crypto?.subtle) return undefined;
  try {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    const hex = Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
    return `sha256:${hex}`;
  } catch {
    return undefined;
  }
}

export { appendAttachmentReferenceToBody } from './attachmentRepository';

export async function attachLocalImageToNote(input: AttachLocalImageInput): Promise<AttachLocalImageResult> {
  return stageLocalAttachmentToNote(input, 'image');
}

/** Shared existing create-only staging lifecycle. Neither branch persists a Note reference. */
export async function stageLocalAttachmentToNote(input: AttachLocalImageInput, kind: 'image' | 'document'): Promise<AttachLocalImageResult> {
  if (isReturnToUseAttachmentIsolationEnabled()) throw returnToUseAttachmentIsolationError();
  const { accountId, noteId, file, currentBody } = input;
  let blob: AttachmentCreateStage = 'NOT_STARTED', metadataStage: AttachmentCreateStage = 'NOT_STARTED';
  const fail = (reason: string): never => { throw new (kind === 'document' ? LocalDocumentAttachmentWriteError : LocalImageAttachmentWriteError)(Object.freeze({ blob, metadata: metadataStage }), reason); };
  const observation = observePublishedNotesHydration();
  const state = useNotesStore.getState();
  const note = state.notes.find(candidate => candidate.id === noteId);
  const request = observation.status === 'CURRENT' ? observation.request : null;
  const current = () => {
    const latest = observePublishedNotesHydration(), store = useNotesStore.getState();
    return !isReturnToUseAttachmentIsolationEnabled() && request !== null && latest.status === 'CURRENT'
      && latest.request === request && request.accountId === accountId && store.activeAccountId === accountId
      && store.activeNoteId === noteId && store.notes.find(item => item.id === noteId) === note
      && (kind === 'image' || store.notes.filter(item => item.id === noteId).length === 1)
      && !!note && note.deletedAt === null && isCompleteLocalNote(note) && note.body === currentBody;
  };
  if (!accountId || accountId !== accountId.trim() || !noteId || noteId !== noteId.trim() || !current()) {
    blob = 'DENIED'; return fail('attachment_creation_denied');
  }
  const admission = kind === 'document' ? admitLocalDocumentFile(file) : null;
  const validationError = admission?.status === 'REJECTED' ? admission.reason : kind === 'image' ? validateLocalImageFile(file) : null;
  if (validationError) return fail(validationError);
  const repository = input.repository ?? createLocalAttachmentMetadataRepository();
  const blobAdapter = input.blobAdapter ?? createLocalAttachmentBlobAdapter();
  if (!repository.createAttachmentForAccountNote || !blobAdapter.createBlobForAccountNote) return fail('attachment_scoped_creation_unavailable');
  const now = input.now ?? (() => new Date().toISOString());
  const id = input.idFactory?.() ?? randomId();
  const createdAt = now();
  let reference: string;
  try { reference = attachmentReference(id); } catch { return fail('attachment_creation_invalid_id'); }
  if (reference !== `attachment://${id}`) return fail('attachment_creation_invalid_id');
  const localBlobKey = kind === 'image' ? localAttachmentBlobKey(accountId, id)
    : scopedAttachmentBlobKey({ accountId, attachmentId: id, namespace: 'local-document' })!;
  let bytes: ArrayBuffer;
  try { bytes = await file.arrayBuffer(); } catch { return fail('attachment_bytes_unavailable'); }
  if (!current()) { blob = 'DENIED'; return fail('attachment_creation_stale'); }
  if (bytes.byteLength !== file.size) return fail('attachment_size_mismatch');
  const checksum = await checksumLocalAttachmentBytes(bytes);
  if (!current()) { blob = 'DENIED'; return fail('attachment_creation_stale'); }
  if (!checksum) return fail('attachment_checksum_unavailable');
  const context = Object.freeze({ accountId, noteId, attachmentId: id, request: request!, isCurrent: current,
    ...(kind === 'document' ? { namespace: 'local-document' as const } : {}) });
  try { blob = await blobAdapter.createBlobForAccountNote(context, { key: localBlobKey, blob: new Blob([bytes], { type: file.type }), mimeType: file.type, checksum }); }
  catch { blob = 'INDETERMINATE'; return fail('attachment_blob_outcome_unknown'); }
  if (blob !== 'COMMITTED') return fail('attachment_blob_not_committed');
  if (!current()) { metadataStage = 'DENIED'; return fail('attachment_creation_stale'); }

  const metadata: AccountScopedAttachmentMetadata = {
    id,
    accountId,
    noteId,
    fileName: file.name || `${id}.image`,
    mimeType: file.type,
    size: file.size,
    checksum,
    localBlobKey,
    ...(kind === 'image' ? { alt: file.name.replace(/\.[^.]+$/, '') || undefined } : {}),
    source: 'local',
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    syncStatus: 'local',
  };

  try { metadataStage = await repository.createAttachmentForAccountNote(context, metadata); }
  catch { metadataStage = 'INDETERMINATE'; return fail('attachment_metadata_outcome_unknown'); }
  if (metadataStage !== 'COMMITTED') return fail('attachment_metadata_not_committed');
  if (!current()) return fail('attachment_staged_but_context_expired');
  return Object.freeze({
    status: 'STAGED', isCurrent: current,
    metadata: Object.freeze(metadata),
    reference,
    body: appendAttachmentReferenceToBody(currentBody, reference),
  });
}
