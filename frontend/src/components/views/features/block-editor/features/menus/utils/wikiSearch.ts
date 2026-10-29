/**
 * wikiSearch.ts — Wiki autocomplete target filtering (pure)
 */

import { type WikiTarget, isCurrentWikiTarget, wikiTargetTitle } from '../../../../../wikiLinks';
const DEFAULT_LIMIT = 8;

export function filterWikiTargets<T extends WikiTarget>(
  query: string,
  targets: T[],
  limit = DEFAULT_LIMIT,
): T[] {
  const q = query.toLowerCase().trim();
  const list = targets.filter(t => isCurrentWikiTarget(t) && (!q || wikiTargetTitle(t).toLowerCase().includes(q)));
  return list.slice(0, limit);
}
