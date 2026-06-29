import type { AttachmentUploadDiagnosticsItem } from './attachmentSyncDiagnostics';
import { formatUploadFailureForUi, getUploadManualReviewDiagnostics } from './attachmentUploadFailureLabel';
import { sanitizeRemoteBlobProviderErrorMessage, type RemoteBlobProviderType } from './remoteBlobProvider';

export interface UploadQueueAvailability {
  readonly canUpload: boolean;
  readonly reasonCode?: string;
  readonly reasonLabel: string;
}

export interface ManualUploadQueueReviewItem {
  readonly attachmentId: string;
  readonly providerType?: RemoteBlobProviderType;
  readonly localSizeBytes?: number;
  readonly label: string;
  readonly reasonCode: string;
  readonly manualReview: boolean;
  readonly remoteObjectAmbiguous: boolean;
}

export interface ManualUploadQueueReview {
  readonly summary: {
    readonly totalItems: number;
    readonly eligibleCount: number;
    readonly blockedCount: number;
    readonly manualReviewCount: number;
    readonly alreadySyncedCount: number;
    readonly missingLocalCount: number;
    readonly unknownEligibleSizeCount: number;
    readonly estimatedEligibleBytes: number;
    readonly providerCounts: Record<string, number>;
  };
  readonly groups: {
    readonly eligible: ManualUploadQueueReviewItem[];
    readonly blocked: ManualUploadQueueReviewItem[];
    readonly manualReview: ManualUploadQueueReviewItem[];
    readonly alreadySynced: ManualUploadQueueReviewItem[];
  };
}

export interface BuildManualUploadQueueReviewInput {
  readonly items: readonly AttachmentUploadDiagnosticsItem[];
  readonly getAvailability?: (item: AttachmentUploadDiagnosticsItem) => UploadQueueAvailability;
}

function normalized(value: string | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

function safeLabel(value: string): string {
  return sanitizeRemoteBlobProviderErrorMessage(value);
}

function reasonCodeFor(item: AttachmentUploadDiagnosticsItem, availability?: UploadQueueAvailability): string {
  if (availability?.reasonCode) return availability.reasonCode;
  const status = normalized(item.remoteSyncStatus);
  const reason = normalized(item.reason);
  if (status === 'synced') return 'already_synced';
  if (status) return status;
  if (reason.includes('missing')) return 'local_blob_missing';
  return item.eligible ? 'ready_for_upload' : 'not_uploadable';
}

function isRemoteAmbiguous(code: string, reason: string): boolean {
  return code === 'metadata_update_failed'
    || code === 'remote_conflict'
    || code === 'invalid_response'
    || code === 'invalid_remote_response'
    || code === 'invalid_upload_response'
    || code === 'missing_remote_id'
    || code === 'size_mismatch'
    || code === 'checksum_mismatch'
    || reason.includes('metadata_update_failed')
    || reason.includes('remote upload may have completed')
    || reason.includes('verification')
    || reason.includes('remote_conflict')
    || reason.includes('invalid response');
}

function isManualReview(code: string, reason: string, availability?: UploadQueueAvailability): boolean {
  return availability?.reasonCode === 'manual_review_required'
    || code === 'failed'
    || code === 'metadata_update_failed'
    || code === 'remote_conflict'
    || code === 'invalid_response'
    || code === 'invalid_remote_response'
    || code === 'invalid_upload_response'
    || code === 'missing_remote_id'
    || code === 'size_mismatch'
    || code === 'checksum_mismatch'
    || reason.includes('requires review')
    || reason.includes('manual review')
    || isRemoteAmbiguous(code, reason);
}

function reviewItem(
  item: AttachmentUploadDiagnosticsItem,
  reasonCode: string,
  label: string,
  options: { manualReview?: boolean; remoteObjectAmbiguous?: boolean } = {},
): ManualUploadQueueReviewItem {
  return {
    attachmentId: item.attachmentId,
    providerType: item.remoteProvider,
    localSizeBytes: item.localSize,
    label: safeLabel(label),
    reasonCode,
    manualReview: Boolean(options.manualReview),
    remoteObjectAmbiguous: Boolean(options.remoteObjectAmbiguous),
  };
}

export function buildManualUploadQueueReview(
  input: BuildManualUploadQueueReviewInput,
): ManualUploadQueueReview {
  const eligible: ManualUploadQueueReviewItem[] = [];
  const blocked: ManualUploadQueueReviewItem[] = [];
  const manualReview: ManualUploadQueueReviewItem[] = [];
  const alreadySynced: ManualUploadQueueReviewItem[] = [];
  const providerCounts: Record<string, number> = {};
  let missingLocalCount = 0;
  let estimatedEligibleBytes = 0;
  let unknownEligibleSizeCount = 0;

  for (const item of input.items) {
    const availability = input.getAvailability?.(item);
    const code = reasonCodeFor(item, availability);
    const reason = normalized(item.reason);
    const provider = item.remoteProvider ?? 'none';
    providerCounts[provider] = (providerCounts[provider] ?? 0) + 1;

    if (!item.localBlobPresent) missingLocalCount += 1;

    if (item.remoteSyncStatus === 'synced' && item.remoteProvider === 'googleDrive' && item.remoteFileId) {
      alreadySynced.push(reviewItem(item, 'already_synced', 'Already synced'));
      continue;
    }

    if (isManualReview(code, reason, availability)) {
      const diagnostics = getUploadManualReviewDiagnostics({
        providerType: item.remoteProvider,
        reasonCode: code === 'failed' ? 'metadata_update_failed' : code,
        manualReview: true,
        remoteObjectAmbiguous: isRemoteAmbiguous(code, reason),
      });
      manualReview.push(reviewItem(item, diagnostics.reasonCode, diagnostics.title, {
        manualReview: true,
        remoteObjectAmbiguous: diagnostics.safeTechnicalDetails.remoteObjectAmbiguous,
      }));
      continue;
    }

    if (availability?.canUpload || (item.eligible && item.localBlobPresent && item.remoteSyncStatus === 'local_only')) {
      eligible.push(reviewItem(item, 'ready_for_upload', 'Ready for manual upload'));
      if (typeof item.localSize === 'number' && Number.isFinite(item.localSize)) {
        estimatedEligibleBytes += item.localSize;
      } else {
        unknownEligibleSizeCount += 1;
      }
      continue;
    }

    const display = formatUploadFailureForUi({
      providerType: item.remoteProvider,
      reasonCode: availability?.reasonCode ?? code,
    });
    blocked.push(reviewItem(item, availability?.reasonCode ?? code, availability?.reasonLabel ?? display.title));
  }

  return {
    summary: {
      totalItems: input.items.length,
      eligibleCount: eligible.length,
      blockedCount: blocked.length,
      manualReviewCount: manualReview.length,
      alreadySyncedCount: alreadySynced.length,
      missingLocalCount,
      unknownEligibleSizeCount,
      estimatedEligibleBytes,
      providerCounts,
    },
    groups: {
      eligible,
      blocked,
      manualReview,
      alreadySynced,
    },
  };
}
