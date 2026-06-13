import { describe, expect, it } from 'vitest';
import {
  calculateKnowledgeImportance,
  nodeRadiusFromImportance,
  recencyWeight,
} from './knowledgeImportance';

describe('knowledgeImportance', () => {
  const now = Date.parse('2026-06-12T12:00:00Z');

  it('weights backlinks, views, recency, and area bonus', () => {
    const score = calculateKnowledgeImportance({
      backlinkCount: 5,
      viewCount: 4,
      updatedAt: now - 12 * 60 * 60 * 1000,
      isAreaNote: true,
      now,
    });
    expect(score).toBe(5 * 3 + 4 + 10 + 15);
  });

  it('decays recency over time', () => {
    expect(recencyWeight(now - 2 * 24 * 60 * 60 * 1000, now)).toBe(7);
    expect(recencyWeight(now - 120 * 24 * 60 * 60 * 1000, now)).toBe(0);
  });

  it('sizes nodes from importance and tier', () => {
    const star = nodeRadiusFromImportance(40, 'star');
    const moon = nodeRadiusFromImportance(2, 'moon');
    expect(star).toBeGreaterThan(moon);
  });
});
