// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({ state: { notes: [] as any[], folders: [] as any[] }, request: { accountId: 'A' }, listeners: new Set<() => void>(), authorityListeners: new Set<(request: any) => void>(), read: vi.fn(), write: vi.fn() }));
vi.mock('../store/useNotesStore', () => ({
  observePublishedNotesHydration: () => ({ status: 'CURRENT', request: fake.request }),
  useNotesStore: { getState: () => fake.state, subscribe: (listener: () => void) => { fake.listeners.add(listener); return () => fake.listeners.delete(listener); } },
}));
vi.mock('./notesAccountAuthority', async original => ({
  ...await original<typeof import('./notesAccountAuthority')>(),
  observeAccountScopedFolders: () => [],
  subscribeNotesAuthorityRequestChange: (listener: (request: any) => void) => {
    fake.authorityListeners.add(listener); return () => fake.authorityListeners.delete(listener);
  },
}));
vi.mock('./supabase', () => ({ authReadFetch: fake.read, authFetch: fake.write }));
import { compareNotesCloudSnapshot, createNotesCloudComparison } from './notesCloudComparison';
import { fetchCompleteNotesFoldersSnapshot } from './notesSyncClient';
const note = (id = 'n', extra = {}) => ({ id, title: 'same title', body: 'body', updatedAt: 1, folderId: null, deletedAt: null, ...extra });
const row = (id = 'n', extra = {}) => ({ id, user_id: 'A', title: 'same title', body: 'body', updated_at: 1, folder_id: null, deleted_at: null, starred: false, properties: null, relations: null, ...extra });
const snapshot = (notes = [row()], folders: any[] = []) => ({ notes, folders });
function page(rows: unknown[], extra = {}) { return new Response(JSON.stringify({ account_id: 'A', rows, total_count: rows.length, offset: 0, limit: 500, complete: true, ...extra })); }
beforeEach(() => {
  fake.state = { notes: [note()], folders: [] }; fake.request = { accountId: 'A' }; fake.read.mockReset(); fake.write.mockReset(); fake.listeners.clear(); fake.authorityListeners.clear();
  fake.read.mockImplementation(async (url: string, _init, control) => { control?.onRequestStart?.(); return page(url.includes('note_folders') ? [] : [row()]); });
});
afterEach(() => { fake.listeners.clear(); });
it('compares stable IDs, not duplicate titles or timestamps; does not mutate supported data', () => {
  const local = [
    note('n'), note('local', { title: 'Local-only title' }), note('diff', { title: 'Local version' }),
    note('gone', { title: 'Local deleted title', deletedAt: 2 }), note('invalid', { title: 'Local malformed title', properties: { x: 3 } }),
    note('same-local', { title: 'Duplicate title' }),
  ];
  const remote = snapshot([
    row('n', { updated_at: 5 }), row('remote', { title: 'Cloud-only title' }),
    row('diff', { title: 'Cloud version', body: 'different' }), row('gone', { title: 'Cloud title for deleted ID' }),
    row('invalid', { title: 'Cloud malformed-pair title' }), row('same-cloud', { title: 'Duplicate title' }),
  ]);
  const before = JSON.stringify({ local, remote });
  const result = compareNotesCloudSnapshot('A', local, [], remote);
  expect(result).toMatchObject({ localOnly: 2, remoteOnly: 2, matching: 1, divergent: 1, incomparable: 1, deleted: 1 });
  expect(Object.fromEntries(['localOnly', 'remoteOnly', 'divergent', 'incomparable', 'deleted'].map(key => [key, result.details[key as keyof typeof result.details].length])))
    .toEqual({ localOnly: 2, remoteOnly: 2, divergent: 1, incomparable: 1, deleted: 1 });
  expect(result.details.localOnly).toEqual([
    { id: 'local', localTitle: 'Local-only title' }, { id: 'same-local', localTitle: 'Duplicate title' },
  ]);
  expect(result.details.remoteOnly).toEqual([
    { id: 'remote', remoteTitle: 'Cloud-only title' }, { id: 'same-cloud', remoteTitle: 'Duplicate title' },
  ]);
  expect(result.details.divergent).toEqual([{ id: 'diff', localTitle: 'Local version', remoteTitle: 'Cloud version' }]);
  expect(result.details.incomparable).toEqual([{ id: 'invalid', localTitle: 'Local malformed title', remoteTitle: 'Cloud malformed-pair title' }]);
  expect(result.details.deleted).toEqual([{ id: 'gone', localTitle: 'Local deleted title', remoteTitle: 'Cloud title for deleted ID' }]);
  expect(Object.isFrozen(result.details)).toBe(true);
  expect(Object.isFrozen(result.details.localOnly)).toBe(true);
  expect(JSON.stringify({ local, remote })).toBe(before);
});
it('fails closed on duplicate or malformed local and remote IDs', () => {
  for (const [local, remote] of [
    [[note('dup'), note('dup')], snapshot([])],
    [[], snapshot([row('dup'), row('dup')])],
    [[note(' ')], snapshot([])],
    [[], snapshot([row('')])],
  ] as const) expect(() => compareNotesCloudSnapshot('A', local, [], remote)).toThrow('notes_comparison_invalid');
});
it('keeps the existing 500-record source limit before constructing details', () => {
  const oversized = Array.from({ length: 501 }, (_, index) => note(`local-${index}`));
  expect(() => compareNotesCloudSnapshot('A', oversized, [], snapshot([]))).toThrow('notes_comparison_limit');
});
it('does not expose non-string or blank titles and rejects foreign account details', () => {
  const result = compareNotesCloudSnapshot('A', [note('bad-title', { title: 42 as any })], [], snapshot([row('bad-title', { title: '  ' })]));
  expect(result.details.incomparable).toEqual([{ id: 'bad-title' }]);
  expect(() => compareNotesCloudSnapshot('A', [note()], [], snapshot([row('n', { user_id: 'B', title: 'foreign title' })]))).toThrow('notes_comparison_owner');
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
it('exposes one exact-ID remote-only Note from the verified comparison without title matching', async () => {
  fake.state.notes = [note('local-duplicate-title', { title: 'Same title' })];
  fake.read.mockImplementation(async (url: string, _init, control) => {
    control?.onRequestStart?.();
    return page(url.includes('note_folders') ? [] : [row('cloud-exact-id', { title: 'Same title', body: 'Cloud text' })]);
  });
  const owner = createNotesCloudComparison('A', () => true);
  const report = await owner.compare();
  expect(report.details.remoteOnly.map(detail => detail.id)).toEqual(['cloud-exact-id']);
  expect(owner.getRemoteOnlyNote('cloud-exact-id')).toEqual({ id: 'cloud-exact-id', title: 'Same title', body: 'Cloud text' });
  expect(owner.getRemoteOnlyNote('local-duplicate-title')).toBeNull();
  expect(fake.read).toHaveBeenCalledTimes(2);
  expect(fake.read.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true);
  expect(fake.write).not.toHaveBeenCalled();
  expect(fake.state.notes).toHaveLength(1);
  owner.cancel();
  expect(owner.getRemoteOnlyNote('cloud-exact-id')).toBeNull();
});
it('exposes immutable same-ID divergent title and body values without resolving duplicate titles', async () => {
  fake.state.notes = [
    note('divergent-id', { title: 'Local title', body: 'Local body' }),
    note('different-id', { title: 'Local title', body: 'Another body' }),
  ];
  const cloudRows = [
    row('divergent-id', { title: 'Cloud title', body: 'Cloud body' }),
    row('another-cloud-id', { title: 'Local title', body: 'Cloud-only duplicate title' }),
  ];
  fake.read.mockImplementation(async (url: string, _init, control) => {
    control?.onRequestStart?.(); return page(url.includes('note_folders') ? [] : cloudRows);
  });
  const owner = createNotesCloudComparison('A', () => true);
  const report = await owner.compare();

  expect(report.details.divergent.map(detail => detail.id)).toEqual(['divergent-id']);
  const pair = owner.getDivergentNotePair('divergent-id');
  expect(pair).toEqual({
    id: 'divergent-id',
    local: { title: 'Local title', body: 'Local body' },
    cloud: { title: 'Cloud title', body: 'Cloud body' },
    differingFields: ['title', 'body'],
  });
  expect(Object.isFrozen(pair)).toBe(true);
  expect(Object.isFrozen(pair?.local)).toBe(true);
  expect(Object.isFrozen(pair?.cloud)).toBe(true);
  expect(Object.isFrozen(pair?.differingFields)).toBe(true);
  expect(owner.getDivergentNotePair('different-id')).toBeNull();
  expect(owner.getDivergentNotePair('another-cloud-id')).toBeNull();
  expect(fake.read).toHaveBeenCalledTimes(2);
  expect(fake.write).not.toHaveBeenCalled();
  owner.cancel();
  expect(owner.getDivergentNotePair('divergent-id')).toBeNull();
});
it('reports non-body supported field differences when the body is equal', async () => {
  fake.state.notes = [note('metadata-diff', {
    title: 'Same title', body: 'Same body', folderId: 'local-folder', starred: false,
    properties: { color: 'blue' }, relations: { related: ['note-a'] },
  })];
  const cloud = row('metadata-diff', {
    title: 'Same title', body: 'Same body', folder_id: 'cloud-folder', starred: true,
    properties: { color: 'green' }, relations: { related: ['note-b'] },
  });
  fake.read.mockImplementation(async (url: string, _init, control) => {
    control?.onRequestStart?.(); return page(url.includes('note_folders') ? [] : [cloud]);
  });
  const owner = createNotesCloudComparison('A', () => true);
  const report = await owner.compare();
  expect(report.details.divergent.map(detail => detail.id)).toEqual(['metadata-diff']);
  expect(owner.getDivergentNotePair('metadata-diff')).toMatchObject({
    local: { body: 'Same body' },
    cloud: { body: 'Same body' },
    differingFields: ['folder', 'starred', 'properties', 'relations'],
  });
  owner.cancel();
});
it('does not expose deleted, unsupported, or incomplete same-ID versions as a pair', async () => {
  const incompleteLocal = { id: 'incomplete-local', title: 'Local title', updatedAt: 1, folderId: null, deletedAt: null } as any;
  const cases = [
    { local: note('deleted-local', { deletedAt: 2 }), remote: row('deleted-local', { title: 'Cloud title' }), category: 'deleted' },
    { local: note('deleted-cloud'), remote: row('deleted-cloud', { deleted_at: 2 }), category: 'deleted' },
    { local: note('unsupported-cloud'), remote: row('unsupported-cloud', { properties: { bad: [] } }), category: 'incomparable' },
    { local: note('unsupported-local', { properties: { bad: 42 as any } }), remote: row('unsupported-local', { title: 'Cloud title' }), category: 'incomparable' },
    { local: incompleteLocal, remote: row('incomplete-local', { title: 'Cloud title' }), category: 'incomparable' },
  ] as const;
  for (const item of cases) {
    fake.state.notes = [item.local];
    fake.read.mockImplementation(async (url: string, _init, control) => {
      control?.onRequestStart?.(); return page(url.includes('note_folders') ? [] : [item.remote]);
    });
    const owner = createNotesCloudComparison('A', () => true);
    const report = await owner.compare();
    expect(report.details[item.category].map(detail => detail.id)).toContain(item.local.id);
    expect(owner.getDivergentNotePair(item.local.id)).toBeNull();
    owner.cancel();
  }
});
it('does not expose deleted, unsupported, or incomparable remote rows to preview', async () => {
  fake.state.notes = [];
  const deleted = row('deleted-cloud', { deleted_at: 10 });
  const unsupported = row('unsupported-cloud', { properties: { invalid: [] } });
  fake.read.mockImplementation(async (url: string, _init, control) => {
    control?.onRequestStart?.(); return page(url.includes('note_folders') ? [] : [deleted, unsupported]);
  });
  const owner = createNotesCloudComparison('A', () => true);
  const report = await owner.compare();
  expect(report.details.deleted.map(detail => detail.id)).toContain('deleted-cloud');
  expect(report.details.incomparable.map(detail => detail.id)).toContain('unsupported-cloud');
  expect(report.details.remoteOnly).toHaveLength(0);
  expect(owner.getRemoteOnlyNote('deleted-cloud')).toBeNull();
  expect(owner.getRemoteOnlyNote('unsupported-cloud')).toBeNull();
  owner.cancel();
});
it.each(['account', 'publication', 'local-note-edit', 'local-id-added'] as const)(
  'discards remote preview access after %s changes', async change => {
    fake.state.notes = [note('local')];
    fake.read.mockImplementation(async (url: string, _init, control) => {
      control?.onRequestStart?.(); return page(url.includes('note_folders') ? [] : [row('cloud-only', { body: 'secret body' })]);
    });
    let accountCurrent = true;
    const owner = createNotesCloudComparison('A', () => accountCurrent);
    await owner.compare();
    expect(owner.getRemoteOnlyNote('cloud-only')?.body).toBe('secret body');
    if (change === 'account') accountCurrent = false;
    if (change === 'publication') fake.request = { accountId: 'A' };
    if (change === 'local-note-edit') fake.state.notes[0]!.body = 'changed in place';
    if (change === 'local-id-added') fake.state.notes.push(note('cloud-only'));
    expect(owner.getRemoteOnlyNote('cloud-only')).toBeNull();
    owner.cancel();
  },
);
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
