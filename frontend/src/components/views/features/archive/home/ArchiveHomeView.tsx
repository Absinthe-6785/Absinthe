import type { AppSettings, Theme } from '../../../../../types';
import type { ArchiveHomeProjection } from '../../knowledge/archive';
import { ArchiveMarkCalendar } from './ArchiveMarkCalendar';
import { ArchiveRecentMilestones } from './ArchiveRecentMilestones';

export interface ArchiveHomeViewProps {
  projection: ArchiveHomeProjection;
  theme: Theme;
  appSettings: AppSettings;
  isLoading?: boolean;
}

/**
 * Archive Home — frame, mark calendar, recent milestones, and placeholders for upcoming sections.
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

      <ArchiveMarkCalendar
        markCalendar={projection.markCalendar}
        endDate={projection.youAreHere.today}
        theme={theme}
        appSettings={appSettings}
      />

      <ArchiveRecentMilestones
        milestones={projection.recentMilestones}
        theme={theme}
        appSettings={appSettings}
      />

      {projection.empty.isEmpty && !isLoading && (
        <p className={`text-sm ${theme.textMuted}`} data-archive-empty-message>
          Marks will accumulate here over time.
        </p>
      )}

      <section
        className={`rounded-[24px] shadow-sm p-6 ${theme.card}`}
        data-archive-home-shell
        aria-label="Upcoming Archive Home sections"
      >
        <p className={`text-sm font-medium ${theme.textMuted}`}>
          Areas and browse paths arrive in upcoming milestones.
        </p>
      </section>
    </div>
  );
}
