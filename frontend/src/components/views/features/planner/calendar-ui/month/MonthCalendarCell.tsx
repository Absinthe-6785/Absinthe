import type { Theme } from '../../../../../types';
import {
  formatMonthOverflowLabel,
  spanPositionClass,
  type MonthCellDisplayModel,
} from './monthCalendarPresentation';

export interface MonthCalendarCellProps {
  model: MonthCellDisplayModel;
  theme: Theme;
  onEventNoteClick?: (noteId: string) => void;
  onDateSelect?: (dateKey: string) => void;
}

export function MonthCalendarCell({
  model,
  theme,
  onEventNoteClick,
  onDateSelect,
}: MonthCalendarCellProps) {
  const overflowLabel = formatMonthOverflowLabel(model.overflowCount);

  return (
    <div
      className={`min-h-[88px] lg:min-h-[96px] border p-1.5 lg:p-2 flex flex-col gap-1
        ${model.inMonth ? '' : 'opacity-40'}
        ${theme.border}
        ${model.isToday ? 'ring-2 ring-primary ring-inset' : ''}
        ${model.isAnchorSelected ? 'bg-primary/5' : ''}`}
      data-planner-month-cell={model.dateKey}
      data-planner-month-cell-in-month={model.inMonth ? 'true' : 'false'}
      data-planner-month-cell-empty={model.isEmpty ? 'true' : 'false'}
    >
      <div className="flex items-start justify-between gap-1">
        <span
          className={`text-[11px] lg:text-xs font-bold tabular-nums ${model.inMonth ? '' : theme.textMuted}${onDateSelect && model.inMonth ? ' cursor-pointer hover:underline' : ''}`}
          data-planner-month-cell-day
          onClick={onDateSelect && model.inMonth ? () => onDateSelect(model.dateKey) : undefined}
          onKeyDown={onDateSelect && model.inMonth ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onDateSelect(model.dateKey);
            }
          } : undefined}
          role={onDateSelect && model.inMonth ? 'button' : undefined}
          tabIndex={onDateSelect && model.inMonth ? 0 : undefined}
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

      <div className="flex flex-col gap-0.5 flex-1 min-h-0">
        {model.eventRows.map(({ occurrence, showTitle }) => (
          <div
            key={occurrence.occurrenceId}
            className={`px-1 py-0.5 text-[9px] lg:text-[10px] font-semibold truncate bg-primary/15 text-primary ${spanPositionClass(occurrence.spanPosition)}${onEventNoteClick ? ' cursor-pointer hover:opacity-80' : ''}`}
            data-planner-month-event={occurrence.noteId}
            data-planner-month-event-span={occurrence.spanPosition}
            title={occurrence.title}
            onClick={onEventNoteClick ? () => onEventNoteClick(occurrence.noteId) : undefined}
            onKeyDown={onEventNoteClick ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onEventNoteClick(occurrence.noteId);
              }
            } : undefined}
            role={onEventNoteClick ? 'button' : undefined}
            tabIndex={onEventNoteClick ? 0 : undefined}
          >
            {showTitle ? occurrence.title : '\u00a0'}
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
