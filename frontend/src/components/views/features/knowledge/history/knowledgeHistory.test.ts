import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { KnowledgeHistoryEvent } from './eventTypes';
import {
  clearKnowledgeHistory,
  loadKnowledgeHistoryEvents,
  saveKnowledgeHistoryEvents,
  trimEvents,
  MAX_HISTORY_EVENTS,
} from './historyStorage';
import {
  recordNoteCreated,
  recordNoteUpdateDiff,
} from './historyRecorder';
import {
  getActivitySummary,
  getEventsForNote,
  getGrowthMetrics,
  getNoteHistoryContext,
  hasRecordedHistory,
} from './historyQueries';
import type { NoteBase } from '../../../noteUtils';

function note(id: string, body = '', extra: Partial<NoteBase> = {}): NoteBase {
  return { id, title: 'T', body, ...extra };
}

describe('knowledge history storage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      store: {} as Record<string, string>,
      getItem(key: string) { return this.store[key] ?? null; },
      setItem(key: string, value: string) { this.store[key] = value; },
      removeItem(key: string) { delete this.store[key]; },
    });
    clearKnowledgeHistory();
  });

  it('trims events to MAX_HISTORY_EVENTS', () => {
    const events: KnowledgeHistoryEvent[] = Array.from({ length: MAX_HISTORY_EVENTS + 10 }, (_, i) => ({
      id: `e-${i}`,
      type: 'NOTE_CREATED',
      timestamp: i,
      noteId: `n-${i}`,
    }));
    expect(trimEvents(events)).toHaveLength(MAX_HISTORY_EVENTS);
  });

  it('recovers from invalid JSON', () => {
    globalThis.localStorage.setItem('absinthe:knowledge-history:v1', '{bad');
    expect(loadKnowledgeHistoryEvents()).toEqual([]);
  });
});

describe('knowledge history recorder', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      store: {} as Record<string, string>,
      getItem(key: string) { return this.store[key] ?? null; },
      setItem(key: string, value: string) { this.store[key] = value; },
      removeItem(key: string) { delete this.store[key]; },
    });
    clearKnowledgeHistory();
  });

  it('records note creation and link diff', () => {
    recordNoteCreated('n1');
    const before = note('n1', 'Hello');
    const after = note('n1', 'Hello [[World]]');
    recordNoteUpdateDiff(before, after);

    const events = loadKnowledgeHistoryEvents();
    expect(events.some(e => e.type === 'NOTE_CREATED')).toBe(true);
    expect(events.some(e => e.type === 'LINK_CREATED')).toBe(true);
  });
});

describe('knowledge history queries', () => {
  const now = Date.parse('2026-06-20T12:00:00Z');
  const events: KnowledgeHistoryEvent[] = [
    { id: '1', type: 'NOTE_CREATED', timestamp: now - 5 * 86_400_000, noteId: 'n1' },
    { id: '2', type: 'LINK_CREATED', timestamp: now - 2 * 86_400_000, noteId: 'n1', metadata: { linkTitle: 'Japan' } },
    { id: '3', type: 'HUB_CREATED', timestamp: now - 1 * 86_400_000, noteId: 'h1', areaId: 'History' },
    { id: '4', type: 'DISCOVERY_RESOLVED', timestamp: now, noteId: 'n1', metadata: { action: 'connect' } },
  ];

  it('summarizes activity in window', () => {
    const summary = getActivitySummary(30, now, events);
    expect(summary.notesCreated).toBe(1);
    expect(summary.linksCreated).toBe(1);
    expect(summary.hubsCreated).toBe(1);
    expect(summary.discoveriesResolved).toBe(1);
  });

  it('builds note history context', () => {
    const ctx = getNoteHistoryContext('n1', 30, now, events);
    expect(ctx.firstSeenAt).toBe(events[0]!.timestamp);
    expect(ctx.lastLinkedAt).toBe(events[1]!.timestamp);
    expect(ctx.activityScore).toBeGreaterThan(0);
  });

  it('detects recorded history', () => {
    expect(hasRecordedHistory([])).toBe(false);
    expect(hasRecordedHistory(events)).toBe(true);
  });

  it('filters events for note', () => {
    expect(getEventsForNote('n1', events)).toHaveLength(3);
  });

  it('computes growth metrics for period', () => {
    const metrics = getGrowthMetrics(now - 30 * 86_400_000, now, events);
    expect(metrics.linksCreated).toBe(1);
  });
});
