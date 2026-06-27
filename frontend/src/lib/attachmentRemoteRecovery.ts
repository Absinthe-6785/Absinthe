import type {
  AttachmentMetadata,
  AttachmentRemoteSyncStatus,
  AttachmentRepository,
  BlobStorageAdapter,
} from './attachmentRepository';
import {
  sanitizeRemoteBlobProviderError,
  type RemoteBlobDownloadResult,
  type RemoteBlobProvider,
  type RemoteBlobProviderType,
  type RemoteBlobUploadVerification,
  type SanitizedRemoteBlobProviderError,
} from './remoteBlobProvider';

export type AttachmentRemoteRecoveryClassification = 'local_available' | 'recoverable_remote' | 'missing_local' | 'not_recoverable';
export type AttachmentRemoteRecoveryStatus = 'recovered' | 'failed' | 'skipped' | 'blocked';

export interface AttachmentRemoteRecoveryResult {
  readonly recoveryId: string;
  readonly attachmentId: string;
  readonly remoteProvider?: RemoteBlobProviderType;
  readonly remoteFileId?: string;
  readonly status: AttachmentRemoteRecoveryStatus;
  readonly localBlobKey?: string;
  readonly remoteSize?: number;
  readonly localSize?: number;
  readonly verification?: RemoteBlobUploadVerification;
  readonly error?: string;
  readonly errorDetails?: SanitizedRemoteBlobProviderError;
  readonly warnings?: string[];
  readonly startedAt: string;
  readonly completedAt: string;
}

export interface RecoverAttachmentBlobFromRemoteInput {
  readonly attachmentRepository: AttachmentRepository;
  readonly localBlobAdapter: BlobStorageAdapter;
  readonly remoteProvider: RemoteBlobProvider;
  readonly attachmentId: string;
  readonly force?: boolean;
  readonly now?: () => Date;
  readonly localBlobKeyFactory?: (metadata: AttachmentMetadata, startedAt: string) => string;
}

export interface ReconcileStaleRemoteSyncStatusInput {
  readonly attachmentRepository: AttachmentRepository;
  readonly maxUploadingAgeMs: number;
  readonly now?: () => Date;
}

export interface ReconcileStaleRemoteSyncStatusResult {
  readonly checkedCount: number;
  readonly reconciledCount: number;
  readonly itemResults: Array<{
    readonly attachmentId: string;
    readonly status: 'failed' | 'skipped';
    readonly error?: string;
  }>;
}

function nowIso(now?: () => Date): string {
  return (now ?? (() => new Date()))().toISOString();
}

function isDeleted(metadata: AttachmentMetadata): boolean {
  return Boolean(metadata.deletedAt) || metadata.syncStatus === 'deleted';
}

function safeProviderError(error: unknown, code = 'attachment_recovery_failed'): SanitizedRemoteBlobProviderError {
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

function defaultRecoveredBlobKey(metadata: AttachmentMetadata): string {
  return `local-attachment/recovered-${metadata.id}`;
}

function unwrapDownloadResult(
  result: Blob | RemoteBlobDownloadResult,
  remoteProvider: RemoteBlobProviderType,
  remoteFileId: string
): RemoteBlobDownloadResult {
  if (result && typeof result === 'object' && 'blob' in result) {
    return result;
  }

  return {
    blob: result,
    providerType: remoteProvider,
    remoteProvider,
    remoteFileId,
    remoteSize: result.size,
    remoteMimeType: result.type,
  };
}

function normalizeHexChecksum(checksum: string | undefined, algorithm: 'sha256' | 'md5'): string | null {
  if (!checksum) return null;
  const normalized = checksum.trim().toLowerCase();
  const prefix = `${algorithm}:`;
  const bare = normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
  const length = algorithm === 'sha256' ? 64 : 32;
  return new RegExp(`^[a-f0-9]{${length}}$`).test(bare) ? bare : null;
}

async function sha256(blob: Blob): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = await subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function verifyRecoveredBlob(
  metadata: AttachmentMetadata,
  download: RemoteBlobDownloadResult
): Promise<RemoteBlobUploadVerification> {
  const warnings = [...(download.verification?.warnings ?? [])];
  const expectedSize = metadata.remoteSize ?? metadata.size;
  const actualSize = download.remoteSize ?? download.blob.size;
  const sizeVerified = expectedSize === undefined ? false : actualSize === expectedSize;
  if (!sizeVerified) {
    warnings.push('Downloaded blob size did not match expected remote size.');
  }

  const expectedSha256 = normalizeHexChecksum(metadata.remoteChecksum ?? metadata.checksum, 'sha256');
  const expectedMd5 = normalizeHexChecksum(metadata.remoteChecksum ?? metadata.checksum, 'md5');
  const remoteSha256 = normalizeHexChecksum(download.remoteChecksum, 'sha256');
  const remoteMd5 = normalizeHexChecksum(download.remoteChecksum, 'md5');

  let checksumVerified = false;
  let checksumAlgorithm: string | undefined;
  if (expectedSha256) {
    const actualSha256 = remoteSha256 ?? await sha256(download.blob);
    checksumVerified = actualSha256 === expectedSha256;
    checksumAlgorithm = 'sha256';
  } else if (expectedMd5 && remoteMd5) {
    checksumVerified = remoteMd5 === expectedMd5;
    checksumAlgorithm = 'md5';
  } else if (expectedMd5) {
    warnings.push('Remote checksum is MD5 but local runtime cannot verify downloaded blob content with MD5.');
  } else if (metadata.remoteChecksum ?? metadata.checksum) {
    warnings.push('Remote checksum algorithm is unavailable or incompatible; size-only verification used.');
  }

  const sizeOnlyVerified = sizeVerified && !checksumAlgorithm;
  if (sizeOnlyVerified) {
    warnings.push('Downloaded blob was verified by size only.');
  }

  return {
    sizeVerified,
    checksumVerified,
    checksumAlgorithm,
    sizeOnlyVerified,
    warnings: warnings.length ? Array.from(new Set(warnings)) : undefined,
  };
}

function assertRecoveryVerification(verification: RemoteBlobUploadVerification): void {
  if (!verification.sizeVerified) {
    throw new Error('Remote recovery size verification failed.');
  }

  if (verification.checksumAlgorithm && !verification.checksumVerified) {
    throw new Error('Remote recovery checksum verification failed.');
  }
}

export async function classifyAttachmentRemoteRecoveryState(input: {
  readonly metadata: AttachmentMetadata;
  readonly localBlobAdapter?: BlobStorageAdapter;
}): Promise<AttachmentRemoteRecoveryClassification> {
  if (isDeleted(input.metadata)) return 'not_recoverable';
  if (input.metadata.localBlobKey && input.localBlobAdapter && await input.localBlobAdapter.hasBlob?.(input.metadata.localBlobKey)) {
    return 'local_available';
  }
  if (input.metadata.remoteProvider && input.metadata.remoteFileId) {
    return 'recoverable_remote';
  }
  return 'missing_local';
}

export async function recoverAttachmentBlobFromRemote(
  input: RecoverAttachmentBlobFromRemoteInput
): Promise<AttachmentRemoteRecoveryResult> {
  const startedAt = nowIso(input.now);
  const recoveryId = `attachment-recovery:${input.attachmentId}:${startedAt}`;
  const complete = (
    result: Omit<AttachmentRemoteRecoveryResult, 'recoveryId' | 'startedAt' | 'completedAt'>
  ): AttachmentRemoteRecoveryResult => {
    const errorDetails = result.errorDetails ?? (result.error ? safeProviderError(result.error) : undefined);
    return {
      recoveryId,
      startedAt,
      completedAt: nowIso(input.now),
      ...result,
      error: errorDetails?.message,
      errorDetails,
    };
  };

  const metadata = await input.attachmentRepository.getAttachment(input.attachmentId);
  if (!metadata || isDeleted(metadata)) {
    return complete({
      attachmentId: input.attachmentId,
      status: 'skipped',
      error: 'Attachment is missing or deleted.',
    });
  }

  const existingLocalBlob = metadata.localBlobKey ? await input.localBlobAdapter.getBlob(metadata.localBlobKey) : null;
  if (existingLocalBlob && !input.force) {
    return complete({
      attachmentId: metadata.id,
      status: 'skipped',
      localBlobKey: metadata.localBlobKey,
      localSize: existingLocalBlob.size,
      error: 'Attachment already has a local blob.',
    });
  }

  if (!metadata.remoteProvider || !metadata.remoteFileId) {
    await input.attachmentRepository.updateAttachment(metadata.id, {
      remoteSyncStatus: 'missing_local',
      remoteError: 'Attachment is missing remote recovery information.',
      lastRemoteRecoveryAt: startedAt,
      updatedAt: startedAt,
    });
    return complete({
      attachmentId: metadata.id,
      status: 'blocked',
      error: 'Attachment is missing remote recovery information.',
    });
  }

  await input.attachmentRepository.updateAttachment(metadata.id, {
    remoteSyncStatus: 'recoverable_remote',
    remoteError: undefined,
    lastRemoteRecoveryAt: startedAt,
    updatedAt: startedAt,
  });

  try {
    const download = unwrapDownloadResult(await input.remoteProvider.downloadBlob({
      attachmentId: metadata.id,
      remoteFileId: metadata.remoteFileId,
      remoteBlobKey: metadata.remoteBlobKey,
      expectedSize: metadata.remoteSize ?? metadata.size,
      expectedChecksum: metadata.remoteChecksum ?? metadata.checksum,
      expectedMimeType: metadata.remoteMimeType ?? metadata.mimeType,
      requestedAt: startedAt,
    }), input.remoteProvider.providerType, metadata.remoteFileId);
    const verification = await verifyRecoveredBlob(metadata, download);
    assertRecoveryVerification(verification);

    const latest = await input.attachmentRepository.getAttachment(metadata.id);
    if (
      !latest
      || isDeleted(latest)
      || latest.remoteFileId !== metadata.remoteFileId
      || latest.updatedAt !== startedAt
    ) {
      return complete({
        attachmentId: metadata.id,
        remoteProvider: metadata.remoteProvider,
        remoteFileId: metadata.remoteFileId,
        status: 'skipped',
        verification,
        warnings: verification.warnings,
        error: 'Attachment metadata changed during recovery; local write skipped.',
      });
    }

    const localBlobKey = input.localBlobKeyFactory?.(metadata, startedAt) ?? defaultRecoveredBlobKey(metadata);
    const written = await input.localBlobAdapter.putBlob({
      key: localBlobKey,
      blob: download.blob,
      mimeType: download.remoteMimeType ?? download.blob.type ?? metadata.mimeType,
      checksum: metadata.remoteChecksum ?? metadata.checksum,
    });
    const completedAt = nowIso(input.now);
    await input.attachmentRepository.updateAttachment(metadata.id, {
      localBlobKey: written.key,
      remoteProvider: download.remoteProvider ?? download.providerType,
      remoteFileId: download.remoteFileId ?? metadata.remoteFileId,
      remoteSize: download.remoteSize ?? download.blob.size,
      remoteChecksum: download.remoteChecksum ?? metadata.remoteChecksum,
      remoteMimeType: download.remoteMimeType ?? download.blob.type ?? metadata.remoteMimeType,
      remoteVerification: verification,
      remoteSyncStatus: 'synced',
      remoteError: undefined,
      lastRemoteRecoveryAt: completedAt,
      updatedAt: completedAt,
    });

    return complete({
      attachmentId: metadata.id,
      remoteProvider: download.remoteProvider ?? download.providerType,
      remoteFileId: download.remoteFileId ?? metadata.remoteFileId,
      status: 'recovered',
      localBlobKey: written.key,
      remoteSize: download.remoteSize ?? download.blob.size,
      localSize: written.size,
      verification,
      warnings: verification.warnings,
    });
  } catch (error) {
    const completedAt = nowIso(input.now);
    const errorDetails = safeProviderError(error);
    const remoteError = errorDetails.message;
    await input.attachmentRepository.updateAttachment(metadata.id, {
      remoteSyncStatus: 'recoverable_remote',
      remoteError,
      lastRemoteRecoveryAt: completedAt,
      updatedAt: completedAt,
    });

    return complete({
      attachmentId: metadata.id,
      remoteProvider: metadata.remoteProvider,
      remoteFileId: metadata.remoteFileId,
      status: 'failed',
      error: remoteError,
      errorDetails,
    });
  }
}

export async function reconcileStaleRemoteSyncStatus(
  input: ReconcileStaleRemoteSyncStatusInput
): Promise<ReconcileStaleRemoteSyncStatusResult> {
  const now = input.now ?? (() => new Date());
  const nowMs = now().getTime();
  const attachments = await input.attachmentRepository.listAttachments();
  const itemResults: ReconcileStaleRemoteSyncStatusResult['itemResults'] = [];

  for (const metadata of attachments) {
    if (metadata.remoteSyncStatus !== 'uploading' || !metadata.lastRemoteSyncAttemptAt) {
      itemResults.push({ attachmentId: metadata.id, status: 'skipped' });
      continue;
    }

    const attemptMs = Date.parse(metadata.lastRemoteSyncAttemptAt);
    if (!Number.isFinite(attemptMs) || nowMs - attemptMs < input.maxUploadingAgeMs) {
      itemResults.push({ attachmentId: metadata.id, status: 'skipped' });
      continue;
    }

    const updatedAt = now().toISOString();
    await input.attachmentRepository.updateAttachment(metadata.id, {
      remoteSyncStatus: 'failed' satisfies AttachmentRemoteSyncStatus,
      remoteError: 'Previous remote upload became stale and needs an explicit retry.',
      updatedAt,
    });
    itemResults.push({
      attachmentId: metadata.id,
      status: 'failed',
      error: 'Previous remote upload became stale and needs an explicit retry.',
    });
  }

  return {
    checkedCount: attachments.length,
    reconciledCount: itemResults.filter(result => result.status === 'failed').length,
    itemResults,
  };
}
