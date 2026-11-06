// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { activateNotesAccountAuthority, NOTES_CORE_DOMAIN, NOTES_FOLDERS_DOMAIN, getActiveNotesAuthorityRequest, observeAccountScopedFolders, type NotesAuthorityRequest } from './notesAccountAuthority';
import type { NotesPersistenceInitResult } from './notePersistence';
const persistence = vi.hoisted(() => ({ initialize: vi.fn(), read: vi.fn(), write: vi.fn() }));
vi.mock('./notePersistence', async original => ({ ...await original<typeof import('./notePersistence')>(), initNotesPersistence: persistence.initialize }));
vi.mock('./supabase', () => ({ authReadFetch: persistence.read, authFetch: persistence.write }));
vi.mock('./vaultSnapshotAuto', () => ({ scheduleAutoSnapshot: vi.fn() }));
import { useNotesStore, observePublishedNotesHydration } from '../store/useNotesStore';
import { resetNotesPersistenceForTests } from './notePersistence';
import { setRecoveryModeActiveForTest } from './recoverySafetyPolicy';
import { createNotesCloudComparison } from './notesCloudComparison';
beforeEach(() => {
  useNotesStore.getState().detachNotesStorage(); resetNotesPersistenceForTests(); setRecoveryModeActiveForTest(false); localStorage.clear(); localStorage.setItem('absinthe-notes-sync-mode', 'local');
  persistence.read.mockReset(); persistence.write.mockReset();
  persistence.initialize.mockImplementation(async (accountId: string, request: NotesAuthorityRequest): Promise<NotesPersistenceInitResult> => {
    const domain = (domainId: typeof NOTES_CORE_DOMAIN | typeof NOTES_FOLDERS_DOMAIN, count: number) => ({ accountId, domainId, schemaVersion: 1 as const, state: count ? 'LOADED_POPULATED' as const : 'LOADED_EMPTY' as const, recordCount: count, verifiedAt: 1, legacyGlobalDataPresent: false });
    return { notes: [{ id: 'n', title: 'Title', body: '', updatedAt: 1, folderId: null, deletedAt: null }], mode: 'accountScoped', accountId, requestGeneration: request.generation, migrated: false, migrationMs: 0, loadMs: 0, notesAuthorityState: domain(NOTES_CORE_DOMAIN, 1), foldersAuthorityState: domain(NOTES_FOLDERS_DOMAIN, 0) };
  });
});
afterEach(() => useNotesStore.getState().detachNotesStorage());
async function publish(account: string) { await useNotesStore.getState().initNotesStorage(account); expect(observePublishedNotesHydration().status).toBe('CURRENT'); }
it('fails closed with real publication revocation across account A/B/A', async () => {
  await publish('A'); let resolve!: (value: Response) => void;
  persistence.read.mockImplementation((url: string) => url.includes('note_folders')
    ? Promise.resolve(new Response(JSON.stringify({ account_id: 'A', rows: [], total_count: 0, offset: 0, limit: 500, complete: true })))
    : new Promise(yes => { resolve = yes; }));
  const owner = createNotesCloudComparison('A', () => true); const work = owner.compare();
  await publish('B'); await publish('A'); resolve(new Response('{}'));
  await expect(work).rejects.toThrow(); expect(owner.isCurrent()).toBe(false); expect(persistence.write).not.toHaveBeenCalled(); owner.cancel();
});
it('does not revive a captured divergent pair after a real account A/B/A publication transition', async () => {
  await publish('A');
  persistence.read.mockImplementation(async (url: string) => {
    const rows = url.includes('note_folders') ? [] : [{
      id: 'n', user_id: 'A', title: 'Cloud title', body: 'Cloud body', updated_at: 1,
      folder_id: null, deleted_at: null, starred: false, properties: null, relations: null,
    }];
    return new Response(JSON.stringify({ account_id: 'A', rows, total_count: rows.length, offset: 0, limit: 500, complete: true }));
  });
  const owner = createNotesCloudComparison('A', () => true);
  const report = await owner.compare();
  expect(report.details.divergent.map(detail => detail.id)).toEqual(['n']);
  expect(owner.getDivergentNotePair('n')).not.toBeNull();

  await publish('B'); await publish('A');

  expect(owner.isCurrent()).toBe(false);
  expect(owner.getDivergentNotePair('n')).toBeNull();
  owner.cancel();
});
it('retires the compared snapshot on same-account authority rollover before any Store update', async () => {
  await publish('A');
  persistence.read.mockImplementation(async (url: string) => {
    const rows = url.includes('note_folders') ? [] : [{
      id: 'n', user_id: 'A', title: 'Cloud title', body: 'Cloud body', updated_at: 1,
      folder_id: null, deleted_at: null, starred: false, properties: null, relations: null,
    }];
    return new Response(JSON.stringify({ account_id: 'A', rows, total_count: rows.length, offset: 0, limit: 500, complete: true }));
  });
  const owner = createNotesCloudComparison('A', () => true);
  await owner.compare();
  expect(owner.getDivergentNotePair('n')).not.toBeNull();
  let invalidations = 0;
  owner.subscribeInvalidation(() => { invalidations += 1; });
  const storeBefore = useNotesStore.getState();

  activateNotesAccountAuthority('A');

  expect(useNotesStore.getState()).toBe(storeBefore);
  expect(invalidations).toBe(1);
  expect(owner.isCurrent()).toBe(false);
  expect(owner.getDivergentNotePair('n')).toBeNull();
  expect(owner.getRemoteOnlyNote('missing')).toBeNull();
  owner.cancel();
});
it('rejects an unproven Notes replacement and an unowned folder array', async () => {
  await publish('A'); const owner = createNotesCloudComparison('A', () => true);
  useNotesStore.setState({ notes: [...useNotesStore.getState().notes] }); expect(owner.isCurrent()).toBe(false); owner.cancel();
  await publish('A'); useNotesStore.setState({ folders: [{ id: 'foreign', name: 'private', createdAt: 1 }] });
  expect(() => createNotesCloudComparison('A', () => true)).toThrow('source_unavailable');
});
it('observes malformed folder storage without any write, recovery-state change or subscriber exception', async () => {
  await publish('A'); const request = getActiveNotesAuthorityRequest()!;
  const owner = createNotesCloudComparison('A', () => true);
  localStorage.setItem('absinthe.notes.account-authority.folders.v1:A:notes.folders', '{invalid');
  const before = Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]));
  const writes = vi.spyOn(Storage.prototype, 'setItem'); const removes = vi.spyOn(Storage.prototype, 'removeItem');
  expect(observeAccountScopedFolders(request)).toBeNull();
  expect(() => owner.isCurrent()).not.toThrow(); expect(owner.isCurrent()).toBe(false);
  expect(() => useNotesStore.setState({ syncError: 'unrelated update' })).not.toThrow();
  expect(() => createNotesCloudComparison('A', () => true)).toThrow('source_unavailable');
  expect(writes).not.toHaveBeenCalled(); expect(removes).not.toHaveBeenCalled();
  expect(Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]))).toEqual(before);
  writes.mockRestore(); removes.mockRestore(); owner.cancel();
});
