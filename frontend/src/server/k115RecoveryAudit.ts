/**
 * K-115 — Error recovery audit: sync, offline, empty vault, restore.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Recovery controls are identified by stable data contracts, not by visible
 * copy or an incidental component name.  The sections are the durable restore
 * and snapshot-history entry points that the recovery behavior tests exercise.
 */
export function auditRecoveryPanelContract(panelSrc: string): boolean {
  return panelSrc.includes('data-settings-data-safety-restore')
    && /onClick\s*=\s*\{\s*[A-Za-z_$][\w$]*\s*\.\s*openFilePicker\s*\}/.test(panelSrc)
    && panelSrc.includes('data-settings-data-safety-snapshots')
    && /onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*[A-Za-z_$][\w$]*\s*\.\s*openSnapshotRestore\s*\(/.test(panelSrc);
}

export interface K115RecoveryWiring {
  retrySync: boolean;
  localCoreRestore: boolean;
  vaultImport: boolean;
  recoveryCenter: boolean;
  snapshotValidate: boolean;
  snapshotEnumerate: boolean;
  panelRestore: boolean;
  offlineNotes: boolean;
  storageMergeGuard: boolean;
}

export const K115_RECOVERY_FLOWS = [
  'sync-failure-retrySync',
  'offline-localStorage-fallback',
  'empty-vault-bootstrap',
  'snapshot-restore-vaultSnapshotStore',
  'local-core-json-restore',
  'vault-import',
  'recovery-center-settings',
] as const;

export function auditRecoveryWiring(): K115RecoveryWiring {
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
    panelRestore: auditRecoveryPanelContract(panel),
    offlineNotes: store.includes('initNotesStorage:') && store.includes('detachNotesStorage:'),
    storageMergeGuard: store.includes('applyingStorageMerge')
      && store.includes('mayApplyCrossTabMutation')
      && store.includes('recordRecoveryBlock'),
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
  return recoveryWiringComplete(auditRecoveryWiring());
}

export function recoveryWiringComplete(w: K115RecoveryWiring): boolean {
  return w.retrySync
    && w.localCoreRestore
    && w.vaultImport
    && w.recoveryCenter
    && w.snapshotValidate
    && w.snapshotEnumerate
    && w.panelRestore
    && w.offlineNotes
    && w.storageMergeGuard;
}
