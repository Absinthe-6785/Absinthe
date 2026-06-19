/** K-109 — Recent history audit. */
export const K109_HISTORY_BUCKETS = ['today', 'yesterday', 'earlier'] as const;
export const K109_HISTORY_KINDS = ['opened', 'edited', 'restored'] as const;

export const K109_HISTORY_HOOKS = [
  'data-k109-history-list',
  'data-k109-history-group',
  'data-k109-history-kind',
  'data-k109-history-row',
] as const;

export function auditArchiveHistory(): readonly string[] {
  return [...K109_HISTORY_BUCKETS, ...K109_HISTORY_KINDS, ...K109_HISTORY_HOOKS];
}
