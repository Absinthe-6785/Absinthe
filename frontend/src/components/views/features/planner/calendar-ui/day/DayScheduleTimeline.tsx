import type { PlannerScheduleRow } from '../../calendar';
import { formatDayTimeRange } from './dayCalendarPresentation';

export interface DayScheduleTimelineProps {
  blocks: readonly PlannerScheduleRow[];
  carryOverBlocks: readonly PlannerScheduleRow[];
}

export function DayScheduleTimeline({ blocks, carryOverBlocks }: DayScheduleTimelineProps) {
  if (blocks.length === 0 && carryOverBlocks.length === 0) return null;

  return (
    <section className="flex flex-col gap-2" data-planner-day-schedule-timeline>
      <h4 className="text-xs lg:text-sm font-bold uppercase tracking-wide text-muted">
        Schedule
      </h4>
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
            className="px-2 py-1.5 text-xs lg:text-sm font-semibold truncate rounded-md bg-surface-alt border border-border"
            data-planner-day-block={block.id}
            title={block.title}
          >
            {formatDayTimeRange(block.startTime, block.endTime)} {block.title}
          </div>
        ))}
      </div>
    </section>
  );
}
