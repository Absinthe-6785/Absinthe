import type { Routine, Todo } from '../../../../../../types';
import type { PlannerDayViewPayload } from '../../calendar';

export interface DayActivityItem {
  id: string;
  timeLabel: string;
  title: string;
  kind: 'event' | 'schedule' | 'milestone';
}

export interface DayDisplayModel {
  dateKey: string;
  isToday: boolean;
  isRoutineException: boolean;
  allDayEvents: PlannerDayViewPayload['allDayEvents'];
  timedEvents: PlannerDayViewPayload['timedEvents'];
  timelineBlocks: PlannerDayViewPayload['timeline']['blocks'];
  carryOverBlocks: PlannerDayViewPayload['timeline']['carryOverBlocks'];
  templateSlots: PlannerDayViewPayload['bundle']['weeklySlots'];
  routines: PlannerDayViewPayload['bundle']['routines'];
  todos: PlannerDayViewPayload['bundle']['todos'];
  milestoneCount: number;
  isEmpty: boolean;
}

export function formatDayTimeRange(startTime: string, endTime: string): string {
  return `${startTime}–${endTime}`;
}

export function buildDayDisplayModel(day: PlannerDayViewPayload): DayDisplayModel {
  const milestoneCount = day.bundle.hints.milestoneCount;
  const isEmpty = day.allDayEvents.length === 0
    && day.timedEvents.length === 0
    && day.timeline.blocks.length === 0
    && day.timeline.carryOverBlocks.length === 0
    && day.bundle.weeklySlots.length === 0
    && day.bundle.routines.length === 0
    && day.bundle.todos.length === 0
    && milestoneCount === 0;

  return {
    dateKey: day.dateKey,
    isToday: day.isToday,
    isRoutineException: day.bundle.isRoutineException,
    allDayEvents: day.allDayEvents,
    timedEvents: day.timedEvents,
    timelineBlocks: day.timeline.blocks,
    carryOverBlocks: day.timeline.carryOverBlocks,
    templateSlots: day.bundle.weeklySlots,
    routines: day.bundle.routines,
    todos: day.bundle.todos,
    milestoneCount,
    isEmpty,
  };
}

export function dayHasContent(day: PlannerDayViewPayload): boolean {
  return !buildDayDisplayModel(day).isEmpty;
}

export function formatDayRoutineSummary(routines: readonly Routine[]): string | null {
  if (routines.length === 0) return null;
  const done = routines.filter(routine => routine.done).length;
  return `${done}/${routines.length} routines complete`;
}

export function formatDayTodoSummary(todos: readonly Todo[]): string | null {
  if (todos.length === 0) return null;
  const done = todos.filter(todo => todo.done).length;
  return `${done}/${todos.length} todos done`;
}

/** Chronological activity feed for today's events and schedule blocks. */
export function buildDayActivityItems(day: PlannerDayViewPayload): DayActivityItem[] {
  const items: DayActivityItem[] = [];

  for (const event of day.timedEvents) {
    items.push({
      id: `event:${event.occurrenceId}`,
      timeLabel: event.startTime ?? '—',
      title: event.title,
      kind: 'event',
    });
  }

  for (const block of day.timeline.blocks) {
    items.push({
      id: `block:${block.id}`,
      timeLabel: block.startTime,
      title: block.title,
      kind: 'schedule',
    });
  }

  for (const event of day.allDayEvents) {
    items.push({
      id: `allday:${event.occurrenceId}`,
      timeLabel: 'All day',
      title: event.title,
      kind: 'event',
    });
  }

  items.sort((a, b) => a.timeLabel.localeCompare(b.timeLabel));
  return items.slice(0, 8);
}
