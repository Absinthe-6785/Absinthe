import { createLocalAttachmentBlobAdapter } from './attachmentBlobIndexedDb';
import { createLocalAttachmentMetadataRepository } from './attachmentMetadataIndexedDb';
import {
  type AttachmentBlobInventoryRecord,
  type AttachmentMetadata,
  type AttachmentRemoteSyncStatus,
  type AttachmentRepository,
  type BlobStorageAdapter,
} from './attachmentRepository';
import {
  buildLocalBlobEvictionReview,
  type LocalBlobEvictionReport,
} from './localBlobEvictionPolicy';
import { sanitizeRemoteBlobProviderErrorMessage, type RemoteBlobProviderType } from './remoteBlobProvider';

export interface AttachmentSyncDiagnostics {
  readonly generatedAt: string;
  readonly attachmentsScanned: number;
  readonly blobsScanned: number;
  readonly statusCounts: Record<string, number>;
  readonly providerCounts: Record<string, number>;
  readonly verificationCounts: {
    readonly allRemoteBackedFullyVerified: number;
    readonly allRemoteBackedSizeOnlyVerified: number;
    readonly eligibleRecoverableFullyVerified: number;
    readonly eligibleRecoverableSizeOnlyVerified: number;
    readonly fullyVerifiedRemoteAttachments: number;
    readonly sizeOnlyVerifiedAttachments: number;
    readonly checksumMismatchCount: number;
    readonly sizeMismatchCount: number;
    readonly verificationWarningCount: number;
    readonly verificationMissingCount: number;
    readonly staleUploadConflictCount: number;
    readonly providerErrorCount: number;
    readonly providerErrorCountsByCategory: Record<string, number>;
  };
  readonly evictionSummary: {
    readonly candidateCount: number;
    readonly fullyVerifiedCandidateCount: number;
    readonly sizeOnlyCandidateCount: number;
    readonly excludedCount: number;
    readonly needsReviewCount: number;
    readonly protectedKeepOfflineCount: number;
    readonly recentlyUsedExcludedCount: number;
    readonly statusExcludedCount: number;
    readonly verificationExcludedCount: number;
    readonly inventoryAvailable: boolean;
    readonly inventoryPartial: boolean;
  };
  readonly byteSummary: {
    readonly fullyVerifiedRecoverableBytes: number;
    readonly reviewOnlyRecoverableBytes: number;
    readonly blockedBytes: number;
  };
  readonly inventory: {
    readonly available: boolean;
    readonly partial: boolean;
    readonly warnings: string[];
  };
  readonly warnings: string[];
  readonly errors: string[];
  readonly recoveryItems: AttachmentRecoveryDiagnosticsItem[];
}

export interface AttachmentRecoveryDiagnosticsItem {
  readonly attachmentId: string;
  readonly localBlobKey?: string;
  readonly remoteProvider?: RemoteBlobProviderType;
  readonly remoteFileId?: string;
  readonly remoteSyncStatus?: AttachmentRemoteSyncStatus;
  readonly eligible: boolean;
  readonly reason: string;
  readonly localBlobPresent: boolean;
  readonly remoteSize?: number;
  readonly verification?: {
    readonly sizeVerified?: boolean;
    readonly checksumVerified?: boolean;
    readonly sizeOnlyVerified?: boolean;
    readonly warnings?: string[];
  };
}

export interface BuildAttachmentSyncDiagnosticsInput {
  readonly attachments?: readonly AttachmentMetadata[];
  readonly repository?: AttachmentRepository;
  readonly blobInventory?: readonly AttachmentBlobInventoryRecord[];
  readonly blobAdapter?: BlobStorageAdapter;
  readonly evictionReport?: LocalBlobEvictionReport;
  readonly now?: () => Date;
}

const KNOWN_REMOTE_STATUSES: AttachmentRemoteSyncStatus[] = [
  'not_configured',
  'local_only',
  'pending_upload',
  'uploading',
  'synced',
  'failed',
  'paused_offline',
  'missing_local',
  'recoverable_remote',
  'conflict',
];

function nowIso(now?: () => Date): string {
  return (now ?? (() => new Date()))().toISOString();
}

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function isDeleted(metadata: AttachmentMetadata): boolean {
  return Boolean(metadata.deletedAt) || metadata.syncStatus === 'deleted';
}

async function readAttachments(input: BuildAttachmentSyncDiagnosticsInput): Promise<{
  attachments: AttachmentMetadata[];
  errors: string[];
}> {
  if (input.attachments) return { attachments: [...input.attachments], errors: [] };

  const repository = input.repository ?? createLocalAttachmentMetadataRepository();
  try {
    return { attachments: await repository.listAttachments(), errors: [] };
  } catch (error) {
    const message = sanitizeRemoteBlobProviderErrorMessage(error);
    return { attachments: [], errors: [`Attachment metadata inventory could not be read: ${message}`] };
  }
}

async function readBlobInventory(input: BuildAttachmentSyncDiagnosticsInput): Promise<{
  records: AttachmentBlobInventoryRecord[];
  available: boolean;
  partial: boolean;
  warnings: string[];
}> {
  if (input.blobInventory) {
    return {
      records: [...input.blobInventory],
      available: true,
      partial: input.blobInventory.some(record => record.inventoryPartial),
      warnings: input.blobInventory.some(record => record.inventoryPartial)
        ? ['Blob inventory is partial. Diagnostics and eviction estimates may be incomplete.']
        : [],
    };
  }

  const adapter = input.blobAdapter ?? createLocalAttachmentBlobAdapter();
  if (!adapter.listBlobRecords) {
    return {
      records: [],
      available: false,
      partial: true,
      warnings: ['Blob inventory is unavailable. Diagnostics and eviction estimates may be incomplete.'],
    };
  }

  try {
    const records = await adapter.listBlobRecords();
    const partial = records.some(record => record.inventoryPartial);
    return {
      records,
      available: true,
      partial,
      warnings: partial ? ['Blob inventory is partial. Diagnostics and eviction estimates may be incomplete.'] : [],
    };
  } catch (error) {
    const message = sanitizeRemoteBlobProviderErrorMessage(error);
    return {
      records: [],
      available: false,
      partial: true,
      warnings: [`Blob inventory is unavailable. Diagnostics and eviction estimates may be incomplete. ${message}`],
    };
  }
}

function providerKey(provider: RemoteBlobProviderType | undefined): string {
  return provider ?? 'local/no remote provider';
}

function statusKey(metadata: AttachmentMetadata): string {
  const status = metadata.remoteSyncStatus;
  if (!status) return 'unknown';
  return KNOWN_REMOTE_STATUSES.includes(status) ? status : 'unknown';
}

function hasSizeOnlyVerification(metadata: AttachmentMetadata): boolean {
  const warnings = metadata.remoteVerification?.warnings?.join(' ').toLowerCase() ?? '';
  return metadata.remoteVerification?.sizeOnlyVerified === true
    || (metadata.remoteVerification?.sizeVerified === true && metadata.remoteVerification?.checksumVerified === false)
    || warnings.includes('size-only')
    || warnings.includes('incompatible');
}

function providerErrorCategory(metadata: AttachmentMetadata): string | null {
  const raw = metadata as AttachmentMetadata & { remoteErrorDetails?: { category?: unknown } };
  const category = raw.remoteErrorDetails?.category;
  if (typeof category === 'string' && category.trim()) return category;
  return metadata.remoteError ? 'unknown' : null;
}

function hasStaleUploadConflict(metadata: AttachmentMetadata): boolean {
  const text = [
    metadata.remoteError,
    ...(metadata.remoteVerification?.warnings ?? []),
  ].join(' ').toLowerCase();
  return text.includes('stale upload') || text.includes('conflict');
}

function isEligibleRecoverableStatus(metadata: AttachmentMetadata): boolean {
  return metadata.remoteSyncStatus === 'recoverable_remote' || metadata.remoteSyncStatus === 'synced';
}

function recoveryReason(input: {
  readonly metadata: AttachmentMetadata;
  readonly localBlobPresent: boolean;
}): { eligible: boolean; reason: string } {
  const { metadata, localBlobPresent } = input;
  if (isDeleted(metadata)) return { eligible: false, reason: 'Recovery unavailable' };
  if (localBlobPresent) return { eligible: false, reason: 'Local blob already present' };
  if (!metadata.remoteProvider) return { eligible: false, reason: 'Provider unavailable' };
  if (!metadata.remoteFileId) return { eligible: false, reason: 'Remote file missing' };
  if (metadata.remoteSyncStatus === 'pending_upload') return { eligible: false, reason: 'Upload pending' };
  if (metadata.remoteSyncStatus === 'uploading') return { eligible: false, reason: 'Upload pending' };
  if (metadata.remoteSyncStatus === 'paused_offline') return { eligible: false, reason: 'Needs reconnect' };
  if (metadata.remoteSyncStatus === 'conflict') return { eligible: false, reason: 'Conflict requires review' };
  if (metadata.remoteSyncStatus === 'failed') return { eligible: false, reason: 'Recovery unavailable' };
  if (metadata.remoteSyncStatus === 'local_only') return { eligible: false, reason: 'Recovery unavailable' };
  if (metadata.remoteSyncStatus === 'missing_local') return { eligible: false, reason: 'Missing local blob; recovery state needs reconciliation.' };
  if (!isEligibleRecoverableStatus(metadata)) return { eligible: false, reason: 'Recovery unavailable' };
  return { eligible: true, reason: 'Ready for explicit recovery' };
}

function sanitizedWarnings(attachments: readonly AttachmentMetadata[], inventoryWarnings: readonly string[], evictionReport: LocalBlobEvictionReport): string[] {
  const warnings = [
    ...inventoryWarnings,
    ...evictionReport.warnings,
    ...attachments.flatMap(metadata => metadata.remoteVerification?.warnings ?? []),
  ].map(warning => sanitizeRemoteBlobProviderErrorMessage(warning));

  return Array.from(new Set(warnings)).slice(0, 12);
}

function sanitizedErrors(attachments: readonly AttachmentMetadata[], evictionReport: LocalBlobEvictionReport, readErrors: readonly string[]): string[] {
  const errors = [
    ...readErrors,
    ...evictionReport.errors,
    ...attachments.map(metadata => metadata.remoteError).filter((error): error is string => Boolean(error)),
  ].map(error => sanitizeRemoteBlobProviderErrorMessage(error));

  return Array.from(new Set(errors)).slice(0, 12);
}

export async function buildAttachmentSyncDiagnostics(
  input: BuildAttachmentSyncDiagnosticsInput = {},
): Promise<AttachmentSyncDiagnostics> {
  const generatedAt = nowIso(input.now);
  const attachmentRead = await readAttachments(input);
  const inventoryRead = await readBlobInventory(input);
  const evictionReport = input.evictionReport ?? await buildLocalBlobEvictionReview({
    attachments: attachmentRead.attachments,
    blobInventory: inventoryRead.records,
    now: input.now,
  });

  const statusCounts: Record<string, number> = {
    total: attachmentRead.attachments.length,
    localBlobPresent: 0,
    localBlobMissing: 0,
    keepOffline: 0,
    unknown: 0,
  };
  for (const status of KNOWN_REMOTE_STATUSES) statusCounts[status] = 0;

  const providerCounts: Record<string, number> = {};
  const providerErrorCountsByCategory: Record<string, number> = {};
  let fullyVerifiedRemoteAttachments = 0;
  let sizeOnlyVerifiedAttachments = 0;
  let eligibleRecoverableFullyVerified = 0;
  let eligibleRecoverableSizeOnlyVerified = 0;
  let checksumMismatchCount = 0;
  let sizeMismatchCount = 0;
  let verificationWarningCount = 0;
  let verificationMissingCount = 0;
  let staleUploadConflictCount = 0;
  let providerErrorCount = 0;

  const inventoryByKey = new Map(inventoryRead.records.map(record => [record.localBlobKey, record]));
  const recoveryItems: AttachmentRecoveryDiagnosticsItem[] = [];

  for (const metadata of attachmentRead.attachments) {
    increment(statusCounts, statusKey(metadata));
    increment(providerCounts, providerKey(metadata.remoteProvider));
    const localBlobPresent = Boolean(metadata.localBlobKey && inventoryByKey.has(metadata.localBlobKey));
    if (localBlobPresent) {
      statusCounts.localBlobPresent += 1;
    } else {
      statusCounts.localBlobMissing += 1;
    }
    if (metadata.keepOffline) statusCounts.keepOffline += 1;

    if (metadata.remoteProvider && metadata.remoteFileId && !isDeleted(metadata)) {
      if (metadata.remoteVerification?.sizeVerified && metadata.remoteVerification.checksumVerified) {
        fullyVerifiedRemoteAttachments += 1;
        if (isEligibleRecoverableStatus(metadata)) eligibleRecoverableFullyVerified += 1;
      } else if (hasSizeOnlyVerification(metadata)) {
        sizeOnlyVerifiedAttachments += 1;
        if (isEligibleRecoverableStatus(metadata)) eligibleRecoverableSizeOnlyVerified += 1;
      } else {
        verificationMissingCount += 1;
      }
    }

    const recovery = recoveryReason({ metadata, localBlobPresent });
    if (metadata.remoteProvider || metadata.remoteFileId || metadata.remoteSyncStatus === 'recoverable_remote' || metadata.remoteSyncStatus === 'missing_local') {
      recoveryItems.push({
        attachmentId: metadata.id,
        localBlobKey: metadata.localBlobKey,
        remoteProvider: metadata.remoteProvider,
        remoteFileId: metadata.remoteFileId,
        remoteSyncStatus: metadata.remoteSyncStatus,
        eligible: recovery.eligible,
        reason: recovery.reason,
        localBlobPresent,
        remoteSize: metadata.remoteSize,
        verification: metadata.remoteVerification ? {
          sizeVerified: metadata.remoteVerification.sizeVerified,
          checksumVerified: metadata.remoteVerification.checksumVerified,
          sizeOnlyVerified: metadata.remoteVerification.sizeOnlyVerified,
          warnings: metadata.remoteVerification.warnings?.map(warning => sanitizeRemoteBlobProviderErrorMessage(warning)),
        } : undefined,
      });
    }

    const verificationText = metadata.remoteVerification?.warnings?.join(' ').toLowerCase() ?? '';
    if (metadata.remoteVerification?.warnings?.length) verificationWarningCount += metadata.remoteVerification.warnings.length;
    if (verificationText.includes('checksum') && verificationText.includes('mismatch')) checksumMismatchCount += 1;
    if (verificationText.includes('size') && verificationText.includes('mismatch')) sizeMismatchCount += 1;
    if (hasStaleUploadConflict(metadata)) staleUploadConflictCount += 1;

    const category = providerErrorCategory(metadata);
    if (category) {
      providerErrorCount += 1;
      increment(providerErrorCountsByCategory, category);
    }
  }

  const fullyVerifiedRecoverableBytes = evictionReport.candidates
    .filter(candidate => candidate.recommendedAction === 'eligible_for_future_eviction')
    .reduce((total, candidate) => total + candidate.estimatedBytes, 0);
  const reviewOnlyRecoverableBytes = evictionReport.candidates
    .filter(candidate => candidate.recommendedAction === 'review_only')
    .reduce((total, candidate) => total + candidate.estimatedBytes, 0);
  const blockedBytes = evictionReport.exclusions.reduce((total, exclusion) => {
    if (!exclusion.localBlobKey) return total;
    return total + (inventoryByKey.get(exclusion.localBlobKey)?.size ?? 0);
  }, 0);

  return {
    generatedAt,
    attachmentsScanned: attachmentRead.attachments.length,
    blobsScanned: inventoryRead.records.length,
    statusCounts,
    providerCounts,
    verificationCounts: {
      allRemoteBackedFullyVerified: fullyVerifiedRemoteAttachments,
      allRemoteBackedSizeOnlyVerified: sizeOnlyVerifiedAttachments,
      eligibleRecoverableFullyVerified,
      eligibleRecoverableSizeOnlyVerified,
      fullyVerifiedRemoteAttachments,
      sizeOnlyVerifiedAttachments,
      checksumMismatchCount,
      sizeMismatchCount,
      verificationWarningCount,
      verificationMissingCount,
      staleUploadConflictCount,
      providerErrorCount,
      providerErrorCountsByCategory,
    },
    evictionSummary: {
      candidateCount: evictionReport.candidateCount,
      fullyVerifiedCandidateCount: evictionReport.fullyVerifiedCandidateCount,
      sizeOnlyCandidateCount: evictionReport.sizeOnlyCandidateCount,
      excludedCount: evictionReport.excludedCount,
      needsReviewCount: evictionReport.needsReviewCount,
      protectedKeepOfflineCount: evictionReport.protectedKeepOfflineCount,
      recentlyUsedExcludedCount: evictionReport.recentlyUsedExcludedCount,
      statusExcludedCount: evictionReport.statusExcludedCount,
      verificationExcludedCount: evictionReport.verificationExcludedCount,
      inventoryAvailable: evictionReport.inventoryAvailable,
      inventoryPartial: evictionReport.inventoryPartial,
    },
    byteSummary: {
      fullyVerifiedRecoverableBytes,
      reviewOnlyRecoverableBytes,
      blockedBytes,
    },
    inventory: {
      available: inventoryRead.available,
      partial: inventoryRead.partial,
      warnings: inventoryRead.warnings,
    },
    warnings: sanitizedWarnings(attachmentRead.attachments, inventoryRead.warnings, evictionReport),
    errors: sanitizedErrors(attachmentRead.attachments, evictionReport, attachmentRead.errors),
    recoveryItems,
  };
}
