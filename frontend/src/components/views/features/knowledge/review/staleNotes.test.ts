import { describe, it, expect } from 'vitest';
import {
  buildStaleNotesBuckets,
  isStaleNote,
  staleTierForNote,
} from './staleNotes';
import type { NoteBase } from '../../../noteUtils';

const DAY = 86_400_000;
const now = Date.UTC(2026, 5, 1);

function note(id: string, updatedAt: number, lastOpenedAt?: number): NoteBase {
  return {
    id,
    title: id,
    body: 'content',
    updatedAt,
    lastOpenedAt,
    folderId: null,
    deletedAt: null,
  };
}

describe('staleNotes', () => {
  it('marks note stale when open and edit exceed threshold', () => {
    const n = note('a', now - 40 * DAY, now - 35 * DAY);
    expect(isStaleNote(n, 30, now)).toBe(true);
    expect(isStaleNote(n, 60, now)).toBe(false);
  });

  it('uses updatedAt when lastOpenedAt is missing', () => {
    const n = note('b', now - 95 * DAY);
    expect(staleTierForNote(n, now)).toBe(90);
  });

  it('buckets notes into exclusive 30/60/90 tiers', () => {
    const notes = [
      note('t30', now - 35 * DAY, now - 32 * DAY),
      note('t60', now - 65 * DAY, now - 62 * DAY),
      note('t90', now - 100 * DAY, now - 95 * DAY),
      note('fresh', now - 2 * DAY, now - 1 * DAY),
    ];
    const buckets = buildStaleNotesBuckets(notes, { now, limitPerTier: 5 });
    expect(buckets.days30.map(e => e.noteId)).toEqual(['t30']);
    expect(buckets.days60.map(e => e.noteId)).toEqual(['t60']);
    expect(buckets.days90.map(e => e.noteId)).toEqual(['t90']);
  });
});
