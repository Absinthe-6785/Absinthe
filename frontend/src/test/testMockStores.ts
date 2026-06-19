/**
 * K-120 — lightweight in-memory store fixtures for audit / perf tests.
 */
import type { NoteBase } from '@/components/views/noteUtils';

export function synthNotes(count: number, prefix = 'note'): NoteBase[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i}`,
    title: `${prefix} ${i} keyword`,
    body: 'x'.repeat(80),
    updatedAt: 1_700_000_000_000 + i,
    folderId: null,
    deletedAt: null,
  }));
}

export interface MockVaultFixture {
  notes: NoteBase[];
  noteCount: number;
}

export function makeMockVault(noteCount: number): MockVaultFixture {
  const notes = synthNotes(noteCount);
  return { notes, noteCount };
}
