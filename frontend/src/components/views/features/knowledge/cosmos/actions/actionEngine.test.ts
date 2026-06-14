import { describe, expect, it, beforeEach } from 'vitest';
import type { NoteBase } from '../../../../noteUtils';
import { KnowledgeIndexService } from '../../KnowledgeIndexService';
import { applyAreaToNote } from '../../trace/areaNotes';
import { buildNoteGalaxyMap } from '../../graph/knowledgeUniverse/galaxyClustering';
import { buildAreaHealthSummaries } from '../intelligence/areaHealth';
import { buildNoteIntelligenceSnapshot } from '../intelligence/cosmosAnalysis';
import {
  buildCosmosActionPlan,
  countActionsForNote,
  enrichConnectionRecommendations,
  formatConnectionReasons,
  suggestAreaForNote,
} from './actionEngine';

function note(id: string, title: string, body = '', extra: Partial<NoteBase> = {}): NoteBase {
  return { id, title, body, ...extra };
}

describe('actionEngine', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      applyAreaToNote(note('area-1', 'History')),
      note('n1', 'French Grammar', '# French\n\n[[History]]', { properties: { tags: 'french' } }),
      note('n2', 'French Day18', 'learning french', { properties: { tags: 'french' } }),
      note('n3', 'Orphan', 'no links'),
    ];
    service.buildFromNotes(notes);
  });

  it('enriches connection recommendations with shared tags', () => {
    const snapshot = buildNoteIntelligenceSnapshot(notes[1], notes, service);
    const enriched = enrichConnectionRecommendations(notes[1].id, snapshot.suggestedConnections, service);
    expect(enriched.length).toBeGreaterThan(0);
    const withTags = enriched.find(c => c.sharedTags.length > 0);
    expect(withTags).toBeDefined();
  });

  it('formats connection reasons deterministically', () => {
    const snapshot = buildNoteIntelligenceSnapshot(notes[1], notes, service);
    const enriched = enrichConnectionRecommendations(notes[1].id, snapshot.suggestedConnections, service);
    if (enriched[0]) {
      const lines = formatConnectionReasons(enriched[0], {
        sharedTags: tags => `Shared tags: ${tags}`,
        mutualRefs: count => `Mutual references: ${count}`,
        signal: () => 'signal',
      });
      expect(lines.every(l => typeof l === 'string')).toBe(true);
    }
  });

  it('builds prioritized action plan from snapshot', () => {
    const orphan = notes[3];
    const snapshot = buildNoteIntelligenceSnapshot(orphan, notes, service);
    const galaxyMap = buildNoteGalaxyMap(notes, service);
    const areaHealth = buildAreaHealthSummaries(notes, service, galaxyMap);
    const plan = buildCosmosActionPlan(orphan, snapshot, notes, service, areaHealth, {
      connectDesc: t => `Connect to ${t}`,
      backlinkDesc: 'backlinks',
      assignDesc: 'assign',
      createHubDesc: 'hub',
      resolveDesc: 'resolve',
      relationDesc: t => `relation ${t}`,
    });
    expect(plan.actions.length).toBeGreaterThan(0);
    for (let i = 1; i < plan.actions.length; i += 1) {
      expect(plan.actions[i - 1].priority).toBeGreaterThanOrEqual(plan.actions[i].priority);
    }
  });

  it('counts actions for search badge', () => {
    const snapshot = buildNoteIntelligenceSnapshot(notes[3], notes, service);
    expect(countActionsForNote(snapshot)).toBeGreaterThanOrEqual(snapshot.opportunities.length);
  });

  it('suggests area for uncategorized notes when confidence is high enough', () => {
    const tagged = note('n4', 'History Lecture', 'about history', { properties: { tags: 'history' } });
    const extended = [...notes, tagged];
    service.buildFromNotes(extended);
    const galaxyMap = buildNoteGalaxyMap(extended, service);
    const areaHealth = buildAreaHealthSummaries(extended, service, galaxyMap);
    const suggestion = suggestAreaForNote(tagged, extended, service, areaHealth);
    if (suggestion) {
      expect(suggestion.confidence).toBeGreaterThanOrEqual(40);
      expect(suggestion.label.length).toBeGreaterThan(0);
    }
  });
});
