import { Edit2, Plus, Trash2 } from 'lucide-react';
import type { PlannerScheduleRow } from '../../calendar';
import { formatDayTimeRange } from './dayCalendarPresentation';
import type { DayScheduleActions } from './dayScheduleActions';
import { dayScheduleActionsEnabled } from './dayScheduleActions';

export interface DayScheduleTimelineProps {
  blocks: readonly PlannerScheduleRow[];
  carryOverBlocks: readonly PlannerScheduleRow[];
  scheduleActions?: DayScheduleActions;
}

export function DayScheduleTimeline({
  blocks,
  carryOverBlocks,
  scheduleActions,
}: DayScheduleTimelineProps) {
  const actionable = dayScheduleActionsEnabled(scheduleActions);
  if (blocks.length === 0 && carryOverBlocks.length === 0 && !actionable) return null;

  return (
    <section className="flex flex-col gap-2" data-planner-day-schedule-timeline>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs lg:text-sm font-bold uppercase tracking-wide text-muted">
          Schedule
        </h4>
        {scheduleActions?.onAdd ? (
          <button
            type="button"
            onClick={scheduleActions.onAdd}
            className="bg-primary text-primary-foreground p-1.5 rounded-full shadow-sm hover:scale-105 transition-transform"
            data-planner-day-schedule-add="true"
            aria-label="Add schedule"
          >
            <Plus size={16} strokeWidth={3} />
          </button>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        {carryOverBlocks.map(block => (
          <div
            key={`carry-${block.id}`}
            className="px-2 py-1.5 text-xs lg:text-sm font-semibold truncate rounded-md bg-surface-alt border border-dashed border-border"
            data-planner-day-block={block.id}
            data-planner-day-block-carryover="true"
            title={block.title}
          >
            {formatDayTimeRange(block.startTime, block.endTime)} {block.title}
          </div>
        ))}

        {blocks.map(block => (
          <div
            key={block.id}
            className="group flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-surface-alt border border-border"
            data-planner-day-block={block.id}
            title={block.title}
          >
            <span className="text-xs lg:text-sm font-semibold truncate min-w-0">
              {formatDayTimeRange(block.startTime, block.endTime)} {block.title}
            </span>
            {scheduleActions?.onEdit || scheduleActions?.onDelete ? (
              <div
                className="flex gap-1 shrink-0 opacity-80 group-hover:opacity-100"
                data-planner-day-block-actions={block.id}
              >
                {scheduleActions.onEdit ? (
                  <button
                    type="button"
                    onClick={() => scheduleActions.onEdit!(block.id)}
                    className="p-1 rounded-full hover:bg-surface text-muted hover:text-foreground"
                    data-planner-day-schedule-edit={block.id}
                    aria-label={`Edit ${block.title}`}
                  >
                    <Edit2 size={12} />
                  </button>
                ) : null}
                {scheduleActions.onDelete ? (
                  <button
                    type="button"
                    onClick={() => scheduleActions.onDelete!(block.id)}
                    className="p-1 rounded-full hover:bg-surface text-muted hover:text-red-500"
                    data-planner-day-schedule-delete={block.id}
                    aria-label={`Delete ${block.title}`}
                  >
                    <Trash2 size={12} />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
