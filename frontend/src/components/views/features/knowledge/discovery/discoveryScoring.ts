/** Centralized discovery scoring weights — no magic numbers in UI. */

export type DiscoveryConfidence = 'high' | 'medium' | 'low';

export const CONFIDENCE_THRESHOLDS = {
  HIGH: 85,
  MEDIUM: 50,
} as const;

export const DISCOVERY_WEIGHTS = {
  /** forgotten / drift: importance × inactivity */
  INACTIVITY_DAY_CAP: 180,
  INACTIVITY_NORMALIZER: 30,
  FORGOTTEN_IMPORTANCE: 1.0,
  DRIFT_IMPORTANCE: 0.85,
  MIN_FORGOTTEN_DAYS: 45,
  MIN_DRIFT_DAYS: 90,
  MIN_FEED_SCORE: 35,

  /** missing connection: similarity × relevance */
  CONNECTION_SIMILARITY: 1.0,
  CONNECTION_RELEVANCE: 0.55,
  MIN_CONNECTION_SCORE: 14,

  /** emerging topic: recency × cluster growth */
  EMERGING_WINDOW_DAYS: 14,
  EMERGING_MIN_NOTES: 4,
  EMERGING_RECENCY: 1.0,
  EMERGING_GROWTH: 0.75,

  /** weak hub: note count × hub absence */
  WEAK_HUB_NOTE_COUNT: 1.2,
  WEAK_HUB_ABSENCE: 1.0,
  WEAK_HUB_MIN_NOTES: 4,

  /** vault scan limits */
  FORGOTTEN_SCAN_LIMIT: 30,
  CONNECTION_SOURCE_LIMIT: 28,
  CONNECTIONS_PER_SOURCE: 2,
  EMERGING_SCAN_LIMIT: 60,
} as const;

export function discoveryConfidenceTier(score: number): DiscoveryConfidence {
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) return 'high';
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
  return 'low';
}

export function scoreForgottenKnowledge(importanceScore: number, inactivityDays: number): number {
  const capped = Math.min(inactivityDays, DISCOVERY_WEIGHTS.INACTIVITY_DAY_CAP);
  const inactivityFactor = capped / DISCOVERY_WEIGHTS.INACTIVITY_NORMALIZER;
  return Math.round(importanceScore * inactivityFactor * DISCOVERY_WEIGHTS.FORGOTTEN_IMPORTANCE);
}

export function scoreMissingConnection(similarityScore: number, relevanceScore: number): number {
  return Math.round(
    similarityScore * DISCOVERY_WEIGHTS.CONNECTION_SIMILARITY
    + relevanceScore * DISCOVERY_WEIGHTS.CONNECTION_RELEVANCE,
  );
}

export function scoreEmergingTopic(recencyDays: number, noteCount: number): number {
  const recencyFactor = Math.max(0, DISCOVERY_WEIGHTS.EMERGING_WINDOW_DAYS - recencyDays);
  const growthFactor = noteCount - DISCOVERY_WEIGHTS.EMERGING_MIN_NOTES + 1;
  return Math.round(
    recencyFactor * DISCOVERY_WEIGHTS.EMERGING_RECENCY
    + growthFactor * DISCOVERY_WEIGHTS.EMERGING_GROWTH * 10,
  );
}

export function scoreWeakHub(noteCount: number): number {
  return Math.round(
    noteCount * DISCOVERY_WEIGHTS.WEAK_HUB_NOTE_COUNT * DISCOVERY_WEIGHTS.WEAK_HUB_ABSENCE,
  );
}

export function scoreKnowledgeDrift(importanceScore: number, inactivityDays: number): number {
  const capped = Math.min(inactivityDays, DISCOVERY_WEIGHTS.INACTIVITY_DAY_CAP);
  const inactivityFactor = capped / DISCOVERY_WEIGHTS.INACTIVITY_NORMALIZER;
  return Math.round(importanceScore * inactivityFactor * DISCOVERY_WEIGHTS.DRIFT_IMPORTANCE);
}
