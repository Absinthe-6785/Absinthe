import type { AppSettings, Theme } from '../../../../types';
import { resolveAppLanguage, getTranslator } from '../../../../lib/i18n';
import {
  ARCHIVE_VIEW_MODES,
  type ArchiveViewMode,
} from './archiveNavigationModels';

export interface ArchiveModeSwitcherProps {
  mode: ArchiveViewMode;
  onModeChange: (mode: ArchiveViewMode) => void;
  theme: Theme;
  appSettings: AppSettings;
}

function modeLabelKey(mode: ArchiveViewMode): 'archiveViewHome' | 'archiveViewPeriod' | 'archiveViewArea' | 'archiveViewTimeline' {
  switch (mode) {
    case 'home': return 'archiveViewHome';
    case 'period': return 'archiveViewPeriod';
    case 'area': return 'archiveViewArea';
    case 'timeline': return 'archiveViewTimeline';
  }
}

export function ArchiveModeSwitcher({
  mode,
  onModeChange,
  theme,
  appSettings,
}: ArchiveModeSwitcherProps) {
  const t = getTranslator(resolveAppLanguage(appSettings.language));
  const darkMode = appSettings.darkMode;

  return (
    <div
      className="flex gap-1.5 shrink-0 p-1 rounded-2xl bg-surface mb-4 mx-2 lg:mx-4"
      data-archive-mode-switcher
      role="tablist"
      aria-label={t('archiveViewHome')}
    >
      {ARCHIVE_VIEW_MODES.map(viewMode => {
        const selected = mode === viewMode;
        return (
          <button
            key={viewMode}
            type="button"
            role="tab"
            aria-selected={selected}
            data-archive-mode-option={viewMode}
            className={`flex-1 py-2 px-2 min-h-[40px] rounded-xl text-[11px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
              selected
                ? 'bg-primary text-primary-foreground'
                : darkMode
                  ? 'bg-surface-alt text-muted hover:bg-white/5'
                  : 'bg-surface-alt text-muted hover:bg-black/[0.03]'
            }`}
            onClick={() => onModeChange(viewMode)}
          >
            {t(modeLabelKey(viewMode))}
          </button>
        );
      })}
    </div>
  );
}
