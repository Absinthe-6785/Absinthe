import type {
  AttachmentMetadata,
  AttachmentRemoteSyncStatus,
  AttachmentRepository,
  BlobStorageAdapter,
} from './attachmentRepository';
import {
  sanitizeRemoteBlobProviderError,
  type RemoteBlobProvider,
  type RemoteBlobProviderType,
  type RemoteBlobUploadResult,
  type RemoteBlobUploadVerification,
} from './remoteBlobProvider';

export type AttachmentSyncQueueItemStatus =
  | 'pending_upload'
  | 'uploading'
  | 'synced'
  | 'failed'
  | 'paused_offline'
  | 'recoverable_remote'
  | 'skipped';

export interface AttachmentSyncQueueItem {
  readonly id: string;
  readonly attachmentId: string;
  readonly localBlobKey?: string;
  readonly remoteProvider: RemoteBlobProviderType;
  readonly requestedAt: string;
  readonly status: AttachmentSyncQueueItemStatus;
  readonly attemptCount: number;
  readonly lastAttemptAt?: string;
  readonly lastError?: string;
}

export interface AttachmentSyncQueueItemResult {
  readonly attachmentId: string;
  readonly localBlobKey?: string;
  readonly status: AttachmentSyncQueueItemStatus;
  readonly remoteProvider?: RemoteBlobProviderType;
  readonly remoteFileId?: string;
  readonly remoteSize?: number;
  readonly remoteChecksum?: string;
  readonly verification?: RemoteBlobUploadVerification;
  readonly error?: string;
  readonly warnings?: string[];
}

export interface AttachmentSyncQueueResult {
  readonly startedAt: string;
  readonly completedAt: string;
  readonly processedCount: number;
  readonly uploadedCount: number;
  readonly syncedCount: number;
  readonly failedCount: number;
  readonly pausedOfflineCount: number;
  readonly skippedCount: number;
  readonly itemResults: AttachmentSyncQueueItemResult[];
}

export interface AttachmentSyncQueueDeps {
  readonly attachmentRepository: AttachmentRepository;
  readonly localBlobAdapter: BlobStorageAdapter;
  readonly remoteProvider: RemoteBlobProvider;
  readonly now?: () => Date;
}

export interface BuildAttachmentUploadQueueInput {
  readonly attachmentRepository: AttachmentRepository;
  readonly remoteProvider: RemoteBlobProviderType;
  readonly now?: () => Date;
}

function nowIso(now?: () => Date): string {
  return (now ?? (() => new Date()))().toISOString();
}

function isDeleted(metadata: AttachmentMetadata): boolean {
  return Boolean(metadata.deletedAt) || metadata.syncStatus === 'deleted';
}

function queueItemId(attachmentId: string, requestedAt: string): string {
  return `attachment-upload:${attachmentId}:${requestedAt}`;
}

function safeError(error: unknown, code = 'attachment_sync_failed'): string {
  return sanitizeRemoteBlobProviderError(error, {
    category: 'upload',
    retryable: false,
    code,
  }).message;
}

function classifyRemoteFailure(error: unknown): AttachmentRemoteSyncStatus {
  const sanitized = sanitizeRemoteBlobProviderError(error);
  const code = sanitized.code?.toLowerCase() ?? '';
  const message = sanitized.message.toLowerCase();

  if (
    sanitized.category === 'network'
    || sanitized.category === 'auth'
    || sanitized.retryable
    || code.includes('network')
    || code.includes('unavailable')
    || code.includes('offline')
    || code.includes('auth')
    || message.includes('network')
    || message.includes('offline')
    || message.includes('unavailable')
    || message.includes('fetch')
  ) {
    return 'paused_offline';
  }

  return 'failed';
}

function metadataAccess(repository: AttachmentRepository): {
  get(id: string): Promise<AttachmentMetadata | null>;
  update(id: string, patch: Partial<AttachmentMetadata>): Promise<void>;
} {
  return {
    get: (id: string) => repository.getAttachment(id),
    update: (id: string, patch: Partial<AttachmentMetadata>) => repository.updateAttachment(id, patch),
  };
}

function localMd5(checksum: string | undefined): string | null {
  if (!checksum) return null;
  const normalized = checksum.trim().toLowerCase();
  if (normalized.startsWith('md5:')) return normalized.slice(4);
  return /^[a-f0-9]{32}$/.test(normalized) ? normalized : null;
}

function providerSize(result: RemoteBlobUploadResult): number | undefined {
  return result.remoteSize ?? result.size;
}

function providerChecksum(result: RemoteBlobUploadResult): string | undefined {
  return result.remoteChecksum ?? result.checksum;
}

export function verifyAttachmentUploadResult(
  metadata: AttachmentMetadata,
  result: RemoteBlobUploadResult
): RemoteBlobUploadVerification {
  const warnings = [...(result.verification?.warnings ?? [])];
  const remoteSize = providerSize(result);
  const sizeVerified = remoteSize === undefined ? false : remoteSize === metadata.size;

  if (remoteSize === undefined) {
    warnings.push('Remote size was not returned by provider.');
  }

  const expectedMd5 = localMd5(metadata.checksum);
  const remoteMd5 = localMd5(providerChecksum(result));
  let checksumVerified = false;
  let checksumAlgorithm: string | undefined;

  if (expectedMd5 && remoteMd5) {
    checksumVerified = expectedMd5 === remoteMd5;
    checksumAlgorithm = 'md5';
  } else if (metadata.checksum && providerChecksum(result)) {
    warnings.push('Local checksum algorithm is not compatible with remote checksum.');
  } else if (metadata.checksum) {
    warnings.push('Remote checksum was not returned by provider.');
  }

  return {
    sizeVerified,
    checksumVerified,
    checksumAlgorithm,
    warnings: warnings.length ? Array.from(new Set(warnings)) : undefined,
  };
}

function assertUploadVerification(verification: RemoteBlobUploadVerification): void {
  if (!verification.sizeVerified) {
    throw new Error('Remote upload size verification failed.');
  }

  if (verification.checksumAlgorithm && !verification.checksumVerified) {
    throw new Error('Remote upload checksum verification failed.');
  }
}

function safeItemResult(result: AttachmentSyncQueueItemResult): AttachmentSyncQueueItemResult {
  return {
    ...result,
    error: result.error ? safeError(result.error) : undefined,
  };
}

export async function buildAttachmentUploadQueue(input: BuildAttachmentUploadQueueInput): Promise<AttachmentSyncQueueItem[]> {
  const requestedAt = nowIso(input.now);
  const attachments = await input.attachmentRepository.listAttachments();

  return attachments
    .filter(metadata => metadata.remoteSyncStatus === 'pending_upload')
    .filter(metadata => !isDeleted(metadata))
    .map(metadata => ({
      id: queueItemId(metadata.id, requestedAt),
      attachmentId: metadata.id,
      localBlobKey: metadata.localBlobKey,
      remoteProvider: input.remoteProvider,
      requestedAt,
      status: 'pending_upload',
      attemptCount: metadata.remoteSyncAttemptCount ?? 0,
    }));
}

export async function enqueueAttachmentUpload(input: {
  readonly attachmentRepository: AttachmentRepository;
  readonly attachmentId: string;
  readonly remoteProvider: RemoteBlobProviderType;
  readonly now?: () => Date;
}): Promise<AttachmentSyncQueueItem | null> {
  const access = metadataAccess(input.attachmentRepository);
  const metadata = await access.get(input.attachmentId);
  if (!metadata || isDeleted(metadata)) return null;

  const requestedAt = nowIso(input.now);
  const attemptCount = metadata.remoteSyncAttemptCount ?? 0;
  await access.update(metadata.id, {
    remoteProvider: input.remoteProvider,
    remoteSyncStatus: 'pending_upload',
    remoteError: undefined,
    updatedAt: requestedAt,
  });

  return {
    id: queueItemId(metadata.id, requestedAt),
    attachmentId: metadata.id,
    localBlobKey: metadata.localBlobKey,
    remoteProvider: input.remoteProvider,
    requestedAt,
    status: 'pending_upload',
    attemptCount,
  };
}

export async function processAttachmentUploadItem(
  item: AttachmentSyncQueueItem,
  deps: AttachmentSyncQueueDeps
): Promise<AttachmentSyncQueueItemResult> {
  const access = metadataAccess(deps.attachmentRepository);
  const startedAt = nowIso(deps.now);
  const metadata = await access.get(item.attachmentId);

  if (!metadata || isDeleted(metadata)) {
    return {
      attachmentId: item.attachmentId,
      localBlobKey: item.localBlobKey,
      status: 'skipped',
      error: 'Attachment is missing or deleted.',
    };
  }

  const localBlobKey = metadata.localBlobKey;
  if (!localBlobKey) {
    await access.update(metadata.id, {
      remoteSyncStatus: 'missing_local',
      remoteError: 'Attachment has no local blob key.',
      lastRemoteSyncAttemptAt: startedAt,
      remoteSyncAttemptCount: (metadata.remoteSyncAttemptCount ?? 0) + 1,
      updatedAt: startedAt,
    });
    return {
      attachmentId: metadata.id,
      status: 'failed',
      error: 'Attachment has no local blob key.',
    };
  }

  const blobRecord = await deps.localBlobAdapter.getBlob(localBlobKey);
  if (!blobRecord) {
    await access.update(metadata.id, {
      remoteSyncStatus: 'missing_local',
      remoteError: 'Local attachment blob is missing.',
      lastRemoteSyncAttemptAt: startedAt,
      remoteSyncAttemptCount: (metadata.remoteSyncAttemptCount ?? 0) + 1,
      updatedAt: startedAt,
    });
    return {
      attachmentId: metadata.id,
      localBlobKey,
      status: 'failed',
      error: 'Local attachment blob is missing.',
    };
  }

  await access.update(metadata.id, {
    remoteProvider: deps.remoteProvider.providerType,
    remoteSyncStatus: 'uploading',
    remoteError: undefined,
    lastRemoteSyncAttemptAt: startedAt,
    remoteSyncAttemptCount: (metadata.remoteSyncAttemptCount ?? 0) + 1,
    updatedAt: startedAt,
  });

  try {
    const uploadResult = await deps.remoteProvider.uploadBlob({
      attachmentId: metadata.id,
      localBlobKey,
      blob: blobRecord.blob,
      fileName: metadata.fileName,
      mimeType: metadata.mimeType,
      size: metadata.size,
      checksum: metadata.checksum,
    });
    const verification = verifyAttachmentUploadResult(metadata, uploadResult);
    assertUploadVerification(verification);

    const latest = await access.get(metadata.id);
    if (!latest || isDeleted(latest) || latest.localBlobKey !== localBlobKey || latest.updatedAt !== startedAt) {
      return {
        attachmentId: metadata.id,
        localBlobKey,
        status: 'skipped',
        error: 'Attachment metadata changed during upload; success update skipped.',
      };
    }

    const completedAt = nowIso(deps.now);
    await access.update(metadata.id, {
      remoteProvider: uploadResult.remoteProvider ?? uploadResult.providerType,
      remoteFileId: uploadResult.remoteFileId,
      remoteBlobKey: uploadResult.remoteBlobKey,
      remoteChecksum: providerChecksum(uploadResult),
      remoteSize: providerSize(uploadResult),
      remoteMimeType: uploadResult.remoteMimeType ?? uploadResult.mimeType,
      remoteSyncedAt: uploadResult.remoteSyncedAt ?? uploadResult.syncedAt ?? completedAt,
      remoteUpdatedAt: uploadResult.updatedAt,
      remoteVerification: verification,
      remoteSyncStatus: 'synced',
      remoteError: undefined,
      lastRemoteSyncAttemptAt: completedAt,
      updatedAt: completedAt,
    });

    return {
      attachmentId: metadata.id,
      localBlobKey,
      status: 'synced',
      remoteProvider: uploadResult.remoteProvider ?? uploadResult.providerType,
      remoteFileId: uploadResult.remoteFileId,
      remoteSize: providerSize(uploadResult),
      remoteChecksum: providerChecksum(uploadResult),
      verification,
      warnings: verification.warnings,
    };
  } catch (error) {
    const completedAt = nowIso(deps.now);
    const remoteSyncStatus = classifyRemoteFailure(error);
    const remoteError = safeError(error);
    await access.update(metadata.id, {
      remoteSyncStatus,
      remoteError,
      lastRemoteSyncAttemptAt: completedAt,
      updatedAt: completedAt,
    });

    return {
      attachmentId: metadata.id,
      localBlobKey,
      status: remoteSyncStatus === 'paused_offline' ? 'paused_offline' : 'failed',
      error: remoteError,
    };
  }
}

export async function runAttachmentUploadQueue(
  items: readonly AttachmentSyncQueueItem[],
  deps: AttachmentSyncQueueDeps
): Promise<AttachmentSyncQueueResult> {
  const startedAt = nowIso(deps.now);
  const itemResults: AttachmentSyncQueueItemResult[] = [];

  for (const item of items) {
    itemResults.push(safeItemResult(await processAttachmentUploadItem(item, deps)));
  }

  const completedAt = nowIso(deps.now);
  const uploadedCount = itemResults.filter(result => result.status === 'synced').length;
  return {
    startedAt,
    completedAt,
    processedCount: itemResults.length,
    uploadedCount,
    syncedCount: uploadedCount,
    failedCount: itemResults.filter(result => result.status === 'failed').length,
    pausedOfflineCount: itemResults.filter(result => result.status === 'paused_offline').length,
    skippedCount: itemResults.filter(result => result.status === 'skipped').length,
    itemResults,
  };
}
