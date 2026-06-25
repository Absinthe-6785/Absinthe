import {
  VAULT_BACKUP_SCHEMA_VERSION,
  VAULT_EXTENSIONS_SCHEMA_VERSION,
} from './vaultBackupConstants';
import type { VaultBackupManifest } from './exportVaultBackup';
import { isVaultBackupManifestV3 } from './exportVaultBackup';
import { migrateVaultBackupManifest, validateVaultBackupNotes } from './vaultBackupCompatibility';
import { fingerprintJson } from './vaultSnapshotFingerprint';

export interface VaultExportValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  schemaVersion: number | null;
  noteCount: number;
  folderCount: number;
  hasExtensions: boolean;
  hasCloud: boolean;
  cloudCompleteness: string | null;
  corruptedNoteIds: string[];
  repairedNoteIds: string[];
  fingerprintMatch: boolean;
}

export function validateVaultExportManifest(
  manifest: VaultBackupManifest,
): VaultExportValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const migrated = migrateVaultBackupManifest(manifest);
  const noteValidation = validateVaultBackupNotes(migrated.manifest.notes);
  const working = migrated.manifest;

  if (working.schemaVersion > VAULT_BACKUP_SCHEMA_VERSION) {
    errors.push('unsupported_schema');
  }
  if (working.app !== 'absinthe') errors.push('invalid_app');
  if (!working.exportedAt) errors.push('missing_export_date');
  if (!Array.isArray(working.notes)) errors.push('missing_notes');
  if (!Array.isArray(working.folders)) errors.push('missing_folders');

  const hasExtensions = Boolean(working.extensions);
  if (isVaultBackupManifestV3(working) && !hasExtensions) {
    warnings.push('missing_extensions');
  }

  if (working.extensions) {
    if (working.extensions.schemaVersion > VAULT_EXTENSIONS_SCHEMA_VERSION) {
      warnings.push('unsupported_extensions_schema');
    }
    if (!working.extensions.knowledge) errors.push('invalid_extensions_knowledge');
    if (!working.extensions.health) errors.push('invalid_extensions_health');
  }

  const hasCloud = Boolean(working.cloud);
  const cloudCompleteness = working.cloud?.completeness ?? null;
  if (working.cloud) {
    if (!working.cloud.planner || !working.cloud.health) {
      errors.push('invalid_cloud_block');
    }
    if (working.cloud.completeness === 'partial') {
      warnings.push(...working.cloud.errors.map(e => `cloud_partial:${e}`));
    }
  }

  let fingerprintMatch = true;
  if (working.contentFingerprint) {
    const expected = fingerprintJson({
      notes: working.notes,
      folders: working.folders,
      extensions: working.extensions ?? null,
      cloud: working.cloud ?? null,
    });
    fingerprintMatch = working.contentFingerprint === expected;
    if (!fingerprintMatch) warnings.push('fingerprint_mismatch');
  }

  return {
    valid: errors.length === 0 && noteValidation.valid,
    errors,
    warnings,
    schemaVersion: working.schemaVersion ?? null,
    noteCount: working.notes?.length ?? 0,
    folderCount: working.folders?.length ?? 0,
    hasExtensions,
    hasCloud,
    cloudCompleteness,
    corruptedNoteIds: noteValidation.corruptedNoteIds,
    repairedNoteIds: noteValidation.repairedNoteIds,
    fingerprintMatch,
  };
}

/** Pre-export gate — returns null when export should be blocked. */
export function assertExportReady(
  manifest: VaultBackupManifest,
): VaultExportValidationReport {
  return validateVaultExportManifest(manifest);
}
