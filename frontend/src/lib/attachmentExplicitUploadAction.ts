import type {
  AttachmentMetadata,
  AttachmentRepository,
  BlobStorageAdapter,
} from './attachmentRepository';
import {
  sanitizeRemoteBlobProviderError,
  type RemoteBlobProvider,
  type RemoteBlobProviderType,
  type RemoteBlobUploadResult,
  type RemoteBlobUploadVerification,
  type SanitizedRemoteBlobProviderError,
} from './remoteBlobProvider';
import { verifyAttachmentUploadResult } from './attachmentSyncQueue';
import { checksumLocalAttachmentBytes } from './localImageAttachments';

export type AttachmentUploadOutcome =
  | 'verified_remote_content' | 'definitive_failure'
  | 'indeterminate' | 'verification_unavailable';

export type AttachmentExplicitUploadStatus = 'uploaded' | 'blocked' | 'failed' | 'skipped';

export interface AttachmentExplicitUploadResult {
  readonly uploadId: string;
  readonly attachmentId: string;
  readonly localBlobKey?: string;
  readonly remoteProvider?: RemoteBlobProviderType;
  readonly remoteFileId?: string;
  readonly remoteSize?: number;
  readonly remoteChecksum?: string;
  readonly status: AttachmentExplicitUploadStatus;
  /** Point-in-time byte verification, not a restore or retention guarantee. */
  readonly outcome?: AttachmentUploadOutcome;
  readonly verification?: RemoteBlobUploadVerification;
  readonly error?: string;
  readonly errorDetails?: SanitizedRemoteBlobProviderError;
  readonly warnings?: string[];
  readonly startedAt: string;
  readonly completedAt: string;
}

export interface UploadAttachmentBlobToRemoteInput {
  readonly attachmentRepository: AttachmentRepository;
  readonly localBlobAdapter: BlobStorageAdapter;
  readonly remoteProvider: RemoteBlobProvider;
  readonly attachmentId: string;
  readonly now?: () => Date;
}

function nowIso(now?: () => Date): string {
  return (now ?? (() => new Date()))().toISOString();
}

function isDeleted(metadata: AttachmentMetadata): boolean {
  return Boolean(metadata.deletedAt) || metadata.syncStatus === 'deleted';
}

function hasSanitizedRemoteError(error: unknown): error is { readonly sanitized: SanitizedRemoteBlobProviderError } {
  if (!error || typeof error !== 'object' || !('sanitized' in error)) return false;
  const sanitized = (error as { readonly sanitized?: unknown }).sanitized;
  if (!sanitized || typeof sanitized !== 'object') return false;
  const value = sanitized as Partial<SanitizedRemoteBlobProviderError>;
  return typeof value.message === 'string'
    && typeof value.category === 'string'
    && typeof value.retryable === 'boolean';
}

function safeUploadError(error: unknown, code = 'attachment_upload_failed'): SanitizedRemoteBlobProviderError {
  if (hasSanitizedRemoteError(error)) {
    return sanitizeRemoteBlobProviderError(error.sanitized, { code: error.sanitized.code ?? code });
  }
  const sanitized = sanitizeRemoteBlobProviderError(error);
  if (sanitized.code || sanitized.category !== 'unknown' || sanitized.retryable) {
    return sanitized;
  }
  return sanitizeRemoteBlobProviderError(error, {
    category: 'upload',
    retryable: false,
    code,
  });
}

function blockedUploadStatus(metadata: AttachmentMetadata): string | null {
  if (isDeleted(metadata)) return 'Attachment is missing or deleted.';
  if (!metadata.localBlobKey) return 'Attachment has no local blob key.';
  if (metadata.remoteProvider && metadata.remoteProvider !== 'googleDrive') return 'Attachment remote provider does not match Google Drive.';
  if (metadata.remoteSyncStatus === 'synced' && metadata.remoteFileId) return 'Attachment is already synced.';
  if (metadata.remoteSyncStatus === 'pending_upload') return 'Attachment is reserved for queued upload.';
  if (metadata.remoteSyncStatus === 'uploading') return 'Attachment upload is already in progress.';
  if (metadata.remoteSyncStatus === 'failed') return 'Attachment upload state requires review.';
  if (metadata.remoteSyncStatus === 'paused_offline') return 'Attachment needs reconnect before upload.';
  if (metadata.remoteSyncStatus === 'conflict') return 'Attachment conflict requires review.';
  if (metadata.remoteSyncStatus === 'missing_local') return 'Attachment local blob is missing.';
  if (metadata.remoteSyncStatus === 'recoverable_remote') return 'Attachment recovery state requires review.';
  return null;
}

function assertUploadVerification(verification: RemoteBlobUploadVerification): void {
  if (!verification.sizeVerified) {
    throw new Error('Remote upload size verification failed.');
  }

  if (verification.checksumAlgorithm && !verification.checksumVerified) {
    throw new Error('Remote upload checksum verification failed.');
  }
}

function remoteSize(result: { readonly remoteSize?: number; readonly size?: number }): number | undefined {
  return result.remoteSize ?? result.size;
}

function remoteChecksum(result: { readonly remoteChecksum?: string; readonly checksum?: string }): string | undefined {
  return result.remoteChecksum ?? result.checksum;
}

export async function uploadAttachmentBlobToRemote(
  input: UploadAttachmentBlobToRemoteInput,
): Promise<AttachmentExplicitUploadResult> {
  const startedAt = nowIso(input.now);
  const uploadId = `attachment-upload:${input.attachmentId}:${startedAt}`;
  let failureCode = 'attachment_upload_failed';
  let completedUploadResult: RemoteBlobUploadResult | null = null;
  let completedUploadVerification: RemoteBlobUploadVerification | undefined;
  let outcome: AttachmentUploadOutcome = 'definitive_failure';
  const complete = (
    result: Omit<AttachmentExplicitUploadResult, 'uploadId' | 'startedAt' | 'completedAt'>,
  ): AttachmentExplicitUploadResult => {
    const errorDetails = result.errorDetails ?? (result.error ? safeUploadError(result.error, failureCode) : undefined);
    return {
      uploadId,
      startedAt,
      completedAt: nowIso(input.now),
      ...result,
      error: errorDetails?.message,
      errorDetails,
    };
  };

  const metadata = await input.attachmentRepository.getAttachment(input.attachmentId);
  if (!metadata) {
    return complete({
      attachmentId: input.attachmentId,
      status: 'skipped',
      error: 'Attachment is missing or deleted.',
    });
  }

  const blockedReason = blockedUploadStatus(metadata);
  if (blockedReason) {
    return complete({
      attachmentId: metadata.id,
      localBlobKey: metadata.localBlobKey,
      remoteProvider: metadata.remoteProvider,
      remoteFileId: metadata.remoteFileId,
      status: 'blocked',
      error: blockedReason,
    });
  }

  const localBlobKey = metadata.localBlobKey;
  if (!localBlobKey) {
    return complete({
      attachmentId: metadata.id,
      status: 'blocked',
      error: 'Attachment has no local blob key.',
    });
  }

  let blobRecord;
  try {
    failureCode = 'local_blob_unreadable';
    blobRecord = await input.localBlobAdapter.getBlob(localBlobKey);
  } catch (error) {
    return complete({
      attachmentId: metadata.id,
      localBlobKey,
      status: 'failed',
      errorDetails: safeUploadError(error, failureCode),
    });
  }

  if (!blobRecord) {
    return complete({
      attachmentId: metadata.id,
      localBlobKey,
      status: 'blocked',
      error: 'Local attachment blob is missing.',
    });
  }

  try {
    // Verify the actual immutable upload Blob, not only its metadata.
    const localChecksum = await checksumLocalAttachmentBytes(await blobRecord.blob.arrayBuffer());
    if (!localChecksum) {
      outcome = 'verification_unavailable';
      throw new Error('Local SHA-256 verification is unavailable; upload not started.');
    }
    if (blobRecord.blob.size !== metadata.size
      || (metadata.checksum?.startsWith('sha256:') && metadata.checksum !== localChecksum)) {
      throw new Error('Local original integrity verification failed; upload not started.');
    }
    failureCode = 'metadata_update_failed';
    await input.attachmentRepository.updateAttachment(metadata.id, {
      remoteProvider: input.remoteProvider.providerType,
      remoteSyncStatus: 'uploading',
      remoteError: undefined,
      lastRemoteSyncAttemptAt: startedAt,
      remoteSyncAttemptCount: (metadata.remoteSyncAttemptCount ?? 0) + 1,
      updatedAt: startedAt,
    });

    failureCode = 'upload_failed';
    outcome = 'indeterminate';
    const uploadResult = await input.remoteProvider.uploadBlob({
      attachmentId: metadata.id,
      localBlobKey,
      blob: blobRecord.blob,
      fileName: metadata.fileName,
      mimeType: metadata.mimeType,
      size: metadata.size,
      checksum: metadata.checksum,
    });
    completedUploadResult = uploadResult;

    if (!uploadResult.remoteFileId?.trim()) {
      throw new Error('Remote upload completed without a remote file id.');
    }
    if (uploadResult.attachmentId !== metadata.id || uploadResult.providerType !== input.remoteProvider.providerType) {
      throw new Error('Remote upload identity could not be verified.');
    }

    outcome = 'definitive_failure';
    const verification = verifyAttachmentUploadResult(metadata, uploadResult);
    completedUploadVerification = verification;
    assertUploadVerification(verification);

    outcome = 'verification_unavailable';
    // Metadata, including a matching size/MD5, is not independent byte evidence.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let downloaded;
    try {
      downloaded = await Promise.race([
        input.remoteProvider.downloadBlob({
          attachmentId: metadata.id,
          remoteFileId: uploadResult.remoteFileId,
          expectedSize: blobRecord.blob.size,
          expectedChecksum: localChecksum,
          expectedMimeType: metadata.mimeType,
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Remote readback verification timed out.')), 30_000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    if (!(downloaded instanceof Blob)
      && (downloaded.providerType !== input.remoteProvider.providerType
        || downloaded.remoteFileId !== uploadResult.remoteFileId)) {
      throw new Error('Remote readback identity could not be verified.');
    }
    const remoteBlob = downloaded instanceof Blob ? downloaded : downloaded.blob;
    const remoteSha256 = await checksumLocalAttachmentBytes(await remoteBlob.arrayBuffer());
    if (!remoteSha256) throw new Error('Remote SHA-256 verification is unavailable.');
    outcome = 'definitive_failure';
    const readbackVerification: RemoteBlobUploadVerification = {
      sizeVerified: remoteBlob.size === blobRecord.blob.size,
      checksumVerified: remoteSha256 === localChecksum,
      checksumAlgorithm: 'sha256',
    };
    completedUploadVerification = readbackVerification;
    assertUploadVerification(readbackVerification);
    outcome = 'verified_remote_content';

    const latest = await input.attachmentRepository.getAttachment(metadata.id);
    if (!latest || isDeleted(latest) || latest.localBlobKey !== localBlobKey || latest.updatedAt !== startedAt
      || latest.noteId !== metadata.noteId || latest.checksum !== metadata.checksum
      || latest.size !== metadata.size || latest.mimeType !== metadata.mimeType) {
      return complete({
        attachmentId: metadata.id,
        localBlobKey,
        remoteProvider: uploadResult.remoteProvider ?? uploadResult.providerType,
        remoteFileId: uploadResult.remoteFileId,
        remoteSize: remoteSize(uploadResult),
        remoteChecksum: remoteChecksum(uploadResult),
        verification: readbackVerification,
        outcome,
        status: 'skipped',
        error: 'Attachment metadata changed during upload; success update skipped.',
      });
    }

    const completedAt = nowIso(input.now);
    failureCode = 'metadata_update_failed';
    await input.attachmentRepository.updateAttachment(metadata.id, {
      remoteProvider: uploadResult.remoteProvider ?? uploadResult.providerType,
      remoteFileId: uploadResult.remoteFileId,
      remoteBlobKey: uploadResult.remoteBlobKey,
      remoteChecksum: remoteChecksum(uploadResult),
      remoteSize: remoteSize(uploadResult),
      remoteMimeType: uploadResult.remoteMimeType ?? uploadResult.mimeType,
      remoteSyncedAt: uploadResult.remoteSyncedAt ?? uploadResult.syncedAt ?? completedAt,
      remoteUpdatedAt: uploadResult.updatedAt,
      remoteVerification: readbackVerification,
      remoteSyncStatus: 'synced',
      remoteError: undefined,
      lastRemoteSyncAttemptAt: completedAt,
      updatedAt: completedAt,
    });

    return complete({
      attachmentId: metadata.id,
      localBlobKey,
      remoteProvider: uploadResult.remoteProvider ?? uploadResult.providerType,
      remoteFileId: uploadResult.remoteFileId,
      remoteSize: remoteSize(uploadResult),
      remoteChecksum: remoteChecksum(uploadResult),
      verification: readbackVerification,
      outcome,
      status: 'uploaded',
    });
  } catch (error) {
    if (outcome === 'indeterminate' && error && typeof error === 'object'
      && 'uploadOutcome' in error && error.uploadOutcome === 'definitive_failure') {
      outcome = 'definitive_failure';
    }
    const completedAt = nowIso(input.now);
    const errorDetails = safeUploadError(error, failureCode);
    try {
      const latest = await input.attachmentRepository.getAttachment(metadata.id);
      if (latest && !isDeleted(latest) && latest.updatedAt === startedAt
        && latest.localBlobKey === localBlobKey && latest.noteId === metadata.noteId
        && latest.checksum === metadata.checksum && latest.size === metadata.size
        && latest.mimeType === metadata.mimeType) await input.attachmentRepository.updateAttachment(metadata.id, {
        remoteSyncStatus: 'failed',
        remoteError: `${outcome}: ${errorDetails.message}`,
        lastRemoteSyncAttemptAt: completedAt,
        updatedAt: completedAt,
      });
    } catch {
      // Preserve the original sanitized upload failure. Diagnostics can review
      // metadata state later without introducing delete or cleanup behavior.
    }

    return complete({
      attachmentId: metadata.id,
      localBlobKey,
      remoteProvider: completedUploadResult?.remoteProvider ?? completedUploadResult?.providerType ?? input.remoteProvider.providerType,
      remoteFileId: completedUploadResult?.remoteFileId,
      remoteSize: completedUploadResult ? remoteSize(completedUploadResult) : undefined,
      remoteChecksum: completedUploadResult ? remoteChecksum(completedUploadResult) : undefined,
      verification: completedUploadVerification,
      warnings: completedUploadResult && failureCode === 'metadata_update_failed'
        ? [
            ...(completedUploadVerification?.warnings ?? []),
            'Remote upload may have completed before local metadata update failed. Review before retrying.',
          ]
        : completedUploadVerification?.warnings,
      status: 'failed',
      outcome,
      errorDetails,
    });
  }
}
