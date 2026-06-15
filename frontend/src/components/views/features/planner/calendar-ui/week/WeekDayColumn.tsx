import type { Theme } from '@/types';
import { WeekEventRows, formatWeekDayPreview } from './WeekEventRows';
import { WeekScheduleBlockRows } from './WeekScheduleBlockRows';
import { WeekTemplateHints } from './WeekTemplateHints';
import { formatWeekRoutineSummary, type WeekDayDisplayModel } from './weekCalendarPresentation';

export interface WeekDayColumnProps {
  model: WeekDayDisplayModel;
  theme: Theme;
  onEventNoteClick?: (noteId: string) => void;
  onDateSelect?: (dateKey: string) => void;
}

export function WeekDayColumn({ model, theme, onEventNoteClick, onDateSelect }: WeekDayColumnProps) {
  const routineLabel = formatWeekRoutineSummary(model.routineSummary);
  const selectable = Boolean(onDateSelect);
  const preview = formatWeekDayPreview(model.timedEvents, model.allDayEvents, model.blocks);

  return (
    <button
      type="button"
      disabled={!selectable}
      onClick={selectable ? () => onDateSelect!(model.dateKey) : undefined}
      className={`min-h-[88px] border p-1 lg:p-1.5 flex flex-col gap-1 text-left w-full
        ${theme.border}
        ${model.isToday ? 'ring-2 ring-primary ring-inset' : ''}
        ${model.isAnchorDate ? 'bg-primary/5' : ''}
        ${selectable ? 'cursor-pointer hover:bg-surface-alt/50 transition-colors' : ''}`}
      data-planner-week-day={model.dateKey}
      data-planner-week-day-empty={model.isEmpty ? 'true' : 'false'}
    >
      <div className="flex items-start justify-between gap-0.5">
        <div className="flex flex-col gap-0 min-w-0">
          <span
            className={`text-[9px] lg:text-[10px] font-semibold uppercase tracking-wide ${theme.textMuted}`}
            data-planner-week-weekday-label
          >
            {model.weekdayLabel}
          </span>
          <span
            className="text-xs lg:text-sm font-bold tabular-nums leading-tight"
            data-planner-week-day-label
          >
            {model.dayLabel}
          </span>
          {preview ? (
            <span
              className="text-[9px] lg:text-[10px] font-semibold truncate text-primary mt-0.5"
              data-planner-week-day-preview
            >
              {preview}
            </span>
          ) : null}
        </div>
        {model.milestoneCount > 0 ? (
          <span
            className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-0.5"
            data-planner-week-milestone-dot
            aria-label="Milestone"
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-0.5 flex-1 min-h-0">
        <WeekEventRows
          allDayEvents={model.allDayEvents}
          timedEvents={model.timedEvents}
          onEventNoteClick={onEventNoteClick}
        />
        <WeekScheduleBlockRows blocks={model.blocks} />
        <WeekTemplateHints templateSlots={model.templateSlots} />
        {routineLabel ? (
          <span
            className={`text-[9px] font-semibold ${theme.textMuted}`}
            data-planner-week-routines
          >
            {routineLabel}
          </span>
        ) : null}
      </div>
    </button>
  );
}
