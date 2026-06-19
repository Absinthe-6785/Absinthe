/**
 * K-121 — Schedule toolbar cleanup audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditScheduleToolbarCleanup(): Record<string, boolean> {
  const sticky = readFileSync(join(ROOT, 'components/views/features/planner/PlannerStickyActions.tsx'), 'utf8');
  const planner = readFileSync(join(ROOT, 'components/views/PlannerView.tsx'), 'utf8');
  return {
    toolbarHook: sticky.includes('data-k121-schedule-toolbar'),
    newEventHook: sticky.includes('data-k121-schedule-new-event'),
    noWorkspaceToolbarBar: !sticky.includes('WorkspaceToolbar'),
    noFullWidthPrimary: !sticky.includes('WorkspaceToolbarPrimary'),
    singleNewEvent: sticky.includes('k117NewEvent') || sticky.includes('New Event'),
    touchTarget: sticky.includes('UI_INTERACTION.touchTargetMinPx'),
    plannerWiresSticky: planner.includes('PlannerStickyActions'),
  };
}

export function auditScheduleToolbarRc(): boolean {
  const r = auditScheduleToolbarCleanup();
  return Object.values(r).every(Boolean);
}
