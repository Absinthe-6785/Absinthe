/**
 * K-107 — Health list virtualization audit.
 */
export const K107_VIRTUAL_LISTS = [
  { surface: 'block-library', hook: 'data-k107-health-block-library', threshold: 48 },
  { surface: 'recent-sessions', hook: 'data-k107-health-virtual-list=recent-sessions', threshold: 24 },
  { surface: 'pr-list', hook: 'data-k107-health-virtual-list=pr-list', threshold: 24 },
  { surface: 'exercise-history', hook: 'data-k107-health-virtual-list=exercise-history', threshold: 24 },
] as const;

export function auditHealthVirtualization(): readonly string[] {
  return K107_VIRTUAL_LISTS.map(v => v.hook);
}

export function auditHealthVirtualizationThresholds(): Record<string, number> {
  return Object.fromEntries(K107_VIRTUAL_LISTS.map(v => [v.surface, v.threshold]));
}
