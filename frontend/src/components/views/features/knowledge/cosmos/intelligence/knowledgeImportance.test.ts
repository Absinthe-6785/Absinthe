import { describe, expect, it } from 'vitest';
import {
  calculateKnowledgeImportanceScore,
  classifyKnowledgeImportance,
  evaluateKnowledgeImportance,
} from './knowledgeImportance';

describe('cosmos knowledgeImportance', () => {
  const now = Date.parse('2026-06-12T12:00:00Z');

  it('scores backlinks, links, mentions, and bonuses deterministically', () => {
    const score = calculateKnowledgeImportanceScore({
      backlinkCount: 5,
      outgoingLinkCount: 3,
      incomingReferenceCount: 5,
      mentionCount: 2,
      sharedTagNeighborCount: 4,
      isAreaParticipant: true,
      isAreaNote: false,
      isStarred: true,
      isMilestone: true,
      updatedAt: now - 12 * 60 * 60 * 1000,
      now,
    });
    expect(score).toBe(5 * 4 + 3 * 2 + 5 * 3 + 2 * 2 + 4 * 1 + 12 + 8 + 10 + 8);
  });

  it('classifies isolated notes with no connections', () => {
    const result = evaluateKnowledgeImportance({
      backlinkCount: 0,
      outgoingLinkCount: 0,
      incomingReferenceCount: 0,
      mentionCount: 0,
      sharedTagNeighborCount: 0,
      isAreaParticipant: false,
      isAreaNote: false,
      isStarred: false,
      isMilestone: false,
      now,
    });
    expect(result.classification).toBe('isolated');
    expect(result.importanceScore).toBe(0);
  });

  it('classifies area notes as core hubs', () => {
    expect(
      classifyKnowledgeImportance(10, {
        backlinkCount: 0,
        outgoingLinkCount: 0,
        mentionCount: 0,
        isAreaNote: true,
        isStarred: false,
      }),
    ).toBe('core-hub');
  });

  it('classifies high backlink notes as major or core hubs', () => {
    expect(
      classifyKnowledgeImportance(30, {
        backlinkCount: 5,
        outgoingLinkCount: 2,
        mentionCount: 0,
        isAreaNote: false,
        isStarred: false,
      }),
    ).toBe('major-hub');
  });
});
