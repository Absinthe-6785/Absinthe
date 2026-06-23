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

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Settings, AlertTriangle, LogOut, HardDrive, Info, RotateCcw } from 'lucide-react';
import { authFetch } from '../../lib/supabase';
import { ViewProps } from '../../types';
import { ConfirmModal } from '../common/ConfirmModal';
import { WorkspacePageHeader } from '../common/WorkspacePageHeader';
import { WORKSPACE_CARD_SURFACE } from '../common/workspaceCardSizes';
import { WORKSPACE_GAP_CLASS } from '../../lib/uiSpacingTokens';
import { useConfirm } from '../../hooks/useConfirm';
import { useTranslation } from '../../lib/i18n';
import { buildVaultBackupManifestV3, downloadVaultBackup } from '../../lib/exportVaultBackup';
import { downloadVaultBackupZip } from '../../lib/vaultBackupZip';
import { fetchVaultCloudBlock } from '../../lib/vaultCloudExport';
import { assertExportReady } from '../../lib/vaultExportValidate';
import { recordLastVaultExport } from '../../lib/vaultRestorePipeline';
import { useNotesStore } from '../../store/useNotesStore';
import { useVaultRestoreFlow } from '../../hooks/useVaultRestoreFlow';
import { useRecoveryCenter } from '../../hooks/useRecoveryCenter';
import { VaultRestoreModal } from './features/knowledge/VaultRestoreModal';
import { RecoveryCenterPanel } from './features/settings/RecoveryCenterPanel';
import {
  assessDataProtectionWarnings,
  formatStorageMegabytes,
  getVaultStorageMetrics,
  type DataProtectionWarningCode,
} from '../../lib/vaultStorageMetrics';
import type { TranslationKey } from '../../lib/i18n';
import type { SettingsSectionId } from '../common/Sidebar';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const DATA_WARNING_KEYS: Record<DataProtectionWarningCode, TranslationKey> = {
  no_snapshot: 'dataWarning_no_snapshot',
  no_cloud_sync: 'dataWarning_no_cloud_sync',
  large_vault_no_backup: 'dataWarning_large_vault_no_backup',
  snapshot_quota_failed: 'dataWarning_snapshot_quota_failed',
};

export const SettingsView = ({
  appSettings, updateSetting, showToast, theme, mutateDaily, mutateStatic, onSignOut, user,
  settingsScrollTarget,
  onSettingsScrollTargetConsumed,
}: ViewProps & {
  settingsScrollTarget?: SettingsSectionId | null;
  onSettingsScrollTargetConsumed?: () => void;
}) => {
  // ✅ DRY: useConfirm으로 3줄 → 1줄
  const { confirm, showConfirm, clearConfirm, handleConfirm } = useConfirm();
  const { t } = useTranslation();
  const resetAllNotes = useNotesStore(s => s.resetAllNotes);
  const notes = useNotesStore(s => s.notes);
  const folders = useNotesStore(s => s.folders);
  const cloudSyncEnabled = Boolean(user?.id);
  const vaultRestore = useVaultRestoreFlow(showToast, t, cloudSyncEnabled);
  const recovery = useRecoveryCenter(cloudSyncEnabled);
  const [backingUpZip, setBackingUpZip] = useState(false);
  const [storageTick, setStorageTick] = useState(0);
  const refreshStorageMetrics = useCallback(() => {
    setStorageTick(n => n + 1);
    recovery.refresh();
  }, [recovery]);
  const storageMetrics = useMemo(() => {
    void storageTick;
    return getVaultStorageMetrics();
  }, [storageTick]);
  const dataWarnings = useMemo(
    () => assessDataProtectionWarnings(cloudSyncEnabled),
    [cloudSyncEnabled],
  );

  useEffect(() => {
    if (!settingsScrollTarget) return;
    const timer = window.setTimeout(() => {
      document
        .querySelector(`[data-settings-section="${settingsScrollTarget}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      onSettingsScrollTargetConsumed?.();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [settingsScrollTarget, onSettingsScrollTargetConsumed]);

  const formatSnapshotTime = (iso: string | null) => {
    if (!iso) return t('storageNoSnapshot');
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
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
    recordLastVaultExport(manifest.exportedAt);
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
      refreshStorageMetrics();
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
      refreshStorageMetrics();
    } catch {
      showToast(t('vaultBackupFailed'), 'error');
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
    <div className={`flex-1 flex flex-col overflow-hidden py-1 pr-1 animate-in fade-in duration-300 ${WORKSPACE_GAP_CLASS}`} data-workspace="settings">
      <div className="shrink-0 pl-2 pr-4 lg:pr-6">
        <WorkspacePageHeader
          workspace="settings"
          title={t('settingsTitle')}
          subtitle={t('k100SettingsSubtitle')}
          icon={Settings}
          theme={theme}
          dark={appSettings.darkMode}
          legacyHook="data-k119-settings-header"
        />
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain bscroll-pane pr-2 pb-16 lg:pb-4" data-settings-scroll data-k119-settings-scroll>
        <div className={`max-w-3xl mx-auto ${WORKSPACE_GAP_CLASS}`}>

          {/* General */}
          <div className={`${WORKSPACE_CARD_SURFACE} flex flex-col relative overflow-hidden transition-colors ${theme.card}`} data-settings-section="general" data-k119-settings-card>
            <h2 className="font-heading text-lg font-bold mb-3 flex items-center gap-2">
              <Settings size={20} className="text-primary" />{t('k100SettingsGeneral')}
            </h2>
            <div className="space-y-3">
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3">
                <div>
                  <p className="text-base font-bold">{t('language')}</p>
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

              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3">
                <div>
                  <p className="text-base font-bold">{t('k100Theme')}</p>
                </div>
                <div className={`flex p-1.5 rounded-2xl border ${theme.border} ${theme.input}`}>
                  {([
                    { dark: false, label: t('k100ThemeLight') },
                    { dark: true, label: t('k100ThemeDark') },
                  ] as const).map(({ dark, label }) => (
                    <button
                      key={label}
                      onClick={() => updateSetting('darkMode', dark)}
                      className={`px-4 lg:px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                        appSettings.darkMode === dark
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

          {/* Storage */}
          <div className={`${WORKSPACE_CARD_SURFACE} flex flex-col relative overflow-hidden transition-colors ${theme.card}`} data-settings-section="storage" data-k119-settings-card>
            <h2 className="font-heading text-lg font-bold mb-3 flex items-center gap-2">
              <HardDrive size={20} className="text-primary" />{t('k98SettingsStorage')}
            </h2>
            <div className="space-y-3">
              <div className={`grid sm:grid-cols-2 gap-4 p-4 rounded-2xl border ${theme.border} ${theme.input}`}>
                <div>
                  <p className={`text-xs font-bold mb-1 ${theme.textMuted}`}>{t('vaultSizeLabel')}</p>
                  <p className="text-sm font-bold">{formatStorageMegabytes(storageMetrics.vaultBytes)}</p>
                </div>
                <div>
                  <p className={`text-xs font-bold mb-1 ${theme.textMuted}`}>{t('lastSnapshotLabel')}</p>
                  <p className="text-sm font-bold">{formatSnapshotTime(storageMetrics.lastSnapshotAt)}</p>
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
            </div>
          </div>

          {/* Backup & Recovery */}
          <div data-settings-section="recovery">
            <h2 className="font-heading text-lg font-bold mb-3 flex items-center gap-2 px-1">
              <RotateCcw size={20} className="text-primary" />{t('k132BackupRecovery')}
            </h2>
            <RecoveryCenterPanel
              recovery={recovery}
              vaultRestore={vaultRestore}
              theme={theme}
              showToast={showToast}
              onExportZip={doVaultBackupZip}
              onExportJson={doVaultBackupJson}
              backingUpZip={backingUpZip}
            />
          </div>

          {/* Danger zone */}
          <div className={`${WORKSPACE_CARD_SURFACE} flex flex-col relative overflow-hidden border-2 border-red-500/20 transition-colors ${theme.card}`} data-settings-section="danger" data-k119-settings-card>
            <h2 className="font-heading text-lg font-bold text-red-500 mb-3 flex items-center gap-2">
              <AlertTriangle size={20} />{t('k98SettingsDangerZone')}
            </h2>
            <div className="space-y-4">
              <div className={`flex flex-col lg:flex-row justify-between lg:items-center gap-3 lg:gap-0`}>
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

              <div className={`flex flex-col lg:flex-row justify-between lg:items-center gap-3 lg:gap-0 pt-4 border-t ${theme.border}`}>
                <div>
                  <p className="text-base font-bold flex items-center gap-1.5">
                    <LogOut size={18} />{t('signOut')}
                  </p>
                </div>
                <button
                  onClick={onSignOut}
                  className={`px-6 py-3.5 rounded-xl font-bold text-sm transition-colors border ${theme.border} ${theme.hoverBg}`}
                >{t('signOut')}
                </button>
              </div>
            </div>
          </div>

          {/* legacy data management removed — K-98A IA */}

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
          fullPreview={vaultRestore.fullPreview}
          pipelineOptions={vaultRestore.pipelineOptions}
          restoreSource={vaultRestore.restoreSource}
          strategy={vaultRestore.strategy}
          selection={vaultRestore.selection}
          onStrategyChange={vaultRestore.setStrategy}
          onPipelineOptionsChange={vaultRestore.updatePipelineOptions}
          onToggleNote={vaultRestore.toggleNote}
          onToggleFolder={vaultRestore.toggleFolder}
          onSelectAll={vaultRestore.selectAll}
          onSelectNone={vaultRestore.selectNone}
          onConfirm={vaultRestore.confirmRestore}
          onCancel={vaultRestore.cancelRestore}
          importing={vaultRestore.importing}
        />
      )}
      <input
        ref={vaultRestore.fileInputRef}
        type="file"
        accept=".json,.zip,application/json,application/zip"
        className="hidden"
        onChange={vaultRestore.handleFileChange}
      />
    </div>
  );
};
