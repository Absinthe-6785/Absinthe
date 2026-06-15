import { useRef } from 'react';
import { Archive, X } from 'lucide-react';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useTranslation } from '@/lib/i18n';
import type { VaultRestoreConflictStrategy, VaultRestorePreview } from '@/lib/importVaultBackup';

export interface VaultRestoreModalProps {
  preview: VaultRestorePreview;
  strategy: VaultRestoreConflictStrategy;
  onStrategyChange: (strategy: VaultRestoreConflictStrategy) => void;
  onConfirm: () => void;
  onCancel: () => void;
  importing?: boolean;
}

export function VaultRestoreModal({
  preview,
  strategy,
  onStrategyChange,
  onConfirm,
  onCancel,
  importing = false,
}: VaultRestoreModalProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open: true, onClose: onCancel, containerRef: panelRef });

  if (!preview.valid || !preview.manifest) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-[200] p-4 backdrop-blur-sm" style={{ background: 'var(--color-overlay)' }} onClick={onCancel} role="presentation">
        <div ref={panelRef} role="dialog" aria-modal="true" className="rounded-absinthe-xl p-6 w-full max-w-[360px] shadow-absinthe-xl bg-surface text-foreground" onClick={e => e.stopPropagation()}>
          <p className="text-sm font-semibold text-center">{t('vaultRestoreInvalid')}</p>
          <button type="button" onClick={onCancel} className="mt-4 w-full py-2.5 rounded-xl font-bold text-sm bg-surface-alt">{t('cancel')}</button>
        </div>
      </div>
    );
  }

  const strategies: VaultRestoreConflictStrategy[] = ['skip', 'replace', 'duplicate'];

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[200] p-4 backdrop-blur-sm" style={{ background: 'var(--color-overlay)' }} onClick={onCancel} role="presentation">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vault-restore-title"
        className="rounded-absinthe-xl p-6 w-full max-w-[400px] shadow-absinthe-xl bg-surface text-foreground flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Archive size={20} className="text-primary shrink-0" />
            <h2 id="vault-restore-title" className="text-base font-bold">{t('vaultRestoreTitle')}</h2>
          </div>
          <button type="button" onClick={onCancel} aria-label={t('cancel')} className="p-1 rounded-lg hover:bg-surface-alt">
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl p-3 bg-surface-alt">
            <div className="text-xs text-muted font-semibold">{t('vaultRestoreNoteCount')}</div>
            <div className="text-lg font-bold">{preview.noteCount}</div>
          </div>
          <div className="rounded-xl p-3 bg-surface-alt">
            <div className="text-xs text-muted font-semibold">{t('vaultRestoreFolderCount')}</div>
            <div className="text-lg font-bold">{preview.folderCount}</div>
          </div>
          <div className="rounded-xl p-3 bg-surface-alt">
            <div className="text-xs text-muted font-semibold">{t('vaultRestoreNewNotes')}</div>
            <div className="text-lg font-bold">{preview.newNoteCount}</div>
          </div>
          <div className="rounded-xl p-3 bg-surface-alt">
            <div className="text-xs text-muted font-semibold">{t('vaultRestoreConflicts')}</div>
            <div className="text-lg font-bold">{preview.conflictCount}</div>
          </div>
        </div>

        {preview.exportedAt ? (
          <p className="text-xs text-muted">
            {t('vaultRestoreExportedAt').replace('{date}', preview.exportedAt.slice(0, 10))}
          </p>
        ) : null}

        {preview.conflictCount > 0 ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-bold text-muted mb-1">{t('vaultRestoreConflictLegend')}</legend>
            {strategies.map(s => (
              <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="vault-restore-strategy"
                  checked={strategy === s}
                  onChange={() => onStrategyChange(s)}
                  className="accent-primary"
                />
                <span>{t(`vaultRestoreStrategy_${s}` as 'vaultRestoreStrategy_skip')}</span>
              </label>
            ))}
          </fieldset>
        ) : null}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onCancel} disabled={importing} className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-surface-alt disabled:opacity-50">
            {t('cancel')}
          </button>
          <button type="button" onClick={onConfirm} disabled={importing} className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-primary text-primary-foreground disabled:opacity-50">
            {importing ? t('vaultRestoreImporting') : t('vaultRestoreConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
