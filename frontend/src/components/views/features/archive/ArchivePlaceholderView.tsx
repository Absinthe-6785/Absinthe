import type { AppSettings, Theme } from '../../../../types';
import { resolveAppLanguage, getTranslator } from '../../../../lib/i18n';
import { type ArchiveViewMode } from './archiveNavigationModels';

export interface ArchivePlaceholderViewProps {
  mode: Exclude<ArchiveViewMode, 'home'>;
  theme: Theme;
  appSettings: AppSettings;
}

function archiveViewKey(mode: Exclude<ArchiveViewMode, 'home'>): 'archiveViewPeriod' | 'archiveViewArea' | 'archiveViewTimeline' {
  switch (mode) {
    case 'period': return 'archiveViewPeriod';
    case 'area': return 'archiveViewArea';
    case 'timeline': return 'archiveViewTimeline';
  }
}

export function ArchivePlaceholderView({ mode, theme, appSettings }: ArchivePlaceholderViewProps) {
  const t = getTranslator(resolveAppLanguage(appSettings.language));
  const viewLabel = t(archiveViewKey(mode));
  return (
    <div
      className="flex flex-col gap-3 px-2 lg:px-4 py-2"
      data-archive-placeholder={mode}
    >
      <h2 className="font-heading text-xl font-bold">
        {viewLabel}
      </h2>
      <p className={`text-sm ${theme.textMuted}`}>
        {t('archiveViewUnavailable').replace('{view}', viewLabel)}
      </p>
    </div>
  );
}
