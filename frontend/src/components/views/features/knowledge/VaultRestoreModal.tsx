import { useMemo, useRef } from 'react';
import { Archive, X } from 'lucide-react';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useTranslation } from '@/lib/i18n';
import type {
  VaultRestoreConflictStrategy,
  VaultRestorePreview,
  VaultRestoreSelection,
} from '@/lib/importVaultBackup';

export interface VaultRestoreModalProps {
  preview: VaultRestorePreview;
  strategy: VaultRestoreConflictStrategy;
  selection: VaultRestoreSelection;
  onStrategyChange: (strategy: VaultRestoreConflictStrategy) => void;
  onToggleNote: (noteId: string, selected: boolean) => void;
  onToggleFolder: (folderId: string, selected: boolean) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  importing?: boolean;
}

export function VaultRestoreModal({
  preview,
  strategy,
  selection,
  onStrategyChange,
  onToggleNote,
  onToggleFolder,
  onSelectAll,
  onSelectNone,
  onConfirm,
  onCancel,
  importing = false,
}: VaultRestoreModalProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open: true, onClose: onCancel, containerRef: panelRef });

  const selectedNoteCount = useMemo(
    () => preview.noteOptions.filter(n => selection.noteIds.has(n.id)).length,
    [preview.noteOptions, selection.noteIds],
  );

  if (!preview.valid || !preview.manifest) {
    const validation = preview.validation;
    return (
      <div className="fixed inset-0 flex items-center justify-center z-[200] p-4 backdrop-blur-sm" style={{ background: 'var(--color-overlay)' }} onClick={onCancel} role="presentation">
        <div ref={panelRef} role="dialog" aria-modal="true" className="rounded-absinthe-xl p-6 w-full max-w-[400px] shadow-absinthe-xl bg-surface text-foreground flex flex-col gap-3" onClick={e => e.stopPropagation()}>
          <p className="text-sm font-semibold text-center">{t('vaultRestoreInvalid')}</p>
          {validation && validation.corruptedNoteIds.length > 0 ? (
            <p className="text-xs text-muted text-center">
              {t('vaultRestoreCorruptedNotes').replace('{count}', String(validation.corruptedNoteIds.length))}
            </p>
          ) : null}
          {validation && validation.errors.length > 0 ? (
            <ul className="text-xs text-red-500 list-disc pl-4">
              {validation.errors.slice(0, 5).map(e => <li key={e}>{e}</li>)}
            </ul>
          ) : null}
          <button type="button" onClick={onCancel} className="w-full py-2.5 rounded-xl font-bold text-sm bg-surface-alt">{t('cancel')}</button>
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
        className="rounded-absinthe-xl p-6 w-full max-w-[480px] max-h-[90vh] shadow-absinthe-xl bg-surface text-foreground flex flex-col gap-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Archive size={20} className="text-primary shrink-0" />
            <h2 id="vault-restore-title" className="text-base font-bold">{t('vaultRestoreTitle')}</h2>
          </div>
          <button type="button" onClick={onCancel} aria-label={t('cancel')} className="p-1 rounded-lg hover:bg-surface-alt">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex flex-col gap-4 pr-1">
          <div>
            <p className="text-xs font-bold text-muted mb-2">{t('vaultRestoreValidationTitle')}</p>
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
                <div className="text-xs text-muted font-semibold">{t('vaultRestoreRelationCount')}</div>
                <div className="text-lg font-bold">{preview.relationCount}</div>
              </div>
              <div className="rounded-xl p-3 bg-surface-alt">
                <div className="text-xs text-muted font-semibold">{t('vaultRestoreConflicts')}</div>
                <div className="text-lg font-bold">{preview.conflictCount}</div>
              </div>
            </div>
          </div>

          <div className="text-xs text-muted flex flex-wrap gap-x-3 gap-y-1">
            {preview.exportedAt ? (
              <span>{t('vaultRestoreExportedAt').replace('{date}', preview.exportedAt.slice(0, 10))}</span>
            ) : null}
            {preview.appVersion ? (
              <span>{t('vaultRestoreAppVersion').replace('{version}', preview.appVersion)}</span>
            ) : null}
            {preview.manifest?.schemaVersion != null ? (
              <span>{t('vaultRestoreSchemaVersion').replace('{version}', String(preview.manifest.schemaVersion))}</span>
            ) : null}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs font-bold text-muted">{t('vaultRestoreSelectTitle')}</p>
              <div className="flex gap-2">
                <button type="button" onClick={onSelectAll} className="text-[10px] font-bold text-primary">{t('vaultRestoreSelectAll')}</button>
                <button type="button" onClick={onSelectNone} className="text-[10px] font-bold text-muted">{t('vaultRestoreSelectNone')}</button>
              </div>
            </div>
            <p className="text-[10px] text-muted mb-2">
              {t('vaultRestoreSelectedCount').replace('{count}', String(selectedNoteCount))}
            </p>

            <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto border border-border rounded-xl p-2">
              {preview.folderOptions.map(folder => {
                const folderKey = folder.id;
                const folderNoteIds = preview.noteOptions
                  .filter(n => (n.folderId ?? '__unfiled__') === folderKey)
                  .map(n => n.id);
                const allSelected = folderNoteIds.every(id => selection.noteIds.has(id));
                const label = folderKey === '__unfiled__'
                  ? t('vaultRestoreUnfiledFolder')
                  : folder.name;

                return (
                  <div key={folderKey}>
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer py-0.5">
                      <input
                        type="checkbox"
                        checked={allSelected && folderNoteIds.length > 0}
                        onChange={e => onToggleFolder(folderKey, e.target.checked)}
                        className="accent-primary"
                      />
                      <span>{label} ({folder.noteCount})</span>
                    </label>
                    <div className="pl-5 flex flex-col gap-0.5">
                      {preview.noteOptions
                        .filter(n => (n.folderId ?? '__unfiled__') === folderKey)
                        .map(note => (
                          <label key={note.id} className="flex items-center gap-2 text-[11px] cursor-pointer py-0.5 truncate">
                            <input
                              type="checkbox"
                              checked={selection.noteIds.has(note.id)}
                              onChange={e => onToggleNote(note.id, e.target.checked)}
                              className="accent-primary shrink-0"
                            />
                            <span className="truncate">{note.title || t('untitledNote')}</span>
                          </label>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

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
        </div>

        <div className="flex gap-2 pt-1 shrink-0">
          <button type="button" onClick={onCancel} disabled={importing} className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-surface-alt disabled:opacity-50">
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={importing || selectedNoteCount === 0}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-primary text-primary-foreground disabled:opacity-50"
          >
            {importing ? t('vaultRestoreImporting') : t('vaultRestoreConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
