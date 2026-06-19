/** K-113 — Unified relative date audit. */
export const K113_COHESION_DATE_BUCKETS = [
  'today',
  'yesterday',
  'thisWeek',
  'earlier',
] as const;

export const K113_RELATIVE_DATE_SOURCES = [
  'k102DateFormat.ts',
  'k102RelativeDateLabels.ts',
  'buildArchiveHistoryItems.ts',
  'buildRecentActivityProjection.ts',
  'searchRecentStorage.ts',
] as const;

export const K113_FORBIDDEN_RELATIVE_HELPERS = [
  'relativeLabel() in buildRecipeProjection.ts — local short labels acceptable for recipe rows',
] as const;

export function auditRelativeDates(): readonly string[] {
  return [...K113_COHESION_DATE_BUCKETS, ...K113_RELATIVE_DATE_SOURCES, 'classifyCohesionBucket'];
}
