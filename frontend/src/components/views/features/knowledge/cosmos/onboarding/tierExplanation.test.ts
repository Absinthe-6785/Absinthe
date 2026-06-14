import { describe, expect, it } from 'vitest';
import { buildTierExplanationLines, tierExplanationForClassification } from './tierExplanation';

describe('tierExplanation', () => {
  it('lists backlink factor for hubs', () => {
    const lines = buildTierExplanationLines(
      {
        backlinkCount: 14,
        outgoingLinkCount: 2,
        incomingReferenceCount: 0,
        mentionCount: 0,
        sharedTagNeighborCount: 0,
        isAreaParticipant: false,
        isAreaNote: false,
        isStarred: false,
        isMilestone: false,
      },
      { importanceScore: 80, classification: 'core-hub' },
    );
    expect(lines.some(l => l.key === 'k41TierFactorBacklinks')).toBe(true);
  });

  it('maps classification to explain key', () => {
    expect(tierExplanationForClassification('core-hub')).toBe('k41TierExplainCoreHub');
    expect(tierExplanationForClassification('isolated')).toBe('k41TierExplainIsolated');
  });
});
