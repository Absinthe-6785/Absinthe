import { describe, expect, it } from 'vitest';
import type { NoteBase } from '@/components/views/noteUtils';
import {
  compactNoteBodyWhitespace,
  compactNoteForSnapshot,
  compactNotesForSnapshot,
  joinSnapshotChunks,
  measureSnapshotCompaction,
  planSnapshotChunks,
  splitSnapshotIntoChunks,
} from './snapshotCompaction';

function note(overrides: Partial<NoteBase> = {}): NoteBase {
  return {
    id: 'n-1',
    title: '  Title  ',
    body: 'Line one  \n\n\n\nLine two   ',
    updatedAt: 1,
    folderId: null,
    deletedAt: null,
    lastOpenedAt: 999,
    ...overrides,
  };
}

describe('snapshotCompaction', () => {
  it('compacts whitespace and omits transient fields', () => {
    const compact = compactNoteForSnapshot(note());
    expect(compact.title).toBe('Title');
    expect(compact.body).toBe('Line one\n\nLine two');
    expect(compact.lastOpenedAt).toBeUndefined();
    expect(compact.deletedAt).toBeNull();
  });

  it('filters deleted notes from snapshot set', () => {
    const notes = [
      note({ id: 'a' }),
      note({ id: 'b', deletedAt: 100 }),
    ];
    expect(compactNotesForSnapshot(notes)).toHaveLength(1);
    expect(compactNotesForSnapshot(notes)[0]?.id).toBe('a');
  });

  it('measures byte savings when deleted notes present', () => {
    const notes = [
      note({ id: 'a', body: 'x'.repeat(200) }),
      note({ id: 'b', deletedAt: 1, body: 'y'.repeat(500) }),
    ];
    const metrics = measureSnapshotCompaction(notes);
    expect(metrics.omittedDeletedCount).toBe(1);
    expect(metrics.afterBytes).toBeLessThan(metrics.beforeBytes);
    expect(metrics.savedPct).toBeGreaterThan(0);
  });

  it('plans chunks near 384 KB target', () => {
    const payload = 'a'.repeat(900_000);
    const plan = planSnapshotChunks(payload);
    expect(plan.chunkCount).toBeGreaterThanOrEqual(2);
    expect(plan.writeCount).toBe(plan.chunkCount + 1);
    const chunks = splitSnapshotIntoChunks(payload);
    expect(chunks.length).toBe(plan.chunkCount);
    expect(joinSnapshotChunks(chunks)).toBe(payload);
  });

  it('compactNoteBodyWhitespace normalizes blank lines', () => {
    expect(compactNoteBodyWhitespace('a\n\n\n\nb')).toBe('a\n\nb');
  });
});
