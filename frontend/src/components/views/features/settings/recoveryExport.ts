/**
 * K-125E — Recovery / export UI helpers (presentation only; no schema or storage changes).
 */
import type { TranslationKey } from '@/lib/i18n';
import type { VaultSnapshotValidationReport } from '@/lib/vaultSnapshotValidate';

export const K125E_RECOVERY_SECTIONS = ['backup', 'recovery', 'export'] as const;
export type K125eRecoverySection = typeof K125E_RECOVERY_SECTIONS[number];

export type SnapshotStatusTone = 'valid' | 'warning' | 'corrupted' | 'unknown';

export interface SnapshotStatusBadge {
  tone: SnapshotStatusTone;
  labelKey: TranslationKey;
}

const ERROR_KEY_MAP: Record<string, TranslationKey> = {
  validation_failed: 'k125eValidationFailed',
  unsupported_schema: 'k125eValidationSchemaMismatch',
  unsupported_snapshot_schema: 'k125eValidationSchemaMismatch',
  unsupported_extensions_schema: 'k125eValidationSchemaMismatch',
  invalid_kind: 'k125eValidationFailed',
  invalid_app: 'k125eValidationFailed',
  missing_export_date: 'k125eValidationMissingFields',
  missing_notes: 'k125eValidationMissingFields',
  missing_folders: 'k125eValidationMissingFields',
  missing_vault: 'k125eValidationMissingFields',
  missing_extensions: 'k125eValidationMissingFields',
  missing_created_at: 'k125eValidationMissingFields',
  fingerprint_mismatch: 'k125eValidationCorrupted',
  'vault:corrupted_notes': 'k125eValidationCorrupted',
  invalid_extensions_knowledge: 'k125eValidationMissingFields',
  invalid_extensions_health: 'k125eValidationMissingFields',
  invalid_cloud_block: 'k125eValidationMissingFields',
  snapshot_missing: 'k125eValidationStorageUnavailable',
  quota_exceeded: 'k125eValidationNotEnoughSpace',
  storage_unavailable: 'k125eValidationStorageUnavailable',
};

export function mapValidationErrorToKey(error: string): TranslationKey {
  if (error.startsWith('vault:')) {
    const inner = error.slice('vault:'.length);
    return ERROR_KEY_MAP[`vault:${inner}`] ?? ERROR_KEY_MAP[inner] ?? 'k125eValidationFailed';
  }
  return ERROR_KEY_MAP[error] ?? 'k125eValidationFailed';
}

export function formatValidationErrors(errors: readonly string[]): TranslationKey[] {
  const keys = errors.map(mapValidationErrorToKey);
  return [...new Set(keys)];
}

function resolveSnapshotStatusTone(
  report: VaultSnapshotValidationReport | null | undefined,
): SnapshotStatusTone {
  if (!report) return 'unknown';
  if (report.valid && report.restoreReady) return 'valid';
  if (report.errors.some(e => e.includes('schema') || e.includes('unsupported'))) return 'warning';
  if (!report.valid) return 'corrupted';
  return 'warning';
}

export function snapshotStatusLabelKey(tone: SnapshotStatusTone): TranslationKey {
  switch (tone) {
    case 'valid': return 'k125eSnapshotStatusValid';
    case 'warning': return 'k125eSnapshotStatusWarning';
    case 'corrupted': return 'k125eSnapshotStatusCorrupted';
    default: return 'k125eSnapshotStatusUnknown';
  }
}

export function resolveSnapshotStatusBadge(
  report: VaultSnapshotValidationReport | null | undefined,
): SnapshotStatusBadge {
  const tone = resolveSnapshotStatusTone(report);
  return { tone, labelKey: snapshotStatusLabelKey(tone) };
}
