import { useCallback } from 'react';
import type { AppSettings, Theme } from '../../../../../types';
import type { ArchiveHomeProjection } from '../../knowledge/archive';
import { openNote, switchToNotesTab } from '../../../../../lib/noteNavigation';
import {
  openArchiveBrowseDestination,
  openArchiveMarkMonthNavigation,
  openTraceDayNavigation,
} from '../../../../../lib/traceNavigation';
import { resolveAppLanguage, getTranslator } from '../../../../../lib/i18n';
import { ArchiveAreaPills } from './ArchiveAreaPills';
import { ArchiveBrowseLinks } from './ArchiveBrowseLinks';
import { ArchiveMarkCalendar } from './ArchiveMarkCalendar';
import { ArchiveRecentMilestones } from './ArchiveRecentMilestones';

export interface ArchiveHomeViewProps {
  projection: ArchiveHomeProjection;
  theme: Theme;
  appSettings: AppSettings;
  isLoading?: boolean;
}

/**
 * Archive Home — frame, calendar, milestones, areas, and browse wayfinding.
 */
export function ArchiveHomeView({
  projection,
  theme,
  appSettings,
  isLoading = false,
}: ArchiveHomeViewProps) {
  const t = getTranslator(resolveAppLanguage(appSettings.language));
  const onMilestoneClick = useCallback(
    (entry: { noteId: string }) => openNote(entry.noteId),
    [],
  );
  const onAreaClick = useCallback(
    (pill: { areaNoteId: string }) => openNote(pill.areaNoteId),
    [],
  );
  const onMarkDayClick = useCallback(
    (dateKey: string) => openTraceDayNavigation(dateKey),
    [],
  );
  const onMarkMonthClick = useCallback(
    (year: number, month: number) => openArchiveMarkMonthNavigation(year, month),
    [],
  );
  const onBrowseClick = useCallback(
    (destination: Parameters<typeof openArchiveBrowseDestination>[0]) => {
      openArchiveBrowseDestination(destination);
    },
    [],
  );
  const headingClass = appSettings.darkMode ? 'text-white' : 'text-gray-900';

  return (
    <div
      className="flex flex-col gap-6 px-2 lg:px-4 py-2"
      data-archive-home
      data-archive-home-complete="true"
      data-archive-empty={projection.empty.isEmpty ? 'true' : 'false'}
    >
      <header className="flex flex-col gap-1">
        <h1 className={`font-heading text-2xl lg:text-3xl font-bold ${headingClass}`}>
          {t('archiveHomeTitle')}
        </h1>
        <p className={`text-sm lg:text-base font-medium ${theme.textMuted}`}>
          {t('archiveHomeSubtitle')}
        </p>
      </header>

      <ArchiveMarkCalendar
        markCalendar={projection.markCalendar}
        endDate={projection.youAreHere.today}
        theme={theme}
        appSettings={appSettings}
        onDayClick={onMarkDayClick}
        onMonthClick={onMarkMonthClick}
      />

      <ArchiveRecentMilestones
        milestones={projection.recentMilestones}
        theme={theme}
        appSettings={appSettings}
        onMilestoneClick={onMilestoneClick}
      />

      <ArchiveAreaPills
        areaPills={projection.areaPills}
        theme={theme}
        appSettings={appSettings}
        onAreaClick={onAreaClick}
      />

      <ArchiveBrowseLinks
        browse={projection.browse}
        theme={theme}
        appSettings={appSettings}
        onBrowseClick={onBrowseClick}
      />

      {projection.empty.isEmpty && !isLoading && (
        <div className="flex flex-col items-start gap-3" data-archive-empty-message>
          <p className={`text-sm ${theme.textMuted}`}>
            {t('archiveHomeEmptyHint')}
          </p>
          <button
            type="button"
            className="text-sm font-semibold text-primary hover:underline"
            onClick={() => switchToNotesTab()}
          >
            {t('archiveEmptyCta')}
          </button>
        </div>
      )}
    </div>
  );
}
