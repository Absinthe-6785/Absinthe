import { attachmentReference, findAttachmentReferencesInText, type AccountScopedAttachmentMetadata, type AttachmentRepository, type BlobStorageAdapter } from './attachmentRepository';
import { scopedAttachmentBlobKey } from './attachmentScopedCreate';
import { admitLocalDocumentFile } from './localDocumentAttachmentAdmission';
import { LOCAL_ATTACHMENT_FILE_MAX_BYTES } from './localAttachmentFilePolicy';
import { stageLocalAttachmentToNote, checksumLocalAttachmentBytes, type AttachLocalImageInput, type AttachLocalImageResult } from './localImageAttachments';
import { createLocalAttachmentBlobAdapter } from './attachmentBlobIndexedDb';
import { createLocalAttachmentMetadataRepository } from './attachmentMetadataIndexedDb';
import { observePublishedNotesHydration, useNotesStore } from '../store/useNotesStore';
import { isCompleteLocalNote } from './notesBootstrapAuthority';
import { isReturnToUseAttachmentIsolationEnabled } from './returnToUseAttachmentIsolation';

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
export type LocalDocumentReadback =
  | Readonly<{ status: 'VERIFIED'; file: File; checksum: string; integrity: 'SHA256_MATCHED'; formatIntegrity: 'UNVERIFIED' }>
  | Readonly<{ status: 'DENIED' | 'UNAVAILABLE'; reason: string }>;

/** Bounded point-in-time local readback; no parsing, repair, remote access, or future-retention claim. */
export async function readLocalDocumentOriginal(input: ReadLocalDocumentInput): Promise<LocalDocumentReadback> {
  const { accountId, noteId, attachmentId, staged } = input;
  const denied = (reason: string): LocalDocumentReadback => Object.freeze({ status: 'DENIED', reason });
  const unavailable = (reason: string): LocalDocumentReadback => Object.freeze({ status: 'UNAVAILABLE', reason });
  const observation = observePublishedNotesHydration();
  const note = useNotesStore.getState().notes.find(item => item.id === noteId);
  const request = observation.status === 'CURRENT' ? observation.request : null;
  const current = () => {
    const latest = observePublishedNotesHydration(), store = useNotesStore.getState();
    return !isReturnToUseAttachmentIsolationEnabled() && request !== null && latest.status === 'CURRENT'
      && latest.request === request && request.accountId === accountId && store.activeAccountId === accountId
      && store.activeNoteId === noteId && store.notes.filter(item => item.id === noteId).length === 1
      && store.notes.find(item => item.id === noteId) === note && !!note && note.deletedAt === null && isCompleteLocalNote(note)
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
