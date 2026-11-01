import JSZip from 'jszip';
import { observePublishedNotesHydration, useNotesStore } from '../store/useNotesStore';
import { createLocalAttachmentMetadataRepository } from './attachmentMetadataIndexedDb';
import { createLocalAttachmentBlobAdapter } from './attachmentBlobIndexedDb';
import { findAttachmentReferencesInText, isAttachmentReference, type AccountScopedAttachmentMetadata, type AttachmentRepository, type BlobStorageAdapter } from './attachmentRepository';
import { localAttachmentBlobKey, LOCAL_IMAGE_ATTACHMENT_MAX_BYTES, SUPPORTED_LOCAL_IMAGE_TYPES } from './localImageAttachments';
import { scopedAttachmentBlobKey } from './attachmentScopedCreate';
import { admitLocalDocumentFile } from './localDocumentAttachmentAdmission';
import { isCompleteLocalNote } from './notesBootstrapAuthority';

// Deliberately bounded, separate from Vault backup/restore and its success markers.
export const LOCAL_ORIGINALS_MAX_RECORDS = 500;
export const LOCAL_ORIGINALS_MAX_BYTES = 100 * 1024 * 1024;
export type OriginalExportReason = 'included' | 'unproven_ownership' | 'unavailable_note' | 'deleted_metadata'
  | 'unsupported_source_or_type' | 'missing_blob' | 'unreadable_blob' | 'size_mismatch'
  | 'checksum_mismatch' | 'checksum_unverifiable' | 'type_mismatch' | 'size_limit' | 'metadata_unavailable' | 'unreferenced_document';
export interface OriginalExportEntry { readonly name: string; readonly reason: OriginalExportReason; readonly path?: string; readonly integrity?: 'sha256' | 'size_only' }
export interface OriginalExportReport {
  readonly entries: readonly OriginalExportEntry[];
  readonly included: number;
  readonly excluded: number;
  readonly bytes: number;
  readonly coverage: 'complete_for_preflight' | 'partial';
}
interface OriginalFile { path: string; bytes: Uint8Array }
interface ExportDeps {
  repository: Pick<AttachmentRepository, 'listAttachmentsForAccount'>;
  blobs: Pick<BlobStorageAdapter, 'getBlob'>;
  buildZip?: (files: readonly OriginalFile[], report: OriginalExportReport) => Promise<Blob>;
  download?: (blob: Blob, isCurrent: () => boolean) => void;
}

function safeName(value: string): string {
  const name = value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069/\\:*?"<>|]/g, '-')
    .replace(/\.{2,}/g, '-').replace(/^[.\s]+|[.\s]+$/g, '').slice(0, 100);
  return name && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? name : 'attachment';
}

export function localOriginalsCoverageText(report: OriginalExportReport): string {
  return [
    'Absinthe — Local Notes attachment originals export',
    `Coverage: ${report.coverage}. Included: ${report.included}. Excluded: ${report.excluded}. Bytes: ${report.bytes}.`,
    'Scope: inspected current-account attachment metadata and references on active published Notes only.',
    'Only account-proven local image and PDF/DOCX originals are supported. Legacy unscoped storage is not scanned or attributed.',
    'PDF/DOCX require an exact reference on their complete active owning Note and matched SHA-256. Unreferenced/staged-only documents are excluded, not deleted.',
    'Complete means all candidates in this bounded preflight were included, NOT a complete attachment backup.',
    'No remote recovery was attempted. Existing Vault ZIP/JSON do not contain original attachment bytes.',
    'This separate ZIP is not a Vault restore package and does not enable attachment restoration.',
    'sha256 = matched metadata checksum; size_only = size checked, no cryptographic integrity claim.',
    'Document SHA-256 proves matched bytes, not document structure or safety. Document size-only export is not supported.',
    '',
    ...report.entries.map(entry => `${entry.reason}\t${entry.name}${entry.path ? `\t${entry.path}\t${entry.integrity}` : ''}`),
  ].join('\n');
}

async function buildZip(files: readonly OriginalFile[], report: OriginalExportReport): Promise<Blob> {
  const zip = new JSZip();
  zip.file('COVERAGE.txt', localOriginalsCoverageText(report));
  for (const file of files) zip.file(file.path, file.bytes);
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
  return new Blob([bytes], { type: 'application/zip' });
}

function downloadZip(blob: Blob, isCurrent: () => boolean): void {
  if (!isCurrent()) throw new Error('local_originals_cancelled');
  const url = URL.createObjectURL(blob);
  try {
    if (!isCurrent()) throw new Error('local_originals_cancelled');
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'absinthe-local-note-originals.zip';
    anchor.click();
  } finally { URL.revokeObjectURL(url); }
}

/** A read-only view of existing authority, never a new read/write permit. */
export function createLocalOriginalsExport(
  accountId: string | null,
  isAccountCurrent: () => boolean,
  deps: ExportDeps = { repository: createLocalAttachmentMetadataRepository(), blobs: createLocalAttachmentBlobAdapter() },
) {
  const observation = observePublishedNotesHydration();
  if (!accountId || observation.status !== 'CURRENT' || observation.request.accountId !== accountId || !isAccountCurrent()) {
    throw new Error('local_originals_authority_unavailable');
  }
  const request = observation.request;
  const notes = useNotesStore.getState().notes;
  let live = true;
  let files: OriginalFile[] = [];
  let report: OriginalExportReport | null = null;
  let started = false;
  let downloading = false;
  const documentSnapshots = new Map<string, string>();
  const snapshot = (item: AccountScopedAttachmentMetadata) => ({
    id: item.id, accountId: item.accountId, noteId: item.noteId, fileName: item.fileName, mimeType: item.mimeType,
    source: item.source, deletedAt: item.deletedAt, syncStatus: item.syncStatus, localBlobKey: item.localBlobKey,
    size: item.size, checksum: item.checksum,
  });
  let unsubscribe = () => {};
  const cancel = () => { live = false; files = []; report = null; documentSnapshots.clear(); unsubscribe(); };
  const isCurrent = () => {
    const current = observePublishedNotesHydration();
    return live && isAccountCurrent() && current.status === 'CURRENT' && current.request === request
      && useNotesStore.getState().notes === notes;
  };
  const assertCurrent = () => {
    if (!isCurrent()) { cancel(); throw new Error('local_originals_cancelled'); }
  };
  unsubscribe = useNotesStore.subscribe(() => { if (!isCurrent()) cancel(); });
  // Keep the existing account-scoped read boundary; never manufacture a staging receipt or an active Note.
  const assertDocumentsCurrent = async () => {
    assertCurrent();
    if (!documentSnapshots.size) return;
    const latest = await deps.repository.listAttachmentsForAccount!(accountId);
    assertCurrent();
    if (latest.length > LOCAL_ORIGINALS_MAX_RECORDS) throw new Error('local_originals_metadata_changed');
    for (const [id, expected] of documentSnapshots) {
      const matches = latest.filter(item => item.id === id);
      if (matches.length !== 1 || JSON.stringify(snapshot(matches[0])) !== expected) throw new Error('local_originals_metadata_changed');
    }
  };

  const preflight = async (): Promise<OriginalExportReport> => {
    if (started) throw new Error('local_originals_already_started');
    started = true;
    try {
      assertCurrent();
      if (notes.length > 2000 || !deps.repository.listAttachmentsForAccount) throw new Error('local_originals_preflight_unavailable');
      const records = await deps.repository.listAttachmentsForAccount(accountId);
      assertCurrent();
      if (records.length > LOCAL_ORIGINALS_MAX_RECORDS) throw new Error('local_originals_size_limit');
      const activeIds = new Set(notes.filter(note => !note.deletedAt).map(note => note.id));
      const refs = new Set(notes.filter(note => !note.deletedAt).flatMap(note => findAttachmentReferencesInText(note.body)));
      if (refs.size > LOCAL_ORIGINALS_MAX_RECORDS) throw new Error('local_originals_size_limit');
      // Capture scalar metadata before any further await; never keep caller-owned records as permits.
      const metadata = records.map(snapshot);
      const entries: OriginalExportEntry[] = [];
      const seen = new Set<string>();
      let totalBytes = 0;
      let readBytes = 0;
      for (const item of metadata) {
        assertCurrent();
        const own = item.accountId === accountId;
        const name = own ? safeName(item.fileName) : 'Unproven record';
        const document = item.localBlobKey?.startsWith('local-document/') === true;
        const expectedKey = document ? scopedAttachmentBlobKey({ accountId, attachmentId: item.id, namespace: 'local-document' })
          : localAttachmentBlobKey(accountId, item.id);
        const owningNotes = document ? notes.filter(note => note.id === item.noteId) : [];
        let reason: OriginalExportReason | null = null;
        if (!own || !isAttachmentReference(`attachment://${item.id}`) || seen.has(item.id)
          || item.localBlobKey !== expectedKey || (document && metadata.filter(record => record.id === item.id).length !== 1)) reason = 'unproven_ownership';
        else if (!item.noteId || !activeIds.has(item.noteId) || (document && (owningNotes.length !== 1
          || owningNotes[0].deletedAt !== null || !isCompleteLocalNote(owningNotes[0])))) reason = 'unavailable_note';
        else if (item.deletedAt || (document && item.deletedAt !== null) || item.syncStatus === 'deleted') reason = 'deleted_metadata';
        else if (item.source !== 'local' || (!document && !SUPPORTED_LOCAL_IMAGE_TYPES.has(item.mimeType))) reason = 'unsupported_source_or_type';
        else if (document && !findAttachmentReferencesInText(owningNotes[0].body).includes(item.id)) reason = 'unreferenced_document';
        else if (!Number.isSafeInteger(item.size) || item.size <= 0 || item.size > LOCAL_IMAGE_ATTACHMENT_MAX_BYTES
          || readBytes + item.size > LOCAL_ORIGINALS_MAX_BYTES) reason = 'size_limit';
        if (own) { seen.add(item.id); refs.delete(item.id); }
        if (reason) { entries.push({ name, reason }); continue; }
        readBytes += item.size;
        try {
          const record = await deps.blobs.getBlob(item.localBlobKey!);
          assertCurrent();
          if (!record) reason = 'missing_blob';
          else if (record.key !== item.localBlobKey) reason = 'unproven_ownership';
          else if (record.blob.size !== item.size || record.size !== item.size) reason = 'size_mismatch';
          else if (((document || record.mimeType) && record.mimeType !== item.mimeType)
            || ((document || record.blob.type) && record.blob.type !== item.mimeType)) reason = 'type_mismatch';
          if (reason || !record) { entries.push({ name, reason: reason ?? 'missing_blob' }); continue; }
          const admission = document ? admitLocalDocumentFile(new File([record.blob], item.fileName, { type: item.mimeType })) : null;
          if (admission?.status === 'REJECTED') { entries.push({ name, reason: 'unsupported_source_or_type' }); continue; }
          const bytes = new Uint8Array(await record.blob.arrayBuffer());
          assertCurrent();
          if (bytes.byteLength !== item.size) { entries.push({ name, reason: 'size_mismatch' }); continue; }
          const checksums = [item.checksum, record.checksum].filter((value): value is string => value !== undefined);
          const expectedChecksum = checksums[0];
          // An explicitly supplied empty/invalid value must not suppress the other source's checksum.
          if ((document && (!item.checksum || !record.checksum))
            || checksums.some(value => typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$/i.test(value))) reason = 'checksum_unverifiable';
          else if (checksums.length === 2 && checksums[0].toLowerCase() !== checksums[1].toLowerCase()) reason = 'checksum_mismatch';
          if (!reason && expectedChecksum) {
            if (!globalThis.crypto?.subtle) reason = 'checksum_unverifiable';
            else {
              const digest = await crypto.subtle.digest('SHA-256', bytes);
              assertCurrent();
              const checksum = 'sha256:' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
              if (checksum !== expectedChecksum.toLowerCase()) reason = 'checksum_mismatch';
            }
          }
          if (reason) { entries.push({ name, reason }); continue; }
          const ext = admission?.status === 'ELIGIBLE_BY_DECLARATION' ? admission.format
            : item.mimeType === 'image/jpeg' ? 'jpg' : item.mimeType.slice(6);
          const base = name.replace(document ? /\.(pdf|docx)$/i : /\.(png|jpe?g|webp|gif)$/i, '');
          const path = `originals/${String(files.length + 1).padStart(6, '0')}-${base || 'attachment'}.${ext}`;
          files.push({ path, bytes });
          totalBytes += bytes.byteLength;
          entries.push({ name, path, reason: 'included', integrity: expectedChecksum ? 'sha256' : 'size_only' });
          if (document) documentSnapshots.set(item.id, JSON.stringify(item));
        } catch {
          assertCurrent();
          entries.push({ name, reason: 'unreadable_blob' });
        }
      }
      for (const _id of refs) entries.push({ name: 'Unresolved active-Note attachment reference', reason: 'metadata_unavailable' });
      await assertDocumentsCurrent();
      assertCurrent();
      report = Object.freeze({ entries: Object.freeze(entries.map(entry => Object.freeze(entry))), included: files.length,
        excluded: entries.length - files.length, bytes: totalBytes,
        coverage: entries.length === files.length ? 'complete_for_preflight' : 'partial' });
      return report;
    } catch (error) { cancel(); throw error; }
  };
  const download = async (allowPartial = false): Promise<void> => {
    assertCurrent();
    if (!report || !files.length || downloading || (report.coverage === 'partial' && !allowPartial)) throw new Error('local_originals_confirmation_required');
    downloading = true;
    try {
      await assertDocumentsCurrent();
      assertCurrent();
      const blob = await (deps.buildZip ?? buildZip)(files, report);
      await assertDocumentsCurrent();
      assertCurrent();
      (deps.download ?? downloadZip)(blob, isCurrent);
    } finally { cancel(); }
  };
  return { preflight, download, cancel, isCurrent };
}

export type LocalOriginalsExport = ReturnType<typeof createLocalOriginalsExport>;
