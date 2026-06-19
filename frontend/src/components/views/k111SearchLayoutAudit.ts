/** K-111 — Search layout audit. */
export const K111_LAYOUT_HOOKS = [
  'data-k111-search-workspace',
  'data-workspace',
  'data-k111-search-recent',
  'data-k111-search-results',
  'data-k111-search-grouped',
] as const;

export function auditSearchLayout(): readonly string[] {
  return [...K111_LAYOUT_HOOKS, 'recent-then-results', 'collapsible-domains'];
}
