import type { AccountScopedAttachmentMetadata, AttachmentRepository, BlobStorageAdapter } from './attachmentRepository';
import { findAttachmentReferencesInText } from './attachmentRepository';
import { GoogleDriveBlobAdapter } from './googleDriveBlobAdapter';
import type { GoogleDriveAccessTokenProvider } from './googleDriveConnectionBoundary';
import { readPublishedLocalDocumentOriginal, type PublishedLocalDocumentOriginal } from './localDocumentAttachments';
import { getActiveNotesAuthorityRequest, isNotesAuthorityRequestActive } from './notesAccountAuthority';
import { isCompleteLocalNote } from './notesBootstrapAuthority';
import { isReturnToUseAttachmentIsolationEnabled } from './returnToUseAttachmentIsolation';
import { observePublishedNotesHydration, useNotesStore } from '../store/useNotesStore';

/** Opaque, memory-only permit: neither credentials nor an upload-capable adapter. */
export interface GoogleDriveOriginalExecutionAuthority { readonly revoke: () => void }
export interface OriginalExecutionSelection {
  accountId: string;
  noteId: string;
  candidate: PublishedLocalDocumentOriginal;
  confirmed: true;
  repository: AttachmentRepository;
  blobAdapter: BlobStorageAdapter;
}
type Operation = {
  accountId: string;
  noteId: string;
  candidate: PublishedLocalDocumentOriginal;
  current: () => boolean;
  revoke: () => void;
  verifySourceForReceipt: () => Promise<boolean>;
  upload: (reserved: AccountScopedAttachmentMetadata) => ReturnType<GoogleDriveBlobAdapter['uploadBlob']>;
  download: () => ReturnType<GoogleDriveBlobAdapter['downloadBlob']>;
};
const permits = new WeakMap<GoogleDriveOriginalExecutionAuthority, Operation>();

/** Synchronous consumption precedes all coordinator I/O. Copies/foreign objects are not permits. */
export function consumeGoogleDriveOriginalExecutionAuthority(permit: GoogleDriveOriginalExecutionAuthority,
  repository: AttachmentRepository, blobAdapter: BlobStorageAdapter) {
  const operation = permits.get(permit);
  permits.delete(permit);
  // A permit may only be consumed by the repositories it verified, not replacement test drivers.
  const owned = stores.get(permit);
  stores.delete(permit);
  if (operation?.current() && owned?.repository === repository && owned.blobAdapter === blobAdapter) return operation;
  operation?.revoke();
  return null;
}
const stores = new WeakMap<GoogleDriveOriginalExecutionAuthority, Pick<OriginalExecutionSelection, 'repository' | 'blobAdapter'>>();

/** Private runtime seam. Only deterministic test transport can issue a permit in this task. */
export async function prepareGoogleDriveOriginalExecutionAuthorityForTests(input: OriginalExecutionSelection, session: {
  accountId: string;
  generation: number;
  isCurrent: () => boolean;
  getPrivateTokenProvider: () => GoogleDriveAccessTokenProvider | null;
  onRevoke: (listener: () => void) => () => void;
  fetcher: typeof fetch;
}): Promise<GoogleDriveOriginalExecutionAuthority | null> {
  let retire = () => {};
  let issued = false;
  try {
    const { accountId, noteId, confirmed, repository, blobAdapter } = input;
    const candidate = Object.freeze({ ...input.candidate });
    const tokenProvider = session.getPrivateTokenProvider();
    const note = useNotesStore.getState().notes.find(item => item.id === noteId);
    let revoked = false;
    let unsubscribe = () => {};
    let unsubscribeSession = () => {};
    const revoke = () => { revoked = true; unsubscribe(); unsubscribeSession(); unsubscribe = () => {}; unsubscribeSession = () => {}; };
    retire = revoke;
    const scopeCurrent = () => {
      const observation = observePublishedNotesHydration(), store = useNotesStore.getState();
      return !revoked && import.meta.env.MODE === 'test' && !isReturnToUseAttachmentIsolationEnabled()
        && confirmed === true && !!accountId && accountId === accountId.trim() && !!noteId && noteId === noteId.trim()
        && session.accountId === accountId && Number.isSafeInteger(session.generation) && session.isCurrent()
        && !!tokenProvider && session.getPrivateTokenProvider() === tokenProvider
        && observation.status === 'CURRENT' && observation.request === candidate.request
        && candidate.request.accountId === accountId && getActiveNotesAuthorityRequest() === candidate.request
        && isNotesAuthorityRequestActive(candidate.request) && store.activeAccountId === accountId
        && store.activeNoteId === noteId && store.notes.filter(item => item.id === noteId).length === 1
        && !!note && store.notes.find(item => item.id === noteId) === note && note.deletedAt === null
        && isCompleteLocalNote(note) && findAttachmentReferencesInText(note.body).includes(candidate.attachmentId);
    };
    const current = () => { try { if (scopeCurrent()) return true; } catch { /* fail closed */ } revoke(); return false; };
    if (!current() || !repository.transitionBackupForAccountNote) return null;
    // Observe transient Note switches/edits too; switching back must not revive an old permit.
    unsubscribe = useNotesStore.subscribe(() => { current(); });
    unsubscribeSession = session.onRevoke(revoke);
    if (!current()) return null;
    const source = await readPublishedLocalDocumentOriginal({ accountId, noteId, candidate, repository, blobAdapter });
    if (!current() || source.status !== 'VERIFIED') return null;
    const expected = JSON.parse(candidate.metadataSnapshot) as AccountScopedAttachmentMetadata;
    if (expected.id !== candidate.attachmentId || expected.accountId !== accountId || expected.noteId !== noteId
      || expected.fileName !== candidate.fileName || expected.mimeType !== candidate.mimeType || expected.size !== candidate.size
      || source.checksum !== expected.checksum) return null;

    let reserved: AccountScopedAttachmentMetadata | undefined;
    let uploadStarted = false, downloadStarted = false;
    let remoteFileId: string | undefined;
    const sourceMatches = async () => {
      if (!reserved || !current()) return false;
      const checked = await readPublishedLocalDocumentOriginal({ accountId, noteId,
        candidate: { ...candidate, metadataSnapshot: JSON.stringify(reserved) }, repository, blobAdapter });
      return current() && checked.status === 'VERIFIED' && checked.checksum === source.checksum;
    };
    const provider = new GoogleDriveBlobAdapter({
      accessTokenProvider: { async getAccessToken() {
        if (!current()) throw new Error('backup_authority_revoked');
        const token = await tokenProvider!.getAccessToken();
        if (!current()) throw new Error('backup_authority_revoked');
        return token;
      } },
      async fetcher(url, init) {
        // Reuse the existing readback contract, including actual local SHA-256, before each HTTP dispatch.
        if (!await sourceMatches()) throw new Error('backup_source_changed');
        if (!current()) throw new Error('backup_authority_revoked');
        return session.fetcher(url, init); // No await between the final fence and dispatch.
      },
    });
    const permit = Object.freeze({ revoke });
    stores.set(permit, { repository, blobAdapter });
    permits.set(permit, Object.freeze({ accountId, noteId, candidate, current, revoke,
      async verifySourceForReceipt() {
        try { if (await sourceMatches()) return true; } catch { /* source unavailable is not verified */ }
        revoke();
        return false;
      },
      async upload(snapshot: AccountScopedAttachmentMetadata) {
        if (uploadStarted || !current()) throw new Error('backup_authority_consumed');
        uploadStarted = true;
        const allowed = { ...expected, remoteProvider: 'googleDrive', remoteSyncStatus: 'uploading',
          remoteSyncAttemptCount: 1, lastRemoteSyncAttemptAt: snapshot.updatedAt, updatedAt: snapshot.updatedAt };
        if (JSON.stringify(snapshot) !== JSON.stringify(allowed)) throw new Error('backup_reservation_mismatch');
        reserved = structuredClone(snapshot);
        const result = await provider.uploadBlob({ attachmentId: candidate.attachmentId, localBlobKey: reserved.localBlobKey,
          blob: source.file, fileName: source.file.name, mimeType: source.file.type, size: source.file.size, checksum: source.checksum });
        if (current() && result.attachmentId === candidate.attachmentId && typeof result.remoteFileId === 'string'
          && /^[A-Za-z0-9_-]{1,256}$/.test(result.remoteFileId)) remoteFileId = result.remoteFileId;
        return result;
      },
      async download() {
        if (downloadStarted || !remoteFileId || !current()) throw new Error('backup_readback_denied');
        downloadStarted = true;
        return provider.downloadBlob({ attachmentId: candidate.attachmentId, remoteFileId,
          expectedSize: source.file.size, expectedChecksum: source.checksum, expectedMimeType: source.file.type });
      },
    }));
    issued = true;
    return permit;
  } catch { return null; }
  finally { if (!issued) retire(); }
}
