/**
 * K-124c — Schedule density recovery after the K-117 unified workspace.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditScheduleDensityRecovery(): Record<string, boolean> {
  const month = readFileSync(join(ROOT, 'components/views/features/planner/calendar-ui/month/MonthCalendarView.tsx'), 'utf8');
  const cell = readFileSync(join(ROOT, 'components/views/features/planner/calendar-ui/month/MonthCalendarCell.tsx'), 'utf8');
  const shell = readFileSync(join(ROOT, 'components/views/features/planner/calendar-ui/CalendarShell.tsx'), 'utf8');
  const nav = readFileSync(join(ROOT, 'components/views/features/planner/ScheduleSectionNav.tsx'), 'utf8');
  const routine = readFileSync(join(ROOT, 'components/views/features/planner/calendar-ui/agenda/PlannerRoutineTodayCard.tsx'), 'utf8');
  const timetable = readFileSync(join(ROOT, 'components/views/features/planner/WeeklyTimetableSection.tsx'), 'utf8');

  return {
    planningFirstFlow: month.includes('data-k140-schedule-grid')
      && month.includes('data-k133b-schedule-flow')
      && month.indexOf('data-k117-schedule-section="calendar"') < month.indexOf('data-k117-schedule-section="today"')
      && month.indexOf('data-k117-schedule-section="today"') < month.indexOf('data-k117-schedule-section="timetable"')
      && month.indexOf('data-k117-schedule-section="timetable"') < month.indexOf('data-k139-schedule-dday-list')
      && !month.includes('data-k117-schedule-section="upcoming"'),
    calendarPrimary: shell.includes('calendarHeader={(')
      && month.includes('data-k133b-calendar-primary-nav')
      && month.includes('data-planner-primary-surface="calendar"')
      && !shell.includes('header={('),
    desktopSupportRail: month.includes('data-planner-desktop-allocation="planning-column-support-rail"')
      && month.includes('lg:grid-cols-[minmax(0,3fr)_minmax(240px,1fr)]')
      && month.includes('data-planner-support-role="today"')
      && month.includes('data-planner-support-role="dday"'),
    upcomingNavRemoved: !nav.includes("'upcoming'")
      && !nav.includes('k80UpcomingAgenda'),
    compactMonthCells: cell.includes('min-h-[52px] lg:min-h-0')
      && cell.includes('px-1 py-0.5 text-[9px]'),
    routineNoDuplicateMargin: routine.includes('<section data-k108-planner-routine-today>'),
    compactEmptyTimetable: timetable.includes('data-k124c-timetable-empty-compact')
      && timetable.includes('data-k139-current-time-line')
      && timetable.includes('data-planner-weekly-today')
      && !timetable.includes("!hasActivities && sectionEmbedded ? 'min-h-[120px]'"),
    compactEmbeddedTimetable: timetable.includes('data-k134b-timetable-compact')
      && timetable.includes("sectionEmbedded ? 'min-h-0'")
      && timetable.includes("sectionEmbedded ? 'grid gap-2 lg:grid-cols-2 xl:grid-cols-3'"),
  };
}

export function auditScheduleDensityRecoveryRc(): boolean {
  return Object.values(auditScheduleDensityRecovery()).every(Boolean);
}
