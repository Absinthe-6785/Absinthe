import type { VaultSnapshotSummary } from '@/lib/vaultSnapshotStore';
import {
  assessRecoveryProtectionStatus,
  getLastVaultExportRecord,
  type RecoveryProtectionStatus,
} from '@/lib/vaultRestorePipeline';
import type { ArchiveRestoreToolsProjection } from './archiveProjectionModels';

export function buildArchiveRestoreTools(
  snapshots: readonly VaultSnapshotSummary[],
  options?: {
    cloudSyncEnabled?: boolean;
    canUndoRestore?: boolean;
  },
): ArchiveRestoreToolsProjection {
  const lastSnapshotAt = snapshots[0]?.createdAt ?? null;
  const lastExport = getLastVaultExportRecord();
  const lastExportAt = lastExport?.exportedAt ?? null;
  const protectionStatus: RecoveryProtectionStatus = assessRecoveryProtectionStatus(
    lastSnapshotAt,
    lastExportAt,
    options?.cloudSyncEnabled ?? false,
    lastExport?.coverage ?? null,
  );

  return {
    snapshotCount: snapshots.length,
    lastSnapshotAt,
    lastExportAt,
    protectionStatus,
    canUndoRestore: options?.canUndoRestore ?? false,
  };
}
