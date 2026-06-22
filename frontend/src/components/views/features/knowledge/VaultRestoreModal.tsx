import { useMemo, useRef, useState } from 'react';
import { Archive, X } from 'lucide-react';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useTranslation } from '@/lib/i18n';
import type {
  VaultRestoreConflictStrategy,
  VaultRestorePreview,
  VaultRestoreSelection,
} from '@/lib/importVaultBackup';
import type { FullVaultRestorePreview, VaultRestoreImpact, VaultRestorePipelineOptions } from '@/lib/vaultRestorePipeline';
import { formatValidationErrors } from '../settings/recoveryExport';

export interface VaultRestoreModalProps {
  preview: VaultRestorePreview;
  fullPreview?: FullVaultRestorePreview | null;
  pipelineOptions?: VaultRestorePipelineOptions;
  restoreSource?: 'export' | 'snapshot';
  strategy: VaultRestoreConflictStrategy;
  selection: VaultRestoreSelection;
  onStrategyChange: (strategy: VaultRestoreConflictStrategy) => void;
  onPipelineOptionsChange?: (patch: Partial<VaultRestorePipelineOptions>) => void;
  onToggleNote: (noteId: string, selected: boolean) => void;
  onToggleFolder: (folderId: string, selected: boolean) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  importing?: boolean;
}

function ImpactSummary({ impact, t }: { impact: VaultRestoreImpact; t: (key: import('@/lib/i18n').TranslationKey) => string }) {
  const lines: string[] = [];
  if (impact.noteCount) lines.push(t('vaultRestoreImpactNotes').replace('{count}', String(impact.noteCount)));
  if (impact.folderCount) lines.push(t('vaultRestoreImpactFolders').replace('{count}', String(impact.folderCount)));
  if (impact.savedViewCount) lines.push(t('vaultRestoreImpactViews').replace('{count}', String(impact.savedViewCount)));
  if (impact.ruleCollectionCount) lines.push(t('vaultRestoreImpactRules').replace('{count}', String(impact.ruleCollectionCount)));
  if (impact.databaseViewCount) lines.push(t('vaultRestoreImpactDbViews').replace('{count}', String(impact.databaseViewCount)));
  if (impact.focusPresetCount) lines.push(t('vaultRestoreImpactFocus').replace('{count}', String(impact.focusPresetCount)));
  if (impact.hasKnowledgeHistory) lines.push(t('vaultRestoreImpactHistory'));
  if (impact.healthDraftCount || impact.healthMemoCount) {
    lines.push(t('vaultRestoreImpactHealth')
      .replace('{drafts}', String(impact.healthDraftCount))
      .replace('{memos}', String(impact.healthMemoCount)));
  }
  if (impact.cloudCompleteness && impact.cloudCompleteness !== 'skipped') {
    const cloudParts: string[] = [];
    if (impact.cloudScheduleCount) cloudParts.push(t('vaultRestoreImpactCloudSchedules').replace('{count}', String(impact.cloudScheduleCount)));
    if (impact.cloudWorkoutCount) cloudParts.push(t('vaultRestoreImpactCloudWorkouts').replace('{count}', String(impact.cloudWorkoutCount)));
    if (impact.cloudInbodyCount) cloudParts.push(t('vaultRestoreImpactCloudInbody').replace('{count}', String(impact.cloudInbodyCount)));
    if (impact.cloudRecipeCount) cloudParts.push(t('vaultRestoreImpactCloudRecipes').replace('{count}', String(impact.cloudRecipeCount)));
    if (cloudParts.length) lines.push(cloudParts.join(' · '));
  }
  if (impact.hasSettings) lines.push(t('vaultRestoreImpactSettings'));

  if (lines.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-bold text-muted mb-2">{t('vaultRestoreImpactTitle')}</p>
      <ul className="text-xs text-muted space-y-1 list-disc pl-4">
        {lines.map(line => <li key={line}>{line}</li>)}
      </ul>
    </div>
  );
}

export function VaultRestoreModal({
  preview,
  fullPreview,
  pipelineOptions,
  restoreSource = 'export',
  strategy,
  selection,
  onStrategyChange,
  onPipelineOptionsChange,
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
  const [restoreAcknowledged, setRestoreAcknowledged] = useState(false);
  useModalA11y({ open: true, onClose: onCancel, containerRef: panelRef });

  const selectedNoteCount = useMemo(
    () => preview.noteOptions.filter(n => selection.noteIds.has(n.id)).length,
    [preview.noteOptions, selection.noteIds],
  );

  const hasExtensions = Boolean(preview.manifest?.extensions);
  const hasCloud = Boolean(
    preview.manifest?.cloud && preview.manifest.cloud.completeness !== 'skipped',
  );
  const canConfirm = selectedNoteCount > 0
    || (pipelineOptions?.restoreExtensions && hasExtensions)
    || (pipelineOptions?.restoreCloud && hasCloud);

  const titleKey = restoreSource === 'snapshot' ? 'vaultRestoreSnapshotTitle' : 'vaultRestoreTitle';

  if (!preview.valid || !preview.manifest) {
    const validation = preview.validation;
    const errorKeys = validation?.errors.length
      ? formatValidationErrors(validation.errors)
      : ['k125eValidationFailed' as const];
    return (
      <div className="fixed inset-0 flex items-center justify-center z-[200] p-4 backdrop-blur-sm" style={{ background: 'var(--color-overlay)' }} onClick={onCancel} role="presentation">
        <div ref={panelRef} role="dialog" aria-modal="true" className="rounded-absinthe-xl p-6 w-full max-w-[400px] shadow-absinthe-xl bg-surface text-foreground flex flex-col gap-3" onClick={e => e.stopPropagation()} data-k125e-restore-invalid>
          <p className="text-sm font-semibold text-center">{t('k125eValidationFailed')}</p>
          <p className="text-xs text-muted text-center">{t('k125eValidationGuidance')}</p>
          {validation && validation.corruptedNoteIds.length > 0 ? (
            <p className="text-xs text-muted text-center">
              {t('vaultRestoreCorruptedNotes').replace('{count}', String(validation.corruptedNoteIds.length))}
            </p>
          ) : null}
          <ul className="text-xs text-red-500 list-disc pl-4 space-y-1">
            {errorKeys.map(key => <li key={key}>{t(key)}</li>)}
          </ul>
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
        data-k125e-restore-modal
      >
        <div className="flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Archive size={20} className="text-primary shrink-0" />
            <h2 id="vault-restore-title" className="text-base font-bold">{t(titleKey)}</h2>
          </div>
          <button type="button" onClick={onCancel} aria-label={t('cancel')} className="p-1 rounded-lg hover:bg-surface-alt">
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-1 text-[10px] font-bold" data-k125e-restore-flow>
          <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5">{t('k125eRestoreFlowPreview')}</span>
          <span className="text-muted self-center">→</span>
          <span className="rounded-full bg-surface-alt text-muted px-2 py-0.5">{t('k125eRestoreFlowVerify')}</span>
          <span className="text-muted self-center">→</span>
          <span className="rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5">{t('k125eRestoreFlowRestore')}</span>
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

          {fullPreview?.impact ? (
            <ImpactSummary impact={fullPreview.impact} t={t} />
          ) : null}

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

          {pipelineOptions && onPipelineOptionsChange ? (
            <fieldset className="flex flex-col gap-2 border border-border rounded-xl p-3">
              <legend className="text-xs font-bold text-muted mb-1 px-1">{t('vaultRestoreOptionsTitle')}</legend>
              {hasExtensions ? (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pipelineOptions.restoreExtensions}
                    onChange={e => onPipelineOptionsChange({ restoreExtensions: e.target.checked })}
                    className="accent-primary"
                  />
                  <span>{t('vaultRestoreOptionExtensions')}</span>
                </label>
              ) : null}
              {hasCloud ? (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pipelineOptions.restoreCloud}
                    onChange={e => onPipelineOptionsChange({ restoreCloud: e.target.checked })}
                    className="accent-primary"
                  />
                  <span>{t('vaultRestoreOptionCloud')}</span>
                </label>
              ) : null}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={pipelineOptions.backupBeforeRestore}
                  onChange={e => onPipelineOptionsChange({ backupBeforeRestore: e.target.checked })}
                  className="accent-primary"
                />
                <span>{t('vaultRestoreOptionBackup')}</span>
              </label>
            </fieldset>
          ) : null}
        </div>

        <label className="flex items-start gap-2 text-xs cursor-pointer shrink-0" data-k125e-restore-ack>
          <input
            type="checkbox"
            checked={restoreAcknowledged}
            onChange={e => setRestoreAcknowledged(e.target.checked)}
            className="accent-primary mt-0.5 shrink-0"
          />
          <span>{t('k125eRestoreAcknowledge')}</span>
        </label>

        <div className="flex gap-2 pt-1 shrink-0">
          <button type="button" onClick={onCancel} disabled={importing} className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-surface-alt disabled:opacity-50">
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={importing || !canConfirm || !restoreAcknowledged}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-amber-600 text-white disabled:opacity-50"
            data-k125e-restore-confirm
          >
            {importing ? t('vaultRestoreImporting') : (restoreSource === 'snapshot' ? t('k125eRestoreConfirm') : t('vaultRestoreConfirm'))}
          </button>
        </div>
      </div>
    </div>
  );
}
