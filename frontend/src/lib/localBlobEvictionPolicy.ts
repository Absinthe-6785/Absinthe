import { createLocalAttachmentBlobAdapter } from './attachmentBlobIndexedDb';
import {
  type AttachmentBlobInventoryRecord,
  type AttachmentMetadata,
  type AttachmentRemoteSyncStatus,
  type AttachmentRepository,
  type BlobStorageAdapter,
} from './attachmentRepository';
import type { RemoteBlobProviderType, RemoteBlobUploadVerification } from './remoteBlobProvider';

export type LocalBlobEvictionConfidence = 'high' | 'medium' | 'low';
export type LocalBlobEvictionRecommendedAction = 'review_only' | 'eligible_for_future_eviction';
export type LocalBlobEvictionExclusionReason =
  | 'deleted_metadata'
  | 'missing_local_blob_key'
  | 'local_blob_missing'
  | 'missing_remote_provider'
  | 'missing_remote_file_id'
  | 'remote_status_excluded'
  | 'keep_offline'
  | 'recently_used'
  | 'stale_upload_conflict'
  | 'migration_or_restore_warning'
  | 'inventory_unavailable'
  | 'inventory_partial'
  | 'remote_size_missing'
  | 'size_mismatch'
  | 'verification_missing'
  | 'verification_incomplete'
  | 'checksum_mismatch'
  | 'data_integrity_warning';

export interface LocalBlobEvictionVerificationSummary {
  readonly sizeVerified: boolean;
  readonly checksumVerified: boolean;
  readonly checksumAlgorithm?: string;
  readonly sizeOnlyVerified?: boolean;
  readonly warnings?: string[];
}

export interface LocalBlobEvictionCandidate {
  readonly candidateId: string;
  readonly attachmentId: string;
  readonly localBlobKey: string;
  readonly remoteProvider: RemoteBlobProviderType;
  readonly remoteFileId?: string;
  readonly estimatedBytes: number;
  readonly verification: LocalBlobEvictionVerificationSummary;
  readonly reason: string;
  readonly confidence: LocalBlobEvictionConfidence;
  readonly recommendedAction: LocalBlobEvictionRecommendedAction;
}

export interface LocalBlobEvictionExclusion {
  readonly attachmentId: string;
  readonly localBlobKey?: string;
  readonly reason: LocalBlobEvictionExclusionReason;
  readonly status?: AttachmentRemoteSyncStatus;
  readonly warning?: string;
}

export interface LocalBlobEvictionReport {
  readonly reportId: string;
  readonly createdAt: string;
  readonly dryRun: true;
  readonly attachmentsScanned: number;
  readonly blobsScanned: number;
  readonly candidateCount: number;
  readonly excludedCount: number;
  readonly needsReviewCount: number;
  readonly estimatedRecoverableBytes: number;
  readonly sizeOnlyCandidateCount: number;
  readonly fullyVerifiedCandidateCount: number;
  readonly protectedKeepOfflineCount: number;
  readonly recentlyUsedExcludedCount: number;
  readonly statusExcludedCount: number;
  readonly verificationExcludedCount: number;
  readonly inventoryAvailable: boolean;
  readonly inventoryPartial: boolean;
  readonly candidates: LocalBlobEvictionCandidate[];
  readonly exclusions: LocalBlobEvictionExclusion[];
  readonly warnings: string[];
  readonly errors: string[];
}

export interface BuildLocalBlobEvictionReviewInput {
  readonly attachments?: readonly AttachmentMetadata[];
  readonly repository?: AttachmentRepository;
  readonly blobInventory?: readonly AttachmentBlobInventoryRecord[];
  readonly blobAdapter?: BlobStorageAdapter;
  readonly recentlyUsedThresholdDays?: number;
  readonly now?: () => Date;
}

const DEFAULT_RECENTLY_USED_THRESHOLD_DAYS = 30;
const EVICTABLE_REMOTE_STATUSES = new Set<AttachmentRemoteSyncStatus>(['synced', 'recoverable_remote']);
const STATUS_EXCLUSIONS = new Set<AttachmentRemoteSyncStatus>([
  'not_configured',
  'local_only',
  'pending_upload',
  'uploading',
  'failed',
  'paused_offline',
  'missing_local',
  'conflict',
]);

function nowIso(now?: () => Date): string {
  return (now ?? (() => new Date()))().toISOString();
}

function reportIdFor(createdAt: string): string {
  return `local-blob-eviction-review-${createdAt}`;
}

function isDeleted(metadata: AttachmentMetadata): boolean {
  return Boolean(metadata.deletedAt) || metadata.syncStatus === 'deleted';
}

function addExclusion(
  exclusions: LocalBlobEvictionExclusion[],
  metadata: AttachmentMetadata,
  reason: LocalBlobEvictionExclusionReason,
  warning?: string,
): void {
  exclusions.push({
    attachmentId: metadata.id,
    localBlobKey: metadata.localBlobKey,
    reason,
    status: metadata.remoteSyncStatus,
    warning,
  });
}

async function readAttachments(input: BuildLocalBlobEvictionReviewInput): Promise<{
  attachments: AttachmentMetadata[];
  errors: string[];
}> {
  if (input.attachments) return { attachments: [...input.attachments], errors: [] };
  if (!input.repository) return { attachments: [], errors: ['Attachment metadata inventory is unavailable.'] };

  try {
    return { attachments: await input.repository.listAttachments(), errors: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { attachments: [], errors: [`Attachment metadata inventory could not be read: ${message}`] };
  }
}

async function readBlobInventory(input: BuildLocalBlobEvictionReviewInput): Promise<{
  records: AttachmentBlobInventoryRecord[];
  available: boolean;
  partial: boolean;
  warning?: string;
}> {
  if (input.blobInventory) {
    return {
      records: [...input.blobInventory],
      available: true,
      partial: input.blobInventory.some(record => record.inventoryPartial),
    };
  }

  const adapter = input.blobAdapter ?? createLocalAttachmentBlobAdapter();
  if (!adapter.listBlobRecords) {
    return {
      records: [],
      available: false,
      partial: true,
      warning: 'Local blob inventory is unavailable; eviction review is report-only and conservative.',
    };
  }

  try {
    const records = await adapter.listBlobRecords();
    return {
      records,
      available: true,
      partial: records.some(record => record.inventoryPartial),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      records: [],
      available: false,
      partial: true,
      warning: `Local blob inventory could not be read; eviction candidates are disabled. ${message}`,
    };
  }
}

function usageTimestamps(metadata: AttachmentMetadata): string[] {
  return [metadata.lastAccessedAt, metadata.lastOpenedAt, metadata.lastPreviewedAt]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function isRecentlyUsed(metadata: AttachmentMetadata, createdAt: string, thresholdDays: number): boolean {
  const timestamps = usageTimestamps(metadata);
  if (!timestamps.length) return false;

  const reportTime = new Date(createdAt).getTime();
  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
  return timestamps.some(value => {
    const time = new Date(value).getTime();
    return Number.isFinite(time) && reportTime - time >= 0 && reportTime - time <= thresholdMs;
  });
}

function hasIntegrityWarning(metadata: AttachmentMetadata): boolean {
  const values = [
    metadata.remoteError,
    ...(metadata.remoteVerification?.warnings ?? []),
  ].join(' ').toLowerCase();

  return values.includes('integrity')
    || values.includes('mismatch')
    || values.includes('stale upload')
    || values.includes('conflict');
}

function hasMigrationOrRestoreWarning(metadata: AttachmentMetadata): boolean {
  const values = [
    metadata.localBlobKey,
    metadata.remoteError,
    ...(metadata.remoteVerification?.warnings ?? []),
  ].join(' ').toLowerCase();

  return values.includes('migration')
    || values.includes('restore')
    || values.includes('att-migrated')
    || metadata.checksum?.startsWith('fnv1a:') === true;
}

function compatibleChecksumExists(metadata: AttachmentMetadata, inventory: AttachmentBlobInventoryRecord): boolean {
  const local = (inventory.checksum ?? metadata.checksum ?? '').toLowerCase();
  const remote = (metadata.remoteChecksum ?? '').toLowerCase();
  if (!local || !remote) return false;
  if (local.startsWith('sha256:') && remote.startsWith('sha256:')) return true;
  if (local.startsWith('md5:') && remote.startsWith('md5:')) return true;
  return /^[a-f0-9]{32}$/.test(local) && /^[a-f0-9]{32}$/.test(remote);
}

function checksumMatches(metadata: AttachmentMetadata, inventory: AttachmentBlobInventoryRecord): boolean {
  const local = (inventory.checksum ?? metadata.checksum ?? '').toLowerCase();
  const remote = (metadata.remoteChecksum ?? '').toLowerCase();
  if (!compatibleChecksumExists(metadata, inventory)) return false;
  return local.replace(/^md5:/, '') === remote.replace(/^md5:/, '');
}

function summarizeVerification(
  metadata: AttachmentMetadata,
  inventory: AttachmentBlobInventoryRecord,
): LocalBlobEvictionVerificationSummary | LocalBlobEvictionExclusionReason {
  const warnings = [...(metadata.remoteVerification?.warnings ?? [])];
  const localSize = inventory.size;
  const remoteSize = metadata.remoteSize;

  if (remoteSize === undefined) return 'remote_size_missing';
  if (!Number.isFinite(localSize)) return 'inventory_partial';
  if (localSize !== remoteSize) return 'size_mismatch';

  const sizeVerified = metadata.remoteVerification?.sizeVerified === true || localSize === remoteSize;
  if (!sizeVerified) return 'verification_incomplete';

  const hasCompatibleChecksum = compatibleChecksumExists(metadata, inventory);
  if (hasCompatibleChecksum && !checksumMatches(metadata, inventory)) return 'checksum_mismatch';

  const checksumVerified = metadata.remoteVerification?.checksumVerified === true
    || (hasCompatibleChecksum && checksumMatches(metadata, inventory));

  if (metadata.remoteVerification?.checksumAlgorithm && metadata.remoteVerification.checksumVerified === false) {
    return 'checksum_mismatch';
  }

  if (!checksumVerified) {
    const hasSizeOnlySignal = metadata.remoteVerification?.sizeOnlyVerified === true
      || warnings.some(warning => warning.toLowerCase().includes('size-only'))
      || warnings.some(warning => warning.toLowerCase().includes('incompatible'))
      || !metadata.remoteChecksum;

    if (!hasSizeOnlySignal) return 'verification_missing';

    return {
      sizeVerified: true,
      checksumVerified: false,
      checksumAlgorithm: metadata.remoteVerification?.checksumAlgorithm,
      sizeOnlyVerified: true,
      warnings: Array.from(new Set([
        ...warnings,
        'Local eviction review verified this attachment by size only; manual review is required before any future eviction.',
      ])),
    };
  }

  return {
    sizeVerified: true,
    checksumVerified: true,
    checksumAlgorithm: metadata.remoteVerification?.checksumAlgorithm ?? (hasCompatibleChecksum ? 'checksum' : undefined),
    warnings: warnings.length ? Array.from(new Set(warnings)) : undefined,
  };
}

export async function buildLocalBlobEvictionReview(
  input: BuildLocalBlobEvictionReviewInput = {},
): Promise<LocalBlobEvictionReport> {
  const createdAt = nowIso(input.now);
  const thresholdDays = input.recentlyUsedThresholdDays ?? DEFAULT_RECENTLY_USED_THRESHOLD_DAYS;
  const attachmentRead = await readAttachments(input);
  const inventoryRead = await readBlobInventory(input);
  const warnings = inventoryRead.warning ? [inventoryRead.warning] : [];
  const errors = [...attachmentRead.errors];
  const inventoryByKey = new Map(inventoryRead.records.map(record => [record.localBlobKey, record]));
  const candidates: LocalBlobEvictionCandidate[] = [];
  const exclusions: LocalBlobEvictionExclusion[] = [];

  if (inventoryRead.partial) {
    warnings.push('Local blob inventory is partial; K-164 does not classify partial inventory records as normal eviction candidates.');
  }

  for (const metadata of attachmentRead.attachments) {
    if (isDeleted(metadata)) {
      addExclusion(exclusions, metadata, 'deleted_metadata', 'Deleted or tombstoned metadata is not part of eviction review.');
      continue;
    }

    if (!metadata.localBlobKey) {
      addExclusion(exclusions, metadata, 'missing_local_blob_key', 'No local blob key exists.');
      continue;
    }

    const inventory = inventoryByKey.get(metadata.localBlobKey);
    if (!inventory) {
      addExclusion(exclusions, metadata, inventoryRead.available ? 'local_blob_missing' : 'inventory_unavailable', 'Local blob inventory does not confirm this blob exists.');
      continue;
    }

    if (inventory.inventoryPartial) {
      addExclusion(exclusions, metadata, 'inventory_partial', 'Local blob inventory record is partial.');
      continue;
    }

    if (!metadata.remoteProvider) {
      addExclusion(exclusions, metadata, 'missing_remote_provider', 'Attachment is not remote-backed.');
      continue;
    }

    if (!metadata.remoteFileId) {
      addExclusion(exclusions, metadata, 'missing_remote_file_id', 'Attachment is missing remote recovery file id.');
      continue;
    }

    if (!metadata.remoteSyncStatus || !EVICTABLE_REMOTE_STATUSES.has(metadata.remoteSyncStatus)) {
      addExclusion(exclusions, metadata, STATUS_EXCLUSIONS.has(metadata.remoteSyncStatus as AttachmentRemoteSyncStatus) ? 'remote_status_excluded' : 'stale_upload_conflict', 'Remote sync status is not eligible for local eviction review.');
      continue;
    }

    if (metadata.keepOffline === true) {
      addExclusion(exclusions, metadata, 'keep_offline', 'Attachment is marked to stay available offline.');
      continue;
    }

    if (isRecentlyUsed(metadata, createdAt, thresholdDays)) {
      addExclusion(exclusions, metadata, 'recently_used', `Attachment was used within the last ${thresholdDays} days.`);
      continue;
    }

    if (hasMigrationOrRestoreWarning(metadata)) {
      addExclusion(exclusions, metadata, 'migration_or_restore_warning', 'Migration or restore warning requires manual review outside eviction.');
      continue;
    }

    if (hasIntegrityWarning(metadata)) {
      addExclusion(exclusions, metadata, 'data_integrity_warning', 'Integrity warning requires manual review outside eviction.');
      continue;
    }

    const verification = summarizeVerification(metadata, inventory);
    if (typeof verification === 'string') {
      addExclusion(exclusions, metadata, verification, 'Verification is insufficient for normal eviction candidacy.');
      continue;
    }

    const sizeOnly = verification.sizeOnlyVerified === true || (verification.sizeVerified && !verification.checksumVerified);
    candidates.push({
      candidateId: `local-blob-eviction:${metadata.id}:${metadata.localBlobKey}`,
      attachmentId: metadata.id,
      localBlobKey: metadata.localBlobKey,
      remoteProvider: metadata.remoteProvider,
      remoteFileId: metadata.remoteFileId,
      estimatedBytes: inventory.size,
      verification,
      reason: sizeOnly
        ? 'Remote-backed local blob has matching size but lacks compatible checksum verification.'
        : 'Remote-backed local blob has matching size and checksum verification.',
      confidence: sizeOnly ? 'medium' : 'high',
      recommendedAction: sizeOnly ? 'review_only' : 'eligible_for_future_eviction',
    });
  }

  const sizeOnlyCandidateCount = candidates.filter(candidate => candidate.verification.sizeOnlyVerified).length;
  const fullyVerifiedCandidateCount = candidates.filter(candidate => candidate.verification.sizeVerified && candidate.verification.checksumVerified).length;

  return {
    reportId: reportIdFor(createdAt),
    createdAt,
    dryRun: true,
    attachmentsScanned: attachmentRead.attachments.length,
    blobsScanned: inventoryRead.records.length,
    candidateCount: candidates.length,
    excludedCount: exclusions.length,
    needsReviewCount: sizeOnlyCandidateCount + exclusions.filter(item => item.reason === 'migration_or_restore_warning' || item.reason === 'data_integrity_warning' || item.reason === 'stale_upload_conflict').length,
    estimatedRecoverableBytes: candidates.reduce((total, candidate) => total + candidate.estimatedBytes, 0),
    sizeOnlyCandidateCount,
    fullyVerifiedCandidateCount,
    protectedKeepOfflineCount: exclusions.filter(item => item.reason === 'keep_offline').length,
    recentlyUsedExcludedCount: exclusions.filter(item => item.reason === 'recently_used').length,
    statusExcludedCount: exclusions.filter(item => item.reason === 'remote_status_excluded' || item.reason === 'stale_upload_conflict').length,
    verificationExcludedCount: exclusions.filter(item => [
      'remote_size_missing',
      'size_mismatch',
      'verification_missing',
      'verification_incomplete',
      'checksum_mismatch',
      'inventory_partial',
    ].includes(item.reason)).length,
    inventoryAvailable: inventoryRead.available,
    inventoryPartial: inventoryRead.partial,
    candidates,
    exclusions,
    warnings,
    errors,
  };
}
