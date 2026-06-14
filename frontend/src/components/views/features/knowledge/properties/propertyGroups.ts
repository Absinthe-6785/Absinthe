export type PropertyGroupId = 'study' | 'source' | 'general';

const STUDY_KEY_FRAGMENTS = [
  'area', 'galaxy', 'project', 'status', 'milestone', 'learning', 'path',
  'review', 'difficulty', 'grade', 'semester', 'course', 'topic', 'weak',
] as const;

const SOURCE_KEY_FRAGMENTS = [
  'source', 'author', 'url', 'isbn', 'doi', 'published', 'publication',
  'journal', 'year', 'publisher', 'cite', 'reference', 'book',
] as const;

function keyMatchesFragments(key: string, fragments: readonly string[]): boolean {
  const normalized = key.trim().toLowerCase();
  return fragments.some(fragment => normalized === fragment || normalized.includes(fragment));
}

export function classifyPropertyGroup(key: string): PropertyGroupId {
  if (keyMatchesFragments(key, STUDY_KEY_FRAGMENTS)) return 'study';
  if (keyMatchesFragments(key, SOURCE_KEY_FRAGMENTS)) return 'source';
  return 'general';
}

export function groupUserProperties(
  properties: readonly { key: string; value: string }[],
): Record<PropertyGroupId, { key: string; value: string }[]> {
  const groups: Record<PropertyGroupId, { key: string; value: string }[]> = {
    study: [],
    source: [],
    general: [],
  };
  for (const entry of properties) {
    groups[classifyPropertyGroup(entry.key)].push(entry);
  }
  return groups;
}
