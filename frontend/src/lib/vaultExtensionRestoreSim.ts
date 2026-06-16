import type { NoteBase } from '@/components/views/noteUtils';
import type { NoteFolder } from '@/store/useNotesStore';
import type { VaultBackupManifest } from './exportVaultBackup';
import { applyVaultRestore } from './importVaultBackup';
import type { VaultPortableExtensions } from './vaultPortableExtensions';

export interface VaultRestoreSimulationResult {
  notes: NoteBase[];
  folders: NoteFolder[];
  extensions: VaultPortableExtensions | null;
  cloudPresent: boolean;
  coreNoteCount: number;
  extensionSections: string[];
}

/** Simulate full restore state without writing to storage (K-88B-2 foundation). */
export function simulateVaultRestore(
  manifest: VaultBackupManifest,
  existingNotes: readonly NoteBase[] = [],
  existingFolders: readonly NoteFolder[] = [],
): VaultRestoreSimulationResult {
  const { notes, folders } = applyVaultRestore(manifest, existingNotes, existingFolders, 'replace');
  const extensionSections: string[] = [];

  if (manifest.extensions?.settings != null) extensionSections.push('settings');
  if (manifest.extensions?.knowledge) {
    if (manifest.extensions.knowledge.savedViews?.length) extensionSections.push('savedViews');
    if (manifest.extensions.knowledge.ruleCollections?.length) extensionSections.push('ruleCollections');
    if (manifest.extensions.knowledge.databaseViews?.length) extensionSections.push('databaseViews');
    if (manifest.extensions.knowledge.focusPresets?.length) extensionSections.push('focusPresets');
    if (manifest.extensions.knowledge.history) extensionSections.push('knowledgeHistory');
    extensionSections.push('workspacePreferences');
  }
  if (manifest.extensions?.health) {
    if (Object.keys(manifest.extensions.health.drafts).length) extensionSections.push('healthDrafts');
    if (Object.keys(manifest.extensions.health.memos).length) extensionSections.push('healthMemos');
    if (manifest.extensions.health.routinePlannedSets) extensionSections.push('routinePlannedSets');
  }

  return {
    notes,
    folders,
    extensions: manifest.extensions ?? null,
    cloudPresent: Boolean(manifest.cloud && manifest.cloud.completeness !== 'skipped'),
    coreNoteCount: manifest.notes.length,
    extensionSections,
  };
}

/** Compare exported extensions with a fresh portable collect (round-trip fidelity). */
export function extensionsEquivalent(
  exported: VaultPortableExtensions,
  collected: VaultPortableExtensions,
): boolean {
  return JSON.stringify(exported) === JSON.stringify(collected);
}
