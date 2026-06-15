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
          className="px-1 py-0.5 text-[9px] lg:text-[10px] font-semibold truncate rounded-md bg-surface-alt border border-border/70"
          data-planner-week-block={block.id}
          title={block.title}
        >
          <span className="text-muted tabular-nums">{formatWeekTimeRange(block.startTime, block.endTime)}</span>
          {' '}
          {block.title}
        </div>
      ))}
    </div>
  );
}
