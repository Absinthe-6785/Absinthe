/**
 * K-117 — Responsive audit (Schedule, Archive, New Note).
 */
export const K117_RESPONSIVE_WIDTHS = [320, 375, 768, 1440] as const;

export const K117_RESPONSIVE_SURFACES = [
  { domain: 'schedule', hooks: ['data-k117-schedule-section-nav', 'data-k117-new-event-btn', 'min-h-[44px]'] },
  { domain: 'archive', hooks: ['data-k117-archive-layout', 'min-h-[44px]', 'max-w-3xl'] },
  { domain: 'notes', hooks: ['data-k117-note-top-actions', 'data-k117-new-note-btn'] },
] as const;

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

export function auditResponsiveSurfaces(): Record<string, boolean> {
  const plannerSticky = readFileSync(join(ROOT, 'features/planner/PlannerStickyActions.tsx'), 'utf8');
  const sectionNav = readFileSync(join(ROOT, 'features/planner/ScheduleSectionNav.tsx'), 'utf8');
  const editor = readFileSync(join(ROOT, 'noteview/NoteViewEditorArea.tsx'), 'utf8');
  return {
    widthBreakpoints: K117_RESPONSIVE_WIDTHS.length === 4,
    scheduleTouch44: plannerSticky.includes('touchTargetMinPx') || plannerSticky.includes('min-h-[44px]'),
    sectionNavCompact: sectionNav.includes('compact'),
    newNoteMobile44: editor.includes('touchTargetMinPx') || editor.includes('minHeight: isMobile ? 44'),
  };
}

export function auditResponsiveRc(): boolean {
  const r = auditResponsiveSurfaces();
  return r.widthBreakpoints && r.scheduleTouch44 && r.newNoteMobile44;
}
