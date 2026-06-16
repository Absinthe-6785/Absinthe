import { listVaultStorageKeys } from './vaultSnapshotScope';
import {
  enumerateVaultSnapshots,
  getLatestSnapshotSummary,
  getSnapshotTotalBytes,
  loadSnapshotPayload,
  type SnapshotStorageAdapter,
} from './vaultSnapshotStore';
import { validateVaultSnapshot } from './vaultSnapshotValidate';

const LARGE_VAULT_BYTES = 2_000_000;

export interface VaultStorageMetrics {
  storageType: 'browser-local-storage';
  vaultBytes: number;
  snapshotBytes: number;
  snapshotCount: number;
  lastSnapshotAt: string | null;
  lastSnapshotNoteCount: number | null;
}

export type DataProtectionWarningCode =
  | 'no_snapshot'
  | 'no_cloud_sync'
  | 'large_vault_no_backup'
  | 'snapshot_quota_failed';

export interface DataProtectionWarning {
  code: DataProtectionWarningCode;
  severity: 'info' | 'caution';
}

function defaultStorage(): SnapshotStorageAdapter {
  return localStorage;
}

export function measureVaultStorageBytes(
  storage: SnapshotStorageAdapter = defaultStorage(),
): number {
  let total = 0;
  for (const key of listVaultStorageKeys()) {
    const value = storage.getItem(key);
    if (value != null) total += new TextEncoder().encode(key + value).length;
  }
  return total;
}

export function getVaultStorageMetrics(
  storage: SnapshotStorageAdapter = defaultStorage(),
): VaultStorageMetrics {
  const latest = getLatestSnapshotSummary(storage);
  const snapshots = enumerateVaultSnapshots(storage);
  return {
    storageType: 'browser-local-storage',
    vaultBytes: measureVaultStorageBytes(storage),
    snapshotBytes: getSnapshotTotalBytes(storage),
    snapshotCount: snapshots.length,
    lastSnapshotAt: latest?.createdAt ?? null,
    lastSnapshotNoteCount: latest?.noteCount ?? null,
  };
}

export function formatStorageMegabytes(bytes: number): string {
  if (bytes < 1024) return '< 0.01 MB';
  const mb = bytes / (1024 * 1024);
  return mb < 0.1 ? '< 0.1 MB' : `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

export function assessDataProtectionWarnings(
  cloudSyncEnabled: boolean,
  storage: SnapshotStorageAdapter = defaultStorage(),
): DataProtectionWarning[] {
  const warnings: DataProtectionWarning[] = [];
  const metrics = getVaultStorageMetrics(storage);

  if (!metrics.lastSnapshotAt) {
    warnings.push({ code: 'no_snapshot', severity: 'info' });
  }

  if (!cloudSyncEnabled) {
    warnings.push({ code: 'no_cloud_sync', severity: 'info' });
  }

  if (metrics.vaultBytes >= LARGE_VAULT_BYTES && !metrics.lastSnapshotAt) {
    warnings.push({ code: 'large_vault_no_backup', severity: 'caution' });
  }

  const latest = getLatestSnapshotSummary(storage);
  if (latest) {
    const payload = loadSnapshotPayload(latest.snapshotId, storage);
    if (payload) {
      const report = validateVaultSnapshot(payload);
      if (!report.valid) {
        warnings.push({ code: 'snapshot_quota_failed', severity: 'caution' });
      }
    }
  }

  return warnings;
}
