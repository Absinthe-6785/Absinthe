import type { AnalyticsProps } from '../../types';
import { ARCHIVE_SHELL_ENABLED, ArchiveShell } from './features/archive';
import { LegacyAnalyticsView } from './LegacyAnalyticsView';

/**
 * Analytics tab entry — Archive Home by default (K-30.16).
 * Legacy operational widgets mount only when ARCHIVE_SHELL_ENABLED is false (K-30.19).
 */
export const AnalyticsView = (props: AnalyticsProps) => {
  if (ARCHIVE_SHELL_ENABLED) {
    return (
      <ArchiveShell
        now={props.now}
        appSettings={props.appSettings}
        theme={props.theme}
        showToast={props.showToast}
      />
    );
  }

  return <LegacyAnalyticsView {...props} />;
};
