import type { PlannerWeekColumnPayload, PlannerWeekViewPayload } from '../../calendar';

export interface WeekDayDisplayModel {
  dateKey: string;
  dayLabel: string;
  weekdayLabel: string;
  isToday: boolean;
  isAnchorDate: boolean;
  allDayEvents: PlannerWeekColumnPayload['allDayEvents'];
  timedEvents: PlannerWeekColumnPayload['timedEvents'];
  blocks: PlannerWeekColumnPayload['blocks'];
  templateSlots: PlannerWeekColumnPayload['templateSlots'];
  routineSummary: PlannerWeekColumnPayload['routineSummary'];
  milestoneCount: number;
  isEmpty: boolean;
}

export function extractDayLabelFromDateKey(dateKey: string): string {
  const day = dateKey.split('-')[2];
  if (!day) return dateKey;
  return String(parseInt(day, 10));
}

export function resolveTodayKeyFromProjection(generatedAt: string): string {
  return generatedAt.slice(0, 10);
}

export function buildWeekDayDisplayModel(
  column: PlannerWeekColumnPayload,
  weekdayLabel: string,
  todayKey: string,
  anchorDate: string,
): WeekDayDisplayModel {
  const milestoneCount = column.bundle.hints.milestoneCount;
  const isEmpty = column.allDayEvents.length === 0
    && column.timedEvents.length === 0
    && column.blocks.length === 0
    && column.templateSlots.length === 0
    && column.routineSummary == null
    && milestoneCount === 0;

  return {
    dateKey: column.dateKey,
    dayLabel: extractDayLabelFromDateKey(column.dateKey),
    weekdayLabel,
    isToday: column.dateKey === todayKey,
    isAnchorDate: column.dateKey === anchorDate,
    allDayEvents: column.allDayEvents,
    timedEvents: column.timedEvents,
    blocks: column.blocks,
    templateSlots: column.templateSlots,
    routineSummary: column.routineSummary,
    milestoneCount,
    isEmpty,
  };
}

export function buildWeekDayDisplayModels(
  week: PlannerWeekViewPayload,
  weekdayLabels: readonly string[],
  todayKey: string,
  anchorDate: string,
): WeekDayDisplayModel[] {
  return week.columns.map((column, index) =>
    buildWeekDayDisplayModel(
      column,
      weekdayLabels[column.bundle.weekday] ?? weekdayLabels[index] ?? '',
      todayKey,
      anchorDate,
    ),
  );
}

export function weekHasContent(columns: readonly PlannerWeekColumnPayload[]): boolean {
  return columns.some(column =>
    column.allDayEvents.length > 0
    || column.timedEvents.length > 0
    || column.blocks.length > 0
    || column.templateSlots.length > 0
    || column.routineSummary != null
    || column.bundle.hints.milestoneCount > 0,
  );
}

export function formatWeekRoutineSummary(
  summary: PlannerWeekColumnPayload['routineSummary'],
): string | null {
  if (!summary) return null;
  return `${summary.done}/${summary.total} routines`;
}

export function formatWeekTimeRange(startTime: string, endTime: string): string {
  return `${startTime}–${endTime}`;
}
