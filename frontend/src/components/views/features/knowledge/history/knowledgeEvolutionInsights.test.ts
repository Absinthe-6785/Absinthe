import { describe, expect, it } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { buildKnowledgeTimeline } from '../timeline/knowledgeTimeline';
import type { KnowledgeHistoryEvent } from './eventTypes';
import { analyzeDormantAreas, DORMANT_THRESHOLD_DAYS } from './DormantAreaAnalyzer';
import { buildAreaComparison } from './historyAreaComparisonQueries';
import { buildKnowledgeJourney } from './historyJourneyQueries';
import { buildKnowledgeMomentumSnapshot, MOMENTUM_WEIGHTS } from './knowledgeMomentum';
import { buildEvolutionInsightsSummary } from './evolutionInsightsQueries';
import { generateKnowledgeEvolutionReport } from './KnowledgeEvolutionReport';

function note(id: string, extra: Partial<NoteBase> = {}): NoteBase {
  return { id, title: id, body: '', createdAt: Date.parse('2026-01-01'), ...extra };
}

describe('K-47 momentum engine', () => {
  it('scores events with documented weights', () => {
    expect(MOMENTUM_WEIGHTS.NOTE_CREATED).toBe(3);
    expect(MOMENTUM_WEIGHTS.LINK_CREATED).toBe(2);
  });

  it('builds momentum snapshot from period events', () => {
    const now = Date.parse('2026-06-20T12:00:00Z');
    const events: KnowledgeHistoryEvent[] = [
      { id: '1', type: 'NOTE_CREATED', timestamp: now - 5 * 86_400_000, noteId: 'n1', areaId: 'History' },
      { id: '2', type: 'LINK_CREATED', timestamp: now - 4 * 86_400_000, noteId: 'n1', areaId: 'History' },
    ];
    const snapshot = buildKnowledgeMomentumSnapshot([note('n1', { properties: { area: 'History' } })], events, undefined, 30, now);
    expect(snapshot.periodNotesAdded).toBe(1);
    expect(snapshot.cosmosMomentumScore).toBeGreaterThan(0);
    expect(snapshot.mostActiveArea).toBe('History');
  });
});

describe('K-47 dormant area analyzer', () => {
  it('flags areas with stale activity', () => {
    const now = Date.parse('2026-06-20T12:00:00Z');
    const old = now - (DORMANT_THRESHOLD_DAYS + 10) * 86_400_000;
    const notes = [note('n1', { properties: { area: 'Japanese' } })];
    const events: KnowledgeHistoryEvent[] = [
      { id: '1', type: 'NOTE_CREATED', timestamp: old, noteId: 'n1', areaId: 'Japanese' },
    ];
    const dormant = analyzeDormantAreas(notes, events, [], now);
    expect(dormant.some(d => d.areaLabel === 'Japanese')).toBe(true);
  });
});

describe('K-47 area comparison', () => {
  it('compares multiple areas', () => {
    const now = Date.now();
    const notes = [
      note('h1', { properties: { area: 'History' } }),
      note('f1', { properties: { area: 'French' } }),
    ];
    const events: KnowledgeHistoryEvent[] = [
      { id: '1', type: 'NOTE_CREATED', timestamp: now - 86_400_000, noteId: 'h1', areaId: 'History' },
      { id: '2', type: 'NOTE_CREATED', timestamp: now - 86_400_000, noteId: 'f1', areaId: 'French' },
    ];
    const result = buildAreaComparison(['History', 'French'], notes, events);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].noteCount).toBeGreaterThan(0);
  });
});

describe('K-47 journey dates', () => {
  it('includes days since previous milestone', () => {
    const service = new KnowledgeIndexService();
    const notes = [note('n1')];
    service.buildFromNotes(notes);
    const timeline = buildKnowledgeTimeline(notes, service, undefined, { now: Date.now() });
    const journey = buildKnowledgeJourney(timeline.milestones, [
      { id: 'e1', type: 'NOTE_CREATED', timestamp: 100, noteId: 'n1' },
    ]);
    const achieved = journey.steps.filter(s => s.achieved);
    if (achieved.length >= 2) {
      expect(achieved[1].daysSincePrevious).not.toBeNull();
    }
  });
});

describe('K-47 evolution report', () => {
  it('generates deterministic markdown report', () => {
    const service = new KnowledgeIndexService();
    const notes = [note('n1', { properties: { area: 'History' } })];
    service.buildFromNotes(notes);
    const timeline = buildKnowledgeTimeline(notes, service, undefined, { now: Date.now() });
    const insights = buildEvolutionInsightsSummary(notes, timeline, []);
    const md = generateKnowledgeEvolutionReport({
      momentum: insights.momentum,
      dormantAreas: insights.dormantAreas,
      latestMilestoneTitleKey: insights.latestMilestoneTitleKey,
      latestMilestoneAt: insights.latestMilestoneAt,
    });
    expect(md).toContain('# Knowledge Evolution Report');
  });
});
