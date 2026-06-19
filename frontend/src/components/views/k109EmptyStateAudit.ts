/** K-109 — Archive empty states audit. */
export const K109_EMPTY_STATE_HOOKS = [
  'data-k109-empty-state',
  'data-k109-archive-empty',
] as const;

export const K109_EMPTY_MESSAGES = [
  'k109EmptyHistory',
  'k109EmptyDeleted',
  'k109EmptySnapshots',
  'k109EmptyTimeline',
] as const;

export function auditArchiveEmptyStates(): readonly string[] {
  return [...K109_EMPTY_STATE_HOOKS, ...K109_EMPTY_MESSAGES];
}
