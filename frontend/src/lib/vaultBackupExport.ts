import type { NoteBase } from '@/components/views/noteUtils';
import type { NoteFolder } from '@/store/useNotesStore';
import { buildVaultBackupManifestV3 } from './exportVaultBackup';
import type { VaultBackupCloudBlock } from './vaultCloudExport';
import type { VaultPortableExtensions } from './vaultPortableExtensions';
import { migrateVaultBackupManifest } from './vaultBackupCompatibility';
import { validateVaultExportManifest } from './vaultExportValidate';

export function buildValidatedVaultBackupManifest(
  notes: readonly NoteBase[],
  folders: readonly NoteFolder[],
  cloud?: VaultBackupCloudBlock | null,
  extensions?: VaultPortableExtensions,
) {
  const manifest = buildVaultBackupManifestV3(notes, folders, cloud, extensions);
  const validation = validateVaultExportManifest(manifest);
  if (!validation.valid) {
    throw new Error(validation.errors[0] ?? validation.corruptedNoteIds[0] ?? 'export_validation_failed');
  }
  return migrateVaultBackupManifest(manifest).manifest;
}
