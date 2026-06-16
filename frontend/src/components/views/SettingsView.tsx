/**
 * SettingsView — useConfirm 적용 예시
 *
 * 기존: 각 View마다 아래 코드를 중복 선언
 *   const [confirm, setConfirm] = useState<...>(null);
 *   const showConfirm = (msg, fn) => setConfirm({ message: msg, onConfirm: fn });
 *   {confirm && <ConfirmModal ... onConfirm={() => { confirm.onConfirm(); setConfirm(null); }} />}
 *
 * 변경: useConfirm() 한 줄로 대체. ConfirmModal 렌더 패턴도 단순화.
 */

import { useState, useMemo } from 'react';
import { Settings, Save, Download, Upload, AlertTriangle, LogOut, Loader2, HardDrive, Info } from 'lucide-react';
import { authFetch } from '../../lib/supabase';
import { ViewProps } from '../../types';
import { ConfirmModal } from '../common/ConfirmModal';
import { useConfirm } from '../../hooks/useConfirm';
import { useTranslation } from '../../lib/i18n';
import { exportAllToCsv } from '../../lib/csvExport';
import { buildVaultBackupManifestV3, downloadVaultBackup } from '../../lib/exportVaultBackup';
import { downloadVaultBackupZip } from '../../lib/vaultBackupZip';
import { fetchVaultCloudBlock } from '../../lib/vaultCloudExport';
import { assertExportReady } from '../../lib/vaultExportValidate';
import { useNotesStore } from '../../store/useNotesStore';
import { useVaultRestoreFlow } from '../../hooks/useVaultRestoreFlow';
import { VaultRestoreModal } from './features/knowledge/VaultRestoreModal';
import {
  assessDataProtectionWarnings,
  formatStorageMegabytes,
  getVaultStorageMetrics,
  type DataProtectionWarningCode,
} from '../../lib/vaultStorageMetrics';
import type { TranslationKey } from '../../lib/i18n';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const DATA_WARNING_KEYS: Record<DataProtectionWarningCode, TranslationKey> = {
  no_snapshot: 'dataWarning_no_snapshot',
  no_cloud_sync: 'dataWarning_no_cloud_sync',
  large_vault_no_backup: 'dataWarning_large_vault_no_backup',
  snapshot_quota_failed: 'dataWarning_snapshot_quota_failed',
};

export const SettingsView = ({
  appSettings, updateSetting, showToast, theme, mutateDaily, mutateStatic, onSignOut, user,
}: ViewProps) => {
  // ✅ DRY: useConfirm으로 3줄 → 1줄
  const { confirm, showConfirm, clearConfirm, handleConfirm } = useConfirm();
  const { t } = useTranslation();
  const resetAllNotes = useNotesStore(s => s.resetAllNotes);
  const notes = useNotesStore(s => s.notes);
  const folders = useNotesStore(s => s.folders);
  const undoLastVaultRestore = useNotesStore(s => s.undoLastVaultRestore);
  const vaultRestoreCanUndo = useNotesStore(s => s.vaultRestoreCanUndo);
  const vaultRestore = useVaultRestoreFlow(showToast, t);
  const [backingUpZip, setBackingUpZip] = useState(false);
  const cloudSyncEnabled = Boolean(user?.id);
  const storageMetrics = useMemo(() => getVaultStorageMetrics(), []);
  const dataWarnings = useMemo(
    () => assessDataProtectionWarnings(cloudSyncEnabled),
    [cloudSyncEnabled],
  );

  const formatSnapshotTime = (iso: string | null) => {
    if (!iso) return t('storageNoSnapshot');
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  // ── CSV 내보내기 상태 ──────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [exportStart, setExportStart] = useState(oneMonthAgo);
  const [exportEnd,   setExportEnd]   = useState(today);
  const [exporting,   setExporting]   = useState(false);
  const [exportMsg,   setExportMsg]   = useState('');

  const doExport = async () => {
    if (!exportStart || !exportEnd) return showToast(t('selectBothDates'), 'error');
    if (exportStart > exportEnd)    return showToast(t('endTimeError'), 'error');
    setExporting(true);
    setExportMsg('');
    try {
      await exportAllToCsv({
        startDate: exportStart,
        endDate:   exportEnd,
        onProgress: msg => setExportMsg(msg),
      });
      showToast(t('settingsExportComplete'));
    } catch {
      showToast(t('settingsExportFailed'), 'error');
    } finally {
      setExporting(false);
      setExportMsg('');
    }
  };

  const buildExportManifest = async () => {
    const active = notes.filter(n => !n.deletedAt);
    const cloud = cloudSyncEnabled ? await fetchVaultCloudBlock() : null;
    const manifest = buildVaultBackupManifestV3(active, folders, cloud);
    const validation = assertExportReady(manifest);
    if (!validation.valid) {
      throw new Error(validation.errors[0] ?? 'export_validation_failed');
    }
    return manifest;
  };

  const doVaultBackupZip = async () => {
    const active = notes.filter(n => !n.deletedAt);
    if (active.length === 0) {
      showToast(t('vaultBackupEmpty'), 'error');
      return;
    }
    setBackingUpZip(true);
    try {
      await downloadVaultBackupZip(await buildExportManifest());
      showToast(t('vaultBackupZipComplete'));
    } catch {
      showToast(t('vaultBackupFailed'), 'error');
    } finally {
      setBackingUpZip(false);
    }
  };

  const doVaultBackupJson = async () => {
    const active = notes.filter(n => !n.deletedAt);
    if (active.length === 0) {
      showToast(t('vaultBackupEmpty'), 'error');
      return;
    }
    try {
      downloadVaultBackup(await buildExportManifest());
      showToast(t('vaultBackupComplete'));
    } catch {
      showToast(t('vaultBackupFailed'), 'error');
    }
  };

  const doUndoRestore = () => {
    if (undoLastVaultRestore()) {
      showToast(t('vaultRestoreUndoComplete'));
    } else {
      showToast(t('vaultRestoreUndoUnavailable'), 'error');
    }
  };

  const doResetData = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/reset`, { method: 'DELETE' });
      if (res.ok) {
        resetAllNotes();
        showToast(t('resetSuccess'));
        mutateDaily();
        mutateStatic();
      } else throw new Error();
    } catch {
      showToast(t('resetFailed'), 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden py-1 pr-1 animate-in fade-in duration-300">
      <div className="flex justify-between items-end mb-6 pl-2 pr-6 shrink-0">
        <div>
          <h1 className="font-heading text-2xl lg:text-3xl font-bold">{t('settingsTitle')}</h1>
          <p className={`text-sm lg:text-base font-medium mt-1 ${theme.textMuted}`}>
            Customize your planner and manage your data.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-20 lg:pb-2">
        <div className="max-w-4xl mx-auto space-y-5 lg:space-y-6">

          {/* Planner Defaults */}
          <div className={`rounded-[24px] lg:rounded-[32px] shadow-sm p-6 lg:p-8 flex flex-col relative overflow-hidden transition-colors ${theme.card}`}>
            <h2 className="font-heading text-lg font-bold mb-6 flex items-center gap-2">
              <Settings size={20} className="text-primary" />{t('plannerDefaults')}
            </h2>
            <div className="space-y-8">
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 lg:gap-0">
                <div>
                  <p className="text-base font-bold">{t('defaultCategory')}</p>
                  <p className={`text-sm font-medium mt-1 ${theme.textMuted}`}>{t('defaultCategoryDesc')}</p>
                </div>
                <div className={`flex flex-wrap gap-2 p-2 rounded-2xl border ${theme.border} ${theme.input}`}>
                  {(['Study', 'Work', 'Exercise', 'Personal'] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => updateSetting('defaultCategory', cat)}
                      className={`px-4 lg:px-5 py-2 lg:py-2.5 rounded-xl text-sm font-bold transition-all ${
                        appSettings.defaultCategory === cat
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'text-gray-500 hover:text-current'
                      }`}
                    >
                      {cat === 'Study' ? t('catStudy') : cat === 'Work' ? t('catWork') : cat === 'Exercise' ? t('catExercise') : t('catPersonal')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 lg:gap-0">
                <div>
                  <p className="text-base font-bold">{t('defaultColor')}</p>
                  <p className={`text-sm font-medium mt-1 ${theme.textMuted}`}>{t('defaultColorDesc')}</p>
                </div>
                <div className={`flex gap-4 p-3 rounded-2xl border ${theme.border} ${theme.input}`}>
                  {['gold', 'blue', 'green', 'purple', 'pink', 'gray'].map((color) => (
                    <button
                      key={color}
                      onClick={() => updateSetting('defaultColor', color)}
                      className={`w-8 h-8 lg:w-10 lg:h-10 rounded-full transition-all shadow-sm ${
                        color === 'blue'   ? 'bg-blue-500'   :
                        color === 'green'  ? 'bg-green-500'  :
                        color === 'purple' ? 'bg-purple-500' :
                        color === 'pink'   ? 'bg-pink-500'   :
                        color === 'gray'   ? 'bg-gray-500'   : 'bg-primary'
                      } ${
                        appSettings.defaultColor === color
                          ? `ring-4 ring-offset-2 ${appSettings.darkMode ? 'ring-gray-300 ring-offset-[#2C2C2E]' : 'ring-gray-500'} scale-110`
                          : 'border-4 border-transparent hover:scale-110'
                      }`}
                    />
                  ))}
                </div>
              </div>
              {/* Language */}
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 lg:gap-0">
                <div>
                  <p className="text-base font-bold">{t('language')}</p>
                  <p className={`text-sm font-medium mt-1 ${theme.textMuted}`}>{t('languageDesc')}</p>
                </div>
                <div className={`flex p-1.5 rounded-2xl border ${theme.border} ${theme.input}`}>
                  {([
                    { code: 'en', label: '🇺🇸 English' },
                    { code: 'ko', label: '🇰🇷 한국어' },
                    { code: 'ja', label: '🇯🇵 日本語' },
                  ] as const).map(({ code, label }) => (
                    <button
                      key={code}
                      onClick={() => updateSetting('language', code)}
                      className={`px-4 lg:px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                        appSettings.language === code || (!appSettings.language && code === 'en')
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'text-gray-500 hover:text-current'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Data Storage */}
          <div className={`rounded-[24px] lg:rounded-[32px] shadow-sm p-6 lg:p-8 flex flex-col relative overflow-hidden transition-colors ${theme.card}`}>
            <h2 className="font-heading text-lg font-bold mb-6 flex items-center gap-2">
              <HardDrive size={20} className="text-primary" />{t('dataStorageTitle')}
            </h2>
            <div className="space-y-4">
              <div className={`grid sm:grid-cols-2 gap-4 p-4 rounded-2xl border ${theme.border} ${theme.input}`}>
                <div>
                  <p className={`text-xs font-bold mb-1 ${theme.textMuted}`}>{t('storageTypeLabel')}</p>
                  <p className="text-sm font-bold">{t('storageTypeLocal')}</p>
                </div>
                <div>
                  <p className={`text-xs font-bold mb-1 ${theme.textMuted}`}>{t('vaultSizeLabel')}</p>
                  <p className="text-sm font-bold">{formatStorageMegabytes(storageMetrics.vaultBytes)}</p>
                </div>
                <div>
                  <p className={`text-xs font-bold mb-1 ${theme.textMuted}`}>{t('lastSnapshotLabel')}</p>
                  <p className="text-sm font-bold">{formatSnapshotTime(storageMetrics.lastSnapshotAt)}</p>
                </div>
                <div>
                  <p className={`text-xs font-bold mb-1 ${theme.textMuted}`}>{t('cloudSyncLabel')}</p>
                  <p className="text-sm font-bold">
                    {cloudSyncEnabled ? t('cloudSyncEnabled') : t('cloudSyncDisabled')}
                  </p>
                </div>
                <div>
                  <p className={`text-xs font-bold mb-1 ${theme.textMuted}`}>{t('snapshotStorageLabel')}</p>
                  <p className="text-sm font-bold">
                    {t('snapshotCountSummary')
                      .replace('{count}', String(storageMetrics.snapshotCount))
                      .replace('{size}', formatStorageMegabytes(storageMetrics.snapshotBytes))}
                  </p>
                </div>
              </div>
              {dataWarnings.length > 0 ? (
                <div className="space-y-2">
                  {dataWarnings.map(w => (
                    <div
                      key={w.code}
                      className={`flex items-start gap-2 text-sm font-medium rounded-xl px-4 py-3 border ${
                        w.severity === 'caution'
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                          : `border-blue-500/20 bg-blue-500/5 ${theme.textMuted}`
                      }`}
                    >
                      {w.severity === 'caution'
                        ? <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        : <Info size={16} className="shrink-0 mt-0.5" />}
                      <span>{t(DATA_WARNING_KEYS[w.code])}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <p className={`text-xs font-medium ${theme.textMuted}`}>{t('dataStorageHint')}</p>
            </div>
          </div>

          {/* Data Management */}
          <div className={`rounded-[24px] lg:rounded-[32px] shadow-sm p-6 lg:p-8 flex flex-col relative overflow-hidden border-2 border-red-500/20 transition-colors ${theme.card}`}>
            <h2 className="font-heading text-lg font-bold text-red-500 mb-6 flex items-center gap-2">
              <Save size={20} />{t('dataManagement')}
            </h2>
            <div className="space-y-6">
              <div className={`flex flex-col lg:flex-row justify-between lg:items-center gap-4 lg:gap-0 pb-6 border-b ${theme.border}`}>
                <div>
                  <p className="text-base font-bold">{t('vaultBackupExport')}</p>
                  <p className={`text-sm font-medium mt-1 ${theme.textMuted}`}>{t('vaultBackupDesc')}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                  <button
                    onClick={doVaultBackupZip}
                    disabled={backingUpZip}
                    className="bg-primary text-primary-foreground px-6 py-3.5 rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors flex justify-center items-center gap-2 disabled:opacity-60"
                  >
                    {backingUpZip
                      ? <><Loader2 size={16} className="animate-spin"/>{t('vaultBackupZipping')}</>
                      : <><Download size={16}/>{t('vaultBackupZipExport')}</>
                    }
                  </button>
                  <button
                    onClick={doVaultBackupJson}
                    className={`px-6 py-3.5 rounded-xl font-bold text-sm transition-colors flex justify-center items-center gap-2 border ${theme.border} ${theme.input}`}
                  >
                    <Download size={16}/>{t('vaultBackupJsonExport')}
                  </button>
                  <button
                    onClick={vaultRestore.openFilePicker}
                    className={`px-6 py-3.5 rounded-xl font-bold text-sm transition-colors flex justify-center items-center gap-2 border ${theme.border} ${theme.input}`}
                  >
                    <Upload size={16}/>{t('vaultRestoreImport')}
                  </button>
                </div>
                {vaultRestoreCanUndo ? (
                  <button
                    type="button"
                    onClick={doUndoRestore}
                    className={`self-start text-xs font-bold px-3 py-2 rounded-lg border ${theme.border} ${theme.input}`}
                  >
                    {t('vaultRestoreUndo')}
                  </button>
                ) : null}
                <input
                  ref={vaultRestore.fileInputRef}
                  type="file"
                  accept=".json,.zip,application/json,application/zip"
                  className="hidden"
                  onChange={vaultRestore.handleFileChange}
                />
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col lg:flex-row justify-between lg:items-start gap-4 lg:gap-0">
                  <div>
                    <p className="text-base font-bold">{t('exportCsv')}</p>
                    <p className={`text-sm font-medium mt-1 ${theme.textMuted}`}>{t('exportDesc')}</p>
                  </div>
                  <button
                    onClick={doExport}
                    disabled={exporting}
                    className="bg-primary text-primary-foreground px-6 py-3.5 rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors flex justify-center items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
                  >
                    {exporting
                      ? <><Loader2 size={16} className="animate-spin"/>{exportMsg || 'Exporting...'}</>
                      : <><Download size={16}/>{t('exportCsv')}</>
                    }
                  </button>
                </div>
                {/* 날짜 범위 선택 */}
                <div className={`flex flex-col sm:flex-row gap-3 p-4 rounded-2xl border ${theme.border} ${theme.input}`}>
                  <div className="flex-1">
                    <p className={`text-xs font-bold mb-1.5 ${theme.textMuted}`}>{t('startDate')}</p>
                    <input
                      type="date"
                      value={exportStart}
                      max={exportEnd}
                      onChange={e => setExportStart(e.target.value)}
                      className={`w-full rounded-xl px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary ${theme.input}`}
                    />
                  </div>
                  <div className="flex items-end pb-2 text-sm font-bold opacity-40 hidden sm:flex">→</div>
                  <div className="flex-1">
                    <p className={`text-xs font-bold mb-1.5 ${theme.textMuted}`}>{t('endDate')}</p>
                    <input
                      type="date"
                      value={exportEnd}
                      min={exportStart}
                      max={today}
                      onChange={e => setExportEnd(e.target.value)}
                      className={`w-full rounded-xl px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary ${theme.input}`}
                    />
                  </div>
                </div>
              </div>

              <div className={`flex flex-col lg:flex-row justify-between lg:items-center gap-4 lg:gap-0 pt-6 border-t ${theme.border}`}>
                <div>
                  <p className="text-base font-bold text-red-500 flex items-center gap-1.5">
                    <AlertTriangle size={18} />{t('resetData')}
                  </p>
                  <p className="text-sm font-medium mt-1 text-red-500/70">{t('resetDesc')}</p>
                </div>
                <button
                  onClick={() => showConfirm(t('resetConfirm'), doResetData)}
                  className="bg-red-500/10 text-red-500 border border-red-500/20 px-6 py-3.5 rounded-xl font-bold text-sm hover:bg-red-500 hover:text-white transition-colors"
                >{t('resetData')}
                </button>
              </div>

              <div className={`flex flex-col lg:flex-row justify-between lg:items-center gap-4 lg:gap-0 pt-6 border-t ${theme.border}`}>
                <div>
                  <p className="text-base font-bold flex items-center gap-1.5">
                    <LogOut size={18} />{t('signOut')}
                  </p>
                  <p className={`text-sm font-medium mt-1 ${theme.textMuted}`}>Log out of your account.</p>
                </div>
                <button
                  onClick={onSignOut}
                  className={`px-6 py-3.5 rounded-xl font-bold text-sm transition-colors border ${theme.border} ${theme.hoverBg}`}
                >{t('signOut')}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ✅ ConfirmModal — useConfirm으로 단일 패턴으로 통일 */}
      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={handleConfirm}
          onCancel={clearConfirm}
          darkMode={appSettings.darkMode}
        />
      )}
      {vaultRestore.preview && vaultRestore.selection && (
        <VaultRestoreModal
          preview={vaultRestore.preview}
          strategy={vaultRestore.strategy}
          selection={vaultRestore.selection}
          onStrategyChange={vaultRestore.setStrategy}
          onToggleNote={vaultRestore.toggleNote}
          onToggleFolder={vaultRestore.toggleFolder}
          onSelectAll={vaultRestore.selectAll}
          onSelectNone={vaultRestore.selectNone}
          onConfirm={vaultRestore.confirmRestore}
          onCancel={vaultRestore.cancelRestore}
          importing={vaultRestore.importing}
        />
      )}
    </div>
  );
};
