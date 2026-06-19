import type { Theme } from '@/types';
import {
  formatMonthOverflowLabel,
  spanPositionClass,
  type MonthCellDisplayModel,
} from './monthCalendarPresentation';
import { formatEventTimeLabel } from '../day/dayCalendarPresentation';

export interface MonthCalendarCellProps {
  model: MonthCellDisplayModel;
  theme: Theme;
  onEventNoteClick?: (noteId: string) => void;
  onDateSelect?: (dateKey: string) => void;
  onScheduleBlockClick?: (blockId: string) => void;
}

export function MonthCalendarCell({
  model,
  theme,
  onEventNoteClick,
  onDateSelect,
  onScheduleBlockClick,
}: MonthCalendarCellProps) {
  const overflowLabel = formatMonthOverflowLabel(model.overflowCount);

  return (
    <div
      role={onDateSelect && model.inMonth ? 'button' : undefined}
      tabIndex={onDateSelect && model.inMonth ? 0 : undefined}
      onClick={onDateSelect && model.inMonth ? () => onDateSelect(model.dateKey) : undefined}
      onKeyDown={onDateSelect && model.inMonth ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onDateSelect(model.dateKey);
        }
      } : undefined}
      className={`min-h-[72px] lg:min-h-[80px] border p-1 lg:p-1.5 flex flex-col gap-0.5
        ${model.inMonth ? '' : 'opacity-40'}
        ${theme.border}
        ${model.isToday ? 'ring-2 ring-primary ring-inset bg-primary/8' : ''}
        ${model.isAnchorSelected ? 'bg-primary/12 ring-1 ring-primary/40 ring-inset' : ''}
        ${model.isEmpty && model.inMonth && onDateSelect ? 'hover:bg-surface-alt/80 hover:ring-1 hover:ring-primary/25' : ''}
        ${onDateSelect && model.inMonth ? 'cursor-pointer hover:bg-surface-alt/40 transition-colors' : ''}`}
      data-planner-month-cell={model.dateKey}
      data-planner-month-cell-in-month={model.inMonth ? 'true' : 'false'}
      data-planner-month-cell-empty={model.isEmpty ? 'true' : 'false'}
      data-k108-month-cell-empty={model.isEmpty && model.inMonth ? 'true' : undefined}
      aria-label={onDateSelect && model.inMonth
        ? model.isEmpty
          ? `Add schedule on ${model.dateKey}`
          : `View ${model.dateKey}`
        : undefined}
    >
      <div className="flex items-start justify-between gap-1">
        <span
          className={`text-[11px] lg:text-xs font-bold tabular-nums ${model.inMonth ? '' : theme.textMuted}`}
          data-planner-month-cell-day
        >
          {model.day}
        </span>
        {model.milestoneCount > 0 ? (
          <span
            className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1"
            data-planner-month-milestone-dot
            aria-label="Milestone"
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-1 flex-1 min-h-0 overflow-hidden">
        {model.blockRows.map(({ block }) => (
          <div
            key={block.id}
            className={`k101-planner-chip px-1.5 py-1 text-[10px] lg:text-[11px] font-semibold truncate rounded-md bg-surface-alt text-foreground border border-border/50 border-l-[3px] border-l-amber-500 hover:bg-surface hover:shadow-sm transition-colors${onScheduleBlockClick ? ' cursor-pointer' : ''}`}
            data-planner-month-block={block.id}
            data-planner-month-block-category={block.category || undefined}
            data-planner-month-block-color={block.color}
            data-k121-month-schedule-block={block.id}
            title={`${block.startTime} ${block.title}${block.category ? ` · ${block.category}` : ''}`}
            onClick={onScheduleBlockClick ? (e) => { e.stopPropagation(); onScheduleBlockClick(block.id); } : undefined}
            onKeyDown={onScheduleBlockClick ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onScheduleBlockClick(block.id);
              }
            } : undefined}
            role={onScheduleBlockClick ? 'button' : undefined}
            tabIndex={onScheduleBlockClick ? 0 : undefined}
          >
            <span className="opacity-70 tabular-nums">{block.startTime}</span>
            {' '}
            <span>{block.title}</span>
          </div>
        ))}

        {model.eventRows.map(({ occurrence, showTitle }) => {
          const timeLabel = !occurrence.isAllDay && occurrence.startTime
            ? formatEventTimeLabel(occurrence.startTime, occurrence.endTime)
            : null;
          return (
          <div
            key={occurrence.occurrenceId}
            className={`k101-planner-chip px-1.5 py-1 text-[9px] lg:text-[10px] font-semibold truncate bg-primary/15 text-primary border-l-2 border-l-primary hover:bg-primary/25 transition-colors ${spanPositionClass(occurrence.spanPosition)}${onEventNoteClick ? ' cursor-pointer' : ''}`}
            data-planner-month-event={occurrence.noteId}
            data-planner-month-event-span={occurrence.spanPosition}
            data-selected={model.isAnchorSelected ? 'true' : undefined}
            title={timeLabel ? `${timeLabel} ${occurrence.title}` : occurrence.title}
            onClick={onEventNoteClick ? (e) => { e.stopPropagation(); onEventNoteClick(occurrence.noteId); } : undefined}
            onKeyDown={onEventNoteClick ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onEventNoteClick(occurrence.noteId);
              }
            } : undefined}
            role={onEventNoteClick ? 'button' : undefined}
            tabIndex={onEventNoteClick ? 0 : undefined}
          >
            {showTitle ? (
              <>
                {timeLabel ? <span className="opacity-70 tabular-nums">{timeLabel} </span> : null}
                {occurrence.title}
              </>
            ) : '\u00a0'}
          </div>
          );
        })}

        {model.countdownRows.map(({ countdown, label }) => (
          <div
            key={countdown.id}
            className="px-1 py-0.5 text-[9px] lg:text-[10px] font-bold truncate rounded-md bg-primary/20 text-primary"
            data-planner-month-countdown={countdown.id}
            title={`${label} ${countdown.title}`}
          >
            <span className="tabular-nums">{label}</span>
            {' '}
            <span className="font-semibold">{countdown.title}</span>
          </div>
        ))}

        {overflowLabel ? (
          <span
            className={`text-[9px] lg:text-[10px] font-semibold ${theme.textMuted}`}
            data-planner-month-overflow
          >
            {overflowLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export type { MonthCellDisplayModel };
