import { AlertTriangle, Download, HardDrive, RefreshCw, ShieldCheck, Upload } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { formatStorageMegabytes, type VaultStorageMetrics } from '@/lib/vaultStorageMetrics';
import type { useRecoveryCenter } from '@/hooks/useRecoveryCenter';
import type { useVaultRestoreFlow } from '@/hooks/useVaultRestoreFlow';
import { WORKSPACE_CARD_SURFACE } from '@/components/common/workspaceCardSizes';
import type { PendingReducedVaultBackup } from '@/lib/vaultBackupFlow';
import type { RecoveryProtectionStatus } from '@/lib/vaultRestorePipeline';
import type { TranslationKey } from '@/lib/i18n';

type RecoveryCenter = ReturnType<typeof useRecoveryCenter>;
type VaultRestoreFlow = ReturnType<typeof useVaultRestoreFlow>;

export interface RecoveryCenterPanelProps {
  recovery: RecoveryCenter;
  vaultRestore: VaultRestoreFlow;
  storageMetrics: VaultStorageMetrics;
  theme: { card: string; border: string; input: string; textMuted: string };
  onCreateBackup: () => void | Promise<void>;
  onRetryBackup: () => void | Promise<void>;
  onCreateLimitedBackup: () => void | Promise<void>;
  backingUp: boolean;
  cloudSyncEnabled: boolean;
  pendingReducedBackup: PendingReducedVaultBackup | null;
}

export function resolveDataSafetyStatusPresentation(status: RecoveryProtectionStatus): {
  labelKey: TranslationKey;
  className: string;
} {
  if (status === 'protected') {
    return { labelKey: 'dataSafetyHealthy', className: 'bg-green-500/10 text-green-600' };
  }
  if (status === 'partial') {
    return { labelKey: 'dataSafetyLimited', className: 'bg-amber-500/10 text-amber-600' };
  }
  return { labelKey: 'dataSafetyNeedsBackup', className: 'bg-amber-500/10 text-amber-600' };
}

export function resolveBackupControlCopy(cloudSyncEnabled: boolean): {
  descriptionKey: TranslationKey;
  actionKey: TranslationKey;
} {
  return cloudSyncEnabled
    ? { descriptionKey: 'dataSafetyBackupDesc', actionKey: 'dataSafetyCreateBackup' }
    : { descriptionKey: 'dataSafetyLocalBackupDesc', actionKey: 'dataSafetyCreateLocalBackup' };
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
  storageMetrics,
  theme,
  onCreateBackup,
  onRetryBackup,
  onCreateLimitedBackup,
  backingUp,
  cloudSyncEnabled,
  pendingReducedBackup,
}: RecoveryCenterPanelProps) {
  const { t } = useTranslation();
  const snapshots = recovery.snapshots.slice(0, 4);
  const status = resolveDataSafetyStatusPresentation(recovery.protectionStatus);
  const backupCopy = resolveBackupControlCopy(cloudSyncEnabled);

  return (
    <div className={`${WORKSPACE_CARD_SURFACE} flex flex-col relative overflow-hidden transition-colors ${theme.card}`} data-settings-data-safety>
      <div className="space-y-5">
        <section data-settings-data-safety-status>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="font-heading text-base font-bold">{t('dataSafetyStatusTitle')}</h3>
              <p className={`text-sm font-medium mt-1 ${theme.textMuted}`}>{t('dataSafetyStatusDesc')}</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${status.className}`}>
              <ShieldCheck size={14} />
              {t(status.labelKey)}
            </span>
          </div>
          <div className={`grid sm:grid-cols-3 gap-3 p-4 rounded-2xl border ${theme.border} ${theme.input}`}>
            <div>
              <p className={`text-xs font-bold mb-1 ${theme.textMuted}`}>{t('dataSafetyLastBackup')}</p>
              <p className="text-sm font-bold">{formatTime(recovery.lastExportAt, t('dataSafetyNever'))}</p>
            </div>
            <div>
              <p className={`text-xs font-bold mb-1 ${theme.textMuted}`}>{t('dataSafetySnapshotCount')}</p>
              <p className="text-sm font-bold tabular-nums">{storageMetrics.snapshotCount}</p>
            </div>
            <div>
              <p className={`text-xs font-bold mb-1 ${theme.textMuted}`}>{t('vaultSizeLabel')}</p>
              <p className="text-sm font-bold">{formatStorageMegabytes(storageMetrics.vaultBytes)}</p>
            </div>
          </div>
        </section>

        <section className={`border-t pt-5 ${theme.border}`} data-settings-data-safety-backup>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-heading text-base font-bold">{t('dataSafetyBackupTitle')}</h3>
              <p className={`text-sm font-medium mt-1 ${theme.textMuted}`}>{t(backupCopy.descriptionKey)}</p>
            </div>
            <button
              type="button"
              onClick={onCreateBackup}
              disabled={backingUp}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-primary text-primary-foreground disabled:opacity-60"
            >
              <Download size={16} />
              {backingUp ? t('vaultBackupZipping') : t(backupCopy.actionKey)}
            </button>
          </div>
          {pendingReducedBackup && (
            <div
              className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4"
              data-settings-limited-backup-warning
              role="status"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{t('dataSafetyLimitedBackupTitle')}</p>
                  <p className={`mt-1 text-sm font-medium ${theme.textMuted}`}>
                    {t(pendingReducedBackup.recipeUnavailable
                      ? 'dataSafetyLimitedBackupRecipeDesc'
                      : 'dataSafetyLimitedBackupDesc')}
                  </p>
                  <p className={`mt-1 text-xs font-medium ${theme.textMuted}`}>
                    {t('dataSafetyLimitedBackupServerSafe')}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={onRetryBackup}
                      disabled={backingUp}
                      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-60 ${theme.border} ${theme.input}`}
                    >
                      <RefreshCw size={15} />
                      {t('dataSafetyRetryBackup')}
                    </button>
                    <button
                      type="button"
                      onClick={onCreateLimitedBackup}
                      disabled={backingUp}
                      className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                    >
                      <Download size={15} />
                      {t('dataSafetyCreateLimitedBackup')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className={`border-t pt-5 ${theme.border}`} data-settings-data-safety-restore>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-heading text-base font-bold">{t('dataSafetyRestoreTitle')}</h3>
              <p className={`text-sm font-medium mt-1 ${theme.textMuted}`}>{t('dataSafetyRestoreDesc')}</p>
            </div>
            <button
              type="button"
              onClick={vaultRestore.openFilePicker}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-primary text-primary-foreground"
            >
              <Upload size={16} />
              {t('dataSafetyRestoreBackup')}
            </button>
          </div>
        </section>

        <section className={`border-t pt-5 ${theme.border}`} data-settings-data-safety-snapshots>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="font-heading text-base font-bold">{t('dataSafetySnapshotHistory')}</h3>
              <p className={`text-sm font-medium mt-1 ${theme.textMuted}`}>{t('dataSafetySnapshotDesc')}</p>
            </div>
          </div>
          {snapshots.length > 0 ? (
            <div className="grid sm:grid-cols-2 gap-2">
              {snapshots.map(snap => (
                <button
                  key={snap.snapshotId}
                  type="button"
                  onClick={() => vaultRestore.openSnapshotRestore(snap.snapshotId)}
                  className={`flex items-center justify-between gap-3 text-left p-3 rounded-xl border ${theme.border} ${theme.input}`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-bold truncate">{formatTime(snap.createdAt, snap.createdAt)}</span>
                    <span className={`block text-xs font-medium mt-0.5 ${theme.textMuted}`}>
                      {t('dataSafetySnapshotMeta')
                        .replace('{notes}', String(snap.noteCount))
                        .replace('{size}', formatStorageMegabytes(snap.payloadBytes))}
                    </span>
                  </span>
                  <HardDrive size={15} className="text-primary shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <p className={`text-sm font-medium ${theme.textMuted}`}>{t('dataSafetyNoSnapshots')}</p>
          )}
        </section>
      </div>
    </div>
  );
}
