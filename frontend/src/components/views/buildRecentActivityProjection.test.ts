import { describe, expect, it } from 'vitest';
import { buildRecentActivityProjection } from './buildRecentActivityProjection';
import type { NoteBase } from './noteUtils';

const now = new Date(2026, 9, 27, 12, 0, 0);
const todayAt = (minute: number) => new Date(2026, 9, 27, 8, minute).getTime();
const daysAgoAt = (days: number, minute: number) => new Date(2026, 9, 27 - days, 8, minute).getTime();
const labels = { today: 'Today', yesterday: 'Yesterday', daysAgo: (days: number) => `${days}d ago` };

const note = (id: string, timestamp: number, overrides: Partial<NoteBase> = {}): NoteBase => ({
  id,
  title: `Note ${id}`,
  body: '',
  updatedAt: timestamp,
  folderId: null,
  deletedAt: null,
  ...overrides,
});

describe('buildRecentActivityProjection', () => {
  it('selects the newest cross-domain activity before applying the per-bucket limit', () => {
    const oldNotes = Array.from({ length: 6 }, (_, index) => note(`old-${index}`, todayAt(index)));
    const projection = buildRecentActivityProjection({
      notes: oldNotes,
      plannerRecents: [{ kind: 'schedule', itemId: 'schedule-1', title: 'New schedule', at: todayAt(20) }],
      recipeRecents: [{ recipeId: 'recipe-1', title: 'New recipe', at: todayAt(21) }],
      archiveRestoreRecents: [{ noteId: 'restored-1', restoredAt: todayAt(22) }],
      labels,
      now,
    });

    expect(projection.groups.find(group => group.bucket === 'today')?.items.map(item => item.id)).toEqual([
      'archive:restore:restored-1',
      'recipe:recipe-1',
      'planner:schedule:schedule-1',
      'notes:old-5:edited',
      'notes:old-4:edited',
      'notes:old-3:edited',
    ]);
  });

  it('considers newer Notes even when they occur later in an unsorted input array', () => {
    const unsortedNotes = [
      note('n1', todayAt(1)),
      note('n2', todayAt(2)),
      note('n3', todayAt(3)),
      note('n4', todayAt(4)),
      note('n5', todayAt(5)),
      note('n6', todayAt(6)),
      note('newest', todayAt(30)),
    ];

    const projection = buildRecentActivityProjection({
      notes: unsortedNotes,
      plannerRecents: [],
      recipeRecents: [],
      archiveRestoreRecents: [],
      labels,
      now,
      limitPerBucket: 3,
    });

    expect(projection.groups.find(group => group.bucket === 'today')?.items.map(item => item.noteId)).toEqual([
      'newest', 'n6', 'n5',
    ]);
  });

  it('fails closed for a negative per-bucket limit', () => {
    const projection = buildRecentActivityProjection({
      notes: [note('n1', todayAt(1)), note('n2', todayAt(2))],
      plannerRecents: [],
      recipeRecents: [],
      archiveRestoreRecents: [],
      labels,
      now,
      limitPerBucket: -1,
    });

    expect(projection.groups.find(group => group.bucket === 'today')?.items).toEqual([]);
    expect(projection.isEmpty).toBe(true);
  });

  it('preserves same-domain identity deduplication and deterministic source order for timestamp ties', () => {
    const projection = buildRecentActivityProjection({
      notes: [note('same-time', todayAt(10))],
      plannerRecents: [
        { kind: 'schedule', itemId: 'same-time', title: 'Planner', at: todayAt(10) },
        { kind: 'schedule', itemId: 'same-time', title: 'Duplicate planner', at: todayAt(9) },
      ],
      recipeRecents: [{ recipeId: 'same-time', title: 'Recipe', at: todayAt(10) }],
      archiveRestoreRecents: [{ noteId: 'same-time', restoredAt: todayAt(10) }],
      labels,
      now,
    });

    expect(projection.groups.find(group => group.bucket === 'today')?.items.map(item => item.id)).toEqual([
      'notes:same-time:edited',
      'planner:schedule:same-time',
      'recipe:same-time',
      'archive:restore:same-time',
    ]);
  });

  it('preserves date buckets, configured limits, metadata, deleted-note exclusion, and frozen inputs', () => {
    const notes = Object.freeze([
      Object.freeze(note('deleted', todayAt(30), { deletedAt: todayAt(31) })),
      Object.freeze(note('note-1', daysAgoAt(0, 20))),
      Object.freeze(note('note-2', daysAgoAt(1, 20))),
      Object.freeze(note('note-3', daysAgoAt(3, 20))),
    ]);
    const plannerRecents = Object.freeze([
      Object.freeze({ kind: 'schedule', itemId: 'event-1', title: 'Study', at: todayAt(22), eventDate: '2026-10-27' }),
    ]);
    const recipeRecents = Object.freeze([
      Object.freeze({ recipeId: 'recipe-1', title: 'Soup', at: todayAt(23) }),
    ]);
    const archiveRestoreRecents = Object.freeze([
      Object.freeze({ noteId: 'restored-note', restoredAt: todayAt(24) }),
    ]);

    const projection = buildRecentActivityProjection({
      notes,
      plannerRecents,
      recipeRecents,
      archiveRestoreRecents,
      labels,
      now,
      limitPerBucket: 2,
    });

    expect(projection.groups.map(group => [group.bucket, group.items.length])).toEqual([
      ['today', 2], ['yesterday', 1], ['earlier', 1],
    ]);
    expect(projection.groups[0].items.map(item => item.id)).toEqual([
      'archive:restore:restored-note', 'recipe:recipe-1',
    ]);
    expect(projection.groups[0].items[0]).toMatchObject({
      domain: 'archive', kind: 'restored', noteId: 'restored-note', relativeLabel: expect.any(String),
    });
    expect(projection.groups[0].items[1]).toMatchObject({
      domain: 'recipe', kind: 'viewed', recipeId: 'recipe-1', title: 'Soup',
    });
    expect(projection.groups[1].items[0]).toMatchObject({ noteId: 'note-2', domain: 'notes' });
    expect(projection.groups[2].items[0]).toMatchObject({ noteId: 'note-3', domain: 'notes' });
    expect(projection.groups.flatMap(group => group.items).some(item => item.noteId === 'deleted')).toBe(false);
    expect(projection.groups[0].items.find(item => item.domain === 'planner')).toBeUndefined();
    expect(notes[1].title).toBe('Note note-1');
    expect(plannerRecents[0].eventDate).toBe('2026-10-27');
    expect(recipeRecents[0].title).toBe('Soup');
    expect(archiveRestoreRecents[0].noteId).toBe('restored-note');
  });

  it('preserves Schedule navigation identity, event date, and domain metadata', () => {
    const projection = buildRecentActivityProjection({
      notes: [],
      plannerRecents: [{
        kind: 'schedule',
        itemId: 'event-1',
        title: 'Study',
        at: todayAt(25),
        eventDate: '2026-10-27',
      }],
      recipeRecents: [],
      archiveRestoreRecents: [],
      labels,
      now,
    });

    expect(projection.groups[0].items[0]).toMatchObject({
      id: 'planner:schedule:event-1',
      domain: 'planner',
      kind: 'schedule',
      title: 'Study',
      plannerItemId: 'event-1',
      eventDate: '2026-10-27',
      relativeLabel: expect.any(String),
    });
  });
});
