import type { PlannerCalendarProjection, PlannerCalendarViewMode } from '../calendar';
import type { CalendarPlaceholderSummary } from './calendarShellModels';

const MODE_HEADLINES: Record<PlannerCalendarViewMode, string> = {
  month: 'Month View',
  week: 'Week View',
  day: 'Day View',
};

export function buildCalendarPlaceholderSummary(
  mode: PlannerCalendarViewMode,
  projection: PlannerCalendarProjection,
): CalendarPlaceholderSummary {
  const { core, views } = projection;

  switch (mode) {
    case 'month':
      return {
        headline: MODE_HEADLINES.month,
        lines: [
          `${views.month.cells.length} days loaded`,
          `${core.eventOccurrences.length} events`,
          `${core.scheduleBlocks.length} schedule blocks`,
        ],
        isEmpty: views.month.cells.length === 0
          && core.eventOccurrences.length === 0
          && core.scheduleBlocks.length === 0,
      };
    case 'week':
      return {
        headline: MODE_HEADLINES.week,
        lines: [
          `${views.week.columns.length} days in week`,
          `${core.eventOccurrences.length} events`,
          `${core.scheduleBlocks.length} schedule blocks`,
        ],
        isEmpty: views.week.columns.length === 0,
      };
    case 'day':
      return {
        headline: MODE_HEADLINES.day,
        lines: [
          `${views.day.timeline.blocks.length} schedule blocks`,
          `${views.day.allDayEvents.length + views.day.timedEvents.length} events`,
          `${core.countdowns.length} countdowns`,
        ],
        isEmpty: views.day.timeline.blocks.length === 0
          && views.day.allDayEvents.length === 0
          && views.day.timedEvents.length === 0,
      };
    default:
      return { headline: MODE_HEADLINES.month, lines: [], isEmpty: true };
  }
}

export function resolveCalendarPeriodLabel(
  mode: PlannerCalendarViewMode,
  presentation: { labels: {
    monthTitle: string;
    weekRangeLabel: string;
    dayHeading: string;
    agendaHorizonLabel: string;
  } },
): string {
  switch (mode) {
    case 'month':
      return presentation.labels.monthTitle;
    case 'week':
      return presentation.labels.weekRangeLabel;
    case 'day':
      return presentation.labels.dayHeading;
    default:
      return '';
  }
}
