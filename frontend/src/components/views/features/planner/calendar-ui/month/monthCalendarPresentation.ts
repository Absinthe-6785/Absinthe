import type { PlannerMonthCellPayload } from '../../calendar';

export const MONTH_CELL_MAX_VISIBLE_EVENTS = 2;

export interface MonthCellEventRow {
  occurrence: PlannerMonthCellPayload['bundle']['events'][number];
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
  isEmpty: boolean;
}

export function buildMonthCellDisplayModel(
  cell: PlannerMonthCellPayload,
): MonthCellDisplayModel {
  const visibleOccurrences = cell.bundle.events.slice(0, MONTH_CELL_MAX_VISIBLE_EVENTS);
  const eventRows: MonthCellEventRow[] = visibleOccurrences.map(occurrence => ({
    occurrence,
    showTitle: occurrence.spanPosition === 'single' || occurrence.spanPosition === 'start',
  }));

  const milestoneCount = cell.bundle.hints.milestoneCount;
  const overflowCount = cell.bundle.hints.overflowEventCount;
  const isEmpty = cell.bundle.events.length === 0 && milestoneCount === 0;

  return {
    dateKey: cell.dateKey,
    day: cell.day,
    inMonth: cell.inMonth,
    isToday: cell.isToday,
    isAnchorSelected: cell.isAnchorSelected,
    eventRows,
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
