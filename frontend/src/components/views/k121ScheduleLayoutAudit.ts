/**
 * K-121 — Schedule proportions / density audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditScheduleLayoutProportions(): Record<string, boolean> {
  const month = readFileSync(join(ROOT, 'components/views/features/planner/calendar-ui/month/MonthCalendarView.tsx'), 'utf8');
  const timetable = readFileSync(join(ROOT, 'components/views/features/planner/WeeklyTimetableSection.tsx'), 'utf8');
  const k125b = month.includes('data-k125b-schedule-ia');
  return {
    layoutHook: month.includes('data-k121-schedule-layout'),
    agenda30Calendar70: k125b
      || (month.includes('30%') && month.includes('70%'))
      || (month.includes('28%') && month.includes('72%')),
    agendaSection: k125b || month.includes('data-k121-schedule-agenda'),
    supportingSection: k125b || month.includes('data-k121-schedule-supporting'),
    timetableEmbedded: month.includes('sectionEmbedded'),
    collapsedEmptyHeight: timetable.includes('min-h-[64px]') || timetable.includes('min-h-0'),
    compactAddWhenEmbedded: timetable.includes('data-k121-timetable-add-compact'),
  };
}

export function auditScheduleLayoutRc(): boolean {
  const r = auditScheduleLayoutProportions();
  return Object.values(r).every(Boolean);
}
