import type { VaultBackupManifest } from './exportVaultBackup';

export type VaultBackupCoverage =
  | 'complete'
  | 'local-only'
  | 'cloud-skipped'
  | 'cloud-partial';

export type VaultBackupProtection = 'protected' | 'partial';

export interface VaultBackupCoverageImpact {
  coverage: VaultBackupCoverage;
  recipeUnavailable: boolean;
  cloudGaps: string[];
}

const PRIMARY_BACKUP_ERROR_PREFIX = '/api/backup:';

export function isVaultBackupCoverage(value: unknown): value is VaultBackupCoverage {
  return value === 'complete'
    || value === 'local-only'
    || value === 'cloud-skipped'
    || value === 'cloud-partial';
}

export function classifyVaultBackupCoverage(
  manifest: Pick<VaultBackupManifest, 'cloud' | 'scope'>,
): VaultBackupCoverageImpact {
  const cloud = manifest.cloud;
  const cloudGaps = [...(manifest.scope?.cloudGaps ?? [])];

  if (!cloud) {
    return { coverage: 'local-only', recipeUnavailable: true, cloudGaps };
  }

  if (cloud.completeness === 'full') {
    return { coverage: 'complete', recipeUnavailable: false, cloudGaps };
  }

  const recipeUnavailable = cloud.completeness === 'skipped'
    || cloud.errors.some(error => error === 'backup_fetch_failed'
      || error.startsWith(PRIMARY_BACKUP_ERROR_PREFIX));

  return {
    coverage: cloud.completeness === 'skipped' ? 'cloud-skipped' : 'cloud-partial',
    recipeUnavailable,
    cloudGaps,
  };
}

export function protectionForVaultBackupCoverage(
  coverage: VaultBackupCoverage,
): VaultBackupProtection {
  return coverage === 'complete' ? 'protected' : 'partial';
}

export function isReducedVaultBackupCoverage(coverage: VaultBackupCoverage): boolean {
  return coverage === 'cloud-skipped' || coverage === 'cloud-partial';
}
