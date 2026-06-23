/**
 * K-124c — Schedule density recovery after the K-117 unified workspace.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditScheduleDensityRecovery(): Record<string, boolean> {
  const month = readFileSync(join(ROOT, 'components/views/features/planner/calendar-ui/month/MonthCalendarView.tsx'), 'utf8');
  const upcoming = readFileSync(join(ROOT, 'components/views/features/planner/calendar-ui/agenda/UpcomingAgendaPanel.tsx'), 'utf8');
  const tiers = readFileSync(join(ROOT, 'components/views/features/planner/calendar-ui/agenda/UpcomingTierGroupList.tsx'), 'utf8');
  const routine = readFileSync(join(ROOT, 'components/views/features/planner/calendar-ui/agenda/PlannerRoutineTodayCard.tsx'), 'utf8');
  const timetable = readFileSync(join(ROOT, 'components/views/features/planner/WeeklyTimetableSection.tsx'), 'utf8');

  return {
    emptyUpcomingRemoved: month.includes('const hasUpcoming')
      && month.includes("className={hasUpcoming ? undefined : 'hidden'}")
      && month.includes('data-k124c-upcoming-empty-hidden')
      && !month.includes('collapseWhenEmpty'),
    tighterSectionRhythm: month.includes('flex flex-col gap-2 items-stretch')
      && month.includes('lg:grid-rows-[auto_auto_minmax(0,1fr)]')
      && month.includes('data-k121-schedule-agenda')
      && month.includes("lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]")
      && month.indexOf('data-k117-schedule-section="timetable"') < month.indexOf('data-k117-schedule-section="calendar"')
      && month.includes('hasRoutineToday'),
    upcomingHeightReduced: upcoming.includes('max-h-[200px]'),
    upcomingGapsReduced: tiers.includes('flex flex-col gap-1.5')
      && tiers.includes('flex flex-col gap-1'),
    routineNoDuplicateMargin: routine.includes('<section data-k108-planner-routine-today>'),
    compactEmptyTimetable: timetable.includes("min-h-[64px]")
      && timetable.includes('data-k124c-timetable-empty-compact')
      && !timetable.includes("!hasActivities && sectionEmbedded ? 'min-h-[120px]'"),
    compactEmbeddedTimetable: timetable.includes("hasActivities ? 'min-h-[140px]'")
      && timetable.includes("sectionEmbedded ? 'rounded-[14px] lg:rounded-[16px] p-2.5 lg:p-3'"),
  };
}

export function auditScheduleDensityRecoveryRc(): boolean {
  return Object.values(auditScheduleDensityRecovery()).every(Boolean);
}
