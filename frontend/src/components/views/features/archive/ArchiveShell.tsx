import { useMemo, useState } from 'react';
import type { DateTime } from 'luxon';
import type { AppSettings, Theme } from '../../../types';
import { ArchivePlaceholderView } from './ArchivePlaceholderView';
import {
  DEFAULT_ARCHIVE_VIEW_MODE,
  type ArchiveViewMode,
} from './archiveNavigationModels';
import { ArchiveHomeView } from './home/ArchiveHomeView';
import { useArchiveHomeProjection } from './hooks/useArchiveHomeProjection';

export interface ArchiveShellProps {
  now: DateTime;
  appSettings: AppSettings;
  theme: Theme;
  /** Override default mode — home only in K-30.11 unless testing branches. */
  initialMode?: ArchiveViewMode;
}

/**
 * Archive surface host — Home · Period · Area · Timeline.
 * K-30.11: Home shell only; other branches render placeholders.
 */
export function ArchiveShell({
  now,
  appSettings,
  theme,
  initialMode = DEFAULT_ARCHIVE_VIEW_MODE,
}: ArchiveShellProps) {
  const [mode] = useState<ArchiveViewMode>(initialMode);
  const nowDate = useMemo(() => now.toJSDate(), [now]);
  const { projection, isLoading } = useArchiveHomeProjection(nowDate);

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden py-1 pr-1 animate-in fade-in duration-300"
      data-archive-shell
      data-archive-mode={mode}
    >
      {mode === 'home' && (
        <ArchiveHomeView
          projection={projection}
          theme={theme}
          appSettings={appSettings}
          isLoading={isLoading}
        />
      )}
      {mode === 'period' && <ArchivePlaceholderView mode="period" theme={theme} appSettings={appSettings} />}
      {mode === 'area' && <ArchivePlaceholderView mode="area" theme={theme} appSettings={appSettings} />}
      {mode === 'timeline' && <ArchivePlaceholderView mode="timeline" theme={theme} appSettings={appSettings} />}
    </div>
  );
}
