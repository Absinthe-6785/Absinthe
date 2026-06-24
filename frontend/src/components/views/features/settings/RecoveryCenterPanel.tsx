import { Download, HardDrive, ShieldCheck, Upload } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { formatStorageMegabytes, type VaultStorageMetrics } from '@/lib/vaultStorageMetrics';
import type { useRecoveryCenter } from '@/hooks/useRecoveryCenter';
import type { useVaultRestoreFlow } from '@/hooks/useVaultRestoreFlow';
import { WORKSPACE_CARD_SURFACE } from '@/components/common/workspaceCardSizes';

type RecoveryCenter = ReturnType<typeof useRecoveryCenter>;
type VaultRestoreFlow = ReturnType<typeof useVaultRestoreFlow>;

export interface RecoveryCenterPanelProps {
  recovery: RecoveryCenter;
  vaultRestore: VaultRestoreFlow;
  storageMetrics: VaultStorageMetrics;
  theme: { card: string; border: string; input: string; textMuted: string };
  onCreateBackup: () => void | Promise<void>;
  backingUp: boolean;
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
  backingUp,
}: RecoveryCenterPanelProps) {
  const { t } = useTranslation();
  const hasBackup = Boolean(recovery.lastExportAt || recovery.lastSnapshotAt);
  const snapshots = recovery.snapshots.slice(0, 4);

  return (
    <div className={`${WORKSPACE_CARD_SURFACE} flex flex-col relative overflow-hidden transition-colors ${theme.card}`} data-settings-data-safety>
      <div className="space-y-5">
        <section data-settings-data-safety-status>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="font-heading text-base font-bold">{t('dataSafetyStatusTitle')}</h3>
              <p className={`text-sm font-medium mt-1 ${theme.textMuted}`}>{t('dataSafetyStatusDesc')}</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
              hasBackup ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'
            }`}>
              <ShieldCheck size={14} />
              {hasBackup ? t('dataSafetyHealthy') : t('dataSafetyNeedsBackup')}
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
              <p className={`text-sm font-medium mt-1 ${theme.textMuted}`}>{t('dataSafetyBackupDesc')}</p>
            </div>
            <button
              type="button"
              onClick={onCreateBackup}
              disabled={backingUp}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-primary text-primary-foreground disabled:opacity-60"
            >
              <Download size={16} />
              {backingUp ? t('vaultBackupZipping') : t('dataSafetyCreateBackup')}
            </button>
          </div>
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
