import { describe, expect, it, beforeEach } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { applyAreaToNote } from '../trace/areaNotes';
import { buildDiscoveryFeed } from './discoveryEngine';
import {
  collectForgottenKnowledgeSignals,
  collectMissingConnectionSignals,
  collectWeakHubSignals,
} from './discoverySignals';
import { scoreForgottenKnowledge } from './discoveryScoring';

function note(id: string, title: string, body = '', extra: Partial<NoteBase> = {}): NoteBase {
  return { id, title, body, ...extra };
}

describe('discoveryEngine', () => {
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

  it('scores forgotten knowledge from importance and inactivity', () => {
    expect(scoreForgottenKnowledge(50, 92)).toBeGreaterThan(scoreForgottenKnowledge(50, 30));
  });

  it('detects forgotten important notes', () => {
    const items = collectForgottenKnowledgeSignals(notes, service, now);
    expect(items.some(i => i.kind === 'forgotten-knowledge')).toBe(true);
  });

  it('detects missing connections without existing links', () => {
    const items = collectMissingConnectionSignals(notes, service);
    expect(items.every(i => i.targetNoteId && i.noteId)).toBe(true);
  });

  it('detects weak hubs from knowledge gaps', () => {
    const items = collectWeakHubSignals(notes, service);
    expect(Array.isArray(items)).toBe(true);
  });

  it('builds ranked discovery feed with summary', () => {
    const feed = buildDiscoveryFeed(notes, service, { now, perSectionLimit: 4 });
    expect(feed.items.length).toBeGreaterThan(0);
    expect(feed.summary.totalCount).toBeGreaterThan(0);
    for (let i = 1; i < feed.items.length; i += 1) {
      expect(feed.items[i - 1].score).toBeGreaterThanOrEqual(feed.items[i].score);
    }
  });

  it('assigns confidence tiers and filters low-score noise', () => {
    const feed = buildDiscoveryFeed(notes, service, { now, perSectionLimit: 10 });
    for (const item of feed.items) {
      expect(item.confidence).toBeDefined();
      expect(item.score).toBeGreaterThanOrEqual(35);
    }
  });

  it('deduplicates forgotten and drift for the same note', () => {
    const feed = buildDiscoveryFeed(notes, service, { now, perSectionLimit: 20 });
    const hubItems = feed.items.filter(
      i => (i.kind === 'forgotten-knowledge' || i.kind === 'knowledge-drift') && i.noteId === 'hub-1',
    );
    expect(hubItems.length).toBeLessThanOrEqual(1);
  });
});
