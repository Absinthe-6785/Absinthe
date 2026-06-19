/**
 * K-117 — Planner density audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

export function auditPlannerDensity(): Record<string, boolean> {
  const month = readFileSync(join(ROOT, 'features/planner/calendar-ui/month/MonthCalendarView.tsx'), 'utf8');
  const upcoming = readFileSync(join(ROOT, 'features/planner/calendar-ui/agenda/UpcomingAgendaPanel.tsx'), 'utf8');
  const timetable = readFileSync(join(ROOT, 'features/planner/WeeklyTimetableSection.tsx'), 'utf8');
  return {
    compactSectionGap: month.includes('gap-1.5 lg:gap-2'),
    upcomingCollapseEmpty: upcoming.includes('collapseWhenEmpty'),
    upcomingMaxHeight: upcoming.includes('max-h-[200px]'),
    adaptiveCalendar: month.includes('data-k117-planner-calendar-adaptive'),
    compactTimetable: timetable.includes('sectionEmbedded') && timetable.includes('min-h-[140px]'),
  };
}

export function auditDensityRc(): boolean {
  const r = auditPlannerDensity();
  return r.compactSectionGap && r.upcomingCollapseEmpty && r.adaptiveCalendar;
}
