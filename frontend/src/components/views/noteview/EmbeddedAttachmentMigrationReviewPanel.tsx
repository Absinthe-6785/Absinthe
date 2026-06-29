import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import type {
  EmbeddedAttachmentAuditReport,
  EmbeddedAttachmentAuditNoteInput,
} from '../../../lib/embeddedAttachmentAudit';
import { auditEmbeddedAttachments } from '../../../lib/embeddedAttachmentAudit';
import {
  buildAttachmentCleanupReview,
  type AttachmentCleanupReviewCandidate,
  type AttachmentCleanupReviewReport,
} from '../../../lib/attachmentCleanupReview';
import {
  attachmentCleanupCandidateId,
  createAttachmentCleanupConfirmationToken,
  executeAttachmentCleanup,
  hashAttachmentCleanupReviewReport,
  type AttachmentCleanupExecutorReport,
} from '../../../lib/attachmentCleanupExecutor';
import {
  buildAttachmentSyncDiagnostics,
  type AttachmentRecoveryDiagnosticsItem,
  type AttachmentSyncDiagnostics,
} from '../../../lib/attachmentSyncDiagnostics';
import {
  recoverAttachmentBlobFromRemote,
  type AttachmentRemoteRecoveryResult,
} from '../../../lib/attachmentRemoteRecovery';
import {
  uploadAttachmentBlobToRemote,
  type AttachmentExplicitUploadResult,
} from '../../../lib/attachmentExplicitUploadAction';
import { formatRecoveryFailureForUi } from '../../../lib/attachmentRecoveryFailureLabel';
import {
  formatUploadFailureForUi,
  getUploadManualReviewDiagnostics,
} from '../../../lib/attachmentUploadFailureLabel';
import { buildManualUploadQueueReview, type ManualUploadQueueReviewItem } from '../../../lib/attachmentUploadQueueReview';
import type { AttachmentRepository, BlobStorageAdapter } from '../../../lib/attachmentRepository';
import { createLocalAttachmentBlobAdapter } from '../../../lib/attachmentBlobIndexedDb';
import { createLocalAttachmentMetadataRepository } from '../../../lib/attachmentMetadataIndexedDb';
import { GoogleDriveBlobAdapter } from '../../../lib/googleDriveBlobAdapter';
import { sanitizeRemoteBlobProviderErrorMessage } from '../../../lib/remoteBlobProvider';
import {
  recoveryUnavailableReasonForProvider,
  resolveRemoteProviderConnectionBoundary,
  type RemoteProviderConnectionBoundary,
} from '../../../lib/remoteProviderConnectionStatus';
import type { GoogleDriveSessionConnectionController } from '../../../lib/googleDriveSessionConnectionController';
import {
  migrateEmbeddedDataUrlsToAttachments,
  hashEmbeddedAttachmentMigrationText,
  type EmbeddedAttachmentMigrationReport,
} from '../../../lib/embeddedAttachmentMigration';
import {
  createLocalEmbeddedAttachmentMigrationBackupReader,
  listEmbeddedAttachmentMigrationBackups,
  restoreEmbeddedAttachmentMigrationBackup,
  type EmbeddedAttachmentMigrationBackupSummary,
  type EmbeddedAttachmentMigrationRestoreReport,
} from '../../../lib/embeddedAttachmentMigrationRestore';
import type { NoteChromeColors } from '../noteEditorTheme';
import type { NoteBase as Note } from '../noteUtils';
import { GoogleDriveManualConnectionPanel } from './GoogleDriveManualConnectionPanel';

type MigrationReviewState = 'idle' | 'scanning' | 'ready' | 'migrating' | 'complete' | 'error';
type CleanupReviewState = 'idle' | 'reviewing' | 'complete' | 'error';
type CleanupExecutionState = 'idle' | 'running' | 'complete' | 'error';
type BackupInspectionState = 'idle' | 'loading' | 'ready' | 'error';
type BackupRestoreState = 'idle' | 'running' | 'complete' | 'error';
type DiagnosticsState = 'idle' | 'loading' | 'ready' | 'error';
type RecoveryActionState = 'idle' | 'running' | 'complete' | 'error';
type UploadActionState = 'idle' | 'running' | 'complete' | 'error';
type UploadQueueRunState = 'idle' | 'running' | 'complete' | 'error';
type UploadQueueRunReport = {
  readonly selectedCount: number;
  readonly succeededCount: number;
  readonly failedCount: number;
  readonly notStartedCount: number;
  readonly stoppedOnFirstFailure: boolean;
  readonly failedAttachmentId?: string;
  readonly failureReason?: string;
};
type AttachmentRecoveryBlockedReason =
  | 'provider_not_configured'
  | 'provider_unavailable'
  | 'provider_mismatch'
  | 'session_expired'
  | 'reconnect_required'
  | 'recovery_controller_unavailable'
  | 'token_provider_unavailable'
  | 'download_unsupported'
  | 'remote_file_missing'
  | 'local_blob_already_present'
  | 'item_not_recoverable'
  | 'blocked_sync_state'
  | 'attachment_deleted'
  | 'attachment_tombstoned'
  | 'missing_local_but_not_remote_backed'
  | 'recovery_in_progress';
type AttachmentUploadBlockedReason =
  | 'provider_not_configured'
  | 'provider_unavailable'
  | 'provider_mismatch'
  | 'session_expired'
  | 'reconnect_required'
  | 'token_provider_unavailable'
  | 'upload_controller_unavailable'
  | 'upload_unsupported'
  | 'local_blob_missing'
  | 'local_blob_unreadable'
  | 'item_not_uploadable'
  | 'blocked_sync_state'
  | 'attachment_deleted'
  | 'attachment_tombstoned'
  | 'upload_in_progress'
  | 'another_upload_in_progress'
  | 'manual_review_required';

interface RecoveryEligibility {
  readonly canRecover: boolean;
  readonly reasonCode?: AttachmentRecoveryBlockedReason;
  readonly reasonLabel: string;
  readonly severity?: 'info' | 'warning' | 'blocked';
}

interface UploadEligibility {
  readonly canUpload: boolean;
  readonly reasonCode?: AttachmentUploadBlockedReason;
  readonly reasonLabel: string;
  readonly severity?: 'info' | 'warning' | 'blocked';
}

const maxManualUploadQueueSelection = 3;

export interface EmbeddedAttachmentMigrationReviewPanelProps {
  notes: readonly Note[];
  colors: NoteChromeColors;
  updateNote: (id: string, patch: Partial<Note>) => void;
  auditFn?: (notes: readonly EmbeddedAttachmentAuditNoteInput[]) => EmbeddedAttachmentAuditReport;
  migrateFn?: typeof migrateEmbeddedDataUrlsToAttachments;
  cleanupReviewFn?: typeof buildAttachmentCleanupReview;
  cleanupExecutorFn?: typeof executeAttachmentCleanup;
  listBackupsFn?: typeof listEmbeddedAttachmentMigrationBackups;
  restoreBackupFn?: typeof restoreEmbeddedAttachmentMigrationBackup;
  diagnosticsFn?: typeof buildAttachmentSyncDiagnostics;
  recoverAttachmentFn?: (attachmentId: string) => Promise<AttachmentRemoteRecoveryResult>;
  uploadAttachmentFn?: (attachmentId: string) => Promise<AttachmentExplicitUploadResult>;
  remoteProviderConnection?: RemoteProviderConnectionBoundary;
  googleDriveSessionController?: GoogleDriveSessionConnectionController | null;
  googleDriveRecoveryFetcher?: typeof fetch;
  googleDriveRecoveryRepository?: AttachmentRepository;
  googleDriveRecoveryBlobAdapter?: BlobStorageAdapter;
  googleDriveUploadFetcher?: typeof fetch;
  googleDriveUploadRepository?: AttachmentRepository;
  googleDriveUploadBlobAdapter?: BlobStorageAdapter;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\bdata:([^;,\s)"']+)(?:;[^,\s)"']*)*;base64,[A-Za-z0-9+/=]+/gi, 'data:$1;base64,[omitted]');
}

function noteTitle(note: Note | undefined, id: string): string {
  const title = note?.title?.trim();
  return title || id;
}

function shortValue(value: string | undefined): string {
  if (!value) return '';
  return value.length <= 28 ? value : `${value.slice(0, 12)}...${value.slice(-10)}`;
}

function hasSessionAccessTokenProvider(controller?: GoogleDriveSessionConnectionController | null): boolean {
  try {
    return Boolean(controller?.getAccessTokenProvider());
  } catch {
    return false;
  }
}

function recoveryUnavailableReasonCode(provider: RemoteProviderConnectionBoundary): AttachmentRecoveryBlockedReason {
  if (provider.status === 'unconfigured') return 'provider_not_configured';
  if (provider.status === 'auth_expired') return 'session_expired';
  if (provider.status === 'reconnect_required') return 'reconnect_required';
  if (provider.status === 'unsupported' || !provider.canDownload) return 'download_unsupported';
  if (provider.status === 'disabled_by_user' || provider.status === 'unavailable' || provider.status === 'error') return 'provider_unavailable';
  return 'provider_unavailable';
}

function reasonLabel(code: AttachmentRecoveryBlockedReason, fallback?: string): string {
  switch (code) {
    case 'provider_not_configured':
      return 'Provider not configured';
    case 'provider_unavailable':
      return 'Provider unavailable';
    case 'provider_mismatch':
      return 'Provider mismatch';
    case 'session_expired':
      return 'Session expired';
    case 'reconnect_required':
      return 'Reconnect required';
    case 'recovery_controller_unavailable':
      return 'Recovery controller unavailable';
    case 'token_provider_unavailable':
      return 'Token provider unavailable';
    case 'download_unsupported':
      return 'Download unsupported';
    case 'remote_file_missing':
      return 'Remote file missing';
    case 'local_blob_already_present':
      return 'Local blob already present';
    case 'blocked_sync_state':
      return 'Sync state blocks recovery';
    case 'attachment_deleted':
      return 'Attachment is deleted';
    case 'attachment_tombstoned':
      return 'Attachment is tombstoned';
    case 'missing_local_but_not_remote_backed':
      return 'Missing local blob is not remote-backed';
    case 'recovery_in_progress':
      return 'Recovery already in progress';
    case 'item_not_recoverable':
    default:
      return 'Attachment is not recoverable';
  }
}

function uploadReasonLabel(code: AttachmentUploadBlockedReason): string {
  switch (code) {
    case 'provider_not_configured':
      return 'Provider not configured';
    case 'provider_unavailable':
      return 'Provider unavailable';
    case 'provider_mismatch':
      return 'Provider mismatch';
    case 'session_expired':
      return 'Session expired';
    case 'reconnect_required':
      return 'Reconnect required';
    case 'token_provider_unavailable':
      return 'Token provider unavailable';
    case 'upload_controller_unavailable':
      return 'Upload controller unavailable';
    case 'upload_unsupported':
      return 'Upload unsupported';
    case 'local_blob_missing':
      return 'Local blob missing';
    case 'local_blob_unreadable':
      return 'Local blob unreadable';
    case 'blocked_sync_state':
      return 'Sync state blocks upload';
    case 'attachment_deleted':
      return 'Attachment is deleted';
    case 'attachment_tombstoned':
      return 'Attachment is tombstoned';
    case 'upload_in_progress':
      return 'Upload already in progress';
    case 'another_upload_in_progress':
      return 'Another upload is in progress';
    case 'manual_review_required':
      return 'Manual review required';
    case 'item_not_uploadable':
    default:
      return 'Attachment is not uploadable';
  }
}

function blocked(
  reasonCode: AttachmentRecoveryBlockedReason,
  fallback?: string,
  severity: RecoveryEligibility['severity'] = 'blocked',
): RecoveryEligibility {
  return {
    canRecover: false,
    reasonCode,
    reasonLabel: reasonLabel(reasonCode, fallback),
    severity,
  };
}

function uploadBlocked(
  reasonCode: AttachmentUploadBlockedReason,
  severity: UploadEligibility['severity'] = 'blocked',
): UploadEligibility {
  return {
    canUpload: false,
    reasonCode,
    reasonLabel: uploadReasonLabel(reasonCode),
    severity,
  };
}

function uploadUnavailableReasonCode(provider: RemoteProviderConnectionBoundary): AttachmentUploadBlockedReason {
  if (provider.status === 'unconfigured') return 'provider_not_configured';
  if (provider.status === 'auth_expired') return 'session_expired';
  if (provider.status === 'reconnect_required') return 'reconnect_required';
  if (provider.status === 'unsupported' || !provider.canUpload) return 'upload_unsupported';
  if (provider.status === 'disabled_by_user' || provider.status === 'unavailable' || provider.status === 'error') return 'provider_unavailable';
  return 'provider_unavailable';
}

function getAttachmentRecoveryAvailability(input: {
  readonly item: AttachmentRecoveryDiagnosticsItem;
  readonly providerConnection: RemoteProviderConnectionBoundary;
  readonly hasRecoveryController: boolean;
  readonly googleDriveSessionController?: GoogleDriveSessionConnectionController | null;
  readonly runningRecoveryAttachmentId?: string | null;
}): RecoveryEligibility {
  const { item, providerConnection, hasRecoveryController, googleDriveSessionController, runningRecoveryAttachmentId } = input;
  if (runningRecoveryAttachmentId === item.attachmentId) return blocked('recovery_in_progress', undefined, 'info');
  if (item.localBlobPresent) return blocked('local_blob_already_present', item.reason, 'info');
  const status = String(item.remoteSyncStatus ?? '').toLowerCase();
  const reason = item.reason.toLowerCase();
  if (status === 'deleted' || reason.includes('deleted')) return blocked('attachment_deleted');
  if (reason.includes('tombstone')) return blocked('attachment_tombstoned');
  if (!item.remoteProvider) return blocked('missing_local_but_not_remote_backed', item.reason, 'info');
  if (item.remoteProvider !== 'googleDrive') return blocked('provider_mismatch');
  if (!item.remoteFileId) return blocked('remote_file_missing', item.reason, 'warning');
  if (['pending_upload', 'uploading', 'failed', 'paused_offline', 'conflict', 'local_only', 'missing_local'].includes(status)) {
    return blocked('blocked_sync_state', item.reason, 'warning');
  }
  if (!item.eligible) return blocked('item_not_recoverable', item.reason, 'info');
  if (providerConnection.providerType && providerConnection.providerType !== 'googleDrive') {
    return blocked('provider_mismatch');
  }
  if (providerConnection.status === 'auth_expired') return blocked('session_expired');
  if (providerConnection.status === 'reconnect_required') return blocked('reconnect_required');
  if (!providerConnection.canRecover || providerConnection.status !== 'available') {
    const code = recoveryUnavailableReasonCode(providerConnection);
    return blocked(code, recoveryUnavailableReasonForProvider(providerConnection, hasRecoveryController, item.remoteProvider));
  }
  if (!googleDriveSessionController) return blocked('provider_not_configured');
  if (!hasSessionAccessTokenProvider(googleDriveSessionController)) return blocked('token_provider_unavailable');
  if (!hasRecoveryController) return blocked('recovery_controller_unavailable');
  return { canRecover: true, reasonLabel: 'Ready for explicit recovery', severity: 'info' };
}

function getAttachmentUploadAvailability(input: {
  readonly item: AttachmentSyncDiagnostics['uploadItems'][number];
  readonly providerConnection: RemoteProviderConnectionBoundary;
  readonly hasUploadController: boolean;
  readonly googleDriveSessionController?: GoogleDriveSessionConnectionController | null;
  readonly runningUploadAttachmentId?: string | null;
}): UploadEligibility {
  const { item, providerConnection, hasUploadController, googleDriveSessionController, runningUploadAttachmentId } = input;
  if (runningUploadAttachmentId === item.attachmentId) return uploadBlocked('upload_in_progress', 'info');
  if (runningUploadAttachmentId) return uploadBlocked('another_upload_in_progress', 'info');
  const status = String(item.remoteSyncStatus ?? '').toLowerCase();
  const reason = item.reason.toLowerCase();
  if (status === 'deleted' || reason.includes('deleted')) return uploadBlocked('attachment_deleted');
  if (reason.includes('tombstone')) return uploadBlocked('attachment_tombstoned');
  if (!item.localBlobKey || !item.localBlobPresent) return uploadBlocked('local_blob_missing', 'warning');
  if (item.remoteProvider && item.remoteProvider !== 'googleDrive') return uploadBlocked('provider_mismatch');
  if (status === 'failed') return uploadBlocked('manual_review_required', 'warning');
  if (['pending_upload', 'uploading', 'failed', 'paused_offline', 'conflict', 'missing_local', 'recoverable_remote'].includes(status)) {
    return uploadBlocked('blocked_sync_state', 'warning');
  }
  if (!item.eligible) return uploadBlocked('item_not_uploadable', 'info');
  if (providerConnection.providerType && providerConnection.providerType !== 'googleDrive') return uploadBlocked('provider_mismatch');
  if (providerConnection.status === 'auth_expired') return uploadBlocked('session_expired');
  if (providerConnection.status === 'reconnect_required') return uploadBlocked('reconnect_required');
  if (!providerConnection.canUpload || providerConnection.status !== 'available') {
    return uploadBlocked(uploadUnavailableReasonCode(providerConnection));
  }
  if (!googleDriveSessionController) return uploadBlocked('provider_not_configured');
  if (!hasSessionAccessTokenProvider(googleDriveSessionController)) return uploadBlocked('token_provider_unavailable');
  if (!hasUploadController) return uploadBlocked('upload_controller_unavailable');
  return { canUpload: true, reasonLabel: 'Ready for explicit upload', severity: 'info' };
}

type CleanupReviewNumericKey = {
  [Key in keyof AttachmentCleanupReviewReport]: AttachmentCleanupReviewReport[Key] extends number ? Key : never
}[keyof AttachmentCleanupReviewReport];

const cleanupSummaryRows: Array<[string, CleanupReviewNumericKey]> = [
  ['Notes scanned', 'notesScanned'],
  ['Attachments scanned', 'attachmentsScanned'],
  ['Blobs scanned', 'blobsScanned'],
  ['Backups scanned', 'backupsScanned'],
  ['Referenced attachments', 'referencedAttachmentCount'],
  ['Unreferenced metadata', 'unreferencedAttachmentMetadataCount'],
  ['Unreferenced blobs', 'unreferencedBlobCount'],
  ['Partial migration artifacts', 'partialMigrationArtifactCount'],
  ['Restored migration artifacts', 'restoredMigrationArtifactCount'],
  ['Missing blobs', 'missingBlobCount'],
  ['Missing metadata', 'missingMetadataCount'],
  ['Duplicate candidates', 'duplicateCandidateCount'],
  ['Backup records', 'backupRecordCount'],
];

const cleanupTypeLabels: Record<string, string> = {
  referencedAttachment: 'Referenced attachments',
  unreferencedAttachmentMetadata: 'Unreferenced attachment metadata',
  unreferencedBlob: 'Unreferenced blobs',
  partialMigrationArtifact: 'Partial migration artifacts',
  restoredMigrationArtifact: 'Restored migration artifacts',
  backupRecord: 'Backup records',
  missingBlob: 'Missing blob',
  missingMetadata: 'Missing metadata',
  duplicateCandidate: 'Duplicate candidates',
};

const cleanupStatusLabels: Record<string, string> = {
  referencedAttachment: 'in use',
  unreferencedAttachmentMetadata: 'review candidate',
  unreferencedBlob: 'review candidate',
  partialMigrationArtifact: 'warning',
  restoredMigrationArtifact: 'preserved',
  backupRecord: 'preserved',
  missingBlob: 'data integrity warning',
  missingMetadata: 'data integrity warning',
  duplicateCandidate: 'review required',
};

const cleanupResultLabels: Record<string, string> = {
  deleted: 'Deleted',
  skipped: 'Skipped',
  blocked: 'Blocked',
  failed: 'Failed',
};

const diagnosticsStatusRows = [
  ['Total attachments', 'total'],
  ['Local only', 'local_only'],
  ['Pending upload', 'pending_upload'],
  ['Uploading', 'uploading'],
  ['Synced', 'synced'],
  ['Failed', 'failed'],
  ['Paused offline', 'paused_offline'],
  ['Recoverable remote', 'recoverable_remote'],
  ['Missing local', 'missing_local'],
  ['Conflict', 'conflict'],
  ['Local blob present', 'localBlobPresent'],
  ['Local blob missing', 'localBlobMissing'],
  ['Keep offline', 'keepOffline'],
  ['Unknown', 'unknown'],
] as const;

const diagnosticsVerificationRows: Array<[string, keyof AttachmentSyncDiagnostics['verificationCounts']]> = [
  ['All remote-backed: fully verified', 'allRemoteBackedFullyVerified'],
  ['All remote-backed: size-only', 'allRemoteBackedSizeOnlyVerified'],
  ['Eligible synced/recoverable: fully verified', 'eligibleRecoverableFullyVerified'],
  ['Eligible synced/recoverable: size-only', 'eligibleRecoverableSizeOnlyVerified'],
  ['Verification warnings', 'verificationWarningCount'],
  ['Verification missing', 'verificationMissingCount'],
  ['Checksum mismatch', 'checksumMismatchCount'],
  ['Size mismatch', 'sizeMismatchCount'],
  ['Stale upload conflict', 'staleUploadConflictCount'],
  ['Provider errors', 'providerErrorCount'],
];

const diagnosticsEvictionRows: Array<[string, keyof AttachmentSyncDiagnostics['evictionSummary']]> = [
  ['Eviction candidates', 'candidateCount'],
  ['Fully verified candidates', 'fullyVerifiedCandidateCount'],
  ['Review-only candidates', 'sizeOnlyCandidateCount'],
  ['Excluded', 'excludedCount'],
  ['Needs review', 'needsReviewCount'],
  ['Keep offline protected', 'protectedKeepOfflineCount'],
  ['Recently used excluded', 'recentlyUsedExcludedCount'],
  ['Status excluded', 'statusExcludedCount'],
  ['Verification excluded', 'verificationExcludedCount'],
];

function isSelectableCleanupCandidate(candidate: AttachmentCleanupReviewCandidate): boolean {
  return candidate.type === 'unreferencedBlob' || candidate.type === 'unreferencedAttachmentMetadata';
}

function cleanupBlockedReason(candidate: AttachmentCleanupReviewCandidate): string {
  if (isSelectableCleanupCandidate(candidate)) return 'Selectable after review.';
  if (candidate.type === 'referencedAttachment') return 'In use by note content.';
  if (candidate.type === 'backupRecord') return 'Backup records are preserved.';
  if (candidate.type === 'restoredMigrationArtifact') return 'Restored migration traces are preserved.';
  if (candidate.type === 'missingBlob' || candidate.type === 'missingMetadata') return 'Integrity warning; manual restore or repair may be needed.';
  if (candidate.type === 'partialMigrationArtifact') return 'Partial migration artifact; inspect the migration result first.';
  if (candidate.type === 'duplicateCandidate') return 'Duplicate candidate; resolve manually before cleanup.';
  return 'Not eligible for explicit cleanup.';
}

type BackupEligibilityStatus =
  | 'restorable'
  | 'current-note-changed'
  | 'missing-note'
  | 'missing-hash'
  | 'restore-unavailable';

interface BackupEligibility {
  status: BackupEligibilityStatus;
  label: string;
  safe: boolean;
  reason: string;
  expectedBodyHash?: string;
  expectedContentHash?: string;
}

function backupConfirmationPhrase(summary: EmbeddedAttachmentMigrationBackupSummary): string {
  return `RESTORE ${summary.backupKey.slice(0, 18)}`;
}

function backupEligibility(input: {
  summary: EmbeddedAttachmentMigrationBackupSummary;
  notesById: Map<string, Note>;
  migrationReport: EmbeddedAttachmentMigrationReport | null;
}): BackupEligibility {
  const note = input.notesById.get(input.summary.noteId);
  if (!note || note.deletedAt) {
    return {
      status: 'missing-note',
      label: 'Missing note',
      safe: false,
      reason: 'The note for this backup is missing or deleted.',
    };
  }

  const migrationResult = input.migrationReport?.noteResults.find(result => (
    result.backupKey === input.summary.backupKey && result.noteId === input.summary.noteId
  ));
  if (!migrationResult) {
    return {
      status: 'restore-unavailable',
      label: 'Restore unavailable',
      safe: false,
      reason: 'Safe restore requires the current migration report so the migrated note hash can be verified.',
    };
  }

  if (!migrationResult.rewrittenBodyHash) {
    return {
      status: 'missing-hash',
      label: 'Restore unavailable',
      safe: false,
      reason: 'This backup has no migrated body hash to verify against the current note.',
    };
  }

  const currentBodyHash = hashEmbeddedAttachmentMigrationText(note.body ?? '');
  const currentContentHash = hashEmbeddedAttachmentMigrationText('');
  if (
    migrationResult.rewrittenBodyHash !== currentBodyHash
    || (migrationResult.rewrittenContentHash && migrationResult.rewrittenContentHash !== currentContentHash)
  ) {
    return {
      status: 'current-note-changed',
      label: 'Current note changed',
      safe: false,
      reason: 'The current note no longer matches the migrated backup checkpoint. Normal restore is blocked.',
      expectedBodyHash: migrationResult.rewrittenBodyHash,
      expectedContentHash: migrationResult.rewrittenContentHash,
    };
  }

  return {
    status: 'restorable',
    label: 'Restorable',
    safe: true,
    reason: 'Current note matches the migrated checkpoint. Restore can replace it with the preserved original body.',
    expectedBodyHash: migrationResult.rewrittenBodyHash,
    expectedContentHash: migrationResult.rewrittenContentHash,
  };
}

export function EmbeddedAttachmentMigrationReviewPanel({
  notes,
  colors: c,
  updateNote,
  auditFn = auditEmbeddedAttachments,
  migrateFn = migrateEmbeddedDataUrlsToAttachments,
  cleanupReviewFn = buildAttachmentCleanupReview,
  cleanupExecutorFn = executeAttachmentCleanup,
  listBackupsFn = listEmbeddedAttachmentMigrationBackups,
  restoreBackupFn = restoreEmbeddedAttachmentMigrationBackup,
  diagnosticsFn = buildAttachmentSyncDiagnostics,
  recoverAttachmentFn,
  uploadAttachmentFn,
  remoteProviderConnection,
  googleDriveSessionController,
  googleDriveRecoveryFetcher,
  googleDriveRecoveryRepository,
  googleDriveRecoveryBlobAdapter,
  googleDriveUploadFetcher,
  googleDriveUploadRepository,
  googleDriveUploadBlobAdapter,
}: EmbeddedAttachmentMigrationReviewPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<MigrationReviewState>('idle');
  const [cleanupStatus, setCleanupStatus] = useState<CleanupReviewState>('idle');
  const [auditReport, setAuditReport] = useState<EmbeddedAttachmentAuditReport | null>(null);
  const [migrationReport, setMigrationReport] = useState<EmbeddedAttachmentMigrationReport | null>(null);
  const [cleanupReport, setCleanupReport] = useState<AttachmentCleanupReviewReport | null>(null);
  const [cleanupExecutionReport, setCleanupExecutionReport] = useState<AttachmentCleanupExecutorReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cleanupError, setCleanupError] = useState<string | null>(null);
  const [cleanupExecutionError, setCleanupExecutionError] = useState<string | null>(null);
  const [cleanupExecutionStatus, setCleanupExecutionStatus] = useState<CleanupExecutionState>('idle');
  const [selectedCleanupCandidateIds, setSelectedCleanupCandidateIds] = useState<ReadonlySet<string>>(() => new Set());
  const [cleanupConfirmation, setCleanupConfirmation] = useState('');
  const [backupStatus, setBackupStatus] = useState<BackupInspectionState>('idle');
  const [restoreStatus, setRestoreStatus] = useState<BackupRestoreState>('idle');
  const [backupSummaries, setBackupSummaries] = useState<EmbeddedAttachmentMigrationBackupSummary[]>([]);
  const [selectedBackupKey, setSelectedBackupKey] = useState<string | null>(null);
  const [restoreConfirmation, setRestoreConfirmation] = useState('');
  const [restoreReport, setRestoreReport] = useState<EmbeddedAttachmentMigrationRestoreReport | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [diagnosticsStatus, setDiagnosticsStatus] = useState<DiagnosticsState>('idle');
  const [diagnosticsReport, setDiagnosticsReport] = useState<AttachmentSyncDiagnostics | null>(null);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);
  const [, setRecoveryStatus] = useState<RecoveryActionState>('idle');
  const [runningRecoveryAttachmentId, setRunningRecoveryAttachmentId] = useState<string | null>(null);
  const [recoveryReportsByAttachmentId, setRecoveryReportsByAttachmentId] = useState<Record<string, AttachmentRemoteRecoveryResult>>({});
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [, setUploadStatus] = useState<UploadActionState>('idle');
  const [runningUploadAttachmentId, setRunningUploadAttachmentId] = useState<string | null>(null);
  const [uploadReportsByAttachmentId, setUploadReportsByAttachmentId] = useState<Record<string, AttachmentExplicitUploadResult>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const runningUploadAttachmentIdsRef = useRef<Set<string>>(new Set());
  const [selectedUploadQueueAttachmentIds, setSelectedUploadQueueAttachmentIds] = useState<ReadonlySet<string>>(() => new Set());
  const [uploadQueueRunStatus, setUploadQueueRunStatus] = useState<UploadQueueRunState>('idle');
  const [uploadQueueRunReport, setUploadQueueRunReport] = useState<UploadQueueRunReport | null>(null);
  const [googleDriveSessionConnection, setGoogleDriveSessionConnection] = useState<RemoteProviderConnectionBoundary | null>(null);
  const [confirming, setConfirming] = useState(false);

  const activeNotes = useMemo(() => notes.filter(note => !note.deletedAt), [notes]);
  const notesById = useMemo(() => new Map(notes.map(note => [note.id, note])), [notes]);
  const hasCandidates = (auditReport?.summary.totalEmbeddedPayloads ?? 0) > 0;
  const busy = status === 'scanning' || status === 'migrating';
  const cleanupBusy = cleanupStatus === 'reviewing';
  const cleanupExecuting = cleanupExecutionStatus === 'running';
  const canMigrate = Boolean(auditReport && hasCandidates && !busy);
  const cleanupReportHash = cleanupReport ? hashAttachmentCleanupReviewReport(cleanupReport) : '';
  const cleanupConfirmationPhrase = cleanupReport ? `CLEANUP ${cleanupReportHash.slice(0, 12)}` : '';
  const cleanupCandidateEntries = cleanupReport?.candidates.map((candidate, index) => ({
    candidate,
    candidateId: attachmentCleanupCandidateId(candidate, index),
    selectable: isSelectableCleanupCandidate(candidate),
  })) ?? [];
  const selectedCleanupCandidateCount = selectedCleanupCandidateIds.size;
  const selectableCleanupCandidateIds = new Set(cleanupCandidateEntries.filter(entry => entry.selectable).map(entry => entry.candidateId));
  const cleanupCanExecute = Boolean(
    cleanupReport
      && selectedCleanupCandidateCount > 0
      && cleanupConfirmation === cleanupConfirmationPhrase
      && !cleanupExecuting,
  );
  const backupBusy = backupStatus === 'loading';
  const restoreBusy = restoreStatus === 'running';
  const selectedBackup = backupSummaries.find(summary => summary.backupKey === selectedBackupKey) ?? null;
  const selectedBackupEligibility = selectedBackup ? backupEligibility({
    summary: selectedBackup,
    notesById,
    migrationReport,
  }) : null;
  const selectedRestorePhrase = selectedBackup ? backupConfirmationPhrase(selectedBackup) : '';
  const restoreCanRun = Boolean(
    selectedBackup
      && selectedBackupEligibility?.safe
      && restoreConfirmation === selectedRestorePhrase
      && !restoreBusy,
  );
  const diagnosticsBusy = diagnosticsStatus === 'loading';
  const fallbackProviderConnection = useMemo(
    () => remoteProviderConnection ?? resolveRemoteProviderConnectionBoundary(),
    [remoteProviderConnection],
  );
  const providerConnection = googleDriveSessionConnection ?? fallbackProviderConnection;
  const sessionRecoverAttachmentFn = useMemo(() => {
    if (!googleDriveSessionController) return undefined;
    return async (attachmentId: string) => {
      const accessTokenProvider = googleDriveSessionController.getAccessTokenProvider();
      if (!accessTokenProvider) {
        throw new Error('Google Drive session token is unavailable.');
      }
      return recoverAttachmentBlobFromRemote({
        attachmentId,
        attachmentRepository: googleDriveRecoveryRepository ?? createLocalAttachmentMetadataRepository(),
        localBlobAdapter: googleDriveRecoveryBlobAdapter ?? createLocalAttachmentBlobAdapter(),
        remoteProvider: new GoogleDriveBlobAdapter({
          accessTokenProvider,
          fetcher: googleDriveRecoveryFetcher,
        }),
      });
    };
  }, [
    googleDriveRecoveryBlobAdapter,
    googleDriveRecoveryFetcher,
    googleDriveRecoveryRepository,
    googleDriveSessionController,
  ]);
  const activeRecoverAttachmentFn = recoverAttachmentFn ?? sessionRecoverAttachmentFn;
  const sessionUploadAttachmentFn = useMemo(() => {
    if (!googleDriveSessionController) return undefined;
    return async (attachmentId: string) => {
      const accessTokenProvider = googleDriveSessionController.getAccessTokenProvider();
      if (!accessTokenProvider) {
        throw new Error('Google Drive session token is unavailable.');
      }
      return uploadAttachmentBlobToRemote({
        attachmentId,
        attachmentRepository: googleDriveUploadRepository ?? googleDriveRecoveryRepository ?? createLocalAttachmentMetadataRepository(),
        localBlobAdapter: googleDriveUploadBlobAdapter ?? googleDriveRecoveryBlobAdapter ?? createLocalAttachmentBlobAdapter(),
        remoteProvider: new GoogleDriveBlobAdapter({
          accessTokenProvider,
          fetcher: googleDriveUploadFetcher ?? googleDriveRecoveryFetcher,
        }),
      });
    };
  }, [
    googleDriveRecoveryBlobAdapter,
    googleDriveRecoveryFetcher,
    googleDriveRecoveryRepository,
    googleDriveSessionController,
    googleDriveUploadBlobAdapter,
    googleDriveUploadFetcher,
    googleDriveUploadRepository,
  ]);
  const activeUploadAttachmentFn = uploadAttachmentFn ?? sessionUploadAttachmentFn;

  const refreshGoogleDriveSessionConnection = useCallback(async () => {
    if (!googleDriveSessionController) {
      setGoogleDriveSessionConnection(null);
      return;
    }
    setGoogleDriveSessionConnection(await googleDriveSessionController.getConnectionStatus());
  }, [googleDriveSessionController]);

  useEffect(() => {
    void refreshGoogleDriveSessionConnection();
  }, [refreshGoogleDriveSessionConnection]);

  const scan = async () => {
    if (busy) return;
    setStatus('scanning');
    setError(null);
    setMigrationReport(null);
    setConfirming(false);
    try {
      const report = auditFn(activeNotes.map(note => ({
        id: note.id,
        title: note.title,
        body: note.body,
        updatedAt: String(note.updatedAt),
      })));
      setAuditReport(report);
      setStatus('ready');
    } catch (err) {
      setError(safeError(err));
      setStatus('error');
    }
  };

  const reviewCleanup = async () => {
    if (cleanupBusy) return;
    setCleanupStatus('reviewing');
    setCleanupError(null);
    setCleanupExecutionError(null);
    setCleanupExecutionReport(null);
    setCleanupExecutionStatus('idle');
    setSelectedCleanupCandidateIds(new Set());
    setCleanupConfirmation('');
    try {
      const report = await cleanupReviewFn({
        notes: activeNotes.map(note => ({
          id: note.id,
          title: note.title,
          body: note.body,
          updatedAt: String(note.updatedAt),
        })),
        backupReader: createLocalEmbeddedAttachmentMigrationBackupReader(),
        migrationReports: migrationReport ? [migrationReport] : [],
      });
      setCleanupReport(report);
      setCleanupStatus('complete');
    } catch (err) {
      setCleanupError(safeError(err));
      setCleanupStatus('error');
    }
  };

  const toggleCleanupCandidate = (candidateId: string, checked: boolean) => {
    if (!selectableCleanupCandidateIds.has(candidateId) || cleanupExecuting) return;
    setSelectedCleanupCandidateIds(previous => {
      const next = new Set(previous);
      if (checked) next.add(candidateId);
      else next.delete(candidateId);
      return next;
    });
    setCleanupExecutionReport(null);
    setCleanupExecutionError(null);
  };

  const runCleanup = async () => {
    if (!cleanupReport || !cleanupCanExecute) return;
    const selectedCandidateIds = Array.from(selectedCleanupCandidateIds).filter(candidateId => selectableCleanupCandidateIds.has(candidateId));
    if (selectedCandidateIds.length !== selectedCleanupCandidateIds.size) {
      setCleanupExecutionStatus('error');
      setCleanupExecutionError('Cleanup review is stale. Re-run cleanup review before cleanup.');
      return;
    }

    setCleanupExecutionStatus('running');
    setCleanupExecutionError(null);
    setCleanupExecutionReport(null);
    try {
      const report = await cleanupExecutorFn({
        reviewReport: cleanupReport,
        confirmationToken: createAttachmentCleanupConfirmationToken(cleanupReport),
        selectedCandidateIds,
        notes: activeNotes.map(note => ({
          id: note.id,
          title: note.title,
          body: note.body,
          updatedAt: String(note.updatedAt),
        })),
        repository: createLocalAttachmentMetadataRepository(),
        blobAdapter: createLocalAttachmentBlobAdapter(),
      });
      setCleanupExecutionReport(report);
      setCleanupExecutionStatus('complete');
      setSelectedCleanupCandidateIds(new Set());
      setCleanupConfirmation('');
    } catch (err) {
      setCleanupExecutionError(safeError(err));
      setCleanupExecutionStatus('error');
    }
  };

  const migrate = async () => {
    if (!canMigrate) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setStatus('migrating');
    setError(null);
    try {
      const report = await migrateFn({
        notes: activeNotes.map(note => ({
          id: note.id,
          title: note.title,
          body: note.body,
          updatedAt: String(note.updatedAt),
        })),
        updateNote: async (noteId, patch) => {
          const body = typeof patch.body === 'string' ? patch.body : undefined;
          if (body !== undefined) updateNote(noteId, { body });
        },
      });
      setMigrationReport(report);
      setStatus('complete');
      setConfirming(false);
    } catch (err) {
      setError(safeError(err));
      setStatus('error');
    }
  };

  const loadBackups = async () => {
    if (backupBusy) return;
    setBackupStatus('loading');
    setBackupError(null);
    setRestoreError(null);
    setRestoreReport(null);
    setSelectedBackupKey(null);
    setRestoreConfirmation('');
    try {
      const summaries = await listBackupsFn(createLocalEmbeddedAttachmentMigrationBackupReader());
      setBackupSummaries(summaries);
      setBackupStatus('ready');
    } catch (err) {
      setBackupError(safeError(err));
      setBackupStatus('error');
    }
  };

  const selectBackup = (backupKey: string) => {
    setSelectedBackupKey(backupKey);
    setRestoreConfirmation('');
    setRestoreReport(null);
    setRestoreError(null);
  };

  const runRestore = async () => {
    if (!selectedBackup || !selectedBackupEligibility || !restoreCanRun) return;
    setRestoreStatus('running');
    setRestoreError(null);
    setRestoreReport(null);
    try {
      const report = await restoreBackupFn({
        noteId: selectedBackup.noteId,
        backupKey: selectedBackup.backupKey,
        backupReader: createLocalEmbeddedAttachmentMigrationBackupReader(),
        expectedCurrentBodyHash: selectedBackupEligibility.expectedBodyHash,
        expectedCurrentContentHash: selectedBackupEligibility.expectedContentHash,
        readCurrentNote: async noteId => {
          const note = activeNotes.find(item => item.id === noteId);
          return note ? { id: note.id, title: note.title, body: note.body, updatedAt: String(note.updatedAt) } : null;
        },
        updateNote: async (noteId, patch) => {
          updateNote(noteId, { body: patch.body ?? '' });
        },
      });
      setRestoreReport(report);
      setRestoreStatus('complete');
      setRestoreConfirmation('');
    } catch (err) {
      setRestoreError(safeError(err));
      setRestoreStatus('error');
    }
  };

  const refreshDiagnostics = async () => {
    if (diagnosticsBusy) return;
    setDiagnosticsStatus('loading');
    setDiagnosticsError(null);
    setRecoveryReportsByAttachmentId({});
    setRecoveryError(null);
    setUploadReportsByAttachmentId({});
    setUploadError(null);
    setSelectedUploadQueueAttachmentIds(new Set());
    setUploadQueueRunStatus('idle');
    setUploadQueueRunReport(null);
    try {
      await refreshGoogleDriveSessionConnection();
      const report = await diagnosticsFn({
        repository: createLocalAttachmentMetadataRepository(),
        blobAdapter: createLocalAttachmentBlobAdapter(),
      });
      setDiagnosticsReport(report);
      setDiagnosticsStatus('ready');
    } catch (err) {
      setDiagnosticsError(safeError(err));
      setDiagnosticsStatus('error');
    }
  };

  const runRecovery = async (attachmentId: string) => {
    if (runningRecoveryAttachmentId === attachmentId) {
      setRecoveryStatus('error');
      setRecoveryError(reasonLabel('recovery_in_progress'));
      return;
    }
    const item = diagnosticsReport?.recoveryItems.find(candidate => candidate.attachmentId === attachmentId);
    let latestProviderConnection = providerConnection;
    if (googleDriveSessionController) {
      try {
        latestProviderConnection = await googleDriveSessionController.getConnectionStatus();
      } catch (err) {
        latestProviderConnection = resolveRemoteProviderConnectionBoundary({
          providerType: 'googleDrive',
          status: 'error',
          capabilities: { supportsDownload: false, supportsUpload: false },
          error: err,
        });
      }
    }
    if (googleDriveSessionController) {
      setGoogleDriveSessionConnection(latestProviderConnection);
    }
    const eligibility = item ? getAttachmentRecoveryAvailability({
      item,
      providerConnection: latestProviderConnection,
      hasRecoveryController: Boolean(activeRecoverAttachmentFn),
      googleDriveSessionController,
      runningRecoveryAttachmentId,
    }) : blocked('item_not_recoverable');
    if (!eligibility.canRecover) {
      setRecoveryStatus('error');
      setRecoveryError(eligibility.reasonLabel);
      return;
    }
    if (!activeRecoverAttachmentFn) {
      setRecoveryStatus('error');
      setRecoveryError(reasonLabel('recovery_controller_unavailable'));
      return;
    }
    setRunningRecoveryAttachmentId(attachmentId);
    setRecoveryStatus('running');
    setRecoveryError(null);
    try {
      const report = await activeRecoverAttachmentFn(attachmentId);
      setRecoveryReportsByAttachmentId(previous => ({
        ...previous,
        [attachmentId]: report,
      }));
      setRecoveryStatus(report.status === 'failed' || report.status === 'blocked' ? 'error' : 'complete');
    } catch (err) {
      setRecoveryError(sanitizeRemoteBlobProviderErrorMessage(err));
      setRecoveryStatus('error');
    } finally {
      setRunningRecoveryAttachmentId(null);
    }
  };

  const runUpload = async (attachmentId: string): Promise<AttachmentExplicitUploadResult | null> => {
    if (runningUploadAttachmentIdsRef.current.size > 0) {
      setUploadStatus('error');
      setUploadError(uploadReasonLabel(
        runningUploadAttachmentIdsRef.current.has(attachmentId)
          ? 'upload_in_progress'
          : 'another_upload_in_progress',
      ));
      return null;
    }
    runningUploadAttachmentIdsRef.current.add(attachmentId);
    const item = diagnosticsReport?.uploadItems.find(candidate => candidate.attachmentId === attachmentId);
    let latestProviderConnection = providerConnection;
    if (googleDriveSessionController) {
      try {
        latestProviderConnection = await googleDriveSessionController.getConnectionStatus();
      } catch (err) {
        latestProviderConnection = resolveRemoteProviderConnectionBoundary({
          providerType: 'googleDrive',
          status: 'error',
          capabilities: { supportsDownload: false, supportsUpload: false },
          error: err,
        });
      }
    }
    if (googleDriveSessionController) {
      setGoogleDriveSessionConnection(latestProviderConnection);
    }
    const eligibility = item ? getAttachmentUploadAvailability({
      item,
      providerConnection: latestProviderConnection,
      hasUploadController: Boolean(activeUploadAttachmentFn),
      googleDriveSessionController,
      runningUploadAttachmentId,
    }) : uploadBlocked('item_not_uploadable');
    if (!eligibility.canUpload) {
      setUploadStatus('error');
      setUploadError(eligibility.reasonLabel);
      runningUploadAttachmentIdsRef.current.delete(attachmentId);
      return null;
    }
    if (!activeUploadAttachmentFn) {
      setUploadStatus('error');
      setUploadError(uploadReasonLabel('upload_controller_unavailable'));
      runningUploadAttachmentIdsRef.current.delete(attachmentId);
      return null;
    }
    setRunningUploadAttachmentId(attachmentId);
    setUploadStatus('running');
    setUploadError(null);
    try {
      const report = await activeUploadAttachmentFn(attachmentId);
      setUploadReportsByAttachmentId(previous => ({
        ...previous,
        [attachmentId]: report,
      }));
      setUploadStatus(report.status === 'failed' || report.status === 'blocked' ? 'error' : 'complete');
      return report;
    } catch (err) {
      const message = sanitizeRemoteBlobProviderErrorMessage(err);
      setUploadError(message);
      setUploadStatus('error');
      return null;
    } finally {
      runningUploadAttachmentIdsRef.current.delete(attachmentId);
      setRunningUploadAttachmentId(null);
    }
  };

  const failedResults = migrationReport?.noteResults.filter(result => result.failedCount > 0 || result.errors.length > 0) ?? [];
  const orphanResults = migrationReport?.noteResults.filter(
    result => result.orphanedAttachmentIds.length > 0 || result.orphanedBlobKeys.length > 0,
  ) ?? [];

  const renderRecoveryReport = (recoveryReport: AttachmentRemoteRecoveryResult) => {
    const failureDisplay = recoveryReport.status === 'failed' || recoveryReport.status === 'blocked'
      ? formatRecoveryFailureForUi({
          errorDetails: recoveryReport.errorDetails,
          providerType: recoveryReport.remoteProvider,
        })
      : null;
    return (
      <div data-attachment-recovery-result style={{ border: `1px solid ${failureDisplay ? c.danger : c.sideBdr}`, borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 5, marginTop: 7 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800 }}>Recovery result</div>
        {failureDisplay ? (
          <div data-attachment-recovery-failure-label style={{ border: `1px solid ${failureDisplay.severity === 'warning' ? `${c.accent}55` : `${c.danger}55`}`, borderRadius: 6, padding: 7, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: c.text }}>{failureDisplay.title}</div>
            <div style={{ fontSize: 10.5, color: c.textMuted, lineHeight: 1.45 }}>{failureDisplay.message}</div>
            <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.45 }}>
              {failureDisplay.actionHint}{failureDisplay.retryable ? ' - retryable' : ''}
            </div>
          </div>
        ) : null}
        <div style={{ fontSize: 10.5, color: c.textMuted, lineHeight: 1.55 }}>
          <div>Attachment: {shortValue(recoveryReport.attachmentId)}</div>
          <div>Status: {recoveryReport.status}</div>
          <div>Provider: {recoveryReport.remoteProvider ?? 'unknown'}</div>
          <div>Remote file: {shortValue(recoveryReport.remoteFileId)}</div>
          {recoveryReport.localBlobKey ? <div>Local blob: {shortValue(recoveryReport.localBlobKey)}</div> : null}
          {recoveryReport.localSize !== undefined ? <div>Local size: {formatBytes(recoveryReport.localSize)}</div> : null}
          {recoveryReport.remoteSize !== undefined ? <div>Remote size: {formatBytes(recoveryReport.remoteSize)}</div> : null}
          {recoveryReport.verification ? (
            <div>
              Verification: size {recoveryReport.verification.sizeVerified ? 'yes' : 'no'}, checksum {recoveryReport.verification.checksumVerified ? 'yes' : 'no'}
              {recoveryReport.verification.sizeOnlyVerified ? ', size-only review' : ''}
            </div>
          ) : null}
          <div>Started: {recoveryReport.startedAt}</div>
          <div>Completed: {recoveryReport.completedAt}</div>
        </div>
        {recoveryReport.errorDetails ? (
          <div style={{ fontSize: 10, color: c.danger, lineHeight: 1.45 }}>
            {recoveryReport.errorDetails.code ? `${recoveryReport.errorDetails.code}: ` : ''}{sanitizeRemoteBlobProviderErrorMessage(recoveryReport.errorDetails.message)} ({recoveryReport.errorDetails.category}, retryable {recoveryReport.errorDetails.retryable ? 'yes' : 'no'})
          </div>
        ) : recoveryReport.error ? (
          <div style={{ fontSize: 10, color: c.danger }}>{sanitizeRemoteBlobProviderErrorMessage(recoveryReport.error)}</div>
        ) : null}
        {recoveryReport.warnings?.map((warning, index) => (
          <div key={`${warning}-${index}`} style={{ fontSize: 10, color: c.textMuted }}>{sanitizeRemoteBlobProviderErrorMessage(warning)}</div>
        ))}
        <div style={{ fontSize: 10.5, color: c.textMuted }}>Refresh diagnostics after recovery to update local inventory state.</div>
      </div>
    );
  };

  const renderUploadReport = (uploadReport: AttachmentExplicitUploadResult) => {
    const failed = uploadReport.status === 'failed' || uploadReport.status === 'blocked';
    const failureDisplay = failed
      ? formatUploadFailureForUi({
          errorDetails: uploadReport.errorDetails,
          providerType: uploadReport.remoteProvider,
          reasonCode: uploadReport.errorDetails?.code,
          remoteObjectAmbiguous: Boolean(uploadReport.remoteFileId),
        })
      : null;
    const manualReviewDiagnostics = failureDisplay
      ? getUploadManualReviewDiagnostics({
          errorDetails: uploadReport.errorDetails,
          providerType: uploadReport.remoteProvider,
          reasonCode: uploadReport.errorDetails?.code,
          manualReview: failureDisplay.manualReview,
          remoteObjectAmbiguous: failureDisplay.remoteObjectAmbiguous || Boolean(uploadReport.remoteFileId),
        })
      : null;
    return (
      <div data-attachment-upload-result style={{ border: `1px solid ${failureDisplay ? (failureDisplay.severity === 'error' ? c.danger : `${c.accent}66`) : c.sideBdr}`, borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 5, marginTop: 7 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800 }}>Upload result</div>
        {failureDisplay ? (
          <div data-attachment-upload-failure-label style={{ border: `1px solid ${failureDisplay.severity === 'error' ? `${c.danger}55` : `${c.accent}55`}`, borderRadius: 6, padding: 7, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: c.text }}>{failureDisplay.title}</div>
            <div style={{ fontSize: 10.5, color: c.textMuted, lineHeight: 1.45 }}>{failureDisplay.message}</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 9.5, color: c.textFaint }}>Action: {failureDisplay.actionHint}</span>
              <span style={{ fontSize: 9.5, color: c.textFaint }}>Retryable: {failureDisplay.retryable ? 'after action' : 'no'}</span>
              {failureDisplay.manualReview ? <span style={{ fontSize: 9.5, color: c.textFaint }}>Manual review</span> : null}
            </div>
          </div>
        ) : null}
        {manualReviewDiagnostics?.isManualReview ? (
          <div data-attachment-upload-manual-review-diagnostics style={{ border: `1px solid ${manualReviewDiagnostics.severity === 'blocked' ? `${c.danger}55` : `${c.accent}44`}`, borderRadius: 6, padding: 7, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: c.text }}>{manualReviewDiagnostics.title}</div>
            <div style={{ fontSize: 10.5, color: c.textMuted, lineHeight: 1.45 }}>{manualReviewDiagnostics.summary}</div>
            {manualReviewDiagnostics.safeTechnicalDetails.remoteObjectAmbiguous ? (
              <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.45 }}>
                Remote object ambiguity: the upload may have created a Google Drive file, but Absinthe could not safely persist the final metadata.
              </div>
            ) : null}
            <ul style={{ margin: '2px 0 0 16px', padding: 0, fontSize: 10, color: c.textMuted, lineHeight: 1.45 }}>
              {manualReviewDiagnostics.checklist.map(item => <li key={item}>{item}</li>)}
            </ul>
            <div style={{ fontSize: 9.5, color: c.textFaint, lineHeight: 1.45 }}>
              Technical: reason {manualReviewDiagnostics.safeTechnicalDetails.reasonCode}; category {manualReviewDiagnostics.safeTechnicalDetails.category ?? 'unknown'}; retryable {manualReviewDiagnostics.safeTechnicalDetails.retryable ? 'yes' : 'no'}; manualReview {manualReviewDiagnostics.safeTechnicalDetails.manualReview ? 'yes' : 'no'}; remoteObjectAmbiguous {manualReviewDiagnostics.safeTechnicalDetails.remoteObjectAmbiguous ? 'yes' : 'no'}
            </div>
          </div>
        ) : null}
        <div style={{ fontSize: 10.5, color: c.textMuted, lineHeight: 1.55 }}>
          <div>Attachment: {shortValue(uploadReport.attachmentId)}</div>
          <div>Status: {uploadReport.status}</div>
          <div>Provider: {uploadReport.remoteProvider ?? 'unknown'}</div>
          <div>Remote file: {shortValue(uploadReport.remoteFileId)}</div>
          {uploadReport.localBlobKey ? <div>Local blob: {shortValue(uploadReport.localBlobKey)}</div> : null}
          {uploadReport.remoteSize !== undefined ? <div>Remote size: {formatBytes(uploadReport.remoteSize)}</div> : null}
          {uploadReport.verification ? (
            <div>
              Verification: size {uploadReport.verification.sizeVerified ? 'yes' : 'no'}, checksum {uploadReport.verification.checksumVerified ? 'yes' : 'no'}
              {uploadReport.verification.sizeOnlyVerified ? ', size-only review' : ''}
            </div>
          ) : null}
          <div>Started: {uploadReport.startedAt}</div>
          <div>Completed: {uploadReport.completedAt}</div>
        </div>
        {uploadReport.errorDetails ? (
          <div style={{ fontSize: 10, color: c.danger, lineHeight: 1.45 }}>
            {uploadReport.errorDetails.code ? `${uploadReport.errorDetails.code}: ` : ''}{uploadReport.errorDetails.category}, retryable {uploadReport.errorDetails.retryable ? 'yes' : 'no'}
          </div>
        ) : uploadReport.error ? (
          <div style={{ fontSize: 10, color: c.danger }}>Upload failed. Review diagnostics.</div>
        ) : null}
        {uploadReport.warnings?.map((warning, index) => (
          <div key={`${warning}-${index}`} style={{ fontSize: 10, color: c.textMuted }}>{sanitizeRemoteBlobProviderErrorMessage(warning)}</div>
        ))}
      </div>
    );
  };

  const toggleUploadQueueSelection = (attachmentId: string, checked: boolean) => {
    if (uploadQueueRunStatus === 'running' || runningUploadAttachmentId) return;
    setUploadQueueRunReport(null);
    setUploadQueueRunStatus('idle');
    setSelectedUploadQueueAttachmentIds(previous => {
      const next = new Set(previous);
      if (checked) {
        if (next.size >= maxManualUploadQueueSelection && !next.has(attachmentId)) return previous;
        next.add(attachmentId);
      } else {
        next.delete(attachmentId);
      }
      return next;
    });
  };

  const runSelectedUploadQueueItems = async (visibleReadyItems: readonly ManualUploadQueueReviewItem[]) => {
    if (uploadQueueRunStatus === 'running' || runningUploadAttachmentIdsRef.current.size > 0) {
      setUploadStatus('error');
      setUploadError(uploadReasonLabel('another_upload_in_progress'));
      return;
    }
    const selectedIds = visibleReadyItems
      .map(item => item.attachmentId)
      .filter(id => selectedUploadQueueAttachmentIds.has(id))
      .slice(0, maxManualUploadQueueSelection);
    if (selectedIds.length === 0) return;

    setUploadQueueRunStatus('running');
    setUploadQueueRunReport(null);
    setUploadError(null);
    let succeededCount = 0;
    let failedAttachmentId: string | undefined;
    let failureReason: string | undefined;

    for (const attachmentId of selectedIds) {
      const report = await runUpload(attachmentId);
      if (!report || report.status !== 'uploaded') {
        failedAttachmentId = attachmentId;
        failureReason = report?.errorDetails
          ? formatUploadFailureForUi({
              errorDetails: report.errorDetails,
              providerType: report.remoteProvider,
              reasonCode: report.errorDetails.code,
              remoteObjectAmbiguous: Boolean(report.remoteFileId),
            }).title
          : report
            ? `Upload stopped with status ${report.status}`
          : 'Upload stopped before this item could start';
        break;
      }
      succeededCount += 1;
    }

    const failedCount = failedAttachmentId ? 1 : 0;
    setUploadQueueRunReport({
      selectedCount: selectedIds.length,
      succeededCount,
      failedCount,
      notStartedCount: Math.max(0, selectedIds.length - succeededCount - failedCount),
      stoppedOnFirstFailure: Boolean(failedAttachmentId),
      failedAttachmentId,
      failureReason,
    });
    setUploadQueueRunStatus(failedAttachmentId ? 'error' : 'complete');
    setSelectedUploadQueueAttachmentIds(new Set());
  };

  const renderUploadQueueGroup = (
    title: string,
    items: readonly ManualUploadQueueReviewItem[],
    options: { executable?: boolean } = {},
  ) => {
    const testId = title === 'Ready for manual upload'
      ? 'upload-queue-ready'
      : title === 'Blocked'
        ? 'upload-queue-blocked'
        : title === 'Needs manual review'
          ? 'upload-queue-manual-review'
          : 'upload-queue-already-synced';
    return (
    <div data-testid={testId} style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: 7, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <div style={{ fontSize: 10.5, fontWeight: 800 }}>{title}</div>
        <div data-testid={`${testId}-count`} style={{ fontSize: 10, color: c.textFaint }}>{items.length}</div>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 10, color: c.textFaint }}>No items in this bucket.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {items.slice(0, 3).map(item => (
            <div key={item.attachmentId} data-upload-queue-review-item style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', fontSize: 10, color: c.textMuted, lineHeight: 1.4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                {options.executable ? (
                  <input
                    type="checkbox"
                    aria-label={`Select attachment ${shortValue(item.attachmentId)} for limited upload`}
                    data-upload-queue-select={item.attachmentId}
                    checked={selectedUploadQueueAttachmentIds.has(item.attachmentId)}
                    onChange={event => toggleUploadQueueSelection(item.attachmentId, event.currentTarget.checked)}
                    disabled={
                      uploadQueueRunStatus === 'running'
                      || Boolean(runningUploadAttachmentId)
                      || (!selectedUploadQueueAttachmentIds.has(item.attachmentId) && selectedUploadQueueAttachmentIds.size >= maxManualUploadQueueSelection)
                    }
                    style={{ flexShrink: 0 }}
                  />
                ) : null}
                <div>
                  attachment {shortValue(item.attachmentId)} - {item.label} - provider {item.providerType ?? 'none'} - size {item.localSizeBytes !== undefined ? formatBytes(item.localSizeBytes) : 'unknown'}
                  {item.manualReview ? ' - manual review' : ''}
                  {item.remoteObjectAmbiguous ? ' - remote object ambiguity' : ''}
                  {runningUploadAttachmentId && runningUploadAttachmentId !== item.attachmentId && options.executable ? ' - one upload is currently in progress' : ''}
                </div>
              </div>
              {options.executable ? (
                <button
                  type="button"
                  className="btbtn"
                  onClick={() => runUpload(item.attachmentId)}
                  disabled={Boolean(runningUploadAttachmentId) || uploadQueueRunStatus === 'running'}
                  style={{ padding: '4px 7px', fontSize: 9.5, fontWeight: 800, color: c.accent, borderColor: `${c.accent}66`, flexShrink: 0 }}
                >
                  {runningUploadAttachmentId === item.attachmentId ? 'Uploading...' : 'Upload this item'}
                </button>
              ) : null}
            </div>
          ))}
          {items.length > 3 ? (
            <div style={{ fontSize: 9.5, color: c.textFaint }}>{items.length - 3} more items in this bucket.</div>
          ) : null}
        </div>
      )}
    </div>
    );
  };

  return (
    <section
      data-embedded-attachment-migration-review
      style={{
        margin: '8px 8px 10px',
        border: `1px solid ${c.sideBdr}`,
        borderRadius: 8,
        background: c.card,
        color: c.text,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        className="btbtn"
        onClick={() => setExpanded(value => !value)}
        aria-expanded={expanded}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '8px 10px',
          fontSize: 11,
          fontWeight: 700,
          color: c.text,
        }}
      >
        <span>Attachment storage maintenance</span>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {expanded ? (
        <div style={{ borderTop: `1px solid ${c.sideBdr}`, padding: 10, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.45, color: c.textMuted }}>
            Review embedded data URLs before converting them into local attachment records. Nothing runs automatically.
          </p>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btbtn"
              onClick={scan}
              disabled={busy}
              style={{ padding: '6px 9px', fontSize: 11, fontWeight: 700 }}
            >
              {status === 'scanning' ? 'Scanning...' : 'Scan embedded attachments'}
            </button>
            <button
              type="button"
              className="btbtn"
              onClick={migrate}
              disabled={!canMigrate}
              style={{
                padding: '6px 9px',
                fontSize: 11,
                fontWeight: 700,
                color: canMigrate ? c.accent : c.textFaint,
                borderColor: canMigrate ? `${c.accent}66` : c.sideBdr,
              }}
            >
              {status === 'migrating'
                ? 'Migrating...'
                : confirming
                  ? 'Confirm migration'
                  : 'Migrate embedded attachments'}
            </button>
          </div>

          {confirming ? (
            <div style={{ fontSize: 10.5, lineHeight: 1.45, color: c.textMuted, border: `1px solid ${c.accent}44`, borderRadius: 6, padding: 8 }}>
              This will create local attachment records and backups before replacing embedded data URLs with attachment references.
            </div>
          ) : null}

          {auditReport ? (
            <div data-embedded-attachment-audit-summary style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  ['Notes scanned', auditReport.summary.totalNotesScanned],
                  ['Affected notes', auditReport.summary.notesWithEmbeddedPayloads],
                  ['Payloads', auditReport.summary.totalEmbeddedPayloads],
                  ['Decoded size', formatBytes(auditReport.summary.totalEstimatedDecodedBytes)],
                  ['Images', auditReport.summary.imagePayloadCount],
                  ['PDF', auditReport.summary.pdfPayloadCount],
                  ['Other', auditReport.summary.otherDataPayloadCount],
                  ['Base64 size', formatBytes(auditReport.summary.totalEstimatedBase64Bytes)],
                ].map(([label, value]) => (
                  <div key={label} style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: '6px 7px' }}>
                    <div style={{ fontSize: 9.5, color: c.textFaint }}>{label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{value}</div>
                  </div>
                ))}
              </div>
              {auditReport.candidates.length === 0 ? (
                <div style={{ fontSize: 10.5, color: c.textMuted }}>No embedded data URLs found.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {auditReport.candidates.slice(0, 8).map(candidate => {
                    const imageCount = candidate.payloads.filter(payload => payload.kind === 'image').length;
                    const pdfCount = candidate.payloads.filter(payload => payload.kind === 'pdf').length;
                    const otherCount = candidate.payloads.filter(payload => payload.kind === 'other').length;
                    return (
                      <div key={candidate.noteId} data-embedded-attachment-candidate style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: 7 }}>
                        <div style={{ fontSize: 11, fontWeight: 700 }}>{noteTitle(notesById.get(candidate.noteId), candidate.noteId)}</div>
                        <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>
                          {candidate.payloadCount} payloads · {formatBytes(candidate.estimatedDecodedBytes)} · image {imageCount} · pdf {pdfCount} · other {otherCount}
                        </div>
                        <div style={{ fontSize: 9.5, color: c.textFaint, marginTop: 4 }}>
                          {candidate.payloads.map(payload => payload.previewLabel).join(' · ')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {migrationReport ? (
            <div data-embedded-attachment-migration-report style={{ border: `1px solid ${failedResults.length ? c.danger : c.sideBdr}`, borderRadius: 6, padding: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 6 }}>
                {failedResults.length ? 'Migration completed with warnings' : 'Migration completed'}
              </div>
              <div style={{ fontSize: 10.5, lineHeight: 1.6, color: c.textMuted }}>
                <div>Migration ID: {migrationReport.migrationId}</div>
                <div>Notes scanned: {migrationReport.notesScanned}</div>
                <div>Notes migrated: {migrationReport.notesMigrated}</div>
                <div>Payloads migrated: {migrationReport.payloadsMigrated}</div>
                <div>Payloads skipped: {migrationReport.payloadsSkipped}</div>
                <div>Payloads failed: {migrationReport.payloadsFailed}</div>
                <div>Backups created: {migrationReport.backupsCreated}</div>
                <div>Attachments created: {migrationReport.attachmentsCreated}</div>
                <div>Blobs written: {migrationReport.blobsWritten}</div>
                <div>Estimated decoded bytes: {formatBytes(migrationReport.totalEstimatedDecodedBytes)}</div>
              </div>
              {failedResults.length ? (
                <div style={{ marginTop: 7, display: 'flex', gap: 6, color: c.danger, fontSize: 10.5, lineHeight: 1.45 }}>
                  <AlertTriangle size={13} />
                  <span>Some items failed. Original note bodies were preserved for failed items.</span>
                </div>
              ) : (
                <div style={{ marginTop: 7, fontSize: 10.5, color: c.textMuted }}>
                  Original note bodies were backed up before conversion.
                </div>
              )}
              {orphanResults.length ? (
                <div style={{ marginTop: 6, fontSize: 10.5, color: c.textMuted }}>
                  Cleanup is deferred. Review orphaned local resources in a future cleanup pass.
                </div>
              ) : null}
              {failedResults.flatMap(result => result.errors).slice(0, 4).map((failure, index) => (
                <div key={`${failure}-${index}`} style={{ marginTop: 4, fontSize: 10, color: c.danger }}>
                  {failure}
                </div>
              ))}
            </div>
          ) : null}

          <div data-attachment-cleanup-review-section style={{ borderTop: `1px solid ${c.sideBdr}`, paddingTop: 9, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800 }}>Cleanup review</div>
              <p style={{ margin: '3px 0 0', fontSize: 10.5, lineHeight: 1.45, color: c.textMuted }}>
                This review only identifies possible cleanup candidates. Nothing is deleted automatically.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="btbtn"
                onClick={reviewCleanup}
                disabled={cleanupBusy}
                style={{ padding: '6px 9px', fontSize: 11, fontWeight: 700 }}
              >
                {cleanupBusy ? 'Reviewing...' : cleanupReport ? 'Re-run orphan review' : 'Run orphan review'}
              </button>
              <span style={{ fontSize: 10, color: c.textFaint }}>Review required before any future cleanup.</span>
            </div>

            {cleanupReport ? (
              <div data-attachment-cleanup-review-report style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {cleanupSummaryRows.map(([label, key]) => (
                    <div key={label} style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: '6px 7px' }}>
                      <div style={{ fontSize: 9.5, color: c.textFaint }}>{label}</div>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{cleanupReport[key]}</div>
                    </div>
                  ))}
                  <div style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: '6px 7px' }}>
                    <div style={{ fontSize: 9.5, color: c.textFaint }}>Estimated recoverable</div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{formatBytes(cleanupReport.estimatedRecoverableBytes)}</div>
                  </div>
                </div>

                {cleanupReport.warnings.map((warning, index) => (
                  <div key={`${warning}-${index}`} style={{ display: 'flex', gap: 6, color: c.textMuted, fontSize: 10.5, lineHeight: 1.45 }}>
                    <AlertTriangle size={13} />
                    <span>{warning}</span>
                  </div>
                ))}
                {cleanupReport.errors.map((failure, index) => (
                  <div key={`${failure}-${index}`} style={{ fontSize: 10.5, color: c.danger }}>{failure}</div>
                ))}
                {cleanupReport.backupRecordCount > 0 ? (
                  <div style={{ fontSize: 10.5, color: c.textMuted }}>
                    Migration backups are preserved. Backup deletion is not part of this review.
                  </div>
                ) : null}
                <div style={{ fontSize: 10.5, color: c.textMuted }}>
                  Blob inventory: {cleanupReport.inventoryAvailable ? (cleanupReport.inventoryPartial ? 'partial' : 'available') : 'unavailable'}.
                </div>
                {cleanupReport.candidates.length === 0 ? (
                  <div style={{ fontSize: 10.5, color: c.textMuted }}>No cleanup candidates found.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {cleanupCandidateEntries.slice(0, 10).map(({ candidate, candidateId, selectable }) => (
                      <div key={candidateId} style={{ border: `1px solid ${candidate.severity === 'danger' ? c.danger : c.sideBdr}`, borderRadius: 6, padding: 7 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                            {selectable ? (
                              <input
                                type="checkbox"
                                checked={selectedCleanupCandidateIds.has(candidateId)}
                                disabled={cleanupExecuting}
                                onChange={event => toggleCleanupCandidate(candidateId, event.currentTarget.checked)}
                                aria-label={`Select ${cleanupTypeLabels[candidate.type] ?? candidate.type}`}
                              />
                            ) : null}
                            <span style={{ fontSize: 10.5, fontWeight: 800 }}>{cleanupTypeLabels[candidate.type] ?? candidate.type}</span>
                          </label>
                          <span style={{ fontSize: 9.5, color: candidate.severity === 'warning' ? c.danger : c.textFaint }}>
                            {selectable ? 'selectable' : (cleanupStatusLabels[candidate.type] ?? candidate.severity)}
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: c.textMuted, marginTop: 4, lineHeight: 1.45 }}>
                          {candidate.noteId ? <span>note {shortValue(candidate.noteId)} </span> : null}
                          {candidate.attachmentId ? <span>attachment {shortValue(candidate.attachmentId)} </span> : null}
                          {candidate.localBlobKey ? <span>blob {shortValue(candidate.localBlobKey)} </span> : null}
                          {candidate.backupKey ? <span>backup {shortValue(candidate.backupKey)} </span> : null}
                        </div>
                        <div style={{ fontSize: 10, color: c.textMuted, marginTop: 4, lineHeight: 1.45 }}>{candidate.reason}</div>
                        <div style={{ fontSize: 9.5, color: c.textFaint, marginTop: 3, lineHeight: 1.45 }}>{candidate.safeActionRecommendation}</div>
                        <div style={{ fontSize: 9.5, color: selectable ? c.accent : c.textFaint, marginTop: 3, lineHeight: 1.45 }}>
                          {selectable ? 'Eligible for selected local cleanup.' : cleanupBlockedReason(candidate)}
                        </div>
                      </div>
                    ))}
                    {cleanupReport.candidates.length > 10 ? (
                      <div style={{ fontSize: 10, color: c.textFaint }}>
                        {cleanupReport.candidates.length - 10} more candidates hidden in this compact review.
                      </div>
                    ) : null}
                  </div>
                )}
                <div style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ fontSize: 11, fontWeight: 800 }}>Explicit cleanup</div>
                  <div style={{ fontSize: 10.5, color: c.textMuted, lineHeight: 1.45 }}>
                    Select individual unreferenced local candidates, then type <strong>{cleanupConfirmationPhrase}</strong> to confirm this exact review.
                    Default selection is zero. Backup records and warnings are not selectable.
                  </div>
                  <input
                    value={cleanupConfirmation}
                    onChange={event => setCleanupConfirmation(event.currentTarget.value)}
                    placeholder={cleanupConfirmationPhrase}
                    disabled={!cleanupReport || cleanupExecuting}
                    aria-label="Cleanup confirmation phrase"
                    style={{
                      border: `1px solid ${c.sideBdr}`,
                      borderRadius: 6,
                      padding: '6px 8px',
                      background: c.input,
                      color: c.text,
                      fontSize: 11,
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btbtn"
                      onClick={runCleanup}
                      disabled={!cleanupCanExecute}
                      style={{
                        padding: '6px 9px',
                        fontSize: 11,
                        fontWeight: 800,
                        color: cleanupCanExecute ? c.danger : c.textFaint,
                        borderColor: cleanupCanExecute ? `${c.danger}66` : c.sideBdr,
                      }}
                    >
                      {cleanupExecuting ? 'Cleaning selected...' : 'Clean selected local items'}
                    </button>
                    <span style={{ fontSize: 10, color: c.textFaint }}>
                      {selectedCleanupCandidateCount} selected
                    </span>
                  </div>
                  {cleanupExecutionReport ? (
                    <div data-attachment-cleanup-executor-report style={{ borderTop: `1px solid ${c.sideBdr}`, paddingTop: 7, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 800 }}>Cleanup result</div>
                      <div style={{ fontSize: 10.5, color: c.textMuted, lineHeight: 1.55 }}>
                        <div>Cleanup ID: {cleanupExecutionReport.cleanupId}</div>
                        <div>Source review: {cleanupExecutionReport.sourceReviewReportId}</div>
                        <div>Confirmation verified: {cleanupExecutionReport.confirmationVerified ? 'yes' : 'no'}</div>
                        <div>Requested: {cleanupExecutionReport.requestedCandidateCount}</div>
                        <div>Eligible: {cleanupExecutionReport.eligibleCandidateCount}</div>
                        <div>Blobs deleted: {cleanupExecutionReport.deletedBlobCount}</div>
                        <div>Metadata deleted: {cleanupExecutionReport.deletedAttachmentMetadataCount}</div>
                        <div>Skipped: {cleanupExecutionReport.skippedCandidateCount}</div>
                        <div>Blocked: {cleanupExecutionReport.blockedCandidateCount}</div>
                        <div>Failed: {cleanupExecutionReport.failedCandidateCount}</div>
                        <div>Recovered estimate: {formatBytes(cleanupExecutionReport.bytesRecoveredEstimate)}</div>
                      </div>
                      {cleanupExecutionReport.results.map(result => (
                        <div key={result.candidateId} style={{ border: `1px solid ${result.status === 'failed' ? c.danger : c.sideBdr}`, borderRadius: 6, padding: 6 }}>
                          <div style={{ fontSize: 10.5, fontWeight: 800 }}>
                            {cleanupResultLabels[result.status] ?? result.status} - {cleanupTypeLabels[result.candidateType] ?? result.candidateType}
                          </div>
                          <div style={{ fontSize: 10, color: c.textMuted, marginTop: 3, lineHeight: 1.45 }}>
                            {result.attachmentId ? <span>attachment {shortValue(result.attachmentId)} </span> : null}
                            {result.localBlobKey ? <span>blob {shortValue(result.localBlobKey)} </span> : null}
                            {result.estimatedBytes ? <span>{formatBytes(result.estimatedBytes)} </span> : null}
                          </div>
                          <div style={{ fontSize: 9.5, color: c.textFaint, marginTop: 3, lineHeight: 1.45 }}>{result.reason}</div>
                        </div>
                      ))}
                      {cleanupExecutionReport.warnings.map((warning, index) => (
                        <div key={`${warning}-${index}`} style={{ fontSize: 10, color: c.textMuted }}>{warning}</div>
                      ))}
                      {cleanupExecutionReport.errors.map((failure, index) => (
                        <div key={`${failure}-${index}`} style={{ fontSize: 10, color: c.danger }}>{failure}</div>
                      ))}
                      <div style={{ fontSize: 10.5, color: c.textMuted }}>Re-run cleanup review after cleanup to refresh local inventory.</div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div data-attachment-backup-restore-section style={{ borderTop: `1px solid ${c.sideBdr}`, paddingTop: 9, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800 }}>Migration backups</div>
              <p style={{ margin: '3px 0 0', fontSize: 10.5, lineHeight: 1.45, color: c.textMuted }}>
                Migration backups preserve original note bodies before embedded attachment conversion. This section shows safe summaries only; original content and base64 payloads are not displayed.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="btbtn"
                onClick={loadBackups}
                disabled={backupBusy}
                style={{ padding: '6px 9px', fontSize: 11, fontWeight: 700 }}
              >
                {backupBusy ? 'Loading backups...' : backupSummaries.length ? 'Reload migration backups' : 'Load migration backups'}
              </button>
              <span style={{ fontSize: 10, color: c.textFaint }}>Backup inspection is explicit. Restore never runs automatically.</span>
            </div>

            {backupStatus === 'ready' ? (
              <div data-attachment-backup-inspection-report style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ fontSize: 10.5, color: c.textMuted }}>
                  {backupSummaries.length} migration backup{backupSummaries.length === 1 ? '' : 's'} found.
                </div>
                {backupSummaries.length === 0 ? (
                  <div style={{ fontSize: 10.5, color: c.textMuted }}>No migration backups found.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {backupSummaries.slice(0, 10).map(summary => {
                      const eligibility = backupEligibility({ summary, notesById, migrationReport });
                      const selected = selectedBackupKey === summary.backupKey;
                      return (
                        <button
                          key={summary.backupKey}
                          type="button"
                          className="btbtn"
                          onClick={() => selectBackup(summary.backupKey)}
                          style={{
                            display: 'block',
                            textAlign: 'left',
                            border: `1px solid ${selected ? c.accent : c.sideBdr}`,
                            borderRadius: 6,
                            padding: 8,
                            color: c.text,
                            background: selected ? c.accentBg : 'transparent',
                            height: 'auto',
                            width: '100%',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 10.5, fontWeight: 800 }}>{noteTitle(notesById.get(summary.noteId), summary.noteId)}</span>
                            <span style={{ fontSize: 9.5, color: eligibility.safe ? c.accent : c.textFaint }}>{eligibility.label}</span>
                          </div>
                          <div style={{ fontSize: 10, color: c.textMuted, marginTop: 4, lineHeight: 1.45 }}>
                            backup {shortValue(summary.backupKey)} · migration {shortValue(summary.migrationId)} · note {shortValue(summary.noteId)}
                          </div>
                          <div style={{ fontSize: 10, color: c.textMuted, marginTop: 3, lineHeight: 1.45 }}>
                            created {summary.createdAt} · original body {formatBytes(summary.originalBodyBytes)} · content {formatBytes(summary.originalContentBytes)}
                          </div>
                          <div style={{ fontSize: 10, color: c.textMuted, marginTop: 3, lineHeight: 1.45 }}>
                            candidates {summary.candidateCount} · decoded {formatBytes(summary.estimatedDecodedBytes)} · types {summary.mimeTypes.join(', ') || 'none'}
                          </div>
                          <div style={{ fontSize: 9.5, color: eligibility.safe ? c.accent : c.textFaint, marginTop: 3, lineHeight: 1.45 }}>{eligibility.reason}</div>
                        </button>
                      );
                    })}
                    {backupSummaries.length > 10 ? (
                      <div style={{ fontSize: 10, color: c.textFaint }}>{backupSummaries.length - 10} more backups hidden in this compact review.</div>
                    ) : null}
                  </div>
                )}

                {selectedBackup && selectedBackupEligibility ? (
                  <div style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <div style={{ fontSize: 11, fontWeight: 800 }}>Explicit restore</div>
                    <div style={{ fontSize: 10.5, color: c.textMuted, lineHeight: 1.45 }}>
                      Status: <strong>{selectedBackupEligibility.label}</strong>. {selectedBackupEligibility.reason}
                    </div>
                    <div style={{ fontSize: 10.5, color: c.textMuted, lineHeight: 1.45 }}>
                      Type <strong>{selectedRestorePhrase}</strong> to restore this backup. Created attachments, blobs, metadata, and backups are preserved.
                    </div>
                    <input
                      value={restoreConfirmation}
                      onChange={event => setRestoreConfirmation(event.currentTarget.value)}
                      placeholder={selectedRestorePhrase}
                      disabled={!selectedBackupEligibility.safe || restoreBusy}
                      aria-label="Restore confirmation phrase"
                      style={{
                        border: `1px solid ${c.sideBdr}`,
                        borderRadius: 6,
                        padding: '6px 8px',
                        background: c.input,
                        color: c.text,
                        fontSize: 11,
                      }}
                    />
                    <button
                      type="button"
                      className="btbtn"
                      onClick={runRestore}
                      disabled={!restoreCanRun}
                      style={{
                        padding: '6px 9px',
                        fontSize: 11,
                        fontWeight: 800,
                        color: restoreCanRun ? c.accent : c.textFaint,
                        borderColor: restoreCanRun ? `${c.accent}66` : c.sideBdr,
                        alignSelf: 'flex-start',
                      }}
                    >
                      {restoreBusy ? 'Restoring backup...' : 'Restore selected backup'}
                    </button>
                    {restoreReport ? (
                      <div data-attachment-restore-report style={{ borderTop: `1px solid ${c.sideBdr}`, paddingTop: 7, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 800 }}>Restore result</div>
                        <div style={{ fontSize: 10.5, color: c.textMuted, lineHeight: 1.55 }}>
                          <div>Note: {shortValue(restoreReport.noteId)}</div>
                          <div>Backup: {shortValue(restoreReport.backupKey)}</div>
                          <div>Restored: {restoreReport.restored ? 'yes' : 'no'}</div>
                          <div>Forced: {restoreReport.forced ? 'yes' : 'no'}</div>
                          {restoreReport.previousBodyHash ? <div>Previous body hash: {restoreReport.previousBodyHash}</div> : null}
                          {restoreReport.restoredBodyHash ? <div>Restored body hash: {restoreReport.restoredBodyHash}</div> : null}
                        </div>
                        {restoreReport.warnings.map((warning, index) => (
                          <div key={`${warning}-${index}`} style={{ fontSize: 10, color: c.textMuted }}>{warning}</div>
                        ))}
                        {restoreReport.errors.map((failure, index) => (
                          <div key={`${failure}-${index}`} style={{ fontSize: 10, color: c.danger }}>{failure}</div>
                        ))}
                        <div style={{ fontSize: 10.5, color: c.textMuted }}>Re-run migration scan or cleanup review if you need updated maintenance counts.</div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div data-attachment-sync-diagnostics-section style={{ borderTop: `1px solid ${c.sideBdr}`, paddingTop: 9, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800 }}>Attachment Sync Diagnostics</div>
              <p style={{ margin: '3px 0 0', fontSize: 10.5, lineHeight: 1.45, color: c.textMuted }}>
                Diagnostics are read-only by default. Per-attachment recovery is available only when a provider is configured and you explicitly recover one eligible item.
              </p>
            </div>
            <GoogleDriveManualConnectionPanel
              colors={c}
              controller={googleDriveSessionController}
              onConnectionStatusChange={setGoogleDriveSessionConnection}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="btbtn"
                onClick={refreshDiagnostics}
                disabled={diagnosticsBusy}
                style={{ padding: '6px 9px', fontSize: 11, fontWeight: 700 }}
              >
                {diagnosticsBusy ? 'Refreshing diagnostics...' : diagnosticsReport ? 'Refresh diagnostics' : 'Refresh diagnostics'}
              </button>
              <span style={{ fontSize: 10, color: c.textFaint }}>Runs only when requested.</span>
            </div>

            {diagnosticsReport ? (
              <div data-attachment-sync-diagnostics-report style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ fontSize: 10.5, color: c.textMuted }}>
                  Generated {diagnosticsReport.generatedAt}. Inventory: {diagnosticsReport.inventory.available ? (diagnosticsReport.inventory.partial ? 'partial' : 'available') : 'unavailable'}.
                </div>

                <div data-remote-provider-connection-status style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: 8 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, marginBottom: 5 }}>Provider connection</div>
                  <div style={{ fontSize: 10.5, color: c.textMuted, lineHeight: 1.55 }}>
                    <div>Status: <strong>{providerConnection.displayLabel}</strong>{providerConnection.providerType ? ` (${providerConnection.providerType})` : ''}</div>
                    <div>{providerConnection.safeMessage}</div>
                    <div>Upload capability: {providerConnection.canUpload ? 'available' : 'unavailable'}</div>
                    <div>Recovery capability: {providerConnection.canRecover ? 'available' : 'unavailable'}</div>
                    {providerConnection.lastCheckedAt ? <div>Last checked: {providerConnection.lastCheckedAt}</div> : null}
                    {providerConnection.error ? <div style={{ color: c.danger }}>{sanitizeRemoteBlobProviderErrorMessage(providerConnection.error)}</div> : null}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {diagnosticsStatusRows.map(([label, key]) => (
                    <div key={label} style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: '6px 7px' }}>
                      <div style={{ fontSize: 9.5, color: c.textFaint }}>{label}</div>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{diagnosticsReport.statusCounts[key] ?? 0}</div>
                    </div>
                  ))}
                </div>

                <div style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: 8 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, marginBottom: 5 }}>Provider breakdown</div>
                  {Object.entries(diagnosticsReport.providerCounts).length === 0 ? (
                    <div style={{ fontSize: 10.5, color: c.textMuted }}>No providers found.</div>
                  ) : Object.entries(diagnosticsReport.providerCounts).map(([provider, count]) => (
                    <div key={provider} style={{ fontSize: 10.5, color: c.textMuted, lineHeight: 1.55 }}>
                      {provider}: <strong>{count}</strong>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {diagnosticsVerificationRows.map(([label, key]) => (
                    <div key={label} style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: '6px 7px' }}>
                      <div style={{ fontSize: 9.5, color: c.textFaint }}>{label}</div>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{Number(diagnosticsReport.verificationCounts[key] ?? 0)}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {diagnosticsEvictionRows.map(([label, key]) => (
                    <div key={label} style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: '6px 7px' }}>
                      <div style={{ fontSize: 9.5, color: c.textFaint }}>{label}</div>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>
                        {typeof diagnosticsReport.evictionSummary[key] === 'boolean'
                          ? (diagnosticsReport.evictionSummary[key] ? 'yes' : 'no')
                          : diagnosticsReport.evictionSummary[key]}
                      </div>
                    </div>
                  ))}
                  <div style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: '6px 7px' }}>
                    <div style={{ fontSize: 9.5, color: c.textFaint }}>Inventory available</div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{diagnosticsReport.evictionSummary.inventoryAvailable ? 'yes' : 'no'}</div>
                  </div>
                  <div style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: '6px 7px' }}>
                    <div style={{ fontSize: 9.5, color: c.textFaint }}>Inventory partial</div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{diagnosticsReport.evictionSummary.inventoryPartial ? 'yes' : 'no'}</div>
                  </div>
                </div>

                <div style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: 8 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, marginBottom: 5 }}>Recoverable byte estimates</div>
                  <div style={{ fontSize: 10.5, color: c.textMuted, lineHeight: 1.55 }}>
                    <div>Fully verified recoverable: <strong>{formatBytes(diagnosticsReport.byteSummary.fullyVerifiedRecoverableBytes)}</strong></div>
                    <div>Review-only recoverable: <strong>{formatBytes(diagnosticsReport.byteSummary.reviewOnlyRecoverableBytes)}</strong></div>
                    <div>Blocked or excluded local bytes: <strong>{formatBytes(diagnosticsReport.byteSummary.blockedBytes)}</strong></div>
                  </div>
                </div>

                <div style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800 }}>Remote upload</div>
                  <div style={{ fontSize: 10.5, color: c.textMuted, lineHeight: 1.45 }}>
                    Google Drive upload is session-only. Upload is available only for one eligible local attachment after an explicit click. Nothing uploads automatically, and no upload-all action exists.
                  </div>
                  {(() => {
                    const uploadQueueReview = buildManualUploadQueueReview({
                      items: diagnosticsReport.uploadItems,
                      getAvailability: item => {
                        const availability = getAttachmentUploadAvailability({
                          item,
                          providerConnection,
                          hasUploadController: Boolean(activeUploadAttachmentFn),
                          googleDriveSessionController,
                          runningUploadAttachmentId,
                        });
                        return {
                          canUpload: availability.canUpload,
                          reasonCode: availability.reasonCode,
                          reasonLabel: availability.reasonLabel,
                        };
                      },
                    });
                    return (
                      <div data-manual-upload-queue-review style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 800 }}>Manual upload queue review</div>
                        <div style={{ fontSize: 10.5, color: c.textMuted, lineHeight: 1.45 }}>
                          Select up to {maxManualUploadQueueSelection} visible Ready items for a limited manual upload. Selected uploads run one at a time through the same guarded Upload path and stop on the first failure.
                        </div>
                        <div style={{ fontSize: 10, color: c.textFaint, lineHeight: 1.45 }}>
                          Only selected items upload. Hidden Ready items, blocked items, manual-review items, and already-synced items are not included.
                        </div>
                        <div style={{ fontSize: 10, color: c.textFaint, lineHeight: 1.45 }}>
                          This compact review shows the first visible items in each bucket; hidden items are never uploaded by review rendering or by a limited selected run.
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: 5 }}>
                          {[
                            ['Total', uploadQueueReview.summary.totalItems],
                            ['Ready', uploadQueueReview.summary.eligibleCount],
                            ['Blocked', uploadQueueReview.summary.blockedCount],
                            ['Manual review', uploadQueueReview.summary.manualReviewCount],
                            ['Synced', uploadQueueReview.summary.alreadySyncedCount],
                            ['Missing local', uploadQueueReview.summary.missingLocalCount],
                          ].map(([label, value]) => (
                            <div key={label} style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: '5px 6px' }}>
                              <div style={{ fontSize: 9.5, color: c.textFaint }}>{label}</div>
                              <div style={{ fontSize: 11.5, fontWeight: 800 }}>{value}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.45 }}>
                          Estimated ready bytes: <strong>{formatBytes(uploadQueueReview.summary.estimatedEligibleBytes)}</strong>
                          {uploadQueueReview.summary.unknownEligibleSizeCount > 0 ? ` (${uploadQueueReview.summary.unknownEligibleSizeCount} ready item${uploadQueueReview.summary.unknownEligibleSizeCount === 1 ? '' : 's'} with unknown size)` : ''}
                        </div>
                        <div style={{ fontSize: 10, color: c.textFaint, lineHeight: 1.45 }}>
                          Providers: {Object.entries(uploadQueueReview.summary.providerCounts).map(([provider, count]) => `${provider} ${count}`).join(', ') || 'none'}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 6 }}>
                          {renderUploadQueueGroup('Ready for manual upload', uploadQueueReview.groups.eligible, { executable: true })}
                          {renderUploadQueueGroup('Blocked', uploadQueueReview.groups.blocked)}
                          {renderUploadQueueGroup('Needs manual review', uploadQueueReview.groups.manualReview)}
                          {renderUploadQueueGroup('Already synced', uploadQueueReview.groups.alreadySynced)}
                        </div>
                        {(() => {
                          const visibleReadyItems = uploadQueueReview.groups.eligible.slice(0, maxManualUploadQueueSelection);
                          const selectedVisibleCount = visibleReadyItems.filter(item => selectedUploadQueueAttachmentIds.has(item.attachmentId)).length;
                          const runDisabled = selectedVisibleCount === 0
                            || uploadQueueRunStatus === 'running'
                            || Boolean(runningUploadAttachmentId);
                          return (
                            <div data-upload-queue-limited-run style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: 7, display: 'flex', flexDirection: 'column', gap: 5 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                <div style={{ fontSize: 10.5, color: c.textMuted, lineHeight: 1.45 }}>
                                  {selectedVisibleCount} selected of {maxManualUploadQueueSelection}. Uploads run sequentially and stop after the first failed item.
                                </div>
                                <button
                                  type="button"
                                  className="btbtn"
                                  onClick={() => runSelectedUploadQueueItems(visibleReadyItems)}
                                  disabled={runDisabled}
                                  style={{ padding: '5px 8px', fontSize: 10, fontWeight: 800, color: c.accent, borderColor: `${c.accent}66`, flexShrink: 0 }}
                                >
                                  {uploadQueueRunStatus === 'running' ? 'Uploading selected...' : 'Upload selected'}
                                </button>
                              </div>
                              <div style={{ fontSize: 10, color: c.textFaint, lineHeight: 1.45 }}>
                                Limited manual run only. No hidden item, retry action, cleanup action, sync action, or delete action is started.
                              </div>
                              {uploadQueueRunReport ? (
                                <div data-upload-queue-run-summary style={{ border: `1px solid ${uploadQueueRunReport.stoppedOnFirstFailure ? `${c.danger}55` : c.sideBdr}`, borderRadius: 6, padding: 7, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                  <div style={{ fontSize: 10.5, fontWeight: 800 }}>
                                    {uploadQueueRunReport.succeededCount} of {uploadQueueRunReport.selectedCount} selected uploads completed.
                                  </div>
                                  <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.45 }}>
                                    Failed: {uploadQueueRunReport.failedCount}. Not started: {uploadQueueRunReport.notStartedCount}.
                                    {uploadQueueRunReport.stoppedOnFirstFailure ? ' Stopped after the first failure.' : ''}
                                  </div>
                                  {uploadQueueRunReport.failedAttachmentId ? (
                                    <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.45 }}>
                                      Failed item: attachment {shortValue(uploadQueueRunReport.failedAttachmentId)} - {uploadQueueRunReport.failureReason ?? 'Review diagnostics before trying again.'}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}
                  {diagnosticsReport.uploadItems.length === 0 ? (
                    <div style={{ fontSize: 10.5, color: c.textMuted }}>No local attachments are waiting for explicit upload.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {diagnosticsReport.uploadItems.slice(0, 10).map(item => {
                        const uploadAvailability = getAttachmentUploadAvailability({
                          item,
                          providerConnection,
                          hasUploadController: Boolean(activeUploadAttachmentFn),
                          googleDriveSessionController,
                          runningUploadAttachmentId,
                        });
                        const canUpload = uploadAvailability.canUpload;
                        const running = runningUploadAttachmentId === item.attachmentId;
                        const reason = uploadAvailability.reasonLabel;
                        const itemUploadReport = uploadReportsByAttachmentId[item.attachmentId];
                        return (
                          <div key={item.attachmentId} data-attachment-upload-item style={{ border: `1px solid ${item.eligible ? c.accent : c.sideBdr}`, borderRadius: 6, padding: 7 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 10.5, fontWeight: 800 }}>attachment {shortValue(item.attachmentId)}</div>
                                <div style={{ fontSize: 10, color: c.textMuted, marginTop: 3, lineHeight: 1.45 }}>
                                  provider {item.remoteProvider ?? 'none'} - status {item.remoteSyncStatus ?? 'unknown'} - blob {shortValue(item.localBlobKey)}
                                </div>
                              </div>
                              {canUpload || running ? (
                                <button
                                  type="button"
                                  className="btbtn"
                                  onClick={() => runUpload(item.attachmentId)}
                                  disabled={running || uploadQueueRunStatus === 'running'}
                                  style={{ padding: '5px 8px', fontSize: 10.5, fontWeight: 800, color: c.accent, borderColor: `${c.accent}66` }}
                                >
                                  {running ? 'Uploading...' : 'Upload'}
                                </button>
                              ) : (
                                <span
                                  data-upload-reason-code={uploadAvailability.reasonCode ?? 'item_not_uploadable'}
                                  data-upload-reason-severity={uploadAvailability.severity ?? 'info'}
                                  style={{ fontSize: 9.5, color: item.eligible ? c.textMuted : c.textFaint }}
                                >
                                  {reason}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 9.5, color: c.textFaint, marginTop: 4, lineHeight: 1.45 }}>
                              local blob {item.localBlobPresent ? 'present' : 'missing'} - local size {item.localSize !== undefined ? formatBytes(item.localSize) : 'unknown'}
                            </div>
                            {running ? (
                              <div
                                data-upload-reason-code={uploadAvailability.reasonCode ?? 'upload_in_progress'}
                                data-upload-reason-severity={uploadAvailability.severity ?? 'info'}
                                style={{ fontSize: 9.5, color: c.textMuted, marginTop: 4, lineHeight: 1.45 }}
                              >
                                {reason}
                              </div>
                            ) : null}
                            {itemUploadReport ? renderUploadReport(itemUploadReport) : null}
                          </div>
                        );
                      })}
                      {diagnosticsReport.uploadItems.length > 10 ? (
                        <div style={{ fontSize: 10, color: c.textFaint }}>{diagnosticsReport.uploadItems.length - 10} more upload entries hidden in this compact review.</div>
                      ) : null}
                    </div>
                  )}
                </div>

                <div style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800 }}>Remote recovery</div>
                  <div style={{ fontSize: 10.5, color: c.textMuted, lineHeight: 1.45 }}>
                    Google Drive recovery is session-only. Recover is available only for eligible attachments while this in-memory session is connected. Nothing is recovered automatically, and no recover-all action exists.
                  </div>
                  {diagnosticsReport.recoveryItems.length === 0 ? (
                    <div style={{ fontSize: 10.5, color: c.textMuted }}>No remote-backed attachments need recovery.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {diagnosticsReport.recoveryItems.slice(0, 10).map(item => {
                        const recoveryAvailability = getAttachmentRecoveryAvailability({
                          item,
                          providerConnection,
                          hasRecoveryController: Boolean(activeRecoverAttachmentFn),
                          googleDriveSessionController,
                          runningRecoveryAttachmentId,
                        });
                        const canRecover = recoveryAvailability.canRecover;
                        const running = runningRecoveryAttachmentId === item.attachmentId;
                        const reason = recoveryAvailability.reasonLabel;
                        const itemRecoveryReport = recoveryReportsByAttachmentId[item.attachmentId];
                        return (
                          <div key={item.attachmentId} data-attachment-recovery-item style={{ border: `1px solid ${item.eligible ? c.accent : c.sideBdr}`, borderRadius: 6, padding: 7 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 10.5, fontWeight: 800 }}>attachment {shortValue(item.attachmentId)}</div>
                                <div style={{ fontSize: 10, color: c.textMuted, marginTop: 3, lineHeight: 1.45 }}>
                                  provider {item.remoteProvider ?? 'none'} 쨌 status {item.remoteSyncStatus ?? 'unknown'} 쨌 remote {shortValue(item.remoteFileId)}
                                </div>
                              </div>
                              {canRecover || running ? (
                                <button
                                  type="button"
                                  className="btbtn"
                                  onClick={() => runRecovery(item.attachmentId)}
                                  disabled={running}
                                  style={{ padding: '5px 8px', fontSize: 10.5, fontWeight: 800, color: c.accent, borderColor: `${c.accent}66` }}
                                >
                                  {running ? 'Recovering...' : 'Recover'}
                                </button>
                              ) : (
                                <span
                                  data-recovery-reason-code={recoveryAvailability.reasonCode ?? 'item_not_recoverable'}
                                  data-recovery-reason-severity={recoveryAvailability.severity ?? 'info'}
                                  style={{ fontSize: 9.5, color: item.eligible ? c.textMuted : c.textFaint }}
                                >
                                  {reason}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 9.5, color: c.textFaint, marginTop: 4, lineHeight: 1.45 }}>
                              local blob {item.localBlobPresent ? 'present' : 'missing'} 쨌 size verified {item.verification?.sizeVerified ? 'yes' : 'no'} 쨌 checksum verified {item.verification?.checksumVerified ? 'yes' : 'no'}
                              {item.verification?.sizeOnlyVerified ? ' 쨌 size-only review' : ''}
                            </div>
                            {running ? (
                              <div
                                data-recovery-reason-code={recoveryAvailability.reasonCode ?? 'recovery_in_progress'}
                                data-recovery-reason-severity={recoveryAvailability.severity ?? 'info'}
                                style={{ fontSize: 9.5, color: c.textMuted, marginTop: 4, lineHeight: 1.45 }}
                              >
                                {reason}
                              </div>
                            ) : null}
                            {item.eligible && !canRecover && providerConnection.status === 'unconfigured' ? (
                              <div style={{ fontSize: 9.5, color: c.textMuted, marginTop: 4, lineHeight: 1.45 }}>
                                This attachment has remote metadata, but no recovery provider is configured in this build.
                              </div>
                            ) : null}
                            {itemRecoveryReport ? renderRecoveryReport(itemRecoveryReport) : null}
                          </div>
                        );
                      })}
                      {diagnosticsReport.recoveryItems.length > 10 ? (
                        <div style={{ fontSize: 10, color: c.textFaint }}>{diagnosticsReport.recoveryItems.length - 10} more recovery entries hidden in this compact review.</div>
                      ) : null}
                    </div>
                  )}
                </div>

                {diagnosticsReport.inventory.warnings.map((warning, index) => (
                  <div key={`${warning}-${index}`} style={{ display: 'flex', gap: 6, color: c.textMuted, fontSize: 10.5, lineHeight: 1.45 }}>
                    <AlertTriangle size={13} />
                    <span>{warning}</span>
                  </div>
                ))}
                {diagnosticsReport.warnings.map((warning, index) => (
                  <div key={`${warning}-${index}`} style={{ fontSize: 10, color: c.textMuted }}>{warning}</div>
                ))}
                {diagnosticsReport.errors.map((failure, index) => (
                  <div key={`${failure}-${index}`} style={{ fontSize: 10, color: c.danger }}>{failure}</div>
                ))}
              </div>
            ) : null}
          </div>

          {error ? (
            <div style={{ fontSize: 10.5, color: c.danger }}>{error}</div>
          ) : null}
          {cleanupError ? (
            <div style={{ fontSize: 10.5, color: c.danger }}>{cleanupError}</div>
          ) : null}
          {cleanupExecutionError ? (
            <div style={{ fontSize: 10.5, color: c.danger }}>{cleanupExecutionError}</div>
          ) : null}
          {backupError ? (
            <div style={{ fontSize: 10.5, color: c.danger }}>{backupError}</div>
          ) : null}
          {restoreError ? (
            <div style={{ fontSize: 10.5, color: c.danger }}>{restoreError}</div>
          ) : null}
          {diagnosticsError ? (
            <div style={{ fontSize: 10.5, color: c.danger }}>{diagnosticsError}</div>
          ) : null}
          {recoveryError ? (
            <div style={{ fontSize: 10.5, color: c.danger }}>{recoveryError}</div>
          ) : null}
          {uploadError ? (
            <div style={{ fontSize: 10.5, color: c.danger }}>{uploadError}</div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
