import type { PlannerCalendarViewMode } from '../calendar';

export const DEFAULT_PLANNER_CALENDAR_MODE: PlannerCalendarViewMode = 'day';

/** Day-first tab order — matches default planner entry (K-32.1). */
export const PLANNER_CALENDAR_MODES: readonly PlannerCalendarViewMode[] = [
  'day',
  'week',
  'month',
  'agenda',
] as const;

export interface CalendarPlaceholderSummary {
  headline: string;
  lines: readonly string[];
  isEmpty: boolean;
}

export interface CalendarShellViewPlaceholderProps {
  mode: PlannerCalendarViewMode;
  summary: CalendarPlaceholderSummary;
  periodLabel: string;
}
