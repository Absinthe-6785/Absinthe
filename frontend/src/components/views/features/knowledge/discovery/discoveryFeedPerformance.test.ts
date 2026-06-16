import { describe, expect, it, beforeEach } from 'vitest';
import type { NoteBase } from '../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { applyAreaToNote } from '../trace/areaNotes';
import { buildDiscoveryFeed } from './discoveryEngine';
import { buildSuggestedConnections } from '../cosmos/intelligence/suggestedConnections';
import { buildNoteGalaxyMap } from '../graph/knowledgeUniverse/galaxyClustering';
import { buildDiscoveryConnectionSuggestions } from './discoveryConnectionSuggestions';
import { createDiscoveryFeedContext } from './discoveryFeedContext';
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import { measureMs } from '@/components/views/editorBenchmark';

function note(id: string, title: string, body = '', extra: Partial<NoteBase> = {}): NoteBase {
  return { id, title, body, ...extra };
}

describe('discovery feed performance', () => {
  const now = Date.parse('2026-06-13T12:00:00Z');

  it('builds discovery feed at 250 notes under 100ms', () => {
    const dataset = buildLargeVaultDataset({ noteCount: 250 });
    const service = new KnowledgeIndexService();
    service.buildFromNotes(dataset.notes);
    const ms = measureMs(() => {
      buildDiscoveryFeed(dataset.notes, service, { now, perSectionLimit: 4 });
    });
    expect(ms, `discovery feed at 250 notes took ${ms}ms`).toBeLessThan(100);
  }, 30_000);
});

describe('discovery feed ranking stability', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];
  const now = Date.parse('2026-06-13T12:00:00Z');

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      applyAreaToNote(note('area-1', 'History', '', { updatedAt: now - 200 * 86_400_000 })),
      note('hub-1', 'History Hub', '[[History]]', {
        updatedAt: now - 200 * 86_400_000,
        lastOpenedAt: now - 92 * 86_400_000,
      }),
      note('linked-1', 'French Grammar', '', { properties: { tags: 'french' } }),
      note('linked-2', 'French Verbs', 'french verbs', { properties: { tags: 'french' } }),
      note('iso-1', 'Orphan Note', 'no links', { updatedAt: now - 5 * 86_400_000 }),
    ];
    service.buildFromNotes(notes);
  });

  it('preserves ranked feed shape on reference fixture', () => {
    const feed = buildDiscoveryFeed(notes, service, { now, perSectionLimit: 4 });
    expect(feed.items.length).toBeGreaterThan(0);
    expect(feed.items.some(i => i.kind === 'forgotten-knowledge')).toBe(true);
    for (let i = 1; i < feed.items.length; i += 1) {
      expect(feed.items[i - 1].score).toBeGreaterThanOrEqual(feed.items[i].score);
    }
  });

  it('indexed connection suggestions align with non-related full-scan scores', () => {
    const galaxyMap = buildNoteGalaxyMap(notes, service);
    const ctx = createDiscoveryFeedContext(notes, service, galaxyMap, now);
    const sourceId = 'linked-1';

    const indexed = buildDiscoveryConnectionSuggestions(sourceId, ctx, 10);
    const full = buildSuggestedConnections(sourceId, notes, service, galaxyMap, { limit: 10 })
      .filter(s => !s.signals.includes('related'));

    for (const fullItem of full) {
      const indexedItem = indexed.find(s => s.noteId === fullItem.noteId);
      expect(indexedItem?.score, `missing indexed match for ${fullItem.noteId}`).toBe(fullItem.score);
    }
  });
});
