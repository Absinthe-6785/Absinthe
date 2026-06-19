/**
 * K-117 — Unified Schedule workspace IA audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEDULE_SECTIONS } from './features/planner/ScheduleSectionNav';

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

export function auditScheduleUnifiedWorkspace(): Record<string, boolean> {
  const planner = readFileSync(join(ROOT, 'PlannerView.tsx'), 'utf8');
  const month = readFileSync(join(ROOT, 'features/planner/calendar-ui/month/MonthCalendarView.tsx'), 'utf8');
  return {
    noWorkspaceTabSwitch: !planner.includes('ScheduleWorkspaceNav'),
    noTimetableTabState: !planner.includes("workspaceSection === 'timetable'"),
    hasSectionNav: planner.includes('ScheduleSectionNav'),
    hasStickyNewEvent: planner.includes('data-k117-new-event-btn'),
    hasUnifiedWorkspaceHook: month.includes('data-k117-schedule-workspace'),
    sectionCount: SCHEDULE_SECTIONS.length === 5,
    embeddedTimetable: month.includes('data-k117-schedule-section="timetable"'),
  };
}

export function auditScheduleRc(): boolean {
  const r = auditScheduleUnifiedWorkspace();
  return r.noWorkspaceTabSwitch && r.hasSectionNav && r.hasUnifiedWorkspaceHook && r.embeddedTimetable;
}
