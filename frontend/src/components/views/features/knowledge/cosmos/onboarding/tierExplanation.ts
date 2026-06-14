import type { TranslationKey } from '../../../../../../lib/i18n';
import type {
  ImportanceClassification,
  KnowledgeImportanceInput,
  KnowledgeImportanceResult,
} from '../intelligence/knowledgeImportance';

export interface TierExplanationLine {
  key: TranslationKey;
  values?: Record<string, string>;
}

export function buildTierExplanationLines(
  input: KnowledgeImportanceInput,
  result: KnowledgeImportanceResult,
): TierExplanationLine[] {
  const lines: TierExplanationLine[] = [];
  const totalLinks = input.backlinkCount + input.outgoingLinkCount + input.mentionCount;

  if (input.isAreaNote) {
    lines.push({ key: 'k41TierFactorAreaNote' });
  }
  if (input.isStarred) {
    lines.push({ key: 'k41TierFactorStarred' });
  }
  if (input.backlinkCount > 0) {
    lines.push({
      key: 'k41TierFactorBacklinks',
      values: { count: String(input.backlinkCount) },
    });
  }
  if (input.outgoingLinkCount > 0) {
    lines.push({
      key: 'k41TierFactorOutgoing',
      values: { count: String(input.outgoingLinkCount) },
    });
  }
  if (input.sharedTagNeighborCount >= 3) {
    lines.push({
      key: 'k41TierFactorTagNeighbors',
      values: { count: String(input.sharedTagNeighborCount) },
    });
  }
  if (totalLinks === 0) {
    lines.push({ key: 'k41TierFactorNoLinks' });
  }

  const daysSinceUpdate = input.updatedAt && input.now
    ? Math.floor((input.now - input.updatedAt) / (1000 * 60 * 60 * 24))
    : null;
  if (daysSinceUpdate != null && daysSinceUpdate <= 7) {
    lines.push({ key: 'k41TierFactorRecentUpdate' });
  }

  if (lines.length === 0) {
    lines.push({
      key: 'k41TierFactorScore',
      values: { score: String(result.importanceScore) },
    });
  }

  return lines.slice(0, 4);
}

export function tierExplanationForClassification(
  classification: ImportanceClassification,
): TranslationKey {
  switch (classification) {
    case 'core-hub': return 'k41TierExplainCoreHub';
    case 'major-hub': return 'k41TierExplainMajorHub';
    case 'supporting': return 'k41TierExplainSupporting';
    case 'satellite': return 'k41TierExplainSatellite';
    default: return 'k41TierExplainIsolated';
  }
}
