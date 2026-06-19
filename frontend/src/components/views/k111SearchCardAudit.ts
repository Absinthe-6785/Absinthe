/** K-111 — Search result card audit. */
export const K111_CARD_HOOKS = [
  'data-k111-search-card',
  'data-k111-search-domain',
  'data-k111-search-category',
] as const;

export const K111_CARD_FEATURES = [
  'relative-dates',
  'domain-icons',
  'category-labels',
  'highlight-ranges',
  'selected-inset-bar',
] as const;

export function auditSearchCard(): readonly string[] {
  return [...K111_CARD_HOOKS, ...K111_CARD_FEATURES];
}
