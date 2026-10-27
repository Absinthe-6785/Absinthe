import { IDBFactory, IDBDatabase as FakeDatabase, IDBObjectStore as FakeObjectStore } from 'fake-indexeddb';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { NoteBase } from '../components/views/noteUtils';

vi.mock('../lib/supabase', () => ({ authFetch: vi.fn(), authReadFetch: vi.fn() }));
vi.mock('../lib/vaultSnapshotAuto', () => ({ scheduleAutoSnapshot: vi.fn() }));

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, String(value)); },
  removeItem: (key: string) => { values.delete(key); },
  clear: () => values.clear(), key: (index: number) => [...values.keys()][index] ?? null,
  get length() { return values.size; },
};
vi.stubGlobal('localStorage', storage);
const { useNotesStore } = await import('./useNotesStore');
const persistence = await import('../lib/notePersistence');
const authority = await import('../lib/notesAccountAuthority');
const legacyDb = await import('../lib/noteIndexedDb');
const { setRecoveryModeActiveForTest } = await import('../lib/recoverySafetyPolicy');

const original: NoteBase = { id: 'old-a', title: 'Original A', body: 'Keep until reset', updatedAt: 1, folderId: null, deletedAt: null };
const other: NoteBase = { ...original, id: 'old-b', title: 'Original B' };
const noteKey = 'notes-v2';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

async function seed(account: string, note: NoteBase) {
  await useNotesStore.getState().initNotesStorage(account);
  expect(await authority.saveAccountScopedNotes(account, [note])).toBe(true);
  expect(await authority.saveAccountScopedFolders([{ id: 'f', name: 'Folder', createdAt: 1 }])).toBe(true);
  expect(await authority.saveAccountScopedActiveNoteId(note.id)).toBe(true);
  await useNotesStore.getState().initNotesStorage(account);
}

function holdLock(number: number) {
  const release = deferred();
  const reached = deferred();
  const delegate = navigator.locks.request.bind(navigator.locks);
  let calls = 0;
  vi.spyOn(navigator.locks, 'request').mockImplementation((async (...args: any[]) => {
    if (++calls === number) { reached.resolve(); await release.promise; }
    return (delegate as any)(...args);
  }) as any);
  return { release, reached };
}

beforeEach(async () => {
  vi.restoreAllMocks();
  useNotesStore.getState().detachNotesStorage();
  persistence.resetNotesPersistenceForTests();
  values.clear();
  vi.stubGlobal('indexedDB', new IDBFactory());
  setRecoveryModeActiveForTest(false);
  await seed('account-b', other);
  await seed('account-a', original);
});

afterEach(() => {
  vi.restoreAllMocks();
  useNotesStore.getState().detachNotesStorage();
  persistence.resetNotesPersistenceForTests();
  setRecoveryModeActiveForTest(true);
  values.clear();
});

describe('bounded Notes reset acknowledgement', () => {
  it.each(['recovery', 'local_notes_persistence', 'initialization', 'note_remote_write'] as const)(
    'observes a selection write failure without replacing the existing %s diagnostic', async source => {
      const issue = { source, message: `original:${source}`, retryable: true };
      useNotesStore.setState({ syncIssue: issue, syncError: issue.message });
      const set = storage.setItem;
      vi.spyOn(storage, 'setItem').mockImplementation((key, value) => {
        if (key.includes('active.v1:account-a')) throw new Error('synthetic_selection_failure');
        set(key, value);
      });
      expect(await persistence.saveActiveNoteIdAsync(null)).toBe(false);
      useNotesStore.getState().setActiveNoteId(null);
      await authority.runAccountScopedNotesMutation('account-a', async () => {});
      expect(useNotesStore.getState().syncIssue).toEqual(issue);
      expect(useNotesStore.getState().syncError).toBe(issue.message);
    },
  );

  it('does not misreport synchronous account bridge writes as completed', async () => {
    const bridge = await import('../components/views/noteUtils');
    const before = [...values.entries()];
    expect(bridge.saveFolders([])).toBe(false);
    expect(bridge.saveActiveNoteId(null)).toBe(false);
    expect(bridge.clearNotesStorage()).toBe(false);
    expect([...values.entries()]).toEqual(before);
    expect(await persistence.saveFoldersAsync([{ id: 'new', name: 'New', createdAt: 5 }])).toBe(true);
    expect(authority.loadAccountScopedFolders()[0].id).toBe('new');
  });

  it.each(['create-folder', 'rename-folder', 'clear-note', 'change-note', 'active-folder', 'selection-aba'] as const)(
    'does not overwrite a newer %s intent while reset waits', async kind => {
      const gate = holdLock(1);
      const operation = useNotesStore.getState().resetAllNotes();
      try {
        await gate.reached.promise;
        const store = useNotesStore.getState();
        if (kind === 'create-folder') store.createFolder('New folder');
        if (kind === 'rename-folder') store.renameFolder('f', 'New name');
        if (kind === 'clear-note') store.setActiveNoteId(null);
        if (kind === 'change-note') store.setActiveNoteId(original.id);
        if (kind === 'active-folder') store.setActiveFolderId('f');
        if (kind === 'selection-aba') { store.setActiveFolderId('f'); store.setActiveFolderId(null); }
        await authority.runAccountScopedNotesMutation('account-a', async () => {});
      } finally { gate.release.resolve(); }
      const expected = useNotesStore.getState();
      const result = await operation;
      expect(result.status).toBe('stale');
      expect(result.completedStages).toEqual([]);
      expect(useNotesStore.getState().notes).toBe(expected.notes);
      expect(useNotesStore.getState().folders).toBe(expected.folders);
      expect(useNotesStore.getState().activeNoteId).toBe(expected.activeNoteId);
      expect(useNotesStore.getState().activeFolderId).toBe(expected.activeFolderId);
      expect((await authority.loadAccountScopedNotes('account-a'))[0].id).toBe(original.id);
      if (kind === 'create-folder') expect(authority.loadAccountScopedFolders().some(f => f.name === 'New folder')).toBe(true);
      if (kind === 'rename-folder') expect(authority.loadAccountScopedFolders()[0].name).toBe('New name');
      if (kind === 'clear-note') expect(authority.loadAccountScopedActiveNoteId([original])).toBeNull();
    },
  );

  it.each(['epoch', 'account-aba', 'selection'] as const)('aborts before destructive IDB requests on callback-time %s', async kind => {
    const getAll = FakeObjectStore.prototype.getAll;
    let reached = false;
    vi.spyOn(FakeObjectStore.prototype, 'getAll').mockImplementation(function (this: any, ...args: any[]) {
      const request = Reflect.apply(getAll, this, args);
      if (!reached && this.transaction.mode === 'readwrite') {
        request.addEventListener('success', () => {
          reached = true;
          if (kind === 'epoch') setRecoveryModeActiveForTest(true);
          if (kind === 'selection') useNotesStore.getState().setActiveFolderId('new-selection');
          if (kind === 'account-aba') {
            authority.activateNotesAccountAuthority('account-b');
            authority.activateNotesAccountAuthority('account-a');
          }
        }, { once: true });
      }
      return request;
    } as any);
    const remove = vi.spyOn(FakeObjectStore.prototype, 'delete');
    const put = vi.spyOn(FakeObjectStore.prototype, 'put');
    const result = await useNotesStore.getState().resetAllNotes();
    expect(reached).toBe(true);
    expect(result.status).toBe('stale');
    expect(remove).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect(await authority.loadAccountScopedNotes('account-a')).toEqual([original]);
  });

  it('holds exactly one lock through clear, Welcome and readback, excluding another participating writer', async () => {
    const transaction = FakeDatabase.prototype.transaction;
    const folders = [{ id: 'new-tab-folder', name: 'Other tab', createdAt: 9 }];
    let writer: Promise<boolean> | undefined;
    let reached = false;
    vi.spyOn(FakeDatabase.prototype, 'transaction').mockImplementation(function (this: any, ...args: any[]) {
      const tx = Reflect.apply(transaction, this, args);
      if (args[1] === 'readwrite' && !reached) {
        reached = true;
        tx.addEventListener('complete', () => { writer = authority.saveAccountScopedFolders(folders); }, { once: true });
      }
      return tx;
    } as any);
    const requestLock = vi.spyOn(navigator.locks, 'request');
    const result = await useNotesStore.getState().resetAllNotes();
    expect(result.status).toBe('completed'); // locked readback still saw the reset's empty folders
    expect(reached).toBe(true);
    expect(requestLock).toHaveBeenCalledTimes(2); // one reset + one queued writer, no reentrant acquisition
    expect(await writer).toBe(true);
    expect(authority.loadAccountScopedFolders()).toEqual(folders);
  });

  it('rejects a durable writer that completed before lock admission, without destructive requests', async () => {
    const entered = deferred(); const release = deferred();
    const holding = authority.runAccountScopedNotesMutation('account-a', async () => {
      entered.resolve(); await release.promise;
      storage.setItem('absinthe.notes.account-authority.folders.v1:account-a:notes.folders', JSON.stringify({
        accountId: 'account-a', domainId: 'notes.folders', schemaVersion: 1,
        folders: [{ id: 'other-tab', name: 'Committed before reset', createdAt: 2 }],
      }));
    });
    await entered.promise;
    const remove = vi.spyOn(FakeObjectStore.prototype, 'delete'); const put = vi.spyOn(FakeObjectStore.prototype, 'put');
    const reset = useNotesStore.getState().resetAllNotes();
    release.resolve(); await holding;
    expect((await reset).status).toBe('stale');
    expect(remove).not.toHaveBeenCalled(); expect(put).not.toHaveBeenCalled();
    expect(authority.loadAccountScopedFolders()[0].name).toBe('Committed before reset');
    expect(await authority.loadAccountScopedNotes('account-a')).toEqual([original]);
  });

  it.each(['unavailable', 'rejected'] as const)('fails closed when the lock is %s', async kind => {
    const before = [...values.entries()];
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'locks')!;
    if (kind === 'unavailable') Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    else vi.spyOn(navigator.locks, 'request').mockRejectedValueOnce(new Error('synthetic_acquisition_failure'));
    try {
      expect((await useNotesStore.getState().resetAllNotes()).status).toBe('incomplete');
      expect([...values.entries()]).toEqual(before);
    } finally { if (kind === 'unavailable') Object.defineProperty(navigator, 'locks', descriptor); }
  });

  it('does not start Welcome persistence or acknowledge success while clear is pending', async () => {
    const gate = holdLock(1);
    let settled = false;
    const operation = useNotesStore.getState().resetAllNotes().then(result => { settled = true; return result; });
    try {
      await gate.reached.promise;
      expect(settled).toBe(false);
      expect(await authority.loadAccountScopedNotes('account-a')).toEqual([original]);
      expect(useNotesStore.getState().notes[0].id).toBe(original.id);
    } finally { gate.release.resolve(); }
    expect((await operation).status).toBe('completed');
  });

  it('awaits clear and Welcome persistence, verifies the snapshot, and preserves B and excluded legacy data', async () => {
    const legacy = JSON.stringify([{ ...original, id: 'legacy' }]);
    storage.setItem(noteKey, legacy);
    storage.setItem('unrelated-attachment-test-sentinel', 'unchanged');
    const gate = holdLock(1); // the complete reset now has one acquisition
    let settled = false;
    const operation = useNotesStore.getState().resetAllNotes().then(result => { settled = true; return result; });
    try {
      await gate.reached.promise;
      expect(settled).toBe(false);
      expect(useNotesStore.getState().notes[0].id).toBe(original.id);
    } finally { gate.release.resolve(); }
    const result = await operation;
    expect(result.status).toBe('completed');
    expect(result.unresolvedStages).toEqual([]);
    expect(result.completedStages).toEqual(['local_metadata_clear', 'notes_clear', 'welcome_note', 'folders', 'active_note', 'readback']);
    const welcome = useNotesStore.getState().notes;
    expect(welcome).toHaveLength(1);
    expect(welcome[0].title).toContain('Welcome');
    expect(await authority.loadAccountScopedNotes('account-a')).toEqual(welcome);
    expect(authority.loadAccountScopedFolders()).toEqual([]);
    expect(authority.loadAccountScopedActiveNoteId(welcome)).toBe(welcome[0].id);
    expect(storage.getItem(noteKey)).toBe(legacy);
    expect(storage.getItem('unrelated-attachment-test-sentinel')).toBe('unchanged');
    await useNotesStore.getState().initNotesStorage('account-b');
    expect(useNotesStore.getState().notes).toEqual([other]);
  });

  it.each(['switch', 'aba', 'logout'] as const)('rejects %s while clear is pending without mutating the replacement account', async kind => {
    const gate = holdLock(1);
    const operation = useNotesStore.getState().resetAllNotes();
    try {
      await gate.reached.promise;
      if (kind === 'logout') useNotesStore.getState().detachNotesStorage();
      else {
        await useNotesStore.getState().initNotesStorage('account-b');
        if (kind === 'aba') await useNotesStore.getState().initNotesStorage('account-a');
      }
    } finally { gate.release.resolve(); }
    expect((await operation).status).toBe('stale');
    await useNotesStore.getState().initNotesStorage('account-b');
    expect(useNotesStore.getState().notes).toEqual([other]);
    await useNotesStore.getState().initNotesStorage('account-a');
    expect(useNotesStore.getState().notes).toEqual([original]);
  });

  it('does not claim rollback when the account changes after clear but before the Welcome writer', async () => {
    const delegate = FakeDatabase.prototype.transaction;
    let writes = 0;
    vi.spyOn(FakeDatabase.prototype, 'transaction').mockImplementation(function (this: any, ...args: any[]) {
      const tx = Reflect.apply(delegate, this, args);
      if (args[1] === 'readwrite' && ++writes === 2) authority.activateNotesAccountAuthority('account-b');
      return tx;
    } as any);
    const result = await useNotesStore.getState().resetAllNotes();
    expect(writes).toBe(2);
    expect(result.status).toBe('stale');
    expect(result.completedStages).toContain('notes_clear');
    expect(result.unresolvedStages).toContain('welcome_note');
    await useNotesStore.getState().initNotesStorage('account-b');
    expect(useNotesStore.getState().notes).toEqual([other]);
  });

  it('fails closed on an account-scoped clear rejection', async () => {
    vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => { throw new Error('synthetic_open_failure'); });
    const result = await useNotesStore.getState().resetAllNotes();
    expect(result.status).toBe('incomplete');
    expect(result.completedStages).toEqual([]); // pre-admission durable read failed
    expect(result.unresolvedStages).toContain('notes_clear');
  });

  it('observes a real aborted clear transaction rather than acknowledging it', async () => {
    const delegate = FakeDatabase.prototype.transaction;
    let abort = true;
    vi.spyOn(FakeDatabase.prototype, 'transaction').mockImplementation(function (this: any, ...args: any[]) {
      const transaction = Reflect.apply(delegate, this, args);
      if (abort && args[1] === 'readwrite') { abort = false; queueMicrotask(() => transaction.abort()); }
      return transaction;
    } as any);
    const result = await useNotesStore.getState().resetAllNotes();
    expect(result.status).toBe('incomplete');
    expect(result.unresolvedStages).toContain('notes_clear');
  });

  it.each(['notes-state', 'folders-clear', 'active-clear', 'folders-final', 'active-final'] as const)('reports %s failure without a completed result', async target => {
    const set = storage.setItem;
    let folderWrites = 0;
    let activeWrites = 0;
    vi.spyOn(storage, 'setItem').mockImplementation((key, value) => {
      if (key.includes('folders.v1:account-a')) folderWrites += 1;
      if (key.includes('active.v1:account-a')) activeWrites += 1;
      if ((target === 'notes-state' && key.includes('state.v1:account-a:notes.core') && JSON.parse(value).state === 'LOADED_EMPTY')
        || (target === 'folders-clear' && key.includes('folders.v1:account-a') && folderWrites === 2)
        || (target === 'active-clear' && key.includes('active.v1:account-a') && activeWrites === 2)
        || (target === 'folders-final' && key.includes('folders.v1:account-a') && folderWrites === 3)
        || (target === 'active-final' && key.includes('active.v1:account-a') && value !== '')) throw new Error('synthetic_storage_failure');
      set(key, value);
    });
    const result = await useNotesStore.getState().resetAllNotes();
    expect(result.status).toBe('incomplete');
    expect(result.unresolvedStages.length).toBeGreaterThan(0);
    if (target.endsWith('final')) expect(result.completedStages).toContain('welcome_note');
    if (target === 'active-final') expect(result.unresolvedStages).toContain('active_note');
    // The UI snapshot is not relabeled as a successful reset on any failure.
    expect(useNotesStore.getState().notes[0].id).toBe(original.id);
  });

  it('reports Welcome writer rejection after a successful clear as partial, not rollback', async () => {
    const delegate = FakeDatabase.prototype.transaction;
    let writes = 0;
    vi.spyOn(FakeDatabase.prototype, 'transaction').mockImplementation(function (this: any, ...args: any[]) {
      if (args[1] === 'readwrite' && ++writes === 2) throw new Error('synthetic_welcome_failure');
      return Reflect.apply(delegate, this, args);
    } as any);
    const result = await useNotesStore.getState().resetAllNotes();
    expect(result.status).toBe('incomplete');
    expect(result.completedStages).toEqual(['local_metadata_clear', 'notes_clear']);
    expect(result.unresolvedStages).toContain('welcome_note');
    expect(await authority.loadAccountScopedNotes('account-a')).toEqual([]);
  });

  it('rejects a final selection readback mismatch', async () => {
    const get = storage.getItem;
    const set = storage.setItem;
    let finalWritten = false;
    vi.spyOn(storage, 'setItem').mockImplementation((key, value) => {
      if (key.includes('active.v1:account-a') && value && value !== original.id) finalWritten = true;
      set(key, value);
    });
    vi.spyOn(storage, 'getItem').mockImplementation(key => finalWritten && key.includes('active.v1:account-a') ? 'wrong-id' : get(key));
    const result = await useNotesStore.getState().resetAllNotes();
    expect(result.status).toBe('incomplete');
    expect(result.unresolvedStages).toEqual(['readback']);
  });

  it('preserves the recovery-mode denial and all durable records', async () => {
    const before = [...values.entries()];
    setRecoveryModeActiveForTest(true);
    expect((await useNotesStore.getState().resetAllNotes()).status).toBe('blocked');
    expect([...values.entries()]).toEqual(before);
    expect(await authority.loadAccountScopedNotes('account-a')).toEqual([original]);
  });

  it('does not use a missing authenticated Notes identity as legacy reset authority', async () => {
    useNotesStore.getState().detachNotesStorage();
    storage.setItem(noteKey, JSON.stringify([original]));
    expect(persistence.captureNotesResetContext('account-a')).toBeNull();
    expect(storage.getItem(noteKey)).toBe(JSON.stringify([original]));
  });

  it.each(['exception', 'false-return'] as const)('does not swallow legacy %s', async kind => {
    useNotesStore.getState().detachNotesStorage();
    persistence.resetNotesPersistenceForTests();
    if (kind === 'exception') vi.stubGlobal('indexedDB', undefined);
    storage.setItem(noteKey, JSON.stringify([original]));
    // This case tests clear acknowledgement, not the separate legacy migration writer.
    storage.setItem('notes-storage-migrated-v2', '1');
    // Initialize only the persistence fixture: Store's compatibility hydration
    // can launch a separate background migration write, which is not this oracle.
    await persistence.initNotesPersistence();
    if (kind === 'exception') vi.spyOn(storage, 'removeItem').mockImplementation(() => { throw new Error('synthetic_remove_failure'); });
    else vi.spyOn(legacyDb, 'clearIndexedDbNotes').mockResolvedValueOnce(false);
    const result = await useNotesStore.getState().resetAllNotes();
    expect(result.status).toBe('incomplete');
    expect(result.unresolvedStages).toContain(kind === 'exception' ? 'local_metadata_clear' : 'notes_clear');
  });
});
