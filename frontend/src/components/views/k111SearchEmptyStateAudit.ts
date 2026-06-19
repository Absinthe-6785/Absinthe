/** K-111 — Search empty states audit. */
export const K111_EMPTY_HOOKS = [
  'data-k111-empty-query',
  'data-k111-empty-results',
  'data-k111-empty-recent',
  'data-k111-empty-query-hint',
] as const;

export const K111_EMPTY_MESSAGES = [
  'k111EmptyNoQuery',
  'k111EmptyNoRecent',
  'workspaceSearchNoResults',
] as const;

export function auditSearchEmptyStates(): readonly string[] {
  return [...K111_EMPTY_HOOKS, ...K111_EMPTY_MESSAGES, 'ProductEmptyState'];
}
