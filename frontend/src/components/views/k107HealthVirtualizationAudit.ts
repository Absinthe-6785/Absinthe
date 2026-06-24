/**
 * K-107 / K-134B Health list rendering audit.
 *
 * K-134B keeps these hooks but lets lists flow in the workspace scroll instead
 * of creating small nested scroll regions.
 */
export const K107_VIRTUAL_LISTS = [
  { surface: 'block-library', hook: 'data-k107-health-block-library', mode: 'natural' },
  { surface: 'recent-sessions', hook: 'data-k107-health-virtual-list=recent-sessions', mode: 'natural' },
  { surface: 'pr-list', hook: 'data-k107-health-virtual-list=pr-list', mode: 'natural' },
  { surface: 'exercise-history', hook: 'data-k107-health-virtual-list=exercise-history', mode: 'natural' },
] as const;

export function auditHealthVirtualization(): readonly string[] {
  return K107_VIRTUAL_LISTS.map(v => v.hook);
}

export function auditHealthVirtualizationThresholds(): Record<string, string> {
  return Object.fromEntries(K107_VIRTUAL_LISTS.map(v => [v.surface, v.mode]));
}
