import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import type { KnowledgeHistoryEvent } from './eventTypes';
import {
  clearKnowledgeHistory,
  loadKnowledgeHistoryEvents,
  saveKnowledgeHistoryEvents,
} from './historyStorage';
import {
  HISTORY_BOOTSTRAP_STORAGE_KEY,
  bootstrapKnowledgeHistory,
  hasNonImportedHistory,
  isHistoryBootstrapComplete,
  maybeBootstrapKnowledgeHistory,
} from './historyBootstrap';
import { groupEventsByDate, isImportedEvent, presentHistoryEvent } from './historyEventPresentation';
import {
  buildCosmosEvolutionStory,
  buildCosmosEvolutionSummary,
  buildDiscoveryProgressSummary,
  getMilestoneNoteId,
} from './historyEvolutionQueries';

function note(id: string, body = '', extra: Partial<NoteBase> = {}): NoteBase {
  return { id, title: id, body, createdAt: Date.parse('2026-02-11'), ...extra };
}

describe('history bootstrap', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      store: {} as Record<string, string>,
      getItem(key: string) { return this.store[key] ?? null; },
      setItem(key: string, value: string) { this.store[key] = value; },
      removeItem(key: string) { delete this.store[key]; },
    });
    clearKnowledgeHistory();
    globalThis.localStorage.removeItem(HISTORY_BOOTSTRAP_STORAGE_KEY);
  });

  it('seeds imported events from notes once', () => {
    const notes = [note('a', 'Hello [[World]]', { properties: { area: 'History' } })];
    const count = bootstrapKnowledgeHistory(notes);
    expect(count).toBeGreaterThan(0);
    expect(isHistoryBootstrapComplete()).toBe(true);
    const events = loadKnowledgeHistoryEvents();
    expect(events.every(isImportedEvent)).toBe(true);
    expect(bootstrapKnowledgeHistory(notes)).toBe(0);
  });

  it('skips bootstrap when real history exists', () => {
    const real: KnowledgeHistoryEvent = {
      id: 'real-1',
      type: 'NOTE_CREATED',
      timestamp: Date.now(),
      noteId: 'n1',
    };
    clearKnowledgeHistory();
    saveKnowledgeHistoryEvents([real]);
    expect(hasNonImportedHistory()).toBe(true);
    expect(maybeBootstrapKnowledgeHistory([note('n1')])).toBe(0);
  });
});

describe('history event presentation', () => {
  const notes = [note('a', ''), note('b', '')];

  it('presents link events with titles', () => {
    const event: KnowledgeHistoryEvent = {
      id: '1',
      type: 'LINK_CREATED',
      timestamp: Date.now(),
      noteId: 'a',
      relatedNoteId: 'b',
      metadata: { title: 'Alpha', linkTitle: 'Beta' },
    };
    const row = presentHistoryEvent(event, notes);
    expect(row.detail).toBe('Alpha ↔ Beta');
    expect(row.actionKey).toBe('k45EventLinkCreated');
  });

  it('groups events by date newest first', () => {
    const events: KnowledgeHistoryEvent[] = [
      { id: '1', type: 'NOTE_CREATED', timestamp: 1000, noteId: 'a' },
      { id: '2', type: 'NOTE_CREATED', timestamp: 2000, noteId: 'b' },
    ];
    const groups = groupEventsByDate(events, 'en');
    expect(groups[0].events[0].id).toBe('2');
  });
});

describe('history evolution queries', () => {
  const notes = [note('n1'), note('n2', '[[n1]]')];
  let service: KnowledgeIndexService;

  beforeEach(() => {
    service = new KnowledgeIndexService();
    service.buildFromNotes(notes);
  });

  it('builds evolution summary from events', () => {
    const events: KnowledgeHistoryEvent[] = [
      { id: '1', type: 'NOTE_CREATED', timestamp: 100, noteId: 'n1' },
      { id: '2', type: 'LINK_CREATED', timestamp: 200, noteId: 'n2' },
      { id: '3', type: 'HUB_CREATED', timestamp: 300, noteId: 'n1', metadata: { imported: 'true' } },
    ];
    const summary = buildCosmosEvolutionSummary(notes, service, events);
    expect(summary.firstNoteAt).toBe(100);
    expect(summary.firstLinkAt).toBe(200);
    expect(getMilestoneNoteId('first-note', events)).toBe('n1');
  });

  it('summarizes discovery progress from events', () => {
    const events: KnowledgeHistoryEvent[] = [
      {
        id: 'd1',
        type: 'DISCOVERY_RESOLVED',
        timestamp: Date.now(),
        noteId: 'n1',
        metadata: { action: 'connect' },
      },
    ];
    const progress = buildDiscoveryProgressSummary(events);
    expect(progress.resolvedCount).toBe(1);
    expect(progress.connectCount).toBe(1);
  });

  it('builds evolution story from summary', () => {
    const summary = buildCosmosEvolutionSummary(notes, service, []);
    const story = buildCosmosEvolutionStory(summary, []);
    expect(story.beganAt).not.toBeNull();
  });
});
