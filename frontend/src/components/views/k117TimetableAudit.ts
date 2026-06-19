/**
 * K-117 — Timetable inline section audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

export function auditTimetableInlineSection(): Record<string, boolean> {
  const planner = readFileSync(join(ROOT, 'PlannerView.tsx'), 'utf8');
  const month = readFileSync(join(ROOT, 'features/planner/calendar-ui/month/MonthCalendarView.tsx'), 'utf8');
  const timetable = readFileSync(join(ROOT, 'features/planner/WeeklyTimetableSection.tsx'), 'utf8');
  return {
    singleCalendarShell: (planner.match(/<CalendarShell/g) ?? []).length === 1,
    timetableInMonthView: month.includes('WeeklyTimetableSection') && month.includes('sectionEmbedded'),
    noStandaloneTab: !planner.includes('standalone'),
    embeddedHook: timetable.includes('data-k117-timetable-embedded'),
    routineSection: month.includes('data-k117-schedule-section="routine"'),
  };
}

export function auditTimetableRc(): boolean {
  const r = auditTimetableInlineSection();
  return r.singleCalendarShell && r.timetableInMonthView && r.embeddedHook;
}
