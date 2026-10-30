// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({ state: { notes: [] as any[], folders: [] as any[] }, request: { accountId: 'A' }, listeners: new Set<() => void>(), read: vi.fn(), write: vi.fn() }));
vi.mock('../store/useNotesStore', () => ({
  observePublishedNotesHydration: () => ({ status: 'CURRENT', request: fake.request }),
  useNotesStore: { getState: () => fake.state, subscribe: (listener: () => void) => { fake.listeners.add(listener); return () => fake.listeners.delete(listener); } },
}));
vi.mock('./notesAccountAuthority', async original => ({ ...await original<typeof import('./notesAccountAuthority')>(), observeAccountScopedFolders: () => [] }));
vi.mock('./supabase', () => ({ authReadFetch: fake.read, authFetch: fake.write }));
import { compareNotesCloudSnapshot, createNotesCloudComparison } from './notesCloudComparison';
import { fetchCompleteNotesFoldersSnapshot } from './notesSyncClient';
const note = (id = 'n', extra = {}) => ({ id, title: 'same title', body: 'body', updatedAt: 1, folderId: null, deletedAt: null, ...extra });
const row = (id = 'n', extra = {}) => ({ id, user_id: 'A', title: 'same title', body: 'body', updated_at: 1, folder_id: null, deleted_at: null, starred: false, properties: null, relations: null, ...extra });
const snapshot = (notes = [row()], folders: any[] = []) => ({ notes, folders });
function page(rows: unknown[], extra = {}) { return new Response(JSON.stringify({ account_id: 'A', rows, total_count: rows.length, offset: 0, limit: 500, complete: true, ...extra })); }
beforeEach(() => {
  fake.state = { notes: [note()], folders: [] }; fake.request = { accountId: 'A' }; fake.read.mockReset(); fake.write.mockReset(); fake.listeners.clear();
  fake.read.mockImplementation(async (url: string, _init, control) => { control?.onRequestStart?.(); return page(url.includes('note_folders') ? [] : [row()]); });
});
afterEach(() => { fake.listeners.clear(); });
it('compares stable IDs, not duplicate titles or timestamps; does not mutate supported data', () => {
  const local = [note('n'), note('local'), note('diff'), note('gone', { deletedAt: 2 }), note('invalid', { properties: { x: 3 } })];
  const remote = snapshot([row('n', { updated_at: 5 }), row('remote'), row('diff', { body: 'different' }), row('gone'), row('invalid')]);
  const before = JSON.stringify({ local, remote });
  expect(compareNotesCloudSnapshot('A', local, [], remote)).toMatchObject({ localOnly: 1, remoteOnly: 1, matching: 1, divergent: 1, incomparable: 1, deleted: 1 });
  expect(JSON.stringify({ local, remote })).toBe(before);
});
it('uses existing supported canonical normalization and legacy optional defaults', () => {
  const legacy = row(); delete (legacy as any).starred; delete (legacy as any).properties; delete (legacy as any).relations;
  expect(compareNotesCloudSnapshot('A', [note()], [], snapshot([legacy])).matching).toBe(1);
  expect(compareNotesCloudSnapshot('A', [note('n', { properties: { tags: 'one, two' } })], [], snapshot([row('n', { properties: { tags: 'one, two' } })])).matching).toBe(1);
});
it('counts folders by ID and unresolved references on each source without resolving or merging them', () => {
  const result = compareNotesCloudSnapshot('A', [note('n', { folderId: 'missing' })], [{ id: 'f', name: 'old', createdAt: 1 }, { id: 'local', name: 'L', createdAt: 1 }], snapshot([row('n', { folder_id: 'missing' })], [{ id: 'f', user_id: 'A', name: 'new', created_at: 1 }, { id: 'remote', user_id: 'A', name: 'R', created_at: 1 }]));
  expect(result).toMatchObject({ localFoldersOnly: 1, remoteFoldersOnly: 1, folderDifferences: 1, unresolvedFolders: 2 });
});
it('never treats unsupported records or broken tombstone chronology as equivalent', () => {
  expect(compareNotesCloudSnapshot('A', [note()], [], snapshot([row('n', { properties: { invalid: [] } })])).incomparable).toBe(1);
  expect(compareNotesCloudSnapshot('A', [note('n', { deletedAt: 0 })], [], snapshot()).incomparable).toBe(1);
});
it.each([null, 'B'])('rejects missing or foreign account %s before a remote request', account => {
  expect(() => createNotesCloudComparison(account, () => true)).toThrow('source_unavailable'); expect(fake.read).not.toHaveBeenCalled();
});
it('reads only GET snapshots and leaves local state, legacy data and mode unchanged', async () => {
  localStorage.setItem('notes-v2', 'legacy'); localStorage.setItem('absinthe-notes-sync-mode', 'local');
  const before = JSON.stringify(fake.state), keys = { ...localStorage };
  const owner = createNotesCloudComparison('A', () => true); expect(await owner.compare()).toMatchObject({ matching: 1 }); owner.cancel();
  expect(fake.read).toHaveBeenCalledTimes(2); expect(fake.read.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true);
  expect(fake.write).not.toHaveBeenCalled(); expect(JSON.stringify(fake.state)).toBe(before); expect({ ...localStorage }).toEqual(keys);
});
it('distinguishes a proven empty remote from request rejection', async () => {
  fake.read.mockImplementation(async () => page([])); const owner = createNotesCloudComparison('A', () => true);
  expect(await owner.compare()).toMatchObject({ localOnly: 1, remoteOnly: 0, matching: 0 }); owner.cancel();
  fake.read.mockRejectedValue(new Error('private detail')); const unavailable = createNotesCloudComparison('A', () => true);
  await expect(unavailable.compare()).rejects.toMatchObject({ reasonCode: 'REMOTE_FETCH_REJECTED' }); unavailable.cancel();
});
it.each([
  { total_count: 501, complete: false }, { total_count: 2, complete: false }, { total_count: 1, complete: false }, { total_count: 0 }, { offset: 1 }, { account_id: 'B' }, { rows: null },
])('fails closed on incomplete, over-budget, malformed or foreign response %j', async extra => {
  fake.read.mockImplementation(async (url: string) => url.includes('note_folders') ? page([]) : page([row()], extra));
  const owner = createNotesCloudComparison('A', () => true); await expect(owner.compare()).rejects.toThrow(); owner.cancel();
  expect(fake.read).toHaveBeenCalledTimes(2); expect(fake.read.mock.calls.every(([url]) => url.includes('offset=0'))).toBe(true);
});
it('rejects duplicate identities and wrong-owner rows', async () => {
  for (const rows of [[row(), row()], [row('n', { user_id: 'B' })]]) {
    fake.read.mockImplementation(async (url: string) => page(url.includes('note_folders') ? [] : rows));
    await expect(fetchCompleteNotesFoldersSnapshot('A', { singlePageLimit: 500 })).rejects.toThrow();
  }
});
it.each(['account', 'publication', 'notes', 'folders', 'cancel'])('rejects %s changes while reads await', async change => {
  let resolve!: (value: Response) => void; fake.read.mockImplementationOnce(() => new Promise(yes => { resolve = yes; }));
  let current = true; const owner = createNotesCloudComparison('A', () => current); const work = owner.compare();
  if (change === 'account') current = false;
  if (change === 'publication') fake.request = { accountId: 'A' };
  if (change === 'notes') fake.state.notes = [...fake.state.notes];
  if (change === 'folders') fake.state.folders = [{ id: 'f' }];
  if (change === 'cancel') owner.cancel();
  fake.listeners.forEach(listener => listener()); resolve(page([row()])); await expect(work).rejects.toThrow(); expect(owner.isCurrent()).toBe(false); owner.cancel();
});
it('rechecks currentness after auth acquisition and before starting a request', async () => {
  let current = true; fake.read.mockImplementation(async (_url, _init, control) => { current = false; control.onRequestStart(); return page([]); });
  const owner = createNotesCloudComparison('A', () => current); await expect(owner.compare()).rejects.toThrow(); owner.cancel();
});
