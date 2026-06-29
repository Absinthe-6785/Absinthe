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

    if (!uploadResult.remoteFileId && !uploadResult.remoteBlobKey) {
      throw new Error('Remote upload completed without a remote file id.');
    }

    const verification = verifyAttachmentUploadResult(metadata, uploadResult);
    completedUploadVerification = verification;
    assertUploadVerification(verification);

    const latest = await input.attachmentRepository.getAttachment(metadata.id);
    if (!latest || isDeleted(latest) || latest.localBlobKey !== localBlobKey || latest.updatedAt !== startedAt) {
      return complete({
        attachmentId: metadata.id,
        localBlobKey,
        remoteProvider: uploadResult.remoteProvider ?? uploadResult.providerType,
        remoteFileId: uploadResult.remoteFileId,
        remoteSize: remoteSize(uploadResult),
        remoteChecksum: remoteChecksum(uploadResult),
        verification,
        warnings: verification.warnings,
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
      remoteVerification: verification,
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
      verification,
      warnings: verification.warnings,
      status: 'uploaded',
    });
  } catch (error) {
    const completedAt = nowIso(input.now);
    const errorDetails = safeUploadError(error, failureCode);
    try {
      await input.attachmentRepository.updateAttachment(metadata.id, {
        remoteSyncStatus: 'failed',
        remoteError: errorDetails.message,
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
      errorDetails,
    });
  }
}
