import { useCallback } from 'react';
import type { AppSettings, Theme } from '../../../../types';
import type { ArchiveProjection } from '../knowledge/archive';
import { resolveAppLanguage, getTranslator } from '../../../../lib/i18n';
import { openNote, switchToNotesTab } from '../../../../lib/noteNavigation';
import {
  openArchiveBrowseDestination,
  openTraceDiscoveryNavigation,
} from '../../../../lib/traceNavigation';
import { archivePeriodRefFromDateKey } from '../knowledge/archive/archivePeriodRefHelpers';
import { archivePeriodRefToTraceRangeLens } from '../knowledge/archive/archivePeriodRefBridge';
import { ArchiveAreaPills } from './home/ArchiveAreaPills';
import { ArchiveBrowseLinks } from './home/ArchiveBrowseLinks';
import { ArchiveMarkCalendar } from './home/ArchiveMarkCalendar';
import { ArchiveRecentMilestones } from './home/ArchiveRecentMilestones';
import {
  listArchivePeriodBrowseLinks,
  type ArchiveBrowseDestination,
} from './home/archiveBrowsePresentation';
import { WorkspaceLayout } from '../../../common/workspaceLayout';
import { useArchiveSectionPrefs } from './hooks/useArchiveSectionPrefs';
import { ArchiveHistorySection } from './sections/ArchiveHistorySection';
import { ArchiveDeletedSection } from './sections/ArchiveDeletedSection';
import { ArchiveSnapshotsSection } from './sections/ArchiveSnapshotsSection';
import { ArchiveTimelineSection } from './sections/ArchiveTimelineSection';
import { ArchiveRestoreToolsSection } from './sections/ArchiveRestoreToolsSection';

export interface ArchiveUnifiedViewProps {
  projection: ArchiveProjection;
  theme: Theme;
  appSettings: AppSettings;
  isLoading?: boolean;
  onRestoreSnapshot: (snapshotId: string) => void;
  onImportBackup: () => void;
}

/** K-109 Archive workspace — history → deleted → snapshots → timeline → restore. */
export function ArchiveUnifiedView({
  projection,
  theme,
  appSettings,
  isLoading = false,
  onRestoreSnapshot,
  onImportBackup,
}: ArchiveUnifiedViewProps) {
  const t = getTranslator(resolveAppLanguage(appSettings.language));
  const headingClass = appSettings.darkMode ? 'text-white' : 'text-gray-900';
  const { prefs, toggle } = useArchiveSectionPrefs();
  const home = projection.home;

  const onMilestoneClick = useCallback(
    (entry: { noteId: string }) => openNote(entry.noteId, {
      returnTab: 'analytics',
      breadcrumb: [
        { type: 'key', key: 'archiveHomeTitle' },
        { type: 'key', key: 'k109SectionTimeline' },
      ],
    }),
    [],
  );

  const onBrowseClick = useCallback(
    (destination: ArchiveBrowseDestination) => openArchiveBrowseDestination(destination),
    [],
  );

  const openCurrentPeriod = useCallback(() => {
    const lens = archivePeriodRefToTraceRangeLens(home.youAreHere.openPeriod);
    if (lens) openArchiveBrowseDestination({ type: 'period', ref: home.youAreHere.openPeriod });
    else switchToNotesTab();
  }, [home.youAreHere.openPeriod]);

  const periodLinks = listArchivePeriodBrowseLinks(home.browse);

  return (
    <WorkspaceLayout
      workspace="archive"
      header={(
        <header className="flex flex-col gap-0.5 px-0.5" data-k109-archive-header>
          <h1 className={`font-heading text-xl lg:text-2xl font-bold ${headingClass}`}>
            {t('archiveHomeTitle')}
          </h1>
          <p className={`text-xs lg:text-sm font-medium ${theme.textMuted}`}>
            {t('k109ArchiveSubtitle')}
          </p>
        </header>
      )}
      primary={(
        <div
          className="flex flex-col gap-3 lg:gap-4 max-w-3xl"
          data-archive-unified
          data-k109-archive-unified
          data-archive-empty={projection.empty.isEmpty ? 'true' : 'false'}
        >
          <ArchiveHistorySection
            history={projection.historyItems}
            theme={theme}
            appSettings={appSettings}
            collapsed={prefs.historyCollapsed}
            onToggle={() => toggle('historyCollapsed')}
          />

          <ArchiveDeletedSection
            deleted={projection.deletedItems}
            theme={theme}
            appSettings={appSettings}
            collapsed={prefs.deletedCollapsed}
            onToggle={() => toggle('deletedCollapsed')}
          />

          <ArchiveSnapshotsSection
            snapshots={projection.snapshotItems}
            theme={theme}
            appSettings={appSettings}
            collapsed={prefs.snapshotsCollapsed}
            onToggle={() => toggle('snapshotsCollapsed')}
            onRestoreSnapshot={onRestoreSnapshot}
          />

          <ArchiveTimelineSection
            timeline={projection.timelineItems}
            defaultPeriod={home.browse.timeline.defaultPeriod}
            markCalendar={home.markCalendar}
            recentMilestones={home.recentMilestones}
            youAreHere={home.youAreHere}
            theme={theme}
            appSettings={appSettings}
            collapsed={prefs.timelineCollapsed}
            onToggle={() => toggle('timelineCollapsed')}
            onMilestoneClick={onMilestoneClick}
            onMarkDayClick={(dateKey) => openArchiveBrowseDestination({
              type: 'period',
              ref: archivePeriodRefFromDateKey(dateKey),
            })}
          />

          <ArchiveRestoreToolsSection
            restoreTools={projection.restoreTools}
            theme={theme}
            appSettings={appSettings}
            collapsed={prefs.restoreToolsCollapsed}
            onToggle={() => toggle('restoreToolsCollapsed')}
            onImportBackup={onImportBackup}
          />

          {projection.empty.isEmpty && !isLoading && (
            <p className={`text-xs ${theme.textMuted}`} data-k109-archive-empty>
              {t('k109ArchiveAllEmpty')}
            </p>
          )}
        </div>
      )}
      supporting={(
        <div className="flex flex-col gap-3 mt-2 max-w-3xl" data-k109-archive-supporting>
          {!home.empty.noAreas && (
            <div className={`rounded-[20px] p-4 ${theme.card}`} data-archive-section="areas">
              <h2 className="font-heading text-sm font-bold mb-2">{t('archiveAreaTitle')}</h2>
              <ArchiveAreaPills
                areaPills={home.areaPills}
                theme={theme}
                appSettings={appSettings}
                onAreaClick={pill => openNote(pill.areaNoteId, { returnTab: 'analytics' })}
              />
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-primary hover:underline"
                onClick={() => openTraceDiscoveryNavigation()}
              >
                {t('archiveOpenDiscovery')}
              </button>
            </div>
          )}
          <div className={`rounded-[20px] p-4 ${theme.card}`} data-archive-section="browse">
            <h2 className="font-heading text-sm font-bold mb-2">{t('archiveBrowseTitle')}</h2>
            {periodLinks.length > 0 && (
              <ul className="flex flex-wrap gap-2 mb-2">
                {periodLinks.map(link => (
                  <li key={link.id}>
                    <button
                      type="button"
                      className={`text-xs font-semibold px-2 py-1 rounded-lg min-h-[44px] lg:min-h-0 ${theme.hoverBg}`}
                      onClick={() => onBrowseClick(link.destination)}
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <ArchiveBrowseLinks
              browse={home.browse}
              theme={theme}
              appSettings={appSettings}
              onBrowseClick={onBrowseClick}
            />
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-primary hover:underline min-h-[44px]"
              onClick={openCurrentPeriod}
            >
              {t('archiveOpenCurrentPeriod')}
            </button>
          </div>
        </div>
      )}
    />
  );
}
