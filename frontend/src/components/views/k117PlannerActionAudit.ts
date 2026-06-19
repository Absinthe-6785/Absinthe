/**
 * K-117 — Single primary planner action audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

export const K117_PLANNER_ADD_REMOVED_SURFACES = [
  'PlannerView dayScheduleActions onAdd',
] as const;

export function auditPlannerSingleAddAction(): Record<string, boolean> {
  const planner = readFileSync(join(ROOT, 'PlannerView.tsx'), 'utf8');
  const sticky = readFileSync(join(ROOT, 'features/planner/PlannerStickyActions.tsx'), 'utf8');
  return {
    stickyActionsHook: sticky.includes('data-k117-planner-sticky-actions'),
    newEventBtn: sticky.includes('data-k117-new-event-btn'),
    plannerNoOnAdd: !planner.includes('onAdd: () => openModal'),
    cardActionsHaveCrud: planner.includes('onDuplicate: handleDuplicateSchedule'),
    compactToolbar: sticky.includes('data-k121-schedule-toolbar'),
  };
}

export function auditPlannerActionRc(): boolean {
  const r = auditPlannerSingleAddAction();
  return r.stickyActionsHook && r.newEventBtn && r.plannerNoOnAdd && r.compactToolbar;
}
