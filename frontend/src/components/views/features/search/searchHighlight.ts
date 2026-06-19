import type { SearchHighlight } from './searchProjectionModels';

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function matchQueryRanges(title: string, query: string): SearchHighlight {
  const q = normalizeSearchQuery(query);
  if (!q) return { titleRanges: [] };

  const lower = title.toLowerCase();
  const ranges: { start: number; end: number }[] = [];
  let idx = 0;
  while (idx < lower.length) {
    const found = lower.indexOf(q, idx);
    if (found === -1) break;
    ranges.push({ start: found, end: found + q.length });
    idx = found + q.length;
  }
  return { titleRanges: ranges };
}

export function buildHighlightsForResults<T extends { id: string; title: string }>(
  items: readonly T[],
  query: string,
): ReadonlyMap<string, SearchHighlight> {
  const map = new Map<string, SearchHighlight>();
  if (!query.trim()) return map;
  for (const item of items) {
    map.set(item.id, matchQueryRanges(item.title, query));
  }
  return map;
}
