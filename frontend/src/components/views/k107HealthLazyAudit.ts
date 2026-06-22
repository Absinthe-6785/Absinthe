/**
 * K-107 — Lazy health sections audit.
 */
export const K107_LAZY_SECTIONS = [
  { id: 'analytics', hook: 'data-k107-health-analytics', gate: 'analyticsCollapsed + IntersectionObserver' },
  { id: 'charts', hook: 'data-k107-health-charts-toggle', gate: 'chartsCollapsed + visible' },
  { id: 'pr-section', hook: 'data-k107-health-virtual-list=pr-list', gate: 'prSectionCollapsed' },
  { id: 'calendar-immediate', hook: 'data-k107-health-calendar-panel', gate: 'immediate mount (K-125C)' },
  { id: 'supporting-panels', hook: 'data-k107-health-supporting-panels', gate: 'IntersectionObserver' },
  { id: 'nutrition-tab', hook: 'healthSection===nutrition', gate: 'tab inactive = no mount' },
] as const;

export function auditHealthLazySections(): readonly string[] {
  return K107_LAZY_SECTIONS.map(s => s.hook);
}

export function auditHealthLazyNutritionGate(): boolean {
  return K107_LAZY_SECTIONS.some(s => s.id === 'nutrition-tab');
}
