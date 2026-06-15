import { useCallback, useState } from 'react';
import type { PlannerCalendarPresentation } from '../../calendar';
import type { DayScheduleActions } from '../day/dayScheduleActions';
import type { AgendaEventActions } from '../day/dayScheduleActions';
import { useTranslation } from '@/lib/i18n';
import { useCountdownReviewed } from '../../hooks/useCountdownReviewed';
import {
  buildUnifiedAgendaItems,
  agendaItemHasActions,
  type BuildAgendaItemsInput,
  type UnifiedAgendaItem,
} from './agendaItemModel';
import { AgendaItemActionMenu } from './AgendaItemActionMenu';

export interface UnifiedAgendaListProps extends BuildAgendaItemsInput {
  presentation: PlannerCalendarPresentation;
  scheduleActions?: DayScheduleActions;
  eventActions?: AgendaEventActions;
  emptyMessage?: string;
  compact?: boolean;
}

interface MenuState {
  item: UnifiedAgendaItem;
  anchor: { x: number; y: number };
}

export function UnifiedAgendaList({
  blocks,
  carryOverBlocks,
  allDayEvents,
  timedEvents,
  countdowns,
  presentation,
  scheduleActions,
  eventActions,
  emptyMessage,
  compact = false,
  isReviewed: isReviewedProp,
  maxCountdowns,
}: UnifiedAgendaListProps) {
  const { t } = useTranslation();
  const { isReviewed: defaultReviewed } = useCountdownReviewed();
  const isReviewed = isReviewedProp ?? defaultReviewed;
  const [menu, setMenu] = useState<MenuState | null>(null);

  const items = buildUnifiedAgendaItems({
    blocks,
    carryOverBlocks,
    allDayEvents,
    timedEvents,
    countdowns,
    presentation,
    isReviewed,
    maxCountdowns,
  });

  const openMenu = useCallback((item: UnifiedAgendaItem, e: React.MouseEvent) => {
    if (!agendaItemHasActions(item, scheduleActions, eventActions)) {
      if (item.noteId && eventActions?.onOpen) {
        eventActions.onOpen(item.noteId);
      }
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setMenu({ item, anchor: { x: e.clientX, y: e.clientY } });
  }, [scheduleActions, eventActions]);

  const resolveMenuActions = useCallback((item: UnifiedAgendaItem) => {
    if ((item.kind === 'block' || item.kind === 'countdown') && item.blockId) {
      return {
        onEdit: scheduleActions?.onEdit ? () => scheduleActions.onEdit!(item.blockId!) : undefined,
        onDelete: scheduleActions?.onDelete ? () => scheduleActions.onDelete!(item.blockId!) : undefined,
        onDuplicate: scheduleActions?.onDuplicate ? () => scheduleActions.onDuplicate!(item.blockId!) : undefined,
      };
    }
    if (item.noteId) {
      return {
        onEdit: eventActions?.onEdit ? () => eventActions.onEdit!(item.noteId!) : undefined,
        onDelete: eventActions?.onDelete ? () => eventActions.onDelete!(item.noteId!) : undefined,
        onDuplicate: eventActions?.onDuplicate ? () => eventActions.onDuplicate!(item.noteId!) : undefined,
      };
    }
    return {};
  }, [scheduleActions, eventActions]);

  if (items.length === 0) {
    return (
      <p className="text-[11px] text-muted py-0.5" data-planner-agenda-empty>
        {emptyMessage ?? t('k77ScheduleEmptyCompact')}
      </p>
    );
  }

  const rowPad = compact ? 'px-1.5 py-1 min-h-[26px]' : 'px-2 py-1.5 min-h-[30px]';
  const textSize = compact ? 'text-[11px]' : 'text-xs';

  return (
    <>
      <ul className="flex flex-col gap-0.5" data-planner-unified-agenda>
        {items.map(item => {
          const actionable = agendaItemHasActions(item, scheduleActions, eventActions)
            || Boolean(item.noteId && eventActions?.onOpen);

          if (item.kind === 'countdown') {
            return (
              <li
                key={item.key}
                className={`flex items-center justify-between gap-2 ${rowPad} rounded-md bg-primary/10 text-primary${actionable ? ' cursor-pointer hover:opacity-90' : ''}`}
                data-planner-agenda-countdown={item.key}
                onClick={actionable ? e => openMenu(item, e) : undefined}
                onKeyDown={actionable ? e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openMenu(item, e as unknown as React.MouseEvent);
                  }
                } : undefined}
                role={actionable ? 'button' : undefined}
                tabIndex={actionable ? 0 : undefined}
              >
                <span className={`${textSize} font-semibold truncate min-w-0 flex-1`}>
                  {item.countdownLabel} {item.title}
                </span>
              </li>
            );
          }

          if (item.kind === 'block') {
            return (
              <li
                key={item.key}
                className={`${rowPad} rounded-md ${item.carryOver ? 'bg-surface-alt border border-dashed border-border' : 'bg-surface-alt border border-border'} ${textSize} font-semibold truncate${actionable ? ' cursor-pointer hover:bg-surface' : ''}`}
                data-planner-agenda-block={item.blockId}
                data-planner-agenda-block-carryover={item.carryOver ? 'true' : undefined}
                onClick={actionable ? e => openMenu(item, e) : undefined}
                onKeyDown={actionable ? e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openMenu(item, e as unknown as React.MouseEvent);
                  }
                } : undefined}
                role={actionable ? 'button' : undefined}
                tabIndex={actionable ? 0 : undefined}
              >
                {item.time ? <span className="text-muted tabular-nums mr-1.5">{item.time}</span> : null}
                {item.title}
              </li>
            );
          }

          return (
            <li
              key={item.key}
              className={`${rowPad} rounded-md bg-primary/10 text-primary${actionable ? ' cursor-pointer hover:opacity-90' : ''}`}
              data-planner-agenda-event={item.noteId}
              onClick={actionable ? e => openMenu(item, e) : undefined}
              onKeyDown={actionable ? e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openMenu(item, e as unknown as React.MouseEvent);
                }
              } : undefined}
              role={actionable ? 'button' : undefined}
              tabIndex={actionable ? 0 : undefined}
            >
              {item.allDay ? (
                <span className={`${textSize} font-semibold truncate`}>{item.title}</span>
              ) : (
                <span className={`${textSize} font-semibold truncate`}>
                  {item.time ? <span className="text-muted tabular-nums mr-1.5">{item.time}</span> : null}
                  {item.title}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <AgendaItemActionMenu
        open={menu != null}
        anchor={menu?.anchor ?? null}
        title={menu?.item.title ?? ''}
        onClose={() => setMenu(null)}
        {...(menu ? resolveMenuActions(menu.item) : {})}
      />
    </>
  );
}
