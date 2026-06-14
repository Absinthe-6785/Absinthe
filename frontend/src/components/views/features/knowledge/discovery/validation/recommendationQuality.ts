import type { NoteBase } from '../../../../noteUtils';
import type { KnowledgeIndexService } from '../../KnowledgeIndexService';
import { buildNoteGalaxyMap } from '../../graph/knowledgeUniverse/galaxyClustering';
import {
  evaluateKnowledgeImportance,
  type ImportanceClassification,
} from '../../cosmos/intelligence/knowledgeImportance';
import { buildImportanceInputForNote } from '../../cosmos/intelligence/knowledgeOpportunities';
import type { DiscoveryConfidence } from '../discoveryScoring';
import type { DiscoveryFeed, DiscoveryItem, DiscoveryKind } from '../discoveryTypes';

export interface KindQualityMetrics {
  count: number;
  averageScore: number;
  highConfidenceCount: number;
  mediumConfidenceCount: number;
  lowConfidenceCount: number;
  averageUsefulness: number;
}

export interface RecommendationQualityReport {
  totalItems: number;
  rawCandidateCount: number;
  duplicateRate: number;
  lowConfidenceRate: number;
  highConfidenceRate: number;
  averageScore: number;
  averageUsefulness: number;
  actionableCount: number;
  byKind: Record<DiscoveryKind, KindQualityMetrics>;
}

export interface ClassificationDistribution {
  totalNotes: number;
  counts: Record<ImportanceClassification, number>;
  percentages: Record<ImportanceClassification, number>;
}

const CLASSIFICATIONS: ImportanceClassification[] = [
  'core-hub',
  'major-hub',
  'supporting',
  'satellite',
  'isolated',
];

/** Deterministic usefulness estimate (0–100) — no telemetry. */
export function estimateRecommendationUsefulness(item: DiscoveryItem): number {
  let score = item.score;

  if (item.confidence === 'high') score += 15;
  else if (item.confidence === 'medium') score += 5;
  else score -= 10;

  if (item.kind === 'missing-connection') {
    const signalCount = item.signals?.length ?? 0;
    score += signalCount >= 2 ? 12 : signalCount === 1 ? -8 : -15;
  }

  if (item.kind === 'forgotten-knowledge' || item.kind === 'knowledge-drift') {
    if ((item.daysSinceActivity ?? 0) >= 90) score += 8;
  }

  if (item.kind === 'weak-hub' && (item.noteCount ?? 0) >= 8) score += 10;

  if (item.kind === 'emerging-topic' && (item.noteCount ?? 0) >= 5) score += 6;

  return Math.max(0, Math.min(100, Math.round(score * 0.85)));
}

export function isActionableDiscovery(item: DiscoveryItem): boolean {
  const usefulness = estimateRecommendationUsefulness(item);
  return usefulness >= 50 && item.confidence !== 'low';
}

function emptyKindMetrics(): KindQualityMetrics {
  return {
    count: 0,
    averageScore: 0,
    highConfidenceCount: 0,
    mediumConfidenceCount: 0,
    lowConfidenceCount: 0,
    averageUsefulness: 0,
  };
}

function countConfidence(items: readonly DiscoveryItem[], tier: DiscoveryConfidence): number {
  return items.filter(i => i.confidence === tier).length;
}

/** Static quality evaluation for a discovery feed. */
export function evaluateDiscoveryFeedQuality(
  feed: DiscoveryFeed,
  rawCandidateCount: number,
): RecommendationQualityReport {
  const items = feed.items;
  const total = items.length;
  const usefulnessScores = items.map(estimateRecommendationUsefulness);

  const byKind = {} as Record<DiscoveryKind, KindQualityMetrics>;
  for (const kind of Object.keys(feed.sections) as DiscoveryKind[]) {
    const section = feed.sections[kind];
    if (section.length === 0) {
      byKind[kind] = emptyKindMetrics();
      continue;
    }
    const useful = section.map(estimateRecommendationUsefulness);
    byKind[kind] = {
      count: section.length,
      averageScore: Math.round(section.reduce((s, i) => s + i.score, 0) / section.length),
      highConfidenceCount: countConfidence(section, 'high'),
      mediumConfidenceCount: countConfidence(section, 'medium'),
      lowConfidenceCount: countConfidence(section, 'low'),
      averageUsefulness: Math.round(useful.reduce((a, b) => a + b, 0) / useful.length),
    };
  }

  const duplicateRate = rawCandidateCount > 0
    ? Math.max(0, 1 - total / rawCandidateCount)
    : 0;

  return {
    totalItems: total,
    rawCandidateCount,
    duplicateRate: Math.round(duplicateRate * 100) / 100,
    lowConfidenceRate: total > 0 ? countConfidence(items, 'low') / total : 0,
    highConfidenceRate: total > 0 ? countConfidence(items, 'high') / total : 0,
    averageScore: total > 0 ? Math.round(items.reduce((s, i) => s + i.score, 0) / total) : 0,
    averageUsefulness: total > 0
      ? Math.round(usefulnessScores.reduce((a, b) => a + b, 0) / total)
      : 0,
    actionableCount: items.filter(isActionableDiscovery).length,
    byKind,
  };
}

/** Vault-wide importance classification distribution for validation audits. */
export function buildClassificationDistribution(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
): ClassificationDistribution {
  const active = notes.filter(n => !n.deletedAt);
  const galaxyMap = buildNoteGalaxyMap(active, service);
  const counts = Object.fromEntries(
    CLASSIFICATIONS.map(c => [c, 0]),
  ) as Record<ImportanceClassification, number>;

  for (const note of active) {
    const input = buildImportanceInputForNote(note, service, galaxyMap.get(note.id));
    const { classification } = evaluateKnowledgeImportance(input);
    counts[classification] += 1;
  }

  const total = active.length || 1;
  const percentages = Object.fromEntries(
    CLASSIFICATIONS.map(c => [c, Math.round((counts[c] / total) * 1000) / 10]),
  ) as Record<ImportanceClassification, number>;

  return { totalNotes: active.length, counts, percentages };
}

/** Expected healthy ranges for classification distribution (validation reference). */
export const CLASSIFICATION_EXPECTED_RANGES: Record<
  ImportanceClassification,
  { min: number; max: number; label: string }
> = {
  'core-hub': { min: 1, max: 5, label: 'Core Hub' },
  'major-hub': { min: 5, max: 15, label: 'Major Hub' },
  supporting: { min: 20, max: 40, label: 'Supporting' },
  satellite: { min: 25, max: 55, label: 'Satellite' },
  isolated: { min: 5, max: 25, label: 'Isolated' },
};

export function flagClassificationOutliers(
  distribution: ClassificationDistribution,
): ImportanceClassification[] {
  return CLASSIFICATIONS.filter(c => {
    const pct = distribution.percentages[c];
    const range = CLASSIFICATION_EXPECTED_RANGES[c];
    return pct < range.min || pct > range.max;
  });
}
