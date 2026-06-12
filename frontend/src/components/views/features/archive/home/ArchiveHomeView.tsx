import type { AppSettings, Theme } from '../../../../../types';
import type { ArchiveHomeProjection } from '../../knowledge/archive';

export interface ArchiveHomeViewProps {
  projection: ArchiveHomeProjection;
  theme: Theme;
  appSettings: AppSettings;
  isLoading?: boolean;
}

/**
 * Archive Home shell — section slots reserved for K-30.12+.
 * Renders frame + empty hints only; no mark calendar or navigation widgets yet.
 */
export function ArchiveHomeView({
  projection,
  theme,
  appSettings,
  isLoading = false,
}: ArchiveHomeViewProps) {
  const headingClass = appSettings.darkMode ? 'text-white' : 'text-gray-900';

  return (
    <div
      className="flex flex-col gap-6 px-2 lg:px-4 py-2"
      data-archive-home
      data-archive-empty={projection.empty.isEmpty ? 'true' : 'false'}
    >
      <header className="flex flex-col gap-1">
        <h1 className={`font-heading text-2xl lg:text-3xl font-bold ${headingClass}`}>
          {projection.frame.title}
        </h1>
        <p className={`text-sm lg:text-base font-medium ${theme.textMuted}`}>
          {projection.frame.subtitle}
        </p>
      </header>

      {projection.empty.isEmpty && !isLoading && (
        <p className={`text-sm ${theme.textMuted}`} data-archive-empty-message>
          Marks will accumulate here over time.
        </p>
      )}

      <section
        className={`rounded-[24px] shadow-sm p-6 ${theme.card}`}
        data-archive-home-shell
        aria-label="Archive Home sections"
      >
        <p className={`text-sm font-medium ${theme.textMuted}`}>
          Archive Home is under construction.
        </p>
        <p className={`text-xs mt-2 ${theme.textMuted}`}>
          Mark calendar, milestones, and browse paths arrive in upcoming milestones.
        </p>
      </section>
    </div>
  );
}
