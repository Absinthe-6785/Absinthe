import { useCallback } from 'react';
import type { AppSettings, Theme } from '../../../../types';
import type { ArchiveHomeProjection } from '../knowledge/archive';
import { openNote, switchToNotesTab } from '../../../../lib/noteNavigation';
import {
  openArchiveBrowseDestination,
  openArchiveMarkMonthNavigation,
  openTraceDayNavigation,
  openTraceDiscoveryNavigation,
  openTraceRangeNavigation,
} from '../../../../lib/traceNavigation';
import { archivePeriodRefToTraceRangeLens } from '../knowledge/archive/archivePeriodRefBridge';
import { resolveAppLanguage, getTranslator } from '../../../../lib/i18n';
import { ArchiveAreaPills } from './home/ArchiveAreaPills';
import { ArchiveBrowseLinks } from './home/ArchiveBrowseLinks';
import { ArchiveMarkCalendar } from './home/ArchiveMarkCalendar';
import { ArchiveRecentMilestones } from './home/ArchiveRecentMilestones';
import {
  listArchivePeriodBrowseLinks,
  type ArchiveBrowseDestination,
} from './home/archiveBrowsePresentation';
import { WORKSPACE_CARD } from '../../../common/workspaceCardSizes';

export interface ArchiveUnifiedViewProps {
  projection: ArchiveHomeProjection;
  theme: Theme;
  appSettings: AppSettings;
  isLoading?: boolean;
}

/** K-71 single Archive workspace — transitions, areas, timeline, browse. */
export function ArchiveUnifiedView({
  projection,
  theme,
  appSettings,
  isLoading = false,
}: ArchiveUnifiedViewProps) {
  const t = getTranslator(resolveAppLanguage(appSettings.language));
  const headingClass = appSettings.darkMode ? 'text-white' : 'text-gray-900';

  const onMilestoneClick = useCallback(
    (entry: { noteId: string }) => openNote(entry.noteId, {
      returnTab: 'analytics',
      breadcrumb: [
        { type: 'key', key: 'archiveHomeTitle' },
        { type: 'key', key: 'archiveRecentMilestonesTitle' },
      ],
    }),
    [],
  );
  const onAreaClick = useCallback(
    (pill: { areaNoteId: string }) => openNote(pill.areaNoteId, {
      returnTab: 'analytics',
      breadcrumb: [
        { type: 'key', key: 'archiveHomeTitle' },
        { type: 'key', key: 'archiveAreaTitle' },
      ],
    }),
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
  const sectionClass = `rounded-[24px] lg:rounded-[32px] shadow-sm p-5 lg:p-6 flex flex-col transition-colors ${WORKSPACE_CARD.md} ${theme.card}`;

  return (
    <div
      className="flex flex-col gap-5 px-2 lg:px-4 py-2"
      data-archive-unified
      data-archive-home="true"
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

      <section className={sectionClass} data-archive-section="transitions">
        <h2 className="font-heading text-base font-bold mb-3">{t('archiveRecentMilestonesTitle')}</h2>
        <ArchiveMarkCalendar
          markCalendar={projection.markCalendar}
          endDate={projection.youAreHere.today}
          theme={theme}
          appSettings={appSettings}
          onDayClick={onMarkDayClick}
          onMonthClick={onMarkMonthClick}
        />
        <div className="mt-4">
          <ArchiveRecentMilestones
            milestones={projection.recentMilestones}
            theme={theme}
            appSettings={appSettings}
            onMilestoneClick={onMilestoneClick}
          />
        </div>
      </section>

      <section className={sectionClass} data-archive-section="areas">
        <h2 className="font-heading text-base font-bold mb-3">{t('archiveAreaTitle')}</h2>
        <ArchiveAreaPills
          areaPills={projection.areaPills}
          theme={theme}
          appSettings={appSettings}
          onAreaClick={onAreaClick}
        />
        <button
          type="button"
          className="mt-3 text-sm font-semibold text-primary hover:underline self-start"
          onClick={() => openTraceDiscoveryNavigation()}
        >
          {t('archiveOpenDiscovery')}
        </button>
      </section>

      <section className={sectionClass} data-archive-section="timeline">
        <h2 className="font-heading text-base font-bold mb-3">{t('archiveViewTimeline')}</h2>
        <button
          type="button"
          className="text-sm font-semibold text-primary hover:underline self-start mb-3"
          onClick={openTimelineRange}
        >
          {t('archiveOpenTimelineRange')}
        </button>
        <button
          type="button"
          className="text-sm font-semibold text-primary hover:underline self-start"
          onClick={openCurrentPeriod}
        >
          {t('archiveOpenCurrentPeriod')}
        </button>
      </section>

      <section className={sectionClass} data-archive-section="browse">
        <h2 className="font-heading text-base font-bold mb-3">{t('archiveBrowseTitle')}</h2>
        {periodLinks.length > 0 && (
          <ul className="flex flex-col gap-1.5 mb-4">
            {periodLinks.map(link => (
              <li key={link.id}>
                <button
                  type="button"
                  className={`w-full text-left rounded-xl px-2 py-2 flex items-center gap-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                    appSettings.darkMode
                      ? 'hover:bg-white/5 text-white'
                      : 'hover:bg-black/[0.03] text-gray-900'
                  }`}
                  onClick={() => onBrowseClick(link.destination)}
                >
                  <span className={`text-xs ${theme.textMuted}`} aria-hidden="true">→</span>
                  {link.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        <ArchiveBrowseLinks
          browse={projection.browse}
          theme={theme}
          appSettings={appSettings}
          onBrowseClick={onBrowseClick}
        />
      </section>

      {projection.empty.isEmpty && !isLoading && (
        <div className="flex flex-col items-start gap-3" data-archive-empty-message>
          <p className={`text-sm ${theme.textMuted}`}>{t('archiveHomeEmptyHint')}</p>
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
