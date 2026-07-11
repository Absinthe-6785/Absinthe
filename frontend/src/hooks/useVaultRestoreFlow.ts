import { useCallback, useRef, useState } from 'react';
import { RECOVERY_MODE_MESSAGE, mayRestore, recordRecoveryBlock } from '../lib/recoverySafetyPolicy';
import type { TranslationKey } from '@/lib/i18n';
import {
  createFullRestoreSelection,
  filterManifestBySelection,
  parseVaultBackupJson,
  type VaultRestoreConflictStrategy,
  type VaultRestorePreview,
  type VaultRestoreSelection,
} from '@/lib/importVaultBackup';
import {
  buildFullVaultRestorePreview,
  executeVaultRestorePipeline,
  manifestFromSnapshot,
  type FullVaultRestorePreview,
  type VaultRestorePipelineOptions,
} from '@/lib/vaultRestorePipeline';
import { parseVaultBackupZip } from '@/lib/vaultBackupZip';
import { loadSnapshotPayload } from '@/lib/vaultSnapshotStore';
import { useNotesStore } from '@/store/useNotesStore';

async function parseBackupFile(file: File): Promise<ReturnType<typeof parseVaultBackupJson>> {
  if (file.name.endsWith('.zip') || file.type === 'application/zip') {
    return parseVaultBackupZip(file);
  }
  const raw = await file.text();
  return parseVaultBackupJson(raw);
}

const DEFAULT_PIPELINE_OPTIONS: VaultRestorePipelineOptions = {
  strategy: 'skip',
  selection: { noteIds: new Set(), folderIds: new Set() },
  restoreCore: true,
  restoreExtensions: true,
  restoreCloud: false,
  backupBeforeRestore: true,
};

export function useVaultRestoreFlow(
  showToast: (msg: string, type?: 'success' | 'error') => void,
  t: (key: TranslationKey) => string,
  cloudSyncEnabled = false,
) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notes = useNotesStore(s => s.notes);
  const folders = useNotesStore(s => s.folders);
  const importVaultRestore = useNotesStore(s => s.importVaultRestore);

  const [preview, setPreview] = useState<VaultRestorePreview | null>(null);
  const [fullPreview, setFullPreview] = useState<FullVaultRestorePreview | null>(null);
  const [strategy, setStrategy] = useState<VaultRestoreConflictStrategy>('skip');
  const [selection, setSelection] = useState<VaultRestoreSelection | null>(null);
  const [pipelineOptions, setPipelineOptions] = useState<VaultRestorePipelineOptions>(DEFAULT_PIPELINE_OPTIONS);
  const [importing, setImporting] = useState(false);
  const [restoreSource, setRestoreSource] = useState<'export' | 'snapshot'>('export');

  const openManifestPreview = useCallback((
    manifest: NonNullable<ReturnType<typeof parseVaultBackupJson>>,
    source: 'export' | 'snapshot',
  ) => {
    const built = buildFullVaultRestorePreview(manifest, notes, folders, source);
    setRestoreSource(source);
    setStrategy('skip');
    setSelection(createFullRestoreSelection(manifest));
    setPipelineOptions({
      strategy: 'skip',
      selection: createFullRestoreSelection(manifest),
      restoreCore: true,
      restoreExtensions: Boolean(manifest.extensions),
      restoreCloud: cloudSyncEnabled && Boolean(manifest.cloud && manifest.cloud.completeness !== 'skipped'),
      backupBeforeRestore: true,
    });
    setFullPreview(built);
    setPreview(built.core);
  }, [notes, folders, cloudSyncEnabled]);

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
      openManifestPreview(manifest, 'export');
    } catch {
      showToast(t('vaultRestoreInvalid'), 'error');
    }
  }, [openManifestPreview, showToast, t]);

  const openSnapshotRestore = useCallback((snapshotId: string) => {
    const payload = loadSnapshotPayload(snapshotId);
    if (!payload) {
      showToast(t('recoverySnapshotMissing'), 'error');
      return;
    }
    try {
      const manifest = manifestFromSnapshot(payload);
      openManifestPreview(manifest, 'snapshot');
    } catch {
      showToast(t('vaultRestoreInvalid'), 'error');
    }
  }, [openManifestPreview, showToast, t]);

  const cancelRestore = useCallback(() => {
    setPreview(null);
    setFullPreview(null);
    setSelection(null);
    setImporting(false);
    setRestoreSource('export');
    setPipelineOptions(DEFAULT_PIPELINE_OPTIONS);
  }, []);

  const toggleNote = useCallback((noteId: string, selected: boolean) => {
    setSelection(prev => {
      if (!prev) return prev;
      const next = new Set(prev.noteIds);
      if (selected) next.add(noteId);
      else next.delete(noteId);
      const nextSelection = { ...prev, noteIds: next };
      setPipelineOptions(po => ({ ...po, selection: nextSelection }));
      return nextSelection;
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
      const nextSelection = { noteIds, folderIds };
      setPipelineOptions(po => ({ ...po, selection: nextSelection }));
      return nextSelection;
    });
  }, [preview]);

  const selectAll = useCallback(() => {
    if (!preview?.manifest) return;
    const next = createFullRestoreSelection(preview.manifest);
    setSelection(next);
    setPipelineOptions(po => ({ ...po, selection: next }));
  }, [preview]);

  const selectNone = useCallback(() => {
    const next = { noteIds: new Set<string>(), folderIds: new Set<string>() };
    setSelection(next);
    setPipelineOptions(po => ({ ...po, selection: next }));
  }, []);

  const setStrategyWithPipeline = useCallback((next: VaultRestoreConflictStrategy) => {
    setStrategy(next);
    setPipelineOptions(po => ({ ...po, strategy: next }));
  }, []);

  const updatePipelineOptions = useCallback((patch: Partial<VaultRestorePipelineOptions>) => {
    setPipelineOptions(po => ({ ...po, ...patch }));
  }, []);

  const confirmRestore = useCallback(async () => {
    if (!preview?.manifest || !selection || !fullPreview) return;
    if (selection.noteIds.size === 0 && !pipelineOptions.restoreExtensions && !pipelineOptions.restoreCloud) {
      return;
    }
    if (!mayRestore()) {
      recordRecoveryBlock('restore');
      showToast(RECOVERY_MODE_MESSAGE, 'error');
      return;
    }
    setImporting(true);
    try {
      const options: VaultRestorePipelineOptions = {
        ...pipelineOptions,
        strategy,
        selection,
      };
      const result = await executeVaultRestorePipeline(preview.manifest, options, {
        importCore: (m, s) => importVaultRestore(m, s),
        getNotes: () => useNotesStore.getState().notes,
        getFolders: () => useNotesStore.getState().folders,
      });

      const coreTotal = result.core
        ? result.core.importedNotes + result.core.replacedNotes + result.core.duplicatedNotes
        : 0;
      const extCount = result.extensions?.sections.length ?? 0;
      const cloudOk = result.cloud?.applied;

      let msg = t('vaultRestoreComplete').replace('{count}', String(coreTotal));
      if (extCount > 0) {
        msg += ` ${t('vaultRestoreExtensionsApplied').replace('{count}', String(extCount))}`;
      }
      if (pipelineOptions.restoreCloud) {
        msg += cloudOk ? ` ${t('vaultRestoreCloudApplied')}` : ` ${t('vaultRestoreCloudSkipped')}`;
      }
      if (result.backedUp) {
        msg += ` ${t('vaultRestoreBackupCreated')}`;
      }
      showToast(msg);
      setPreview(null);
      setFullPreview(null);
      setSelection(null);
      setRestoreSource('export');
    } catch {
      showToast(t('vaultRestoreFailed'), 'error');
    } finally {
      setImporting(false);
    }
  }, [
    preview,
    selection,
    fullPreview,
    pipelineOptions,
    strategy,
    importVaultRestore,
    showToast,
    t,
  ]);

  return {
    fileInputRef,
    preview,
    fullPreview,
    strategy,
    selection,
    pipelineOptions,
    restoreSource,
    setStrategy: setStrategyWithPipeline,
    updatePipelineOptions,
    importing,
    openFilePicker,
    handleFileChange,
    openSnapshotRestore,
    cancelRestore,
    confirmRestore,
    toggleNote,
    toggleFolder,
    selectAll,
    selectNone,
  };
}
