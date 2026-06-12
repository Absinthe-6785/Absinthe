import { useCallback } from 'react';
import type { AppSettings, Theme } from '../../../../../types';
import type { ArchiveHomeProjection } from '../../knowledge/archive';
import { useNotesStore } from '../../../../../store/useNotesStore';
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
  const setActiveNoteId = useNotesStore(s => s.setActiveNoteId);
  const onMilestoneClick = useCallback(
    (entry: { noteId: string }) => setActiveNoteId(entry.noteId),
    [setActiveNoteId],
  );
  const onAreaClick = useCallback(
    (pill: { areaNoteId: string }) => setActiveNoteId(pill.areaNoteId),
    [setActiveNoteId],
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
      />

      {projection.empty.isEmpty && !isLoading && (
        <p className={`text-sm ${theme.textMuted}`} data-archive-empty-message>
          Marks will accumulate here over time.
        </p>
      )}
    </div>
  );
}
