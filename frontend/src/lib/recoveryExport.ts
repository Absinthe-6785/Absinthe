import { useNotesStore } from '@/store/useNotesStore';
import { useAppStore } from '@/store/useAppStore';
import { buildVaultBackupManifest, type VaultBackupManifest } from './exportVaultBackup';

export function downloadRecoveryExport(): void {
  const notes = useNotesStore.getState().notes;
  const folders = useNotesStore.getState().folders;
  const appSettings = useAppStore.getState().appSettings;

  const manifest = buildVaultBackupManifest(notes, folders);
  const recoveryPayload: VaultBackupManifest & { appSettings: typeof appSettings } = {
    ...manifest,
    appSettings,
  };

  const blob = new Blob([JSON.stringify(recoveryPayload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'recovery.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

export const downloadRecoveryJson = downloadRecoveryExport;
