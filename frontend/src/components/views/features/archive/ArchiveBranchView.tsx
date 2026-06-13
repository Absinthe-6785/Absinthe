import { useCallback } from 'react';
import type { AppSettings, Theme } from '../../../../types';
import { resolveAppLanguage, getTranslator } from '../../../../lib/i18n';
import { openNote, switchToNotesTab } from '../../../../lib/noteNavigation';
import {
  openArchiveBrowseDestination,
  openArchiveMarkMonthNavigation,
  openTraceDayNavigation,
  openTraceDiscoveryNavigation,
  openTraceRangeNavigation,
} from '../../../../lib/traceNavigation';
import { archivePeriodRefToTraceRangeLens } from '../knowledge/archive/archivePeriodRefBridge';
import type { ArchiveHomeProjection } from '../knowledge/archive';
import { type ArchiveViewMode } from './archiveNavigationModels';
import { ArchiveAreaPills } from './home/ArchiveAreaPills';
import { ArchiveMarkCalendar } from './home/ArchiveMarkCalendar';
import { ArchiveRecentMilestones } from './home/ArchiveRecentMilestones';
import {
  listArchivePeriodBrowseLinks,
  type ArchiveBrowseDestination,
} from './home/archiveBrowsePresentation';

export interface ArchiveBranchViewProps {
  mode: Exclude<ArchiveViewMode, 'home'>;
  projection: ArchiveHomeProjection;
  theme: Theme;
  appSettings: AppSettings;
  isLoading?: boolean;
}

function archiveViewKey(
  mode: Exclude<ArchiveViewMode, 'home'>,
): 'archiveViewPeriod' | 'archiveViewArea' | 'archiveViewTimeline' {
  switch (mode) {
    case 'period': return 'archiveViewPeriod';
    case 'area': return 'archiveViewArea';
    case 'timeline': return 'archiveViewTimeline';
  }
}

export function ArchiveBranchView({
  mode,
  projection,
  theme,
  appSettings,
  isLoading = false,
}: ArchiveBranchViewProps) {
  const t = getTranslator(resolveAppLanguage(appSettings.language));
  const viewLabel = t(archiveViewKey(mode));
  const headingClass = appSettings.darkMode ? 'text-white' : 'text-gray-900';

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
    (destination: ArchiveBrowseDestination) => openArchiveBrowseDestination(destination),
    [],
  );

  const openCurrentPeriod = useCallback(() => {
    const lens = archivePeriodRefToTraceRangeLens(projection.youAreHere.openPeriod);
    if (lens) openTraceRangeNavigation(lens);
    else switchToNotesTab();
  }, [projection.youAreHere.openPeriod]);

  const openTimelineRange = useCallback(() => {
    openArchiveBrowseDestination({
      type: 'timeline',
      defaultPeriod: projection.browse.timeline.defaultPeriod,
    });
  }, [projection.browse.timeline.defaultPeriod]);

  const periodLinks = listArchivePeriodBrowseLinks(projection.browse);

  return (
    <div
      className="flex flex-col gap-6 px-2 lg:px-4 py-2"
      data-archive-branch={mode}
      data-archive-placeholder={mode}
      data-archive-branch-loading={isLoading ? 'true' : 'false'}
    >
      <header className="flex flex-col gap-2">
        <h1 className={`font-heading text-2xl lg:text-3xl font-bold ${headingClass}`}>
          {viewLabel}
        </h1>
        <p className={`text-sm ${theme.textMuted}`}>
          {mode === 'period' && t('archiveBranchPeriodHint')}
          {mode === 'area' && t('archiveBranchAreaHint')}
          {mode === 'timeline' && t('archiveBranchTimelineHint')}
        </p>
      </header>

      {mode === 'period' && (
        <>
          <section
            className={`rounded-[24px] lg:rounded-[32px] shadow-sm p-5 lg:p-6 flex flex-col transition-colors ${theme.card}`}
            data-archive-branch-period-links
          >
            <h2 className="font-heading text-base font-bold mb-3">탐색</h2>
            {periodLinks.length === 0 ? (
              <p className={`text-sm ${theme.textMuted}`}>{t('archiveBrowseEmptyHint')}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {periodLinks.map(link => (
                  <li key={link.id}>
                    <button
                      type="button"
                      className={`w-full text-left rounded-xl px-2 py-2 flex items-center gap-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                        appSettings.darkMode
                          ? 'hover:bg-white/5 text-white'
                          : 'hover:bg-black/[0.03] text-gray-900'
                      }`}
                      data-archive-branch-period-link={link.id}
                      onClick={() => onBrowseClick(link.destination)}
                    >
                      <span className={`text-xs ${theme.textMuted}`} aria-hidden="true">→</span>
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="mt-4 text-sm font-semibold text-primary hover:underline self-start"
              data-archive-branch-open-current-period
              onClick={openCurrentPeriod}
            >
              {t('archiveOpenCurrentPeriod')}
            </button>
          </section>

          <ArchiveMarkCalendar
            markCalendar={projection.markCalendar}
            endDate={projection.youAreHere.today}
            theme={theme}
            appSettings={appSettings}
            onDayClick={onMarkDayClick}
            onMonthClick={onMarkMonthClick}
          />
        </>
      )}

      {mode === 'area' && (
        <>
          <ArchiveAreaPills
            areaPills={projection.areaPills}
            theme={theme}
            appSettings={appSettings}
            onAreaClick={onAreaClick}
          />
          <button
            type="button"
            className="text-sm font-semibold text-primary hover:underline self-start"
            data-archive-branch-open-discovery
            onClick={() => openTraceDiscoveryNavigation()}
          >
            {t('archiveOpenDiscovery')}
          </button>
        </>
      )}

      {mode === 'timeline' && (
        <>
          <ArchiveRecentMilestones
            milestones={projection.recentMilestones}
            theme={theme}
            appSettings={appSettings}
            onMilestoneClick={onMilestoneClick}
          />
          <ArchiveMarkCalendar
            markCalendar={projection.markCalendar}
            endDate={projection.youAreHere.today}
            theme={theme}
            appSettings={appSettings}
            onDayClick={onMarkDayClick}
            onMonthClick={onMarkMonthClick}
          />
          <button
            type="button"
            className="text-sm font-semibold text-primary hover:underline self-start"
            data-archive-branch-open-timeline-range
            onClick={openTimelineRange}
          >
            {t('archiveOpenTimelineRange')}
          </button>
        </>
      )}

      {projection.empty.isEmpty && !isLoading && (
        <button
          type="button"
          className="text-sm font-semibold text-primary hover:underline self-start"
          onClick={() => switchToNotesTab()}
        >
          {t('archiveEmptyCta')}
        </button>
      )}
    </div>
  );
}
