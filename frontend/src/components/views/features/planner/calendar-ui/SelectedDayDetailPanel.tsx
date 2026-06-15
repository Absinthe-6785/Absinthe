import { useMemo } from 'react';
import type { Theme } from '@/types';
import { useTranslation } from '@/lib/i18n';
import type { PlannerCalendarPresentation, PlannerCalendarProjection } from '../calendar';
import { DayEventsSection } from './day/DayEventsSection';
import { DayScheduleTimeline } from './day/DayScheduleTimeline';
import { DayCountdownStrip } from './day/DayCountdownStrip';
import { DayMilestonesSection } from './day/DayMilestonesSection';
import { SelectedDayHistoryExtras } from './SelectedDayHistoryExtras';
import { buildDayDisplayModel } from './day/dayCalendarPresentation';
import type { DayScheduleActions } from './day/dayScheduleActions';

export type SelectedDayDetailVariant = 'full' | 'month';

export interface SelectedDayDetailPanelProps {
  projection: PlannerCalendarProjection;
  presentation: PlannerCalendarPresentation;
  theme: Theme;
  onEventNoteClick?: (noteId: string) => void;
  scheduleActions?: DayScheduleActions;
  hideHeading?: boolean;
  /** full: day/week; month: history-focused extras */
  variant?: SelectedDayDetailVariant;
  bare?: boolean;
}

/** Selected-day panel — schedules, events, deadlines only (K-74). */
export function SelectedDayDetailPanel({
  projection,
  presentation,
  theme,
  onEventNoteClick,
  scheduleActions,
  hideHeading = false,
  variant = 'full',
  bare = false,
}: SelectedDayDetailPanelProps) {
  const { t } = useTranslation();
  const day = projection.views.day;
  const model = useMemo(() => buildDayDisplayModel(day), [day]);

  const shellClass = bare
    ? 'flex flex-col gap-2.5'
    : `rounded-[20px] lg:rounded-[24px] p-3 lg:p-4 flex flex-col gap-2.5 ${theme.card}`;

  return (
    <div
      className={shellClass}
      data-planner-selected-day-detail
      data-planner-selected-day-variant={variant}
    >
      {!hideHeading ? (
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-heading text-sm lg:text-base font-bold">
            {presentation.labels.dayHeading}
          </h3>
          {model.isToday ? (
            <span className="text-[10px] font-bold uppercase tracking-wide text-primary">
              {t('plannerToday')}
            </span>
          ) : null}
        </div>
      ) : null}

      <DayScheduleTimeline
        blocks={model.timelineBlocks}
        carryOverBlocks={model.carryOverBlocks}
        scheduleActions={scheduleActions}
      />

      <section className="flex flex-col gap-1.5" data-planner-day-events-deadlines>
        <h4 className="text-[10px] lg:text-xs font-bold uppercase tracking-wide text-muted">
          {t('k74EventsAndDeadlines')}
        </h4>
        <DayEventsSection
          allDayEvents={model.allDayEvents}
          timedEvents={model.timedEvents}
          onEventNoteClick={onEventNoteClick}
          hideHeading
        />
        <DayCountdownStrip
          countdowns={projection.core.countdowns}
          presentation={presentation}
          onNoteClick={onEventNoteClick}
          hideHeading
          inline
        />
      </section>

      {variant === 'month' ? (
        <>
          <DayMilestonesSection
            milestones={day.bundle.milestones}
            onEventNoteClick={onEventNoteClick}
          />
          <SelectedDayHistoryExtras dateKey={day.dateKey} theme={theme} />
        </>
      ) : null}
    </div>
  );
}
