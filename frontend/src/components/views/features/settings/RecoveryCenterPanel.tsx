import { useState } from 'react';
import { Archive, CheckCircle2, Eye, HardDrive, Loader2, Shield, Upload, XCircle } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { formatStorageMegabytes } from '@/lib/vaultStorageMetrics';
import type { useRecoveryCenter } from '@/hooks/useRecoveryCenter';
import type { useVaultRestoreFlow } from '@/hooks/useVaultRestoreFlow';

type RecoveryCenter = ReturnType<typeof useRecoveryCenter>;
type VaultRestoreFlow = ReturnType<typeof useVaultRestoreFlow>;

export interface RecoveryCenterPanelProps {
  recovery: RecoveryCenter;
  vaultRestore: VaultRestoreFlow;
  cloudSyncEnabled: boolean;
  theme: { card: string; border: string; input: string; textMuted: string };
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

function formatTime(iso: string | null, fallback: string): string {
  if (!iso) return fallback;
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function RecoveryCenterPanel({
  recovery,
  vaultRestore,
  cloudSyncEnabled,
  theme,
  showToast,
}: RecoveryCenterPanelProps) {
  const { t } = useTranslation();
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<Record<string, boolean>>({});

  const protectionLabel = {
    protected: t('recoveryProtectionProtected'),
    partial: t('recoveryProtectionPartial'),
    none: t('recoveryProtectionNone'),
  }[recovery.protectionStatus];

  const protectionClass = {
    protected: 'text-green-600 dark:text-green-400',
    partial: 'text-amber-600 dark:text-amber-400',
    none: 'text-red-500',
  }[recovery.protectionStatus];

  const handleValidate = async (snapshotId: string) => {
    setValidatingId(snapshotId);
    try {
      const report = recovery.validateSnapshot(snapshotId);
      if (!report) {
        showToast(t('recoverySnapshotMissing'), 'error');
        return;
      }
      setValidationResults(prev => ({ ...prev, [snapshotId]: report.valid }));
      showToast(
        report.valid ? t('recoverySnapshotValid') : t('recoverySnapshotInvalid'),
        report.valid ? 'success' : 'error',
      );
    } finally {
      setValidatingId(null);
    }
  };

  const handlePreview = (snapshotId: string) => {
    vaultRestore.openSnapshotRestore(snapshotId);
  };

  return (
    <div className={`rounded-[24px] lg:rounded-[32px] shadow-sm p-6 lg:p-8 flex flex-col relative overflow-hidden transition-colors ${theme.card}`}>
      <h2 className="font-heading text-lg font-bold mb-6 flex items-center gap-2">
        <Archive size={20} className="text-primary" />
        {t('recoveryCenterTitle')}
      </h2>

      <div className="space-y-6">
        {/* Recovery status */}
        <div>
          <p className={`text-xs font-bold mb-3 ${theme.textMuted}`}>{t('recoveryStatusTitle')}</p>
          <div className={`grid sm:grid-cols-2 gap-4 p-4 rounded-2xl border ${theme.border} ${theme.input}`}>
            <div>
              <p className={`text-xs font-bold mb-1 ${theme.textMuted}`}>{t('lastSnapshotLabel')}</p>
              <p className="text-sm font-bold">{formatTime(recovery.lastSnapshotAt, t('storageNoSnapshot'))}</p>
            </div>
            <div>
              <p className={`text-xs font-bold mb-1 ${theme.textMuted}`}>{t('recoverySnapshotCount')}</p>
              <p className="text-sm font-bold">{recovery.snapshotCount}</p>
            </div>
            <div>
              <p className={`text-xs font-bold mb-1 ${theme.textMuted}`}>{t('recoveryLastExport')}</p>
              <p className="text-sm font-bold">{formatTime(recovery.lastExportAt, t('recoveryNoExport'))}</p>
            </div>
            <div>
              <p className={`text-xs font-bold mb-1 ${theme.textMuted}`}>{t('cloudSyncLabel')}</p>
              <p className="text-sm font-bold">
                {cloudSyncEnabled ? t('cloudSyncEnabled') : t('cloudSyncDisabled')}
              </p>
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <Shield size={16} className={protectionClass} />
              <span className={`text-sm font-bold ${protectionClass}`}>{protectionLabel}</span>
            </div>
          </div>
        </div>

        {/* Exports */}
        <div>
          <p className={`text-xs font-bold mb-3 ${theme.textMuted}`}>{t('recoveryExportsTitle')}</p>
          <div className={`flex flex-col sm:flex-row gap-2 p-4 rounded-2xl border ${theme.border} ${theme.input}`}>
            <button
              type="button"
              onClick={vaultRestore.openFilePicker}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm bg-primary text-primary-foreground"
            >
              <Upload size={16} />
              {t('vaultRestoreImport')}
            </button>
            <p className={`text-xs font-medium self-center ${theme.textMuted}`}>{t('recoveryExportsHint')}</p>
          </div>
        </div>

        {/* Snapshot browser */}
        <div>
          <p className={`text-xs font-bold mb-3 ${theme.textMuted}`}>{t('recoverySnapshotsTitle')}</p>
          {recovery.snapshots.length === 0 ? (
            <p className={`text-sm font-medium ${theme.textMuted}`}>{t('recoveryNoSnapshots')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {recovery.snapshots.map(snap => {
                const schemaVersion = recovery.getSnapshotSchemaVersion(snap.snapshotId);
                const validated = validationResults[snap.snapshotId];
                return (
                  <div
                    key={snap.snapshotId}
                    className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl border ${theme.border} ${theme.input}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <HardDrive size={14} className="text-primary shrink-0" />
                        <span className="text-sm font-bold">{formatTime(snap.createdAt, snap.createdAt)}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-alt ${theme.textMuted}`}>
                          {t(`recoverySnapshotSlot_${snap.slot}` as 'recoverySnapshotSlot_daily')}
                        </span>
                        {validated === true ? (
                          <CheckCircle2 size={14} className="text-green-500" />
                        ) : validated === false ? (
                          <XCircle size={14} className="text-red-500" />
                        ) : null}
                      </div>
                      <p className={`text-xs font-medium mt-1 ${theme.textMuted}`}>
                        {t('recoverySnapshotMeta')
                          .replace('{notes}', String(snap.noteCount))
                          .replace('{folders}', String(snap.folderCount))
                          .replace('{size}', formatStorageMegabytes(snap.payloadBytes))
                          .replace('{version}', schemaVersion != null ? String(schemaVersion) : '—')}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={validatingId === snap.snapshotId}
                        onClick={() => handleValidate(snap.snapshotId)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border ${theme.border} ${theme.input} disabled:opacity-50`}
                      >
                        {validatingId === snap.snapshotId
                          ? <Loader2 size={14} className="animate-spin" />
                          : t('recoveryValidateSnapshot')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePreview(snap.snapshotId)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground"
                      >
                        <Eye size={14} />
                        {t('recoveryPreviewSnapshot')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
