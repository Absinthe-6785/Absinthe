import type {
  PlannerCountdownRow,
  PlannerEventOccurrence,
  PlannerMonthCellPayload,
  PlannerScheduleRow,
} from '../../calendar';

export const MONTH_CELL_MAX_VISIBLE_EVENTS = 3;
export const MONTH_CELL_MAX_VISIBLE_BLOCKS = 2;
export const MONTH_CELL_MAX_VISIBLE_COUNTDOWNS = 1;

const EMPTY_COUNTDOWNS: readonly PlannerCountdownRow[] = [];

type MonthCellEventPresentation = Pick<PlannerEventOccurrence,
  'occurrenceId' | 'noteId' | 'title' | 'spanPosition' | 'isAllDay' | 'startTime' | 'endTime'>;

type MonthCellBlockPresentation = Pick<PlannerScheduleRow,
  'id' | 'title' | 'startTime' | 'category' | 'color'>;

type MonthCellCountdownPresentation = Pick<PlannerCountdownRow, 'id' | 'title'>;

export interface MonthCellCountdownRow {
  countdown: MonthCellCountdownPresentation;
  label: string;
}

export interface MonthCellEventRow {
  occurrence: MonthCellEventPresentation;
  showTitle: boolean;
}

export interface MonthCellBlockRow {
  block: MonthCellBlockPresentation;
}

export interface MonthCellDisplayModel {
  dateKey: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isAnchorSelected: boolean;
  eventRows: readonly MonthCellEventRow[];
  blockRows: readonly MonthCellBlockRow[];
  countdownRows: readonly MonthCellCountdownRow[];
  overflowCount: number;
  milestoneCount: number;
  isEmpty: boolean;
}

export function buildMonthCellDisplayModel(
  cell: PlannerMonthCellPayload,
  countdowns: readonly PlannerCountdownRow[] = EMPTY_COUNTDOWNS,
  formatCountdownLabel: (daysUntil: number) => string = d => `D-${d}`,
): MonthCellDisplayModel {
  const dateCountdowns = countdowns.filter(countdown => countdown.targetDate === cell.dateKey);
  return buildMonthCellDisplayModelFromDateCandidates(cell, dateCountdowns, formatCountdownLabel);
}

/** Builds a month in one countdown pass, keeping the temporary index local to this call. */
export function buildMonthCellDisplayModels(
  cells: readonly PlannerMonthCellPayload[],
  countdowns: readonly PlannerCountdownRow[] = EMPTY_COUNTDOWNS,
  formatCountdownLabel: (daysUntil: number) => string = d => `D-${d}`,
  previousModels?: readonly MonthCellDisplayModel[],
): MonthCellDisplayModel[] {
  const cellDates = new Set(cells.map(cell => cell.dateKey));
  const countdownsByDate = new Map<string, PlannerCountdownRow[]>();

  for (const countdown of countdowns) {
    const dateKey = countdown.targetDate;
    if (!cellDates.has(dateKey)) continue;

    const dateCountdowns = countdownsByDate.get(dateKey);
    if (dateCountdowns) {
      dateCountdowns.push(countdown);
    } else {
      countdownsByDate.set(dateKey, [countdown]);
    }
  }

  return cells.map((cell, index) => {
    const dateCountdowns = countdownsByDate.get(cell.dateKey) ?? EMPTY_COUNTDOWNS;
    const previous = previousModels?.[index];
    if (previous && monthCellDisplayModelMatches(previous, cell, dateCountdowns, formatCountdownLabel)) {
      return previous;
    }
    return buildMonthCellDisplayModelFromDateCandidates(cell, dateCountdowns, formatCountdownLabel);
  });
}

function monthCellDisplayModelMatches(
  model: MonthCellDisplayModel,
  cell: PlannerMonthCellPayload,
  dateCountdowns: readonly PlannerCountdownRow[],
  formatCountdownLabel: (daysUntil: number) => string,
): boolean {
  const events = cell.bundle.events;
  const blocks = cell.bundle.blocks;
  const milestoneCount = cell.bundle.hints.milestoneCount;
  const eventOverflow = Math.max(0, events.length - MONTH_CELL_MAX_VISIBLE_EVENTS);
  const blockOverflow = Math.max(0, blocks.length - MONTH_CELL_MAX_VISIBLE_BLOCKS);
  const overflowCount = eventOverflow + blockOverflow;

  if (model.dateKey !== cell.dateKey
    || model.day !== cell.day
    || model.inMonth !== cell.inMonth
    || model.isToday !== cell.isToday
    || model.isAnchorSelected !== cell.isAnchorSelected
    || model.overflowCount !== overflowCount
    || model.milestoneCount !== milestoneCount
    || model.eventRows.length !== Math.min(events.length, MONTH_CELL_MAX_VISIBLE_EVENTS)
    || model.blockRows.length !== Math.min(blocks.length, MONTH_CELL_MAX_VISIBLE_BLOCKS)) {
    return false;
  }

  for (let index = 0; index < model.eventRows.length; index += 1) {
    const row = model.eventRows[index]!;
    const occurrence = events[index]!;
    if (row.showTitle !== (occurrence.spanPosition === 'single' || occurrence.spanPosition === 'start')
      || row.occurrence.occurrenceId !== occurrence.occurrenceId
      || row.occurrence.noteId !== occurrence.noteId
      || row.occurrence.title !== occurrence.title
      || row.occurrence.spanPosition !== occurrence.spanPosition
      || row.occurrence.isAllDay !== occurrence.isAllDay
      || row.occurrence.startTime !== occurrence.startTime
      || row.occurrence.endTime !== occurrence.endTime) {
      return false;
    }
  }

  for (let index = 0; index < model.blockRows.length; index += 1) {
    const row = model.blockRows[index]!.block;
    const block = blocks[index]!;
    if (row.id !== block.id
      || row.title !== block.title
      || row.startTime !== block.startTime
      || row.category !== block.category
      || row.color !== block.color) {
      return false;
    }
  }

  let visibleCountdownIndex = 0;
  if (dateCountdowns.length > 0) {
    const eventNoteIds = new Set(events.map(event => event.noteId));
    for (const countdown of dateCountdowns) {
      if (eventNoteIds.has(countdown.sourceRefId)) continue;
      if (visibleCountdownIndex >= MONTH_CELL_MAX_VISIBLE_COUNTDOWNS) break;
      const row = model.countdownRows[visibleCountdownIndex];
      if (!row
        || row.countdown.id !== countdown.id
        || row.countdown.title !== countdown.title
        || row.label !== formatCountdownLabel(countdown.daysUntil)) {
        return false;
      }
      visibleCountdownIndex += 1;
    }
  }

  const isEmpty = events.length === 0
    && blocks.length === 0
    && milestoneCount === 0
    && visibleCountdownIndex === 0;
  return model.countdownRows.length === visibleCountdownIndex && model.isEmpty === isEmpty;
}

function buildMonthCellDisplayModelFromDateCandidates(
  cell: PlannerMonthCellPayload,
  dateCountdowns: readonly PlannerCountdownRow[],
  formatCountdownLabel: (daysUntil: number) => string,
): MonthCellDisplayModel {
  const visibleOccurrences = cell.bundle.events.slice(0, MONTH_CELL_MAX_VISIBLE_EVENTS);
  const eventRows: MonthCellEventRow[] = visibleOccurrences.map(occurrence => ({
    occurrence: {
      occurrenceId: occurrence.occurrenceId,
      noteId: occurrence.noteId,
      title: occurrence.title,
      spanPosition: occurrence.spanPosition,
      isAllDay: occurrence.isAllDay,
      startTime: occurrence.startTime,
      endTime: occurrence.endTime,
    },
    showTitle: occurrence.spanPosition === 'single' || occurrence.spanPosition === 'start',
  }));

  const blockRows: MonthCellBlockRow[] = cell.bundle.blocks
    .slice(0, MONTH_CELL_MAX_VISIBLE_BLOCKS)
    .map(block => ({
      block: {
        id: block.id,
        title: block.title,
        startTime: block.startTime,
        category: block.category,
        color: block.color,
      },
    }));

  const eventNoteIds = new Set(cell.bundle.events.map(event => event.noteId));
  const cellCountdowns = dateCountdowns
    .filter(countdown => !eventNoteIds.has(countdown.sourceRefId))
    .slice(0, MONTH_CELL_MAX_VISIBLE_COUNTDOWNS);
  const countdownRows: MonthCellCountdownRow[] = cellCountdowns.map(countdown => ({
    countdown: { id: countdown.id, title: countdown.title },
    label: formatCountdownLabel(countdown.daysUntil),
  }));

  const milestoneCount = cell.bundle.hints.milestoneCount;
  const eventOverflow = Math.max(0, cell.bundle.events.length - MONTH_CELL_MAX_VISIBLE_EVENTS);
  const blockOverflow = Math.max(0, cell.bundle.blocks.length - MONTH_CELL_MAX_VISIBLE_BLOCKS);
  const overflowCount = eventOverflow + blockOverflow;
  const isEmpty = cell.bundle.events.length === 0
    && cell.bundle.blocks.length === 0
    && milestoneCount === 0
    && countdownRows.length === 0;

  return {
    dateKey: cell.dateKey,
    day: cell.day,
    inMonth: cell.inMonth,
    isToday: cell.isToday,
    isAnchorSelected: cell.isAnchorSelected,
    eventRows,
    blockRows,
    countdownRows,
    overflowCount,
    milestoneCount,
    isEmpty,
  };
}

export function formatMonthOverflowLabel(overflowCount: number): string | null {
  if (overflowCount <= 0) return null;
  return overflowCount === 1 ? '+1 more' : `+${overflowCount} more`;
}

export function chunkMonthCells<T>(cells: readonly T[], columns = 7): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < cells.length; index += columns) {
    rows.push(cells.slice(index, index + columns) as T[]);
  }
  return rows;
}

export function monthGridHasAnchors(cells: readonly PlannerMonthCellPayload[]): boolean {
  return cells.some(cell =>
    cell.bundle.events.length > 0
    || cell.bundle.blocks.length > 0
    || cell.bundle.hints.milestoneCount > 0,
  );
}

export function spanPositionClass(spanPosition: PlannerMonthCellPayload['bundle']['events'][number]['spanPosition']): string {
  switch (spanPosition) {
    case 'start':
      return 'rounded-l-md rounded-r-none';
    case 'middle':
      return 'rounded-none';
    case 'end':
      return 'rounded-r-md rounded-l-none';
    default:
      return 'rounded-md';
  }
}
