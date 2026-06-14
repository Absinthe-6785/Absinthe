import { describe, expect, it, beforeEach } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { applyAreaToNote } from '../trace/areaNotes';
import { buildKnowledgeTimeline } from './knowledgeTimeline';
import { noteEffectiveCreatedAt } from './timelineMetrics';
import { buildPeriodBuckets } from './timelineSnapshots';

function note(id: string, title: string, body = '', extra: Partial<NoteBase> = {}): NoteBase {
  return { id, title, body, ...extra };
}

describe('knowledgeTimeline', () => {
  let service: KnowledgeIndexService;
  const now = Date.parse('2026-06-13T12:00:00Z');

  beforeEach(() => {
    service = new KnowledgeIndexService();
  });

  it('builds month snapshots with cumulative growth', () => {
    const notes = [
      note('n1', 'Alpha', '', { createdAt: Date.parse('2026-01-15'), updatedAt: Date.parse('2026-01-15') }),
      note('n2', 'Beta', '[[Alpha]]', { createdAt: Date.parse('2026-06-01'), updatedAt: Date.parse('2026-06-01') }),
    ];
    service.buildFromNotes(notes);
    const timeline = buildKnowledgeTimeline(notes, service, undefined, { mode: 'month', now });
    expect(timeline.snapshots.length).toBeGreaterThan(0);
    const last = timeline.snapshots[timeline.snapshots.length - 1];
    expect(last.noteCount).toBe(2);
    expect(last.linkCount).toBeGreaterThan(0);
  });

  it('detects first-note milestone', () => {
    const notes = [note('n1', 'First', '', { createdAt: Date.parse('2026-03-01') })];
    service.buildFromNotes(notes);
    const timeline = buildKnowledgeTimeline(notes, service, undefined, { now });
    expect(timeline.milestones.find(m => m.id === 'first-note')?.achieved).toBe(true);
  });

  it('tracks area evolution rows', () => {
    const notes = [
      applyAreaToNote(note('a1', 'History', '', { createdAt: Date.parse('2026-01-01') })),
      note('h1', 'Lecture 1', '', { createdAt: Date.parse('2026-02-01'), properties: { area: 'History' } }),
      note('h2', 'Lecture 2', '', { createdAt: Date.parse('2026-03-01'), properties: { area: 'History' } }),
    ];
    service.buildFromNotes(notes);
    const timeline = buildKnowledgeTimeline(notes, service, undefined, { mode: 'month', now });
    expect(timeline.areaEvolution.some(r => r.areaLabel === 'History')).toBe(true);
  });

  it('computes recent evolution summary', () => {
    const notes = [
      note('n1', 'Old', '', { createdAt: Date.parse('2025-01-01') }),
      note('n2', 'New', '[[Old]]', { createdAt: Date.parse('2026-06-01') }),
    ];
    service.buildFromNotes(notes);
    const timeline = buildKnowledgeTimeline(notes, service, undefined, { now, recentDays: 30 });
    expect(timeline.recentEvolution.notesAdded).toBeGreaterThanOrEqual(1);
  });
});

describe('timelineSnapshots', () => {
  it('uses createdAt for effective time', () => {
    const t = noteEffectiveCreatedAt(note('x', 'T', '', { createdAt: 1000, updatedAt: 2000 }));
    expect(t).toBe(1000);
  });

  it('builds quarter buckets', () => {
    const notes = [note('n1', 'A', '', { createdAt: Date.parse('2026-01-10') })];
    const buckets = buildPeriodBuckets(notes, 'quarter', Date.parse('2026-06-13'));
    expect(buckets.some(b => b.label.startsWith('Q'))).toBe(true);
  });
});
