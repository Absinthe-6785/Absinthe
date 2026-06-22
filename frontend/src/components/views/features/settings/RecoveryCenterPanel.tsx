import { useState } from 'react';
import { Shield, Upload } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import type { VaultSnapshotSummary } from '@/lib/vaultSnapshotStore';
import type { VaultSnapshotValidationReport } from '@/lib/vaultSnapshotValidate';
import type { useRecoveryCenter } from '@/hooks/useRecoveryCenter';
import type { useVaultRestoreFlow } from '@/hooks/useVaultRestoreFlow';
import { formatValidationErrors } from './recoveryExport';
import { SnapshotList } from './SnapshotList';

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
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [validationReports, setValidationReports] = useState<
    Record<string, VaultSnapshotValidationReport | null>
  >({});

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

  const schemaVersions = Object.fromEntries(
    recovery.snapshots.map(s => [s.snapshotId, recovery.getSnapshotSchemaVersion(s.snapshotId)]),
  );

  const handleVerify = async (snapshot: VaultSnapshotSummary) => {
    setValidatingId(snapshot.snapshotId);
    try {
      const report = recovery.validateSnapshot(snapshot.snapshotId);
      if (!report) {
        showToast(t('k125eValidationStorageUnavailable'), 'error');
        return;
      }
      setValidationReports(prev => ({ ...prev, [snapshot.snapshotId]: report }));
      if (report.valid && report.restoreReady) {
        showToast(t('recoverySnapshotValid'), 'success');
      } else {
        const keys = formatValidationErrors(report.errors);
        showToast(t(keys[0] ?? 'k125eValidationFailed'), 'error');
      }
    } finally {
      setValidatingId(null);
    }
  };

  const openRestore = (snapshotId: string, restoring: boolean) => {
    if (restoring) setRestoringId(snapshotId);
    vaultRestore.openSnapshotRestore(snapshotId);
    if (restoring) setRestoringId(null);
  };

  return (
    <div
      className={`rounded-[20px] lg:rounded-[24px] shadow-sm p-4 lg:p-5 flex flex-col gap-3 ${theme.card}`}
      data-k125e-recovery-panel
    >
      {/* Recovery status — compact */}
      <div data-k125e-section="recovery">
        <p className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${theme.textMuted}`}>
          {t('k125eSectionRecovery')}
        </p>
        <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-xl border text-[11px] ${theme.border} ${theme.input}`}>
          <div>
            <p className={`text-[9px] font-bold mb-0.5 ${theme.textMuted}`}>{t('lastSnapshotLabel')}</p>
            <p className="font-bold leading-tight">{formatTime(recovery.lastSnapshotAt, t('storageNoSnapshot'))}</p>
          </div>
          <div>
            <p className={`text-[9px] font-bold mb-0.5 ${theme.textMuted}`}>{t('recoverySnapshotCount')}</p>
            <p className="font-bold">{recovery.snapshotCount}</p>
          </div>
          <div>
            <p className={`text-[9px] font-bold mb-0.5 ${theme.textMuted}`}>{t('recoveryLastExport')}</p>
            <p className="font-bold leading-tight">{formatTime(recovery.lastExportAt, t('recoveryNoExport'))}</p>
          </div>
          <div>
            <p className={`text-[9px] font-bold mb-0.5 ${theme.textMuted}`}>{t('cloudSyncLabel')}</p>
            <p className="font-bold">{cloudSyncEnabled ? t('cloudSyncEnabled') : t('cloudSyncDisabled')}</p>
          </div>
        </div>
        <div className={`mt-2 flex items-center gap-1.5 text-[11px] font-bold ${protectionClass}`}>
          <Shield size={14} className="shrink-0" />
          <span>{protectionLabel}</span>
        </div>
      </div>

      {/* Import backup file */}
      <div className={`flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-xl border ${theme.border} ${theme.input}`}>
        <button
          type="button"
          onClick={vaultRestore.openFilePicker}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-bold text-xs bg-primary text-primary-foreground shrink-0"
          data-k125e-import-backup
        >
          <Upload size={14} />
          {t('vaultRestoreImport')}
        </button>
        <p className={`text-[10px] font-medium ${theme.textMuted}`}>{t('k125eImportHint')}</p>
      </div>

      {/* Snapshot list */}
      <div>
        <p className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${theme.textMuted}`}>
          {t('recoverySnapshotsTitle')}
        </p>
        {recovery.snapshots.length === 0 ? (
          <p className={`text-xs font-medium ${theme.textMuted}`}>{t('recoveryNoSnapshots')}</p>
        ) : (
          <SnapshotList
            snapshots={recovery.snapshots}
            schemaVersions={schemaVersions}
            validationReports={validationReports}
            validatingId={validatingId}
            restoringId={restoringId}
            onVerify={handleVerify}
            onPreview={snap => openRestore(snap.snapshotId, false)}
            onRestore={snap => openRestore(snap.snapshotId, true)}
          />
        )}
      </div>
    </div>
  );
}
