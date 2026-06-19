import { Copy, Edit2, Plus, Trash2 } from 'lucide-react';
import type { PlannerScheduleRow } from '../../calendar';
import { useTranslation } from '@/lib/i18n';
import { formatDayTimeRange } from './dayCalendarPresentation';
import type { DayScheduleActions } from './dayScheduleActions';
import { dayScheduleActionsEnabled } from './dayScheduleActions';

export interface DayScheduleTimelineProps {
  blocks: readonly PlannerScheduleRow[];
  carryOverBlocks: readonly PlannerScheduleRow[];
  scheduleActions?: DayScheduleActions;
  suppressEmpty?: boolean;
}

export function DayScheduleTimeline({
  blocks,
  carryOverBlocks,
  scheduleActions,
  suppressEmpty = false,
}: DayScheduleTimelineProps) {
  const { t } = useTranslation();
  const actionable = dayScheduleActionsEnabled(scheduleActions);
  const empty = blocks.length === 0 && carryOverBlocks.length === 0;
  if (empty && suppressEmpty && !dayScheduleActionsEnabled(scheduleActions)) return null;

  return (
    <section className="flex flex-col gap-1.5" data-planner-day-schedule-timeline>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[10px] lg:text-xs font-bold uppercase tracking-wide text-muted">
          {t('scheduleSectionSchedule')}
        </h4>
        {scheduleActions?.onAdd ? (
          <button
            type="button"
            onClick={scheduleActions.onAdd}
            className="bg-primary text-primary-foreground p-1.5 rounded-full shadow-sm hover:scale-105 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            data-planner-day-schedule-add="true"
            aria-label={t('scheduleAddSchedule')}
          >
            <Plus size={14} strokeWidth={3} />
          </button>
        ) : null}
      </div>
      {empty ? (
        suppressEmpty ? null : <p className="text-[10px] lg:text-xs text-muted px-1">{t('scheduleSectionEmpty')}</p>
      ) : (
        <div className="flex flex-col gap-1">
          {carryOverBlocks.map(block => (
            <div
              key={`carry-${block.id}`}
              className="px-2 py-1 text-xs lg:text-sm font-semibold truncate rounded-md bg-surface-alt border border-dashed border-border"
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
              className={`group flex items-center justify-between gap-2 px-2 py-1 rounded-md bg-surface-alt border border-border ${scheduleActions?.onView ? 'cursor-pointer hover:border-primary/40' : ''}`}
              data-planner-day-block={block.id}
              title={block.title}
              role={scheduleActions?.onView ? 'button' : undefined}
              tabIndex={scheduleActions?.onView ? 0 : undefined}
              onClick={scheduleActions?.onView ? () => scheduleActions.onView!(block.id) : undefined}
              onKeyDown={scheduleActions?.onView ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  scheduleActions.onView!(block.id);
                }
              } : undefined}
            >
              <span className="text-xs lg:text-sm font-semibold truncate min-w-0">
                {formatDayTimeRange(block.startTime, block.endTime)} {block.title}
              </span>
              {scheduleActions?.onEdit || scheduleActions?.onDelete || scheduleActions?.onDuplicate ? (
                <div
                  className="flex gap-1 shrink-0 opacity-80 group-hover:opacity-100 group-focus-within:opacity-100"
                  data-planner-day-block-actions={block.id}
                  onClick={e => e.stopPropagation()}
                >
                  {scheduleActions.onEdit ? (
                    <button
                      type="button"
                      onClick={() => scheduleActions.onEdit!(block.id)}
                      className="p-2 min-h-[44px] min-w-[44px] rounded-full hover:bg-surface text-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary flex items-center justify-center"
                      data-planner-day-schedule-edit={block.id}
                      aria-label={`Edit ${block.title}`}
                    >
                      <Edit2 size={14} />
                    </button>
                  ) : null}
                  {scheduleActions.onDuplicate ? (
                    <button
                      type="button"
                      onClick={() => scheduleActions.onDuplicate!(block.id)}
                      className="p-2 min-h-[44px] min-w-[44px] rounded-full hover:bg-surface text-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary flex items-center justify-center"
                      data-planner-day-schedule-duplicate={block.id}
                      aria-label={`Duplicate ${block.title}`}
                    >
                      <Copy size={14} />
                    </button>
                  ) : null}
                  {scheduleActions.onDelete ? (
                    <button
                      type="button"
                      onClick={() => scheduleActions.onDelete!(block.id)}
                      className="p-2 min-h-[44px] min-w-[44px] rounded-full hover:bg-surface text-muted hover:text-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary flex items-center justify-center"
                      data-planner-day-schedule-delete={block.id}
                      aria-label={`Delete ${block.title}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
