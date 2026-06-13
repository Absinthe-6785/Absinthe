import type { GraphNodeTier } from './graphNodeTier';

export interface KnowledgeImportanceInput {
  backlinkCount: number;
  viewCount?: number;
  updatedAt?: number | null;
  isAreaNote?: boolean;
  now?: number;
}

const AREA_BONUS = 15;
const RECENCY_MAX = 10;

/** Decaying recency boost — recent notes surface slightly larger in the universe. */
export function recencyWeight(updatedAt: number | null | undefined, now = Date.now()): number {
  if (updatedAt == null || updatedAt <= 0) return 0;
  const daysSince = (now - updatedAt) / (1000 * 60 * 60 * 24);
  if (daysSince <= 1) return RECENCY_MAX;
  if (daysSince <= 7) return 7;
  if (daysSince <= 30) return 4;
  if (daysSince <= 90) return 2;
  return 0;
}

/** Unified importance score for sizing, hub detection, and clustering priority. */
export function calculateKnowledgeImportance(input: KnowledgeImportanceInput): number {
  const viewCount = input.viewCount ?? 0;
  const areaBonus = input.isAreaNote ? AREA_BONUS : 0;
  return (
    input.backlinkCount * 3
    + viewCount * 1
    + recencyWeight(input.updatedAt, input.now)
    + areaBonus
  );
}

/** Map importance + tier to rendered node radius (px). */
export function nodeRadiusFromImportance(importance: number, tier: GraphNodeTier): number {
  const base = tier === 'star' ? 12 : tier === 'planet' ? 9 : 6;
  const cap = tier === 'star' ? 10 : tier === 'planet' ? 6 : 4;
  const scale = Math.min(Math.sqrt(Math.max(importance, 0)) * 0.8, cap);
  return base + scale;
}
