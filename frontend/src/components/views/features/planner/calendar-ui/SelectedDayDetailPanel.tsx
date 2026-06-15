import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import type { Theme } from '@/types';
import { useTranslation } from '@/lib/i18n';
import type { PlannerCalendarPresentation, PlannerCalendarProjection } from '../calendar';
import { DayAgendaList } from './day/DayAgendaList';
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
  /** Hide per-section empty placeholders — show one combined empty state. */
  suppressEmptySections?: boolean;
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
  suppressEmptySections = false,
}: SelectedDayDetailPanelProps) {
  const { t } = useTranslation();
  const day = projection.views.day;
  const model = useMemo(() => buildDayDisplayModel(day), [day]);
  const hasSchedules = model.timelineBlocks.length > 0 || model.carryOverBlocks.length > 0;
  const hasEvents = model.allDayEvents.length > 0 || model.timedEvents.length > 0;
  const hasCountdowns = projection.core.countdowns.length > 0;
  const canAddSchedule = !!scheduleActions?.onAdd;
  const showCombinedEmpty = suppressEmptySections && !hasSchedules && !hasEvents && !hasCountdowns
    && !canAddSchedule
    && variant !== 'month';

  const shellClass = bare
    ? 'flex flex-col gap-2'
    : `rounded-[20px] lg:rounded-[24px] p-2.5 lg:p-3 flex flex-col gap-2 ${theme.card}`;

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

      {showCombinedEmpty ? (
        <p className="text-[11px] text-muted py-0.5" data-planner-day-combined-empty>{t('k77ScheduleEmptyCompact')}</p>
      ) : (
        <>
          {canAddSchedule ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={scheduleActions!.onAdd}
                className="bg-primary text-primary-foreground p-1.5 rounded-full shadow-sm hover:scale-105 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                data-planner-day-schedule-add="true"
                aria-label={t('scheduleAddSchedule')}
              >
                <Plus size={14} strokeWidth={3} />
              </button>
            </div>
          ) : null}
          <DayAgendaList
            blocks={model.timelineBlocks}
            carryOverBlocks={model.carryOverBlocks}
            allDayEvents={model.allDayEvents}
            timedEvents={model.timedEvents}
            countdowns={projection.core.countdowns}
            presentation={presentation}
            onEventNoteClick={onEventNoteClick}
          />
        </>
      )}

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
