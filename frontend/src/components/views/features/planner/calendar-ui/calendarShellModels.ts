import type { PlannerCalendarViewMode } from '../calendar';

export const DEFAULT_PLANNER_CALENDAR_MODE: PlannerCalendarViewMode = 'month';

export const PLANNER_CALENDAR_MODES: readonly PlannerCalendarViewMode[] = [
  'month',
  'week',
  'day',
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
