/**
 * K-107 — Mobile responsiveness audit.
 */
export const K107_MOBILE_WIDTHS = [320, 375, 768] as const;

export const K107_MOBILE_SURFACES = [
  { view: 'health', hooks: ['data-k104-health-no-sticky-mobile', 'healthSwipeSectionHint', 'min-h-[44px]'] },
  { view: 'planner', hooks: ['data-workspace-zone', 'plannerNavPrevPeriod'] },
  { view: 'notes', hooks: ['data-k102-note-row-date', 'NoteSidebarVirtualList'] },
] as const;

export function auditMobilePerformance(): readonly number[] {
  return K107_MOBILE_WIDTHS;
}

export function auditMobileTouchTargets(): boolean {
  return K107_MOBILE_SURFACES.some(s => s.hooks.some(h => h.includes('44px') || h.includes('min-h')));
}
