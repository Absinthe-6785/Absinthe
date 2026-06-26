// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { NoteBase } from '@/components/views/noteUtils';
import { NOTES_KEY } from '@/components/views/noteUtils';
import { clearNotesOnboardingMarker } from '@/lib/notesOnboarding';
import {
  NOTES_IDB_MIGRATION_FLAG,
  clearIndexedDbNotes,
  loadNotesFromIndexedDb,
  markIndexedDbMigrationComplete,
  saveNotesToIndexedDb,
} from '@/lib/noteIndexedDb';
import {
  NOTES_DURABILITY_BACKUP_PREFIX,
  initNotesPersistence,
  migrateLocalStorageNotesToIndexedDb,
  resetNotesPersistenceForTests,
  saveNotesAsync,
} from '@/lib/notePersistence';

function note(id: string, updatedAt: number, body = id): NoteBase {
  return {
    id,
    title: `Title ${id}`,
    body,
    updatedAt,
    folderId: null,
    deletedAt: null,
  };
}

function backupKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(NOTES_DURABILITY_BACKUP_PREFIX)) keys.push(key);
  }
  return keys;
}

describe('notePersistence durability guards', () => {
  beforeEach(async () => {
    localStorage.clear();
    clearNotesOnboardingMarker();
    resetNotesPersistenceForTests();
    try {
      await clearIndexedDbNotes();
    } catch {
      /** first open */
    }
    localStorage.clear();
    clearNotesOnboardingMarker();
    resetNotesPersistenceForTests();
  });

  it('does not write an empty notes array before persistence hydration', async () => {
    const existing = [note('existing', 10, 'keep me')];
    localStorage.setItem(NOTES_KEY, JSON.stringify(existing));

    await expect(saveNotesAsync([])).resolves.toBe(true);

    expect(JSON.parse(localStorage.getItem(NOTES_KEY) ?? '[]')).toEqual(existing);
    expect(await loadNotesFromIndexedDb()).toEqual([]);
  });

  it('backs up localStorage notes before migrating them into IndexedDB', async () => {
    const existing = [note('legacy', 20, 'legacy body')];
    localStorage.setItem(NOTES_KEY, JSON.stringify(existing));

    const result = await migrateLocalStorageNotesToIndexedDb();

    expect(result).toEqual({ migrated: true, count: 1 });
    expect(localStorage.getItem(NOTES_KEY)).toBeNull();
    expect(backupKeys()).toHaveLength(1);
    expect((await loadNotesFromIndexedDb()).map(n => n.id)).toEqual(['legacy']);
  });

  it('rescues localStorage notes when the migration flag exists but IndexedDB is empty', async () => {
    const stranded = [note('stranded', 30, 'survived empty idb')];
    markIndexedDbMigrationComplete();
    localStorage.setItem(NOTES_KEY, JSON.stringify(stranded));

    const result = await initNotesPersistence();

    expect(result.notes.map(n => n.id)).toEqual(['stranded']);
    expect(localStorage.getItem(NOTES_KEY)).toBeNull();
    expect(backupKeys()).toHaveLength(1);
    expect((await loadNotesFromIndexedDb()).map(n => n.id)).toEqual(['stranded']);
  });

  it('merges localStorage notes into a non-empty IndexedDB during migration', async () => {
    await saveNotesToIndexedDb([note('idb', 10, 'idb body')]);
    localStorage.removeItem(NOTES_IDB_MIGRATION_FLAG);
    localStorage.setItem(NOTES_KEY, JSON.stringify([note('legacy', 40, 'legacy body')]));

    const result = await initNotesPersistence();

    expect(result.notes.map(n => n.id).sort()).toEqual(['idb', 'legacy']);
    expect(localStorage.getItem(NOTES_KEY)).toBeNull();
    expect(backupKeys()).toHaveLength(1);
    expect((await loadNotesFromIndexedDb()).map(n => n.id).sort()).toEqual(['idb', 'legacy']);
  });
});
