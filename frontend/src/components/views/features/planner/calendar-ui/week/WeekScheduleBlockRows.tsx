import type { PlannerScheduleRow } from '../../calendar';
import { formatWeekTimeRange } from './weekCalendarPresentation';

export interface WeekScheduleBlockRowsProps {
  blocks: readonly PlannerScheduleRow[];
}

export function WeekScheduleBlockRows({ blocks }: WeekScheduleBlockRowsProps) {
  if (blocks.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5" data-planner-week-block-rows>
      {blocks.map(block => (
        <div
          key={block.id}
          className="px-1.5 py-1 text-[10px] lg:text-[11px] font-semibold truncate rounded-md bg-surface-alt border border-border"
          data-planner-week-block={block.id}
          title={block.title}
        >
          {formatWeekTimeRange(block.startTime, block.endTime)} {block.title}
        </div>
      ))}
    </div>
  );
}
