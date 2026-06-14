import {
  IMPORTANCE_CLASS_THRESHOLDS,
  IMPORTANCE_WEIGHTS,
} from './importanceWeights';

export type ImportanceClassification =
  | 'core-hub'
  | 'major-hub'
  | 'supporting'
  | 'satellite'
  | 'isolated';

export interface KnowledgeImportanceInput {
  backlinkCount: number;
  outgoingLinkCount: number;
  incomingReferenceCount: number;
  mentionCount: number;
  sharedTagNeighborCount: number;
  isAreaParticipant: boolean;
  isAreaNote: boolean;
  isStarred: boolean;
  isMilestone: boolean;
  updatedAt?: number | null;
  now?: number;
}

export interface KnowledgeImportanceResult {
  importanceScore: number;
  classification: ImportanceClassification;
}

function recencyBonus(updatedAt: number | null | undefined, now: number): number {
  if (updatedAt == null || updatedAt <= 0) return 0;
  const daysSince = (now - updatedAt) / (1000 * 60 * 60 * 24);
  if (daysSince <= 1) return IMPORTANCE_WEIGHTS.RECENCY_MAX;
  if (daysSince <= 7) return 6;
  if (daysSince <= 30) return 3;
  if (daysSince <= 90) return 1;
  return 0;
}

/** Deterministic importance score for knowledge intelligence (distinct from graph sizing). */
export function calculateKnowledgeImportanceScore(
  input: KnowledgeImportanceInput,
): number {
  const now = input.now ?? Date.now();
  let score = 0;

  score += input.backlinkCount * IMPORTANCE_WEIGHTS.BACKLINK;
  score += input.outgoingLinkCount * IMPORTANCE_WEIGHTS.OUTGOING_LINK;
  score += input.incomingReferenceCount * IMPORTANCE_WEIGHTS.INCOMING_REFERENCE;
  score += input.mentionCount * IMPORTANCE_WEIGHTS.MENTION;
  score += input.sharedTagNeighborCount * IMPORTANCE_WEIGHTS.TAG_NEIGHBOR;

  if (input.isAreaParticipant || input.isAreaNote) {
    score += IMPORTANCE_WEIGHTS.AREA_PARTICIPATION;
  }
  if (input.isStarred) score += IMPORTANCE_WEIGHTS.STAR;
  if (input.isMilestone) score += IMPORTANCE_WEIGHTS.MILESTONE;

  score += recencyBonus(input.updatedAt, now);

  return Math.round(score);
}

export function classifyKnowledgeImportance(
  score: number,
  input: Pick<KnowledgeImportanceInput, 'backlinkCount' | 'outgoingLinkCount' | 'mentionCount' | 'isAreaNote' | 'isStarred'>,
): ImportanceClassification {
  const totalLinks = input.backlinkCount + input.outgoingLinkCount + input.mentionCount;

  if (totalLinks === 0 && score < IMPORTANCE_CLASS_THRESHOLDS.SATELLITE) {
    return 'isolated';
  }

  if (input.isAreaNote || (input.isStarred && input.backlinkCount >= 5)) {
    return 'core-hub';
  }

  if (score >= IMPORTANCE_CLASS_THRESHOLDS.CORE_HUB || input.backlinkCount >= 8) {
    return 'core-hub';
  }
  if (score >= IMPORTANCE_CLASS_THRESHOLDS.MAJOR_HUB || input.backlinkCount >= 4) {
    return 'major-hub';
  }
  if (score >= IMPORTANCE_CLASS_THRESHOLDS.SUPPORTING || totalLinks >= 2) {
    return 'supporting';
  }
  if (score >= IMPORTANCE_CLASS_THRESHOLDS.SATELLITE || totalLinks >= 1) {
    return 'satellite';
  }

  return 'isolated';
}

export function evaluateKnowledgeImportance(
  input: KnowledgeImportanceInput,
): KnowledgeImportanceResult {
  const importanceScore = calculateKnowledgeImportanceScore(input);
  const classification = classifyKnowledgeImportance(importanceScore, input);
  return { importanceScore, classification };
}
