/**
 * K-115 — Error recovery audit: sync, offline, empty vault, restore.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const K115_RECOVERY_FLOWS = [
  'sync-failure-retrySync',
  'offline-localStorage-fallback',
  'empty-vault-bootstrap',
  'snapshot-restore-vaultSnapshotStore',
  'local-core-json-restore',
  'vault-import',
  'recovery-center-settings',
] as const;

export function auditRecoveryWiring(): Record<string, boolean> {
  const store = readFileSync(join(ROOT, 'store/useNotesStore.ts'), 'utf8');
  const client = readFileSync(join(ROOT, 'lib/notesSyncClient.ts'), 'utf8');
  const settings = readFileSync(join(ROOT, 'components/views/SettingsView.tsx'), 'utf8');
  const recovery = readFileSync(join(ROOT, 'hooks/useRecoveryCenter.ts'), 'utf8');
  const panel = readFileSync(join(ROOT, 'components/views/features/settings/RecoveryCenterPanel.tsx'), 'utf8');
  return {
    retrySync: store.includes('retrySync:') && store.includes('syncError'),
    localCoreRestore: store.includes('withLocalCoreJsonRestoreAuthorities')
      && store.includes('applyVaultRestore'),
    vaultImport: store.includes('importVaultRestore') && client.includes('fetchCompleteNotesFoldersSnapshot'),
    recoveryCenter: settings.includes('RecoveryCenterPanel') && settings.includes('useRecoveryCenter'),
    snapshotValidate: recovery.includes('validateVaultSnapshot'),
    snapshotEnumerate: recovery.includes('enumerateVaultSnapshots'),
    panelRestore: panel.includes('recovery') || panel.includes('snapshot'),
    offlineNotes: store.includes('initNotesStorage'),
  };
}

export function auditRecoveryRc(): readonly string[] {
  const w = auditRecoveryWiring();
  return [
    ...K115_RECOVERY_FLOWS,
    ...Object.entries(w).map(([k, v]) => (v ? k : `MISSING:${k}`)),
  ];
}

export function auditRecoveryComplete(): boolean {
  const w = auditRecoveryWiring();
  return w.retrySync && w.localCoreRestore && w.vaultImport && w.recoveryCenter && w.snapshotValidate;
}
