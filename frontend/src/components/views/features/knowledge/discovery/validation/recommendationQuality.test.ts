import { describe, expect, it, beforeEach } from 'vitest';
import type { NoteBase } from '../../../../noteUtils';
import { KnowledgeIndexService } from '../../KnowledgeIndexService';
import { applyAreaToNote } from '../../trace/areaNotes';
import { buildDiscoveryFeed } from '../discoveryEngine';
import {
  buildClassificationDistribution,
  evaluateDiscoveryFeedQuality,
  estimateRecommendationUsefulness,
  flagClassificationOutliers,
  isActionableDiscovery,
} from './recommendationQuality';

function note(id: string, title: string, body = '', extra: Partial<NoteBase> = {}): NoteBase {
  return { id, title, body, ...extra };
}

describe('recommendationQuality', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];
  const now = Date.parse('2026-06-13T12:00:00Z');

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      applyAreaToNote(note('area-1', 'History')),
      note('hub-1', 'History Hub', '[[History]]', {
        lastOpenedAt: now - 100 * 86_400_000,
        updatedAt: now - 100 * 86_400_000,
      }),
      note('n1', 'French Grammar', '', { properties: { tags: 'french' } }),
      note('n2', 'French Verbs', 'verbs', { properties: { tags: 'french' } }),
      note('n3', 'French Day 18', '[[French Grammar]]', { properties: { tags: 'french' } }),
      note('n4', 'Project Alpha', 'spec', { properties: { tags: 'project' } }),
      note('iso-1', 'Orphan', ''),
    ];
    service.buildFromNotes(notes);
  });

  it('estimates usefulness higher for multi-signal connections', () => {
    const feed = buildDiscoveryFeed(notes, service, { now });
    const conn = feed.items.find(i => i.kind === 'missing-connection');
    if (!conn) return;
    const multi = { ...conn, signals: ['shared-tag', 'shared-area', 'title-similarity'] as const };
    const single = { ...conn, signals: ['shared-tag'] as const };
    expect(estimateRecommendationUsefulness(multi)).toBeGreaterThan(
      estimateRecommendationUsefulness(single),
    );
  });

  it('evaluates feed quality metrics', () => {
    const feed = buildDiscoveryFeed(notes, service, { now });
    const report = evaluateDiscoveryFeedQuality(feed, feed.items.length + 3);
    expect(report.totalItems).toBe(feed.items.length);
    expect(report.averageScore).toBeGreaterThanOrEqual(0);
    expect(report.actionableCount).toBeLessThanOrEqual(report.totalItems);
  });

  it('builds classification distribution', () => {
    const dist = buildClassificationDistribution(notes, service);
    expect(dist.totalNotes).toBe(7);
    expect(dist.percentages.satellite + dist.percentages.isolated).toBeGreaterThan(0);
  });

  it('flags outliers when distribution is extreme', () => {
    const dist = {
      totalNotes: 10,
      counts: {
        'core-hub': 8,
        'major-hub': 1,
        supporting: 0,
        satellite: 1,
        isolated: 0,
      },
      percentages: {
        'core-hub': 80,
        'major-hub': 10,
        supporting: 0,
        satellite: 10,
        isolated: 0,
      },
    };
    expect(flagClassificationOutliers(dist)).toContain('core-hub');
  });

  it('marks high-confidence items as actionable', () => {
    const feed = buildDiscoveryFeed(notes, service, { now });
    const actionable = feed.items.filter(isActionableDiscovery);
    for (const item of actionable) {
      expect(item.confidence).not.toBe('low');
    }
  });
});
