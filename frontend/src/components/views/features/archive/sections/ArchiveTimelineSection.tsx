import type { AppSettings, Theme } from '../../../../../types';
import type {
  ArchiveMarkCalendarProjection,
  ArchiveMilestoneEntry,
  ArchivePeriodRef,
  ArchiveTimelineProjection,
  ArchiveYouAreHere,
} from '../../knowledge/archive';
import { resolveAppLanguage, getTranslator } from '../../../../../lib/i18n';
import { ArchiveCollapsibleSection } from './ArchiveCollapsibleSection';
import { openNote } from '../../../../../lib/noteNavigation';
import { openArchiveBrowseDestination } from '../../../../../lib/traceNavigation';
import { ArchiveMarkCalendar } from '../home/ArchiveMarkCalendar';
import { ArchiveRecentMilestones } from '../home/ArchiveRecentMilestones';

export interface ArchiveTimelineSectionProps {
  timeline: ArchiveTimelineProjection;
  defaultPeriod: ArchivePeriodRef;
  markCalendar: ArchiveMarkCalendarProjection;
  recentMilestones: readonly ArchiveMilestoneEntry[];
  youAreHere: ArchiveYouAreHere;
  theme: Theme;
  appSettings: AppSettings;
  collapsed: boolean;
  onToggle: () => void;
  onMilestoneClick: (entry: { noteId: string }) => void;
  onMarkDayClick: (dateKey: string) => void;
}

const BUCKET_LABEL_KEYS = {
  today: 'k109TimelineToday',
  thisWeek: 'k109TimelineThisWeek',
  thisMonth: 'k109TimelineThisMonth',
  earlier: 'k109TimelineEarlier',
} as const;

export function ArchiveTimelineSection({
  timeline,
  defaultPeriod,
  markCalendar,
  recentMilestones,
  youAreHere,
  theme,
  appSettings,
  collapsed,
  onToggle,
  onMilestoneClick,
  onMarkDayClick,
}: ArchiveTimelineSectionProps) {
  const t = getTranslator(resolveAppLanguage(appSettings.language));
  const hasCalendar = markCalendar.hasAnyMarks || recentMilestones.length > 0;

  return (
    <ArchiveCollapsibleSection
      sectionId="timeline"
      title={t('k109SectionTimeline')}
      collapsed={collapsed}
      onToggle={onToggle}
      theme={theme}
      dark={appSettings.darkMode}
      isEmpty={timeline.isEmpty && !hasCalendar}
      emptyHint={t('k109EmptyTimeline')}
      major
    >
      <div className="space-y-3" data-k109-timeline-groups>
        {hasCalendar && (
          <div data-archive-mark-calendar className="mb-2">
            <ArchiveMarkCalendar
              markCalendar={markCalendar}
              endDate={youAreHere.today}
              theme={theme}
              appSettings={appSettings}
              onDayClick={onMarkDayClick}
              onMonthClick={(year, month) => openArchiveBrowseDestination({
                type: 'period',
                ref: { kind: 'month', year, month, label: `${year}-${month}` },
              })}
            />
            {recentMilestones.length > 0 && (
              <div className="mt-2">
                <ArchiveRecentMilestones
                  milestones={recentMilestones}
                  theme={theme}
                  appSettings={appSettings}
                  onMilestoneClick={onMilestoneClick}
                />
              </div>
            )}
          </div>
        )}
        {timeline.groups.map(group => {
          if (group.entries.length === 0) return null;
          return (
            <div key={group.bucket} data-k109-timeline-group={group.bucket}>
              <p className={`text-[10px] font-bold uppercase tracking-wide mb-1.5 ${theme.textMuted}`}>
                {t(BUCKET_LABEL_KEYS[group.bucket])}
              </p>
              <ul className="space-y-1">
                {group.entries.map(entry => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className={`w-full text-left text-xs py-2 px-1 min-h-[44px] lg:min-h-[36px] rounded-lg truncate ${theme.hoverBg}`}
                      onClick={() => {
                        if (entry.kind === 'milestone' && entry.noteId) {
                          openNote(entry.noteId, { returnTab: 'analytics' });
                        } else if (entry.kind === 'mark-day') {
                          onMarkDayClick(entry.dateKey);
                        }
                      }}
                      data-k109-timeline-row
                    >
                      {entry.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        <button
          type="button"
          className="text-xs font-semibold text-primary hover:underline min-h-[44px]"
          onClick={() => openArchiveBrowseDestination({ type: 'timeline', defaultPeriod })}
          data-k109-timeline-browse
        >
          {t('archiveOpenTimelineRange')}
        </button>
      </div>
    </ArchiveCollapsibleSection>
  );
}
