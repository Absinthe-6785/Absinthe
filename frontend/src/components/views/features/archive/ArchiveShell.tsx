import { useMemo, useState } from 'react';
import type { DateTime } from 'luxon';
import type { AppSettings, Theme } from '../../../../types';
import { ArchiveBranchView } from './ArchiveBranchView';
import { ArchiveModeSwitcher } from './ArchiveModeSwitcher';
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
 * K-30.11+: Home shell with in-app mode tabs for Period · Area · Timeline.
 */
export function ArchiveShell({
  now,
  appSettings,
  theme,
  initialMode = DEFAULT_ARCHIVE_VIEW_MODE,
}: ArchiveShellProps) {
  const [mode, setMode] = useState<ArchiveViewMode>(initialMode);
  const nowDate = useMemo(() => now.toJSDate(), [now]);
  const { projection, isLoading } = useArchiveHomeProjection(nowDate, appSettings.language);

  return (
    <div
      className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden py-1 pr-1 animate-in fade-in duration-300"
      data-archive-shell
      data-archive-mode={mode}
    >
      <ArchiveModeSwitcher
        mode={mode}
        onModeChange={setMode}
        theme={theme}
        appSettings={appSettings}
      />
      {mode === 'home' && (
        <ArchiveHomeView
          projection={projection}
          theme={theme}
          appSettings={appSettings}
          isLoading={isLoading}
        />
      )}
      {mode === 'period' && (
        <ArchiveBranchView
          mode="period"
          projection={projection}
          theme={theme}
          appSettings={appSettings}
          isLoading={isLoading}
        />
      )}
      {mode === 'area' && (
        <ArchiveBranchView
          mode="area"
          projection={projection}
          theme={theme}
          appSettings={appSettings}
          isLoading={isLoading}
        />
      )}
      {mode === 'timeline' && (
        <ArchiveBranchView
          mode="timeline"
          projection={projection}
          theme={theme}
          appSettings={appSettings}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
