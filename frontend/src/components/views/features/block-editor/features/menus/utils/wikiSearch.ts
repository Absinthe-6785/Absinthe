/**
 * wikiSearch.ts — Wiki autocomplete target filtering (pure)
 */

const DEFAULT_LIMIT = 8;

export function filterWikiTargets(
  query: string,
  targets: string[],
  limit = DEFAULT_LIMIT,
): string[] {
  const q = query.toLowerCase().trim();
  const list = q ? targets.filter(t => t.toLowerCase().includes(q)) : targets;
  return list.slice(0, limit);
}
