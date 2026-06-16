import type { NoteBase } from '@/components/views/noteUtils';
import type { NoteFolder } from '@/store/useNotesStore';
import {
  validateVaultBackupManifest,
  type VaultRestoreValidationReport,
} from './importVaultBackup';
import {
  VAULT_SNAPSHOT_SCHEMA_VERSION,
  VAULT_SNAPSHOT_KIND,
} from './vaultSnapshotConstants';
import {
  parseVaultSnapshotJson,
  toRestoreReadyManifest,
  type VaultSnapshot,
} from './vaultSnapshotBuild';
import { fingerprintPortableVaultContent } from './vaultSnapshotFingerprint';

export interface VaultSnapshotValidationReport {
  valid: boolean;
  errors: string[];
  snapshotSchemaVersion: number | null;
  vaultValidation: VaultRestoreValidationReport | null;
  fingerprintMatch: boolean;
  restoreReady: boolean;
  noteCount: number;
  folderCount: number;
  exportedAt: string | null;
  createdAt: string | null;
  slot: string | null;
}

export function validateVaultSnapshot(
  snapshot: VaultSnapshot,
  existingNotes: readonly NoteBase[] = [],
  existingFolders: readonly NoteFolder[] = [],
): VaultSnapshotValidationReport {
  const errors: string[] = [];

  if (snapshot.kind !== VAULT_SNAPSHOT_KIND) errors.push('invalid_kind');
  if (snapshot.snapshotSchemaVersion > VAULT_SNAPSHOT_SCHEMA_VERSION) {
    errors.push('unsupported_snapshot_schema');
  }
  if (!snapshot.vault) errors.push('missing_vault');
  if (!snapshot.extensions) errors.push('missing_extensions');
  if (!snapshot.createdAt) errors.push('missing_created_at');

  const expectedFingerprint = fingerprintPortableVaultContent({
    notes: snapshot.vault.notes,
    folders: snapshot.vault.folders,
    extensions: snapshot.extensions,
  });
  const fingerprintMatch = snapshot.contentFingerprint === expectedFingerprint;
  if (!fingerprintMatch) errors.push('fingerprint_mismatch');

  const vaultValidation = snapshot.vault
    ? validateVaultBackupManifest(snapshot.vault, existingNotes, existingFolders)
    : null;

  if (vaultValidation && !vaultValidation.valid) {
    errors.push(...vaultValidation.errors.map(e => `vault:${e}`));
    if (vaultValidation.corruptedNoteIds.length > 0) {
      errors.push('vault:corrupted_notes');
    }
  }

  const valid = errors.length === 0;
  const restoreReady = valid && vaultValidation?.valid === true;

  return {
    valid,
    errors,
    snapshotSchemaVersion: snapshot.snapshotSchemaVersion ?? null,
    vaultValidation,
    fingerprintMatch,
    restoreReady,
    noteCount: snapshot.vault?.noteCount ?? 0,
    folderCount: snapshot.vault?.folderCount ?? 0,
    exportedAt: snapshot.vault?.exportedAt ?? null,
    createdAt: snapshot.createdAt ?? null,
    slot: snapshot.slot ?? null,
  };
}

export function validateVaultSnapshotJson(
  raw: string,
  existingNotes: readonly NoteBase[] = [],
  existingFolders: readonly NoteFolder[] = [],
): VaultSnapshotValidationReport {
  const snapshot = parseVaultSnapshotJson(raw);
  if (!snapshot) {
    return {
      valid: false,
      errors: ['invalid_json'],
      snapshotSchemaVersion: null,
      vaultValidation: null,
      fingerprintMatch: false,
      restoreReady: false,
      noteCount: 0,
      folderCount: 0,
      exportedAt: null,
      createdAt: null,
      slot: null,
    };
  }
  return validateVaultSnapshot(snapshot, existingNotes, existingFolders);
}

/** Simulate restore readiness without applying changes. */
export function assessSnapshotRestoreReadiness(
  snapshot: VaultSnapshot,
  existingNotes: readonly NoteBase[] = [],
  existingFolders: readonly NoteFolder[] = [],
): { ready: boolean; validation: VaultSnapshotValidationReport; manifest: ReturnType<typeof toRestoreReadyManifest> } {
  const validation = validateVaultSnapshot(snapshot, existingNotes, existingFolders);
  return {
    ready: validation.restoreReady,
    validation,
    manifest: toRestoreReadyManifest(snapshot),
  };
}
