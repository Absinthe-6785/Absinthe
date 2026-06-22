/**
 * K-125B — Schedule IA reorder audit (routine-first vertical flow).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEDULE_SECTIONS } from './features/planner/ScheduleSectionNav';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const K125B_SCHEDULE_SECTION_ORDER = [
  'routine',
  'today',
  'timetable',
  'calendar',
  'upcoming',
] as const;

export function auditK125bScheduleIa(): Record<string, boolean> {
  const month = readFileSync(join(ROOT, 'components/views/features/planner/calendar-ui/month/MonthCalendarView.tsx'), 'utf8');
  const nav = readFileSync(join(ROOT, 'components/views/features/planner/ScheduleSectionNav.tsx'), 'utf8');
  const routine = readFileSync(join(ROOT, 'components/views/features/planner/calendar-ui/agenda/PlannerRoutineTodayCard.tsx'), 'utf8');
  const upcoming = readFileSync(join(ROOT, 'components/views/features/planner/calendar-ui/agenda/UpcomingAgendaPanel.tsx'), 'utf8');
  const timetable = readFileSync(join(ROOT, 'components/views/features/planner/WeeklyTimetableSection.tsx'), 'utf8');

  const navOrder = SCHEDULE_SECTIONS.map(s => s.id);
  const routineIdx = month.indexOf('data-k117-schedule-section="routine"');
  const todayIdx = month.indexOf('data-k117-schedule-section="today"');
  const timetableIdx = month.indexOf('data-k117-schedule-section="timetable"');
  const calendarIdx = month.indexOf('data-k117-schedule-section="calendar"');
  const upcomingIdx = month.indexOf('data-k117-schedule-section="upcoming"');

  return {
    navOrder: JSON.stringify(navOrder) === JSON.stringify(K125B_SCHEDULE_SECTION_ORDER),
    domRoutineBeforeToday: routineIdx >= 0 && todayIdx > routineIdx,
    domTodayBeforeTimetable: todayIdx >= 0 && timetableIdx > todayIdx,
    domTimetableBeforeCalendar: timetableIdx >= 0 && calendarIdx > timetableIdx,
    domCalendarBeforeUpcoming: calendarIdx >= 0 && upcomingIdx > calendarIdx,
    verticalStack: month.includes('data-k125b-schedule-ia') && !month.includes('lg:grid-rows-[minmax(0,28%)'),
    orderMarkers: month.includes('data-k125b-schedule-order="1"') && month.includes('data-k125b-schedule-order="5"'),
    emptyUpcomingHidden: month.includes('const hasUpcoming') && month.includes("className={hasUpcoming ? 'shrink-0' : 'hidden'}"),
    routineEmptyCompact: routine.includes('data-k125b-routine-empty-compact'),
    upcomingNoEmbeddedCta: upcoming.includes('canAdd && !embedded'),
    timetableIconAddEmbedded: timetable.includes('data-k121-timetable-add-compact') && timetable.includes('aria-label'),
    navSyncHook: nav.includes('data-k125b-schedule-section-nav'),
    scrollSkipsHidden: nav.includes("el.classList.contains('hidden')"),
  };
}

export function auditK125bScheduleIaRc(): boolean {
  return Object.values(auditK125bScheduleIa()).every(Boolean);
}
