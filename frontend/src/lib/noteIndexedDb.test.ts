// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  NOTES_IDB_MIGRATION_FLAG,
  clearIndexedDbNotes,
  countIndexedDbNotes,
  deleteNoteFromIndexedDb,
  isIndexedDbMigrationComplete,
  isIndexedDbNotesEmpty,
  loadNotesFromIndexedDb,
  markIndexedDbMigrationComplete,
  saveNotesToIndexedDb,
} from '@/lib/noteIndexedDb';
import type { NoteBase } from '@/components/views/noteUtils';

function sampleNote(id: string, body: string): NoteBase {
  return {
    id,
    title: `Title ${id}`,
    body,
    updatedAt: Date.now(),
    folderId: null,
    deletedAt: null,
  };
}

describe('noteIndexedDb', () => {
  beforeEach(async () => {
    localStorage.removeItem(NOTES_IDB_MIGRATION_FLAG);
    try {
      await clearIndexedDbNotes();
    } catch {
      /** first open */
    }
  });

  it('starts empty', async () => {
    expect(await isIndexedDbNotesEmpty()).toBe(true);
    expect(await countIndexedDbNotes()).toBe(0);
  });

  it('saveNotesToIndexedDb round-trips full records', async () => {
    const notes = [
      sampleNote('n-1', 'Body one'),
      sampleNote('n-2', 'Body two with [[links]]'),
    ];
    expect(await saveNotesToIndexedDb(notes)).toBe(true);
    expect(await countIndexedDbNotes()).toBe(2);

    const loaded = await loadNotesFromIndexedDb();
    expect(loaded).toHaveLength(2);
    expect(loaded.find(n => n.id === 'n-2')?.body).toContain('[[links]]');
  });

  it('deleteNoteFromIndexedDb removes one record', async () => {
    await saveNotesToIndexedDb([
      sampleNote('n-1', 'a'),
      sampleNote('n-2', 'b'),
    ]);
    expect(await deleteNoteFromIndexedDb('n-1')).toBe(true);
    const loaded = await loadNotesFromIndexedDb();
    expect(loaded.map(n => n.id)).toEqual(['n-2']);
  });

  it('tracks migration marker independently', () => {
    expect(isIndexedDbMigrationComplete()).toBe(false);
    markIndexedDbMigrationComplete();
    expect(isIndexedDbMigrationComplete()).toBe(true);
  });
});
