import { describe, expect, it, beforeEach } from 'vitest';
import type { NoteBase } from '../../../../noteUtils';
import { KnowledgeIndexService } from '../../KnowledgeIndexService';
import { applyAreaToNote } from '../../trace/areaNotes';
import { buildNoteGalaxyMap } from '../../graph/knowledgeUniverse/galaxyClustering';
import { buildKnowledgeOpportunities } from './knowledgeOpportunities';
import { buildSuggestedConnections } from './suggestedConnections';
import { buildAreaHealthSummaries } from './areaHealth';
import { buildCosmosVaultAnalysis, buildNoteIntelligenceSnapshot } from './cosmosAnalysis';

function note(id: string, title: string, body = '', extra: Partial<NoteBase> = {}): NoteBase {
  return { id, title, body, ...extra };
}

describe('cosmos intelligence integration', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      applyAreaToNote(note('area-1', 'History')),
      note('hub-1', 'History Hub', '[[History]]'),
      note('iso-1', 'Orphan Note', 'no links'),
      note('linked-1', 'French Day 18', '', { properties: { tags: 'french' } }),
      note('linked-2', 'French Day 19', '[[French Day 18]]', { properties: { tags: 'french' } }),
    ];
    service.buildFromNotes(notes);
  });

  it('detects opportunities for isolated notes', () => {
    const galaxyMap = buildNoteGalaxyMap(notes, service);
    const opps = buildKnowledgeOpportunities(notes, service, galaxyMap, { noteId: 'iso-1' });
    expect(opps.some(o => o.kind === 'connect')).toBe(true);
  });

  it('suggests title-similar and tag-related connections', () => {
    const galaxyMap = buildNoteGalaxyMap(notes, service);
    const suggestions = buildSuggestedConnections('linked-2', notes, service, galaxyMap);
    expect(suggestions.some(s => s.noteId === 'linked-1')).toBe(true);
  });

  it('builds area health summaries', () => {
    const galaxyMap = buildNoteGalaxyMap(notes, service);
    const health = buildAreaHealthSummaries(notes, service, galaxyMap);
    expect(health.length).toBeGreaterThan(0);
    expect(health[0].score).toBeGreaterThanOrEqual(0);
    expect(health[0].score).toBeLessThanOrEqual(100);
  });

  it('builds note intelligence snapshot for active note', () => {
    const snapshot = buildNoteIntelligenceSnapshot(notes[4], notes, service);
    expect(snapshot.noteId).toBe('linked-2');
    expect(snapshot.importance.classification).not.toBe('isolated');
    expect(snapshot.suggestedConnections.length).toBeGreaterThan(0);
  });

  it('aggregates vault-level cosmos analysis', () => {
    const analysis = buildCosmosVaultAnalysis(notes, service);
    expect(analysis.isolatedCount).toBeGreaterThanOrEqual(1);
    expect(analysis.topOpportunities.length).toBeGreaterThan(0);
  });
});
