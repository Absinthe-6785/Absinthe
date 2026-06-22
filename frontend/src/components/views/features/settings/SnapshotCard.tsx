import { useTranslation } from '@/lib/i18n';
import { formatStorageMegabytes } from '@/lib/vaultStorageMetrics';
import type { VaultSnapshotSummary } from '@/lib/vaultSnapshotStore';
import type { VaultSnapshotValidationReport } from '@/lib/vaultSnapshotValidate';
import { resolveSnapshotStatusBadge } from './recoveryExport';

export interface SnapshotCardProps {
  snapshot: VaultSnapshotSummary;
  schemaVersion: number | null;
  validationReport: VaultSnapshotValidationReport | null;
  isValidating: boolean;
  isRestoring: boolean;
  onVerify: () => void;
  onPreview: () => void;
  onRestore: () => void;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const BADGE_CLASS: Record<string, string> = {
  valid: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  corrupted: 'bg-red-500/15 text-red-600 dark:text-red-300',
  unknown: 'bg-surface-alt text-muted',
};

export function SnapshotCard({
  snapshot,
  schemaVersion,
  validationReport,
  isValidating,
  isRestoring,
  onVerify,
  onPreview,
  onRestore,
}: SnapshotCardProps) {
  const { t } = useTranslation();
  const badge = resolveSnapshotStatusBadge(validationReport);

  return (
    <article
      className="rounded-xl border px-3 py-2"
      data-k125e-snapshot-card
      data-k125e-snapshot-id={snapshot.snapshotId}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold">{formatTime(snapshot.createdAt)}</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${BADGE_CLASS[badge.tone]}`}
              data-k125e-snapshot-status={badge.tone}
            >
              {t(badge.labelKey)}
            </span>
            <span className="text-[9px] font-bold text-muted">
              {t(`recoverySnapshotSlot_${snapshot.slot}` as 'recoverySnapshotSlot_daily')}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] font-medium text-muted">
            <span>{t('k125eSnapshotNotes').replace('{count}', String(snapshot.noteCount))}</span>
            <span>{t('k125eSnapshotFolders').replace('{count}', String(snapshot.folderCount))}</span>
            <span>{formatStorageMegabytes(snapshot.payloadBytes)}</span>
            {schemaVersion != null ? (
              <span>{t('k125eSnapshotSchema').replace('{version}', String(schemaVersion))}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className="mt-1.5 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-1.5"
        data-k125e-snapshot-inspect
      >
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={onVerify}
            disabled={isValidating}
            className="rounded-lg border px-2 py-1 text-[10px] font-bold disabled:opacity-50"
          >
            {isValidating ? t('k125eVerifying') : t('k125eVerifySnapshot')}
          </button>
          <button
            type="button"
            onClick={onPreview}
            disabled={isValidating}
            className="rounded-lg border px-2 py-1 text-[10px] font-bold disabled:opacity-50"
          >
            {t('k125ePreviewSnapshot')}
          </button>
        </div>
        <button
          type="button"
          onClick={onRestore}
          disabled={isRestoring || isValidating}
          className="ml-auto rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-200 disabled:opacity-50"
          data-k125e-snapshot-restore
        >
          {isRestoring ? t('k125eRestoring') : t('k125eRestoreSnapshot')}
        </button>
      </div>
    </article>
  );
}
