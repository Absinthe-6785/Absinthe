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
import { WorkspaceLayout } from '../../../common/workspaceLayout';

export interface ArchiveUnifiedViewProps {
  projection: ArchiveHomeProjection;
  theme: Theme;
  appSettings: AppSettings;
  isLoading?: boolean;
}

/** K-71 single Archive workspace — K-72 dense 2×2 grid. */
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
  const sectionMd = `rounded-[20px] lg:rounded-[24px] shadow-sm p-4 lg:p-5 flex flex-col transition-colors ${WORKSPACE_CARD.md} ${theme.card}`;
  const sectionSm = `rounded-[20px] lg:rounded-[24px] shadow-sm p-3 lg:p-4 flex flex-col transition-colors ${WORKSPACE_CARD.sm} ${theme.card}`;
  const sectionTitle = 'font-heading text-sm font-bold mb-2';

  return (
    <WorkspaceLayout
      workspace="archive"
      header={(
        <header className="flex flex-col gap-0.5 px-0.5">
          <h1 className={`font-heading text-xl lg:text-2xl font-bold ${headingClass}`}>
            {t('archiveHomeTitle')}
          </h1>
          <p className={`text-xs lg:text-sm font-medium ${theme.textMuted}`}>
            {t('archiveHomeSubtitle')}
          </p>
        </header>
      )}
      primary={(
        <div
          className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4"
          data-archive-unified
          data-archive-home="true"
          data-archive-home-complete="true"
          data-archive-empty={projection.empty.isEmpty ? 'true' : 'false'}
        >
          <section className={sectionMd} data-archive-section="transitions">
            <h2 className={sectionTitle}>{t('archiveRecentMilestonesTitle')}</h2>
            <ArchiveMarkCalendar
              markCalendar={projection.markCalendar}
              endDate={projection.youAreHere.today}
              theme={theme}
              appSettings={appSettings}
              onDayClick={onMarkDayClick}
              onMonthClick={onMarkMonthClick}
            />
            <div className="mt-2">
              <ArchiveRecentMilestones
                milestones={projection.recentMilestones}
                theme={theme}
                appSettings={appSettings}
                onMilestoneClick={onMilestoneClick}
              />
            </div>
          </section>

          <section className={sectionSm} data-archive-section="areas">
            <h2 className={sectionTitle}>{t('archiveAreaTitle')}</h2>
            <ArchiveAreaPills
              areaPills={projection.areaPills}
              theme={theme}
              appSettings={appSettings}
              onAreaClick={onAreaClick}
            />
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-primary hover:underline self-start"
              onClick={() => openTraceDiscoveryNavigation()}
            >
              {t('archiveOpenDiscovery')}
            </button>
          </section>

          <section className={sectionSm} data-archive-section="timeline">
            <h2 className={sectionTitle}>{t('archiveViewTimeline')}</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <button
                type="button"
                className="text-xs font-semibold text-primary hover:underline"
                onClick={openTimelineRange}
              >
                {t('archiveOpenTimelineRange')}
              </button>
              <button
                type="button"
                className="text-xs font-semibold text-primary hover:underline"
                onClick={openCurrentPeriod}
              >
                {t('archiveOpenCurrentPeriod')}
              </button>
            </div>
          </section>

          <section className={sectionSm} data-archive-section="browse">
            <h2 className={sectionTitle}>{t('archiveBrowseTitle')}</h2>
            {periodLinks.length > 0 && (
              <ul className="flex flex-wrap gap-2 mb-2">
                {periodLinks.map(link => (
                  <li key={link.id}>
                    <button
                      type="button"
                      className={`text-xs font-semibold px-2 py-1 rounded-lg transition-colors ${
                        appSettings.darkMode
                          ? 'hover:bg-white/5 text-white'
                          : 'hover:bg-black/[0.03] text-gray-900'
                      }`}
                      onClick={() => onBrowseClick(link.destination)}
                    >
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
            <div className="lg:col-span-2 flex flex-col items-start gap-2" data-archive-empty-message>
              <p className={`text-xs ${theme.textMuted}`}>{t('archiveHomeEmptyHint')}</p>
              <button
                type="button"
                className="text-xs font-semibold text-primary hover:underline"
                onClick={() => switchToNotesTab()}
              >
                {t('archiveEmptyCta')}
              </button>
            </div>
          )}
        </div>
      )}
    />
  );
}
