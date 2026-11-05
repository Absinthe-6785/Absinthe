import type { AccountScopedAttachmentMetadata, AttachmentRepository, BlobStorageAdapter, ScopedAttachmentBackupResult, ScopedAttachmentBackupTransition } from './attachmentRepository';
import type { AttachmentUploadOutcome } from './attachmentExplicitUploadAction';
import { GoogleDriveBlobUploadError } from './googleDriveBlobAdapter';
import { consumeGoogleDriveOriginalExecutionAuthority, type GoogleDriveOriginalExecutionAuthority } from './googleDriveOriginalExecutionAuthority';
import type { createGoogleDriveSessionRuntime } from './googleDriveSessionRuntime';
import { readPublishedLocalDocumentOriginal, type PublishedLocalDocumentOriginal } from './localDocumentAttachments';
import { checksumLocalAttachmentBytes } from './localImageAttachments';

type CasStatus = ScopedAttachmentBackupResult['status'];
export type SingleOriginalBackupResult = Readonly<{
  status: 'DENIED' | 'NOT_STARTED' | 'NOT_COMPLETED' | 'INDETERMINATE' | 'VERIFIED_AND_RECORDED';
  /** Byte equality at readback time, NOT durability, retention, or restore proof. */
  outcome?: AttachmentUploadOutcome;
  reservation?: CasStatus;
  receipt?: CasStatus;
  /** Local cancellation cannot establish that an already-started remote write had no effect. */
  remoteEffect: 'NOT_STARTED' | 'POSSIBLE' | 'KNOWN_FILE';
}>;

/** No production driver, token getter, UI, queue, or default provider is exposed. */
interface CoordinatorOptions {
  repository: AttachmentRepository;
  blobAdapter: BlobStorageAdapter;
  runtime: Pick<ReturnType<typeof createGoogleDriveSessionRuntime>, 'prepareSingleOriginalBackupForTests'>;
  now?: () => Date;
}

/**
 * Inactive 01B integration seam. It runs only in test mode AND with the existing
 * isolation opt-out. A future production executor needs separate release/QA approval.
 */
export function createInactiveSingleOriginalBackupCoordinator(options: CoordinatorOptions) {
  const { repository, blobAdapter, runtime } = options;
  const timestamp = () => (options.now?.() ?? new Date()).toISOString();
  const closed = (): SingleOriginalBackupResult => Object.freeze({ status: 'DENIED', remoteEffect: 'NOT_STARTED' });

  return {
    /** Preparation verifies the original; it never reserves or uploads. Execution still requires this opaque permit. */
    confirmSelection(input: { accountId: string; noteId: string; candidate: PublishedLocalDocumentOriginal; confirmed: true }) {
      return runtime.prepareSingleOriginalBackupForTests({ ...input, repository, blobAdapter });
    },

    async execute(confirmation: GoogleDriveOriginalExecutionAuthority): Promise<SingleOriginalBackupResult> {
      const context = consumeGoogleDriveOriginalExecutionAuthority(confirmation, repository, blobAdapter);
      if (!context || !context.current()) return closed();
      const run = async (): Promise<SingleOriginalBackupResult> => {
        const { accountId, noteId, candidate, current } = context;
        let reservation: CasStatus | undefined;
        let remoteEffect: SingleOriginalBackupResult['remoteEffect'] = 'NOT_STARTED';
        const result = (status: SingleOriginalBackupResult['status'], outcome?: AttachmentUploadOutcome, receipt?: CasStatus): SingleOriginalBackupResult =>
          Object.freeze({ status, ...(outcome ? { outcome } : {}), ...(reservation ? { reservation } : {}), ...(receipt ? { receipt } : {}), remoteEffect });
        const cas = repository.transitionBackupForAccountNote!;
        let reserved: AccountScopedAttachmentMetadata;
        let localChecksum: string;
        let localFile: File;
        const finish = async (outcome: AttachmentUploadOutcome, remoteFileId?: string): Promise<SingleOriginalBackupResult> => {
          if (!current()) return result('INDETERMINATE', outcome);
          if (outcome === 'verified_remote_content' && !await context.verifySourceForReceipt()) return result('INDETERMINATE', outcome);
          if (!current()) return result('INDETERMINATE', outcome);
          let receipt: CasStatus;
          try {
            const at = timestamp();
            const transition: ScopedAttachmentBackupTransition = outcome === 'verified_remote_content'
              ? { kind: 'finish', at, outcome, remoteFileId: remoteFileId!, checksum: localChecksum, size: localFile.size }
              : { kind: 'finish', at, outcome, ...(remoteFileId ? { remoteFileId } : {}) };
            receipt = (await cas.call(repository, { accountId, noteId, request: candidate.request, expected: reserved, isCurrent: current, transition })).status;
          } catch { receipt = 'INDETERMINATE'; }
          if (!current()) return result('INDETERMINATE', outcome, receipt);
          return result(outcome === 'verified_remote_content' && receipt === 'COMMITTED'
            ? 'VERIFIED_AND_RECORDED' : 'NOT_COMPLETED', outcome, receipt);
        };

        try {
          const local = await readPublishedLocalDocumentOriginal({ accountId, noteId, candidate, repository, blobAdapter });
          if (!current() || local.status !== 'VERIFIED') return result('NOT_STARTED');
          const expected = JSON.parse(candidate.metadataSnapshot) as AccountScopedAttachmentMetadata;
          if (expected.id !== candidate.attachmentId || expected.accountId !== accountId || expected.noteId !== noteId
            || expected.fileName !== candidate.fileName || expected.mimeType !== candidate.mimeType || expected.size !== candidate.size
            || local.checksum !== expected.checksum) return result('NOT_STARTED');
          const at = timestamp();
          try {
            reservation = (await cas.call(repository, { accountId, noteId, request: candidate.request, expected,
              isCurrent: current, transition: { kind: 'reserve', at } })).status;
          } catch { reservation = 'INDETERMINATE'; }
          if (reservation !== 'COMMITTED') return result(reservation === 'INDETERMINATE' ? 'INDETERMINATE' : 'NOT_STARTED');
          if (!current()) return result('NOT_COMPLETED');
          // Read the actual committed reservation; never use the original candidate for terminal CAS.
          const expectedReserved = { ...expected, remoteProvider: 'googleDrive', remoteSyncStatus: 'uploading',
            remoteSyncAttemptCount: 1, lastRemoteSyncAttemptAt: at, updatedAt: at };
          const stored = await repository.getAttachment(candidate.attachmentId);
          if (!current() || JSON.stringify(stored) !== JSON.stringify(expectedReserved)) return result('NOT_COMPLETED');
          reserved = structuredClone(stored) as AccountScopedAttachmentMetadata;
          const reservedCandidate = Object.freeze({ ...candidate, metadataSnapshot: JSON.stringify(reserved) });
          const reread = await readPublishedLocalDocumentOriginal({ accountId, noteId, candidate: reservedCandidate, repository, blobAdapter });
          if (!current()) return result('NOT_COMPLETED');
          if (reread.status !== 'VERIFIED' || reread.checksum !== local.checksum) return finish('definitive_failure');
          localFile = reread.file; localChecksum = reread.checksum;
          const latest = await repository.getAttachment(candidate.attachmentId);
          if (!current() || JSON.stringify(latest) !== JSON.stringify(reserved)) return result('NOT_COMPLETED');
        } catch { return result(reservation === 'COMMITTED' ? 'NOT_COMPLETED' : 'NOT_STARTED'); }

        let remoteFileId: string;
        try {
          // No await between the final currentness/snapshot check and dispatch of this one upload.
          remoteEffect = 'POSSIBLE';
          const upload = await context.upload(reserved);
          if (!current()) return result('INDETERMINATE', 'indeterminate');
          if (upload.providerType !== 'googleDrive' || upload.remoteProvider !== undefined && upload.remoteProvider !== 'googleDrive'
            || upload.attachmentId !== candidate.attachmentId || typeof upload.remoteFileId !== 'string'
            || !/^[A-Za-z0-9_-]{1,256}$/.test(upload.remoteFileId)) return finish('indeterminate');
          remoteFileId = upload.remoteFileId;
          remoteEffect = 'KNOWN_FILE';
        } catch (error) {
          return finish(error instanceof GoogleDriveBlobUploadError && error.uploadOutcome === 'definitive_failure'
            ? 'definitive_failure' : 'indeterminate');
        }

        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const verified = await Promise.race([
            (async () => {
              const download = await context.download();
              if (!current()) return null;
              if (!(download instanceof Blob) && (download.providerType !== 'googleDrive'
                || download.remoteFileId !== remoteFileId)) return null;
              const blob = download instanceof Blob ? download : download.blob;
              const checksum = await checksumLocalAttachmentBytes(await blob.arrayBuffer());
              if (!current() || !checksum) return null;
              return blob.size === localFile.size && checksum === localChecksum;
            })(),
            new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('readback_timeout')), 30_000); }),
          ]);
          return finish(verified === null ? 'verification_unavailable' : verified ? 'verified_remote_content' : 'definitive_failure', remoteFileId);
        } catch { return finish('verification_unavailable', remoteFileId); }
        finally { clearTimeout(timer); }
      };
      try { return await run(); }
      finally { context.revoke(); }
    },
  };
}
