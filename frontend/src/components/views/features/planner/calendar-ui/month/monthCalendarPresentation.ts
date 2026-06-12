import type { PlannerCountdownRow, PlannerEventOccurrence, PlannerMonthCellPayload } from '../../calendar';

export const MONTH_CELL_MAX_VISIBLE_EVENTS = 2;

export interface MonthCellEventRow {
  occurrence: PlannerEventOccurrence;
  showTitle: boolean;
}

export interface MonthCellDisplayModel {
  dateKey: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isAnchorSelected: boolean;
  eventRows: readonly MonthCellEventRow[];
  overflowCount: number;
  milestoneCount: number;
  legacyDdayCountdowns: readonly PlannerCountdownRow[];
  isEmpty: boolean;
}

export function buildMonthCellDisplayModel(
  cell: PlannerMonthCellPayload,
  legacyDdayCountdowns: readonly PlannerCountdownRow[],
): MonthCellDisplayModel {
  const visibleOccurrences = cell.bundle.events.slice(0, MONTH_CELL_MAX_VISIBLE_EVENTS);
  const eventRows: MonthCellEventRow[] = visibleOccurrences.map(occurrence => ({
    occurrence,
    showTitle: occurrence.spanPosition === 'single' || occurrence.spanPosition === 'start',
  }));

  const milestoneCount = cell.bundle.hints.milestoneCount;
  const overflowCount = cell.bundle.hints.overflowEventCount;
  const isEmpty = cell.bundle.events.length === 0
    && milestoneCount === 0
    && legacyDdayCountdowns.length === 0;

  return {
    dateKey: cell.dateKey,
    day: cell.day,
    inMonth: cell.inMonth,
    isToday: cell.isToday,
    isAnchorSelected: cell.isAnchorSelected,
    eventRows,
    overflowCount,
    milestoneCount,
    legacyDdayCountdowns,
    isEmpty,
  };
}

export function groupLegacyDdayCountdownsByDate(
  countdowns: readonly PlannerCountdownRow[],
): ReadonlyMap<string, readonly PlannerCountdownRow[]> {
  const map = new Map<string, PlannerCountdownRow[]>();

  for (const countdown of countdowns) {
    if (countdown.source !== 'legacy-dday') continue;
    const bucket = map.get(countdown.targetDate);
    if (bucket) bucket.push(countdown);
    else map.set(countdown.targetDate, [countdown]);
  }

  return map;
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
    || cell.bundle.hints.milestoneCount > 0,
  );
}

export function spanPositionClass(spanPosition: PlannerEventOccurrence['spanPosition']): string {
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
