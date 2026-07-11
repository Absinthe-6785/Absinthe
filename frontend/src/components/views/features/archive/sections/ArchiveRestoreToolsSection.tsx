import { RotateCcw, Shield, Upload } from 'lucide-react';
import { useState } from 'react';
import type { AppSettings, Theme } from '../../../../../types';
import { resolveAppLanguage, getTranslator } from '../../../../../lib/i18n';
import type { ArchiveRestoreToolsProjection } from '../../knowledge/archive';
import { ArchiveCollapsibleSection } from './ArchiveCollapsibleSection';
import { switchToTab } from '../../../../../lib/noteNavigation';
import { useNotesStore } from '../../../../../store/useNotesStore';
import { RECOVERY_MODE_MESSAGE } from '../../../../../lib/recoverySafetyPolicy';

export interface ArchiveRestoreToolsSectionProps {
  restoreTools: ArchiveRestoreToolsProjection;
  theme: Theme;
  appSettings: AppSettings;
  collapsed: boolean;
  onToggle: () => void;
  onImportBackup: () => void;
}

export function ArchiveRestoreToolsSection({
  restoreTools,
  theme,
  appSettings,
  collapsed,
  onToggle,
  onImportBackup,
}: ArchiveRestoreToolsSectionProps) {
  const t = getTranslator(resolveAppLanguage(appSettings.language));
  const undoRestore = useNotesStore(s => s.undoLastVaultRestore);
  const canUndo = useNotesStore(s => s.vaultRestoreCanUndo);
  const [undoBlockedMessage, setUndoBlockedMessage] = useState<string | null>(null);

  const handleUndoRestore = () => {
    const restored = undoRestore();
    setUndoBlockedMessage(restored ? null : RECOVERY_MODE_MESSAGE);
  };

  const protectionLabel = {
    protected: t('recoveryProtectionProtected'),
    partial: t('recoveryProtectionPartial'),
    none: t('recoveryProtectionNone'),
  }[restoreTools.protectionStatus];

  return (
    <ArchiveCollapsibleSection
      sectionId="restore-tools"
      title={t('k109SectionRestoreTools')}
      collapsed={collapsed}
      onToggle={onToggle}
      theme={theme}
      dark={appSettings.darkMode}
      tone="utility"
    >
      <div className="space-y-2.5" data-k109-restore-tools>
        <div className={`flex items-center gap-2 text-xs p-2.5 rounded-xl border ${theme.border} ${theme.input}`}>
          <Shield size={14} className="text-primary shrink-0" />
          <span className="font-semibold">{protectionLabel}</span>
        </div>
        <p className={`text-[10px] ${theme.textMuted}`}>
          {t('k109RestoreSnapshotCount').replace('{count}', String(restoreTools.snapshotCount))}
        </p>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <button
            type="button"
            onClick={onImportBackup}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] lg:min-h-[34px] px-3 rounded-xl text-xs font-bold bg-primary text-primary-foreground"
            data-k109-restore-import
          >
            <Upload size={14} />
            {t('vaultRestoreImport')}
          </button>
          {canUndo && (
            <button
              type="button"
              onClick={handleUndoRestore}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] lg:min-h-[34px] px-3 rounded-xl text-xs font-bold border"
              data-k109-restore-undo
            >
              <RotateCcw size={14} />
              {t('k109UndoRestore')}
            </button>
          )}
          <button
            type="button"
            onClick={() => switchToTab('settings')}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] lg:min-h-[34px] px-3 rounded-xl text-xs font-semibold text-primary hover:underline"
            data-k109-open-recovery-center
          >
            {t('recoveryCenterTitle')}
          </button>
        </div>
        {undoBlockedMessage && (
          <p role="alert" className="text-xs font-semibold text-amber-600" data-k319-undo-restore-blocked>
            {undoBlockedMessage}
          </p>
        )}
      </div>
    </ArchiveCollapsibleSection>
  );
}
