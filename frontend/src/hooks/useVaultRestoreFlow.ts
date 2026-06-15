import { useCallback, useRef, useState } from 'react';
import type { TranslationKey } from '@/lib/i18n';
import {
  buildVaultRestorePreview,
  createFullRestoreSelection,
  filterManifestBySelection,
  parseVaultBackupJson,
  type VaultRestoreConflictStrategy,
  type VaultRestorePreview,
  type VaultRestoreSelection,
} from '@/lib/importVaultBackup';
import { parseVaultBackupZip } from '@/lib/vaultBackupZip';
import { useNotesStore } from '@/store/useNotesStore';

async function parseBackupFile(file: File): Promise<ReturnType<typeof parseVaultBackupJson>> {
  if (file.name.endsWith('.zip') || file.type === 'application/zip') {
    return parseVaultBackupZip(file);
  }
  const raw = await file.text();
  return parseVaultBackupJson(raw);
}

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
  const [selection, setSelection] = useState<VaultRestoreSelection | null>(null);
  const [importing, setImporting] = useState(false);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const manifest = await parseBackupFile(file);
      if (!manifest) {
        showToast(t('vaultRestoreInvalid'), 'error');
        return;
      }
      const built = buildVaultRestorePreview(manifest, notes, folders);
      if (!built.valid) {
        setPreview(built);
        return;
      }
      setStrategy('skip');
      setSelection(createFullRestoreSelection(manifest));
      setPreview(built);
    } catch {
      showToast(t('vaultRestoreInvalid'), 'error');
    }
  }, [notes, folders, showToast, t]);

  const cancelRestore = useCallback(() => {
    setPreview(null);
    setSelection(null);
    setImporting(false);
  }, []);

  const toggleNote = useCallback((noteId: string, selected: boolean) => {
    setSelection(prev => {
      if (!prev) return prev;
      const next = new Set(prev.noteIds);
      if (selected) next.add(noteId);
      else next.delete(noteId);
      return { ...prev, noteIds: next };
    });
  }, []);

  const toggleFolder = useCallback((folderId: string, selected: boolean) => {
    if (!preview?.manifest) return;
    setSelection(prev => {
      if (!prev) return prev;
      const noteIds = new Set(prev.noteIds);
      const folderIds = new Set(prev.folderIds);
      const folderNotes = preview.noteOptions.filter(
        n => (n.folderId ?? '__unfiled__') === folderId,
      );
      for (const n of folderNotes) {
        if (selected) noteIds.add(n.id);
        else noteIds.delete(n.id);
      }
      if (folderId !== '__unfiled__') {
        if (selected) folderIds.add(folderId);
        else folderIds.delete(folderId);
      }
      return { noteIds, folderIds };
    });
  }, [preview]);

  const selectAll = useCallback(() => {
    if (!preview?.manifest) return;
    setSelection(createFullRestoreSelection(preview.manifest));
  }, [preview]);

  const selectNone = useCallback(() => {
    setSelection({ noteIds: new Set(), folderIds: new Set() });
  }, []);

  const confirmRestore = useCallback(() => {
    if (!preview?.manifest || !selection) return;
    if (selection.noteIds.size === 0) return;
    setImporting(true);
    try {
      const filtered = filterManifestBySelection(preview.manifest, selection);
      const result = importVaultRestore(filtered, strategy);
      const total = result.importedNotes + result.replacedNotes + result.duplicatedNotes;
      showToast(t('vaultRestoreComplete').replace('{count}', String(total)));
      setPreview(null);
      setSelection(null);
    } catch {
      showToast(t('vaultRestoreFailed'), 'error');
    } finally {
      setImporting(false);
    }
  }, [preview, selection, strategy, importVaultRestore, showToast, t]);

  return {
    fileInputRef,
    preview,
    strategy,
    selection,
    setStrategy,
    importing,
    openFilePicker,
    handleFileChange,
    cancelRestore,
    confirmRestore,
    toggleNote,
    toggleFolder,
    selectAll,
    selectNone,
  };
}
