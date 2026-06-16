import type { NoteBase } from '@/components/views/noteUtils';
import { parseNoteMarkdown } from '@/components/views/features/knowledge';
import {
  VAULT_BACKUP_SCHEMA_VERSION,
  VAULT_EXTENSIONS_SCHEMA_VERSION,
} from './vaultBackupConstants';
import type { VaultBackupManifest } from './exportVaultBackup';
import { isVaultBackupManifestV3 } from './exportVaultBackup';
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
  fingerprintMatch: boolean;
}

export function validateVaultExportManifest(
  manifest: VaultBackupManifest,
): VaultExportValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const corruptedNoteIds: string[] = [];

  if (manifest.schemaVersion > VAULT_BACKUP_SCHEMA_VERSION) {
    errors.push('unsupported_schema');
  }
  if (manifest.app !== 'absinthe') errors.push('invalid_app');
  if (!manifest.exportedAt) errors.push('missing_export_date');
  if (!Array.isArray(manifest.notes)) errors.push('missing_notes');
  if (!Array.isArray(manifest.folders)) errors.push('missing_folders');

  for (const note of manifest.notes ?? []) {
    if (!note.id || !note.title) {
      corruptedNoteIds.push(note.id || 'unknown');
      continue;
    }
    try {
      parseNoteMarkdown(note.markdown);
    } catch {
      corruptedNoteIds.push(note.id);
    }
  }

  const hasExtensions = Boolean(manifest.extensions);
  if (isVaultBackupManifestV3(manifest) && !hasExtensions) {
    warnings.push('missing_extensions');
  }

  if (manifest.extensions) {
    if (manifest.extensions.schemaVersion > VAULT_EXTENSIONS_SCHEMA_VERSION) {
      warnings.push('unsupported_extensions_schema');
    }
    if (!manifest.extensions.knowledge) errors.push('invalid_extensions_knowledge');
    if (!manifest.extensions.health) errors.push('invalid_extensions_health');
  }

  const hasCloud = Boolean(manifest.cloud);
  const cloudCompleteness = manifest.cloud?.completeness ?? null;
  if (manifest.cloud) {
    if (!manifest.cloud.planner || !manifest.cloud.health) {
      errors.push('invalid_cloud_block');
    }
    if (manifest.cloud.completeness === 'partial') {
      warnings.push(...manifest.cloud.errors.map(e => `cloud_partial:${e}`));
    }
  }

  let fingerprintMatch = true;
  if (manifest.contentFingerprint) {
    const expected = fingerprintJson({
      notes: manifest.notes,
      folders: manifest.folders,
      extensions: manifest.extensions ?? null,
      cloud: manifest.cloud ?? null,
    });
    fingerprintMatch = manifest.contentFingerprint === expected;
    if (!fingerprintMatch) warnings.push('fingerprint_mismatch');
  }

  return {
    valid: errors.length === 0 && corruptedNoteIds.length === 0,
    errors,
    warnings,
    schemaVersion: manifest.schemaVersion ?? null,
    noteCount: manifest.notes?.length ?? 0,
    folderCount: manifest.folders?.length ?? 0,
    hasExtensions,
    hasCloud,
    cloudCompleteness,
    corruptedNoteIds,
    fingerprintMatch,
  };
}

/** Pre-export gate — returns null when export should be blocked. */
export function assertExportReady(
  manifest: VaultBackupManifest,
): VaultExportValidationReport {
  const report = validateVaultExportManifest(manifest);
  return report;
}
