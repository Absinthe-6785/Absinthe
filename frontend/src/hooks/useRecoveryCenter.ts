import { useCallback, useMemo, useState } from 'react';
import type { NoteBase } from '@/components/views/noteUtils';
import type { NoteFolder } from '@/store/useNotesStore';
import { useNotesStore } from '@/store/useNotesStore';
import {
  enumerateVaultSnapshots,
  loadSnapshotPayload,
  type VaultSnapshotSummary,
} from '@/lib/vaultSnapshotStore';
import { validateVaultSnapshot, type VaultSnapshotValidationReport } from '@/lib/vaultSnapshotValidate';
import {
  assessRecoveryProtectionStatus,
  getLastVaultExportRecord,
  type RecoveryProtectionStatus,
} from '@/lib/vaultRestorePipeline';
import type { VaultBackupCoverage } from '@/lib/vaultBackupCoverage';

export interface RecoveryCenterState {
  snapshots: VaultSnapshotSummary[];
  snapshotCount: number;
  lastSnapshotAt: string | null;
  lastExportAt: string | null;
  lastExportCoverage: VaultBackupCoverage | null;
  protectionStatus: RecoveryProtectionStatus;
  refresh: () => void;
  validateSnapshot: (snapshotId: string) => VaultSnapshotValidationReport | null;
  getSnapshotSchemaVersion: (snapshotId: string) => number | null;
}

export function useRecoveryCenter(cloudSyncEnabled: boolean): RecoveryCenterState {
  const notes = useNotesStore(s => s.notes);
  const folders = useNotesStore(s => s.folders);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick(n => n + 1), []);

  const snapshots = useMemo(() => {
    void tick;
    return enumerateVaultSnapshots();
  }, [tick]);

  const lastSnapshotAt = snapshots[0]?.createdAt ?? null;
  const lastExport = useMemo(() => getLastVaultExportRecord(), [tick]);
  const lastExportAt = lastExport?.exportedAt ?? null;
  const lastExportCoverage = lastExport?.coverage ?? null;

  const protectionStatus = assessRecoveryProtectionStatus(
    lastSnapshotAt,
    lastExportAt,
    cloudSyncEnabled,
    lastExportCoverage,
  );

  const validateSnapshot = useCallback(
    (snapshotId: string): VaultSnapshotValidationReport | null => {
      const payload = loadSnapshotPayload(snapshotId);
      if (!payload) return null;
      return validateVaultSnapshot(payload, notes as NoteBase[], folders as NoteFolder[]);
    },
    [notes, folders],
  );

  const getSnapshotSchemaVersion = useCallback((snapshotId: string): number | null => {
    const payload = loadSnapshotPayload(snapshotId);
    return payload?.snapshotSchemaVersion ?? null;
  }, []);

  return {
    snapshots,
    snapshotCount: snapshots.length,
    lastSnapshotAt,
    lastExportAt,
    lastExportCoverage,
    protectionStatus,
    refresh,
    validateSnapshot,
    getSnapshotSchemaVersion,
  };
}
