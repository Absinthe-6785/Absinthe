import { describe, it, expect } from 'vitest';
import { buildReviewQueue } from './reviewQueue';
import type { NoteBase } from '../../../noteUtils';

const DAY = 86_400_000;
const now = Date.UTC(2026, 5, 1);

function note(id: string, title: string, body: string, updatedAt: number): NoteBase {
  return { id, title, body, updatedAt, lastOpenedAt: updatedAt, folderId: null, deletedAt: null };
}

describe('buildReviewQueue', () => {
  it('returns deduplicated manual review candidates', () => {
    const notes = [
      note('stale', 'Stale', 'old', now - 100 * DAY),
      note('hub', 'Hub', '[[A]] [[B]] [[C]]', now - DAY),
      note('recent', 'Recent', 'new', now - DAY),
    ];
    const queue = buildReviewQueue(notes, { limit: 10, now });
    expect(queue.length).toBeGreaterThan(0);
    expect(new Set(queue.map(q => q.noteId)).size).toBe(queue.length);
  });
});
