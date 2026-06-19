/**
 * K-117 — Schedule event CRUD audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

export function auditEventCrud(): Record<string, boolean> {
  const detail = readFileSync(join(ROOT, 'features/planner/calendar-ui/day/ScheduleEventDetailPanel.tsx'), 'utf8');
  const timeline = readFileSync(join(ROOT, 'features/planner/calendar-ui/day/DayScheduleTimeline.tsx'), 'utf8');
  const planner = readFileSync(join(ROOT, 'PlannerView.tsx'), 'utf8');
  return {
    detailEdit: detail.includes('data-schedule-event-edit'),
    detailDuplicate: detail.includes('data-schedule-event-duplicate'),
    detailDelete: detail.includes('data-schedule-event-delete'),
    detailEscape: detail.includes("e.key === 'Escape'"),
    detailEnter: detail.includes("e.key === 'Enter'"),
    cardDuplicate: timeline.includes('data-planner-day-schedule-duplicate'),
    modalForm: planner.includes('editSchedule') && planner.includes('k76ScheduleDate'),
  };
}

export function auditEventCrudRc(): boolean {
  const r = auditEventCrud();
  return r.detailEdit && r.detailDuplicate && r.detailDelete && r.cardDuplicate;
}
