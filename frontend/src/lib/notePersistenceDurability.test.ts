// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { NoteBase } from '@/components/views/noteUtils';
import {
  NOTES_KEY,
  getLastNotesStorageBridgeSaveResult,
  saveNotes,
} from '@/components/views/noteUtils';
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
import { setRecoveryModeActiveForTest } from '@/lib/recoverySafetyPolicy';

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
    setRecoveryModeActiveForTest(false);
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

  it('K-319B rejects an empty pre-hydration write and preserves storage byte-for-byte', async () => {
    const existing = [note('existing', 10, 'keep me')];
    const original = JSON.stringify(existing, null, 2);
    localStorage.setItem(NOTES_KEY, original);
    setRecoveryModeActiveForTest(true);

    await expect(saveNotesAsync([])).resolves.toEqual({
      status: 'rejected',
      reason: 'empty_replacement',
    });

    expect(localStorage.getItem(NOTES_KEY)).toBe(original);
    expect(await loadNotesFromIndexedDb()).toEqual([]);
  });

  it('K-319B rejects malformed pre-hydration writes with a structured failure', async () => {
    const existing = [note('existing', 10, 'keep me')];
    const original = JSON.stringify(existing);
    localStorage.setItem(NOTES_KEY, original);
    setRecoveryModeActiveForTest(true);

    await expect(saveNotesAsync([{ id: 'malformed' }])).resolves.toEqual({
      status: 'rejected',
      reason: 'malformed_note',
    });
    expect(localStorage.getItem(NOTES_KEY)).toBe(original);
  });

  it('K-319B reports IndexedDB bridge work as pending instead of persisted', async () => {
    const initialized = await initNotesPersistence();
    setRecoveryModeActiveForTest(true);
    const before = await loadNotesFromIndexedDb();

    expect(saveNotes([])).toBe(false);
    expect(getLastNotesStorageBridgeSaveResult()).toBe('pending');
    await Promise.resolve();

    expect(await loadNotesFromIndexedDb()).toEqual(before);
  });

  it('K-319B preserves the structured persisted result for a valid allowed write', async () => {
    const current = [note('existing', 10, 'keep me')];
    localStorage.setItem(NOTES_KEY, JSON.stringify(current));
    setRecoveryModeActiveForTest(true);
    const replacement = [...current, note('new', 20, 'new note')];

    await expect(saveNotesAsync(replacement)).resolves.toEqual({ status: 'persisted' });
    expect(JSON.parse(localStorage.getItem(NOTES_KEY) ?? '[]')).toEqual(replacement);
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
