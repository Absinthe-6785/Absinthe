/** K-110 — Cooking history audit. */
export const K110_HISTORY_BUCKETS = ['today', 'yesterday', 'earlier'] as const;

export const K110_HISTORY_HOOKS = [
  'data-k110-history-list',
  'data-k110-history-group',
  'data-k110-history-row',
] as const;

export const K110_HISTORY_FIELDS = [
  'lastCooked',
  'frequency',
  'lastEdit',
] as const;

export function auditCookingHistory(): readonly string[] {
  return [...K110_HISTORY_BUCKETS, ...K110_HISTORY_HOOKS, ...K110_HISTORY_FIELDS];
}
