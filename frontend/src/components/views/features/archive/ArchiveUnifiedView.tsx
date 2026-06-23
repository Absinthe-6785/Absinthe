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
import {
  listArchivePeriodBrowseLinks,
  type ArchiveBrowseDestination,
} from './home/archiveBrowsePresentation';
import { WorkspaceLayout } from '../../../common/workspaceLayout';
import { WorkspacePageHeader } from '../../../common/WorkspacePageHeader';
import { ProductEmptyState } from '../../../common/ProductEmptyState';
import { Archive } from 'lucide-react';
import { useArchiveSectionPrefs } from './hooks/useArchiveSectionPrefs';
import { ArchiveHistorySection } from './sections/ArchiveHistorySection';
import { ArchiveDeletedSection } from './sections/ArchiveDeletedSection';
import { ArchiveSnapshotsSection } from './sections/ArchiveSnapshotsSection';
import { ArchiveTimelineSection } from './sections/ArchiveTimelineSection';
import { ArchiveRestoreToolsSection } from './sections/ArchiveRestoreToolsSection';
import { ArchiveCollapsibleSection } from './sections/ArchiveCollapsibleSection';
import { WORKSPACE_GAP_CLASS } from '../../../../lib/uiSpacingTokens';

export interface ArchiveUnifiedViewProps {
  projection: ArchiveProjection;
  theme: Theme;
  appSettings: AppSettings;
  isLoading?: boolean;
  onRestoreSnapshot: (snapshotId: string) => void;
  onImportBackup: () => void;
}

/** K-117 Archive workspace — vertical flow: primary sections → restore → browse → supporting. */
export function ArchiveUnifiedView({
  projection,
  theme,
  appSettings,
  isLoading = false,
  onRestoreSnapshot,
  onImportBackup,
}: ArchiveUnifiedViewProps) {
  const t = getTranslator(resolveAppLanguage(appSettings.language));
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
        <WorkspacePageHeader
          workspace="archive"
          title={t('archiveHomeTitle')}
          subtitle={t('k109ArchiveSubtitle')}
          icon={Archive}
          theme={theme}
          dark={appSettings.darkMode}
          className="px-0.5"
          legacyHook="data-k109-archive-header"
        />
      )}
      primary={(
        <div
          className={`w-full max-w-[1320px] mx-auto flex flex-col ${WORKSPACE_GAP_CLASS}`}
          data-archive-unified
          data-k109-archive-unified
          data-k117-archive-layout
          data-k121-archive-layout
          data-archive-empty={projection.empty.isEmpty ? 'true' : 'false'}
        >
          <div className={`grid grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] items-start ${WORKSPACE_GAP_CLASS}`}>
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
          </div>

          <ArchiveRestoreToolsSection
            restoreTools={projection.restoreTools}
            theme={theme}
            appSettings={appSettings}
            collapsed={prefs.restoreToolsCollapsed}
            onToggle={() => toggle('restoreToolsCollapsed')}
            onImportBackup={onImportBackup}
          />

          <ArchiveCollapsibleSection
            sectionId="browse"
            title={t('archiveBrowseTitle')}
            collapsed={prefs.browseCollapsed}
            onToggle={() => toggle('browseCollapsed')}
            theme={theme}
            dark={appSettings.darkMode}
          >
            <div data-archive-section="browse">
              {periodLinks.length > 0 && (
                <ul className="flex flex-wrap gap-1.5 mb-2">
                  {periodLinks.map(link => (
                    <li key={link.id}>
                      <button
                        type="button"
                        className={`text-xs font-semibold px-2 py-1 rounded-xl min-h-[44px] lg:min-h-0 ${theme.hoverBg}`}
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
          </ArchiveCollapsibleSection>

          {!home.empty.noAreas && (
            <ArchiveCollapsibleSection
              sectionId="areas"
              title={t('archiveAreaTitle')}
              collapsed={prefs.areasCollapsed}
              onToggle={() => toggle('areasCollapsed')}
              theme={theme}
              dark={appSettings.darkMode}
            >
              <div data-archive-section="areas">
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
            </ArchiveCollapsibleSection>
          )}

          {projection.empty.isEmpty && !isLoading && (
            <div data-k109-archive-empty data-k121-empty-state="archive-unified">
              <ProductEmptyState
                variant="tailwind"
                theme={theme}
                icon={Archive}
                title={t('k109ArchiveAllEmpty')}
                description={t('k109ArchiveSubtitle')}
                dataHook="archive-unified-empty"
                primaryAction={{
                  label: t('k125ArchiveEmptyAction'),
                  onClick: () => openTraceDiscoveryNavigation(),
                }}
              />
            </div>
          )}
        </div>
      )}
    />
  );
}
