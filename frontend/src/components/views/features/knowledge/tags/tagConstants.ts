/** Reserved property key for page-level tags */
export const TAGS_PROPERTY_KEY = 'tags';

/** Case-insensitive tag identity */
export function normalizeTagName(tag: string): string {
  return tag.trim().toLowerCase();
}

export function isTagsPropertyKey(key: string): boolean {
  return normalizeTagName(key) === TAGS_PROPERTY_KEY;
}

/** Serialize tag list for storage in properties.tags */
export function tagsToPropertyValue(tags: readonly string[]): string {
  return JSON.stringify([...tags]);
}

/** Parse tag list from properties.tags value */
export function tagsFromPropertyValue(raw: unknown): string[] {
  if (raw == null) return [];

  if (Array.isArray(raw)) {
    return dedupeTags(raw.filter((t): t is string => typeof t === 'string'));
  }

  if (typeof raw !== 'string') return [];

  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) return [];
      return dedupeTags(parsed.filter((t): t is string => typeof t === 'string'));
    } catch {
      return [];
    }
  }

  return dedupeTags(trimmed.split(',').map(t => t.trim()).filter(Boolean));
}

/** Deduplicate tags case-insensitively, preserving first-seen display casing */
export function dedupeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const trimmed = tag.trim();
    if (!trimmed) continue;
    const key = normalizeTagName(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}
