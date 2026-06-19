/** K-113 — Shared empty-state language audit. */
export const K113_EMPTY_STATE_KEYS = [
  'k113NoRecentActivity',
  'k113NoRecipesYet',
  'k113NoHistoryYet',
  'k109EmptyHistory',
  'k110EmptyNoHistory',
  'k111EmptyNoRecent',
] as const;

export const K113_FORBIDDEN_EMPTY_PHRASES = [
  'No data.',
  'Empty.',
  'Nothing found.',
] as const;

export function auditEmptyStates(): readonly string[] {
  return [...K113_EMPTY_STATE_KEYS, 'ProductEmptyState', ...K113_FORBIDDEN_EMPTY_PHRASES];
}
