/** K-109 — Timeline cohesion audit. */
export const K109_TIMELINE_BUCKETS = ['today', 'thisWeek', 'thisMonth', 'earlier'] as const;

export const K109_TIMELINE_HOOKS = [
  'data-k109-timeline-groups',
  'data-k109-timeline-group',
  'data-k109-timeline-row',
  'data-k109-timeline-browse',
] as const;

export const K109_TIMELINE_PREFS_KEY = 'absinthe-archive-sections';

export function auditArchiveTimeline(): readonly string[] {
  return [...K109_TIMELINE_BUCKETS, ...K109_TIMELINE_HOOKS, K109_TIMELINE_PREFS_KEY];
}
