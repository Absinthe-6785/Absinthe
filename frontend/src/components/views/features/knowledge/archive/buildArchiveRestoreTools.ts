import type { VaultSnapshotSummary } from '@/lib/vaultSnapshotStore';
import {
  assessRecoveryProtectionStatus,
  getLastVaultExportAt,
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
  const lastExportAt = getLastVaultExportAt();
  const protectionStatus: RecoveryProtectionStatus = assessRecoveryProtectionStatus(
    lastSnapshotAt,
    lastExportAt,
    options?.cloudSyncEnabled ?? false,
  );

  return {
    snapshotCount: snapshots.length,
    lastSnapshotAt,
    lastExportAt,
    protectionStatus,
    canUndoRestore: options?.canUndoRestore ?? false,
  };
}
