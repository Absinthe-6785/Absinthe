import { useCallback, useRef, useState } from 'react';
import type { TranslationKey } from '@/lib/i18n';
import {
  buildVaultRestorePreview,
  parseVaultBackupJson,
  type VaultRestoreConflictStrategy,
  type VaultRestorePreview,
} from '@/lib/importVaultBackup';
import { useNotesStore } from '@/store/useNotesStore';

export function useVaultRestoreFlow(
  showToast: (msg: string, type?: 'success' | 'error') => void,
  t: (key: TranslationKey) => string,
) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notes = useNotesStore(s => s.notes);
  const folders = useNotesStore(s => s.folders);
  const importVaultRestore = useNotesStore(s => s.importVaultRestore);

  const [preview, setPreview] = useState<VaultRestorePreview | null>(null);
  const [strategy, setStrategy] = useState<VaultRestoreConflictStrategy>('skip');
  const [importing, setImporting] = useState(false);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const raw = reader.result as string;
      const manifest = parseVaultBackupJson(raw);
      if (!manifest) {
        showToast(t('vaultRestoreInvalid'), 'error');
        return;
      }
      const built = buildVaultRestorePreview(manifest, notes, folders);
      if (!built.valid) {
        showToast(t('vaultRestoreInvalid'), 'error');
        return;
      }
      setStrategy('skip');
      setPreview(built);
    };
    reader.readAsText(file);
  }, [notes, folders, showToast, t]);

  const cancelRestore = useCallback(() => {
    setPreview(null);
    setImporting(false);
  }, []);

  const confirmRestore = useCallback(() => {
    if (!preview?.manifest) return;
    setImporting(true);
    try {
      const result = importVaultRestore(preview.manifest, strategy);
      const total = result.importedNotes + result.replacedNotes + result.duplicatedNotes;
      showToast(t('vaultRestoreComplete').replace('{count}', String(total)));
      setPreview(null);
    } catch {
      showToast(t('vaultRestoreFailed'), 'error');
    } finally {
      setImporting(false);
    }
  }, [preview, strategy, importVaultRestore, showToast, t]);

  return {
    fileInputRef,
    preview,
    strategy,
    setStrategy,
    importing,
    openFilePicker,
    handleFileChange,
    cancelRestore,
    confirmRestore,
  };
}
