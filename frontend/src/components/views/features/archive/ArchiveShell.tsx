import { useMemo } from 'react';
import type { DateTime } from 'luxon';
import type { AppSettings, Theme } from '../../../../types';
import { ArchiveUnifiedView } from './ArchiveUnifiedView';
import { useArchiveHomeProjection } from './hooks/useArchiveHomeProjection';

export interface ArchiveShellProps {
  now: DateTime;
  appSettings: AppSettings;
  theme: Theme;
}

/** K-71 Archive — single scrollable workspace (no tabs). */
export function ArchiveShell({
  now,
  appSettings,
  theme,
}: ArchiveShellProps) {
  const nowDate = useMemo(() => now.toJSDate(), [now]);
  const { projection, isLoading } = useArchiveHomeProjection(nowDate, appSettings.language);

  return (
    <div
      className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden py-1 pr-1 animate-in fade-in duration-300"
      data-archive-shell
      data-archive-mode="unified"
    >
      <ArchiveUnifiedView
        projection={projection}
        theme={theme}
        appSettings={appSettings}
        isLoading={isLoading}
      />
    </div>
  );
}
