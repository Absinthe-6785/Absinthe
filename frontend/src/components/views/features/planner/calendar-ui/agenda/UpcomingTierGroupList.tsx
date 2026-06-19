import { useCallback, useState } from 'react';
import type { DayScheduleActions, AgendaEventActions } from '../day/dayScheduleActions';
import {
  agendaItemHasActions,
  type UnifiedAgendaItem,
} from './agendaItemModel';
import type { UpcomingAgendaGroup } from './buildUpcomingAgendaGroups';
import type { UpcomingTierSection } from './buildUpcomingTierGroups';
import { AgendaItemActionMenu } from './AgendaItemActionMenu';

export interface UpcomingTierGroupListProps {
  sections: readonly UpcomingTierSection[];
  scheduleActions?: DayScheduleActions;
  eventActions?: AgendaEventActions;
  onDateSelect?: (dateKey: string) => void;
}

interface MenuState {
  item: UnifiedAgendaItem;
  dateKey: string;
  anchor: { x: number; y: number };
}

function AgendaItemRow({
  item,
  dateKey,
  scheduleActions,
  eventActions,
  onDateSelect,
  onOpenMenu,
}: {
  item: UnifiedAgendaItem;
  dateKey: string;
  scheduleActions?: DayScheduleActions;
  eventActions?: AgendaEventActions;
  onDateSelect?: (dateKey: string) => void;
  onOpenMenu: (item: UnifiedAgendaItem, dateKey: string, e: React.MouseEvent) => void;
}) {
  const actionable = agendaItemHasActions(item, scheduleActions, eventActions)
    || Boolean(item.noteId && eventActions?.onOpen)
    || Boolean(item.kind === 'block' && item.blockId && scheduleActions?.onView);

  const handleClick = (e: React.MouseEvent) => {
    if (item.kind === 'block' && item.blockId && scheduleActions?.onView && !e.shiftKey) {
      scheduleActions.onView(item.blockId);
      return;
    }
    if (!agendaItemHasActions(item, scheduleActions, eventActions)) {
      if (item.noteId && eventActions?.onOpen) eventActions.onOpen(item.noteId);
      return;
    }
    onOpenMenu(item, dateKey, e);
  };

  const categoryClass = item.kind === 'event' ? 'border-l-2 border-l-primary'
    : item.kind === 'block' ? 'border-l-2 border-l-amber-500'
      : '';

  return (
    <li
      className={`px-1.5 py-1 min-h-[24px] rounded-md text-[11px] font-semibold truncate k101-planner-chip k101-interactive
        ${item.kind === 'countdown' ? 'bg-primary/10 text-primary' : item.kind === 'event' ? 'bg-primary/8 text-primary' : 'bg-surface-alt border border-border/60'}
        ${categoryClass}
        ${actionable ? 'cursor-pointer hover:bg-surface' : ''}`}
      data-planner-upcoming-item={item.key}
      onClick={actionable ? handleClick : undefined}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e as unknown as React.MouseEvent);
        }
      }}
      role={actionable ? 'button' : undefined}
      tabIndex={actionable ? 0 : undefined}
    >
      {item.kind === 'countdown' ? (
        <span className="flex flex-col leading-tight">
          <span className="truncate">{item.title}</span>
          <span className="text-[10px] font-bold tabular-nums opacity-90">{item.countdownLabel}</span>
        </span>
      ) : (
        <span className="truncate">
          {item.time ? <span className="text-muted tabular-nums mr-1">{item.time}</span> : null}
          {item.title}
        </span>
      )}
    </li>
  );
}

function DayGroup({
  group,
  scheduleActions,
  eventActions,
  onDateSelect,
  onOpenMenu,
}: {
  group: UpcomingAgendaGroup;
  scheduleActions?: DayScheduleActions;
  eventActions?: AgendaEventActions;
  onDateSelect?: (dateKey: string) => void;
  onOpenMenu: (item: UnifiedAgendaItem, dateKey: string, e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5" data-planner-upcoming-day={group.dateKey}>
      <button
        type="button"
        onClick={onDateSelect ? () => onDateSelect(group.dateKey) : undefined}
        className={`text-[10px] font-semibold text-muted tabular-nums text-left k101-interactive rounded px-1${onDateSelect ? ' hover:text-primary cursor-pointer' : ''}`}
        data-planner-upcoming-date={group.dateKey}
      >
        {group.dateLabel}
      </button>
      <ul className="flex flex-col gap-0.5">
        {group.items.map(item => (
          <AgendaItemRow
            key={`${group.dateKey}-${item.key}`}
            item={item}
            dateKey={group.dateKey}
            scheduleActions={scheduleActions}
            eventActions={eventActions}
            onDateSelect={onDateSelect}
            onOpenMenu={onOpenMenu}
          />
        ))}
      </ul>
    </div>
  );
}

export function UpcomingTierGroupList({
  sections,
  scheduleActions,
  eventActions,
  onDateSelect,
}: UpcomingTierGroupListProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);

  const openMenu = useCallback((item: UnifiedAgendaItem, dateKey: string, e: React.MouseEvent) => {
    if (!agendaItemHasActions(item, scheduleActions, eventActions)) return;
    e.preventDefault();
    e.stopPropagation();
    setMenu({ item, dateKey, anchor: { x: e.clientX, y: e.clientY } });
  }, [scheduleActions, eventActions]);

  const resolveMenuActions = useCallback((item: UnifiedAgendaItem, dateKey: string) => {
    const jump = onDateSelect ? () => onDateSelect(dateKey) : undefined;
    if ((item.kind === 'block' || item.kind === 'countdown') && item.blockId) {
      return {
        onEdit: scheduleActions?.onEdit ? () => scheduleActions.onEdit!(item.blockId!) : undefined,
        onDelete: scheduleActions?.onDelete ? () => scheduleActions.onDelete!(item.blockId!) : undefined,
        onDuplicate: scheduleActions?.onDuplicate ? () => scheduleActions.onDuplicate!(item.blockId!) : undefined,
        onJumpToDay: jump,
      };
    }
    if (item.noteId) {
      return {
        onEdit: eventActions?.onEdit ? () => eventActions.onEdit!(item.noteId!) : undefined,
        onDelete: eventActions?.onDelete ? () => eventActions.onDelete!(item.noteId!) : undefined,
        onDuplicate: eventActions?.onDuplicate ? () => eventActions.onDuplicate!(item.noteId!) : undefined,
        onJumpToDay: jump,
      };
    }
    return { onJumpToDay: jump };
  }, [scheduleActions, eventActions, onDateSelect]);

  return (
    <>
      <div className="flex flex-col gap-1.5" data-k108-planner-upcoming-tier data-planner-upcoming-groups>
        {sections.map(section => (
          <section key={section.tier} data-k108-upcoming-tier={section.tier}>
            {section.tier === 'later' ? (
              <h4 className="text-[10px] font-black uppercase tracking-wide text-muted mb-1.5">
                {section.tierLabel}
              </h4>
            ) : null}
            <div className="flex flex-col gap-1">
              {section.days.map(group => (
                <DayGroup
                  key={group.dateKey}
                  group={group}
                  scheduleActions={scheduleActions}
                  eventActions={eventActions}
                  onDateSelect={onDateSelect}
                  onOpenMenu={openMenu}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <AgendaItemActionMenu
        open={menu != null}
        anchor={menu?.anchor ?? null}
        title={menu?.item.title ?? ''}
        onClose={() => setMenu(null)}
        {...(menu ? resolveMenuActions(menu.item, menu.dateKey) : {})}
      />
    </>
  );
}
