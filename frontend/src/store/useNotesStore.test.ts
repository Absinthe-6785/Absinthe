/**
 * useNotesStore 통합 테스트 — import/sync, sync 실패, Settings Reset, Planner 공유
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NOTES_KEY,
  FOLDERS_KEY,
  ACTIVE_KEY,
  noteSyncPayload,
  LOCAL_NOTES_SAVE_ERROR,
  LOCAL_FOLDERS_SAVE_ERROR,
  loadFolders,
  type NoteBase,
} from '../components/views/noteUtils';

// ── localStorage mock (vitest node env) ─────────────────────────────
const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v); },
  removeItem: (k: string) => { storage.delete(k); },
  clear: () => { storage.clear(); },
  key: (i: number) => [...storage.keys()][i] ?? null,
  get length() { return storage.size; },
};
vi.stubGlobal('localStorage', localStorageMock);

const authFetchMock = vi.fn();
vi.mock('../lib/supabase', () => ({
  authFetch: (...args: unknown[]) => authFetchMock(...args),
}));

// loadNotes() runs at module init — import after localStorage stub
import {
  resetNotesPersistenceForTests,
  saveNotesAsync,
  setCachedNotes,
  validateLocalStorageNotesReplacement,
} from '../lib/notePersistence';
import { activateRecoveryMode, setRecoveryModeActiveForTest } from '../lib/recoverySafetyPolicy';
import {
  NOTES_FOLDERS_BOOTSTRAP_KEY,
  NOTES_LAST_SYNC_KEY,
  NOTES_RUNTIME_SYNC_MODE_KEY,
} from '../lib/notesSyncClient';
import {
  flushAutoSnapshotForTests,
  resetAutoSnapshotStateForTests,
} from '../lib/vaultSnapshotAuto';
import { SNAPSHOT_INDEX_KEY } from '../lib/vaultSnapshotConstants';
import { buildVaultBackupManifest, type VaultBackupManifest } from '../lib/exportVaultBackup';
import {
  loadVaultRestoreSnapshot,
  VAULT_RESTORE_SNAPSHOT_FAILURE_MESSAGE,
  VAULT_RESTORE_SNAPSHOT_KEY,
} from '../lib/vaultRestoreSnapshot';
const {
  useNotesStore,
  applyStorageMerge,
  isVaultRestoreUndoAvailable,
  VaultRestoreDurabilityError,
} = await import('./useNotesStore');

function okJson(data: unknown) {
  return { ok: true, status: 200, json: async () => data };
}

function failResponse(status = 500) {
  return { ok: false, status, json: async () => ({}) };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => { resolve = res; });
  return { promise, resolve };
}

function skipFolderBootstrap() {
  storage.set(NOTES_FOLDERS_BOOTSTRAP_KEY, '1');
}

function noteApiCalls(method?: string) {
  return authFetchMock.mock.calls.filter(([url, opts]) => {
    const requestMethod = (opts as RequestInit | undefined)?.method ?? 'GET';
    return String(url).includes('/api/notes') && (!method || requestMethod === method);
  });
}

const sampleNote = (): NoteBase => ({
  id: 'note-import-1',
  title: 'Imported',
  body: '# Hello from import',
  updatedAt: Date.now(),
  folderId: null,
  deletedAt: null,
  starred: false,
});

function resetStore() {
  setRecoveryModeActiveForTest(false);
  storage.clear();
  storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
  authFetchMock.mockReset();
  resetNotesPersistenceForTests();
  useNotesStore.setState({
    notes: [],
    folders: [],
    activeNoteId: null,
    activeFolderId: null,
    isSyncing: false,
    savedAt: null,
    syncError: null,
  });
}

describe('useNotesStore — import & DB sync', () => {
  beforeEach(() => resetStore());
  afterEach(() => vi.useRealTimers());

  it('importNote adds note to state, localStorage, and POSTs to API', async () => {
    authFetchMock.mockResolvedValue(okJson({}));

    const note = sampleNote();
    useNotesStore.getState().importNote(note);

    const { notes, activeNoteId } = useNotesStore.getState();
    expect(notes[0]).toMatchObject({ id: note.id, title: 'Imported' });
    expect(activeNoteId).toBe(note.id);
    expect(JSON.parse(storage.get(NOTES_KEY)!)).toHaveLength(1);

    await vi.waitFor(() => {
      expect(authFetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/notes'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(noteSyncPayload(note)),
        }),
      );
    });
    expect(useNotesStore.getState().syncError).toBeNull();
  });

  it('hydrateFromDB uploads local-only notes then merges', async () => {
    const local = sampleNote();
    useNotesStore.setState({ notes: [local], activeNoteId: local.id });
    storage.set(NOTES_KEY, JSON.stringify([local]));

    authFetchMock
      .mockResolvedValueOnce(okJson([]))   // folders
      .mockResolvedValueOnce(okJson([]))   // notes GET empty
      .mockResolvedValueOnce(okJson({}));  // note POST

    await useNotesStore.getState().hydrateFromDB();

    expect(authFetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/notes'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(useNotesStore.getState().notes.some(n => n.id === local.id)).toBe(true);
  });

  it('initNotesStorage merges pre-hydration in-memory notes with stored notes', async () => {
    const stored = { ...sampleNote(), id: 'stored-note', title: 'Stored', updatedAt: 10 };
    const draft = { ...sampleNote(), id: 'draft-note', title: 'Draft', updatedAt: 20 };
    storage.set(NOTES_KEY, JSON.stringify([stored]));
    useNotesStore.setState({ notes: [draft], activeNoteId: draft.id });

    await useNotesStore.getState().initNotesStorage();

    expect(useNotesStore.getState().notes.map(n => n.id).sort()).toEqual(['draft-note', 'stored-note']);
    const saved = JSON.parse(storage.get(NOTES_KEY) ?? '[]') as NoteBase[];
    expect(saved.map(n => n.id).sort()).toEqual(['draft-note', 'stored-note']);
  });
});

describe('useNotesStore local-only sync mode', () => {
  beforeEach(() => {
    resetStore();
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'local');
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('does not call notes cloud APIs for create, edit, flush, hydrate, folders, or delete', async () => {
    authFetchMock.mockResolvedValue(okJson([]));

    const id = useNotesStore.getState().createNote({ title: 'Local', body: 'draft' });
    const folderId = useNotesStore.getState().createFolder('Local Folder');
    useNotesStore.getState().updateNote(id, { body: 'local edit' });
    useNotesStore.getState().flushPendingSync();
    await useNotesStore.getState().hydrateFromDB();
    useNotesStore.getState().deleteFolder(folderId);
    useNotesStore.getState().permanentDeleteNote(id);

    vi.advanceTimersByTime(600);
    await Promise.resolve();

    expect(authFetchMock).not.toHaveBeenCalled();
    expect(useNotesStore.getState().syncError).toBeNull();
  });
});

describe('useNotesStore — sync failure & retry', () => {
  beforeEach(() => {
    resetStore();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('sets syncError on failed POST and clears on retry', async () => {
    authFetchMock
      .mockResolvedValueOnce(failResponse(503))
      .mockResolvedValueOnce(okJson({}));

    const note = sampleNote();
    useNotesStore.getState().importNote(note);
    await Promise.resolve();

    expect(useNotesStore.getState().syncError).toContain('503');

    useNotesStore.getState().retrySync();
    await Promise.resolve();

    expect(useNotesStore.getState().syncError).toBeNull();
    expect(useNotesStore.getState().savedAt).toBeInstanceOf(Date);
    expect(authFetchMock).toHaveBeenCalledTimes(2);
  });

  it('flushPendingSync immediately syncs debounced body edits', async () => {
    authFetchMock.mockResolvedValue(okJson({}));

    const id = useNotesStore.getState().createNote({ title: 'T', body: 'initial' });
    await Promise.resolve();
    authFetchMock.mockClear();

    useNotesStore.getState().updateNote(id, { body: 'edited body' });
    expect(authFetchMock).not.toHaveBeenCalled();

    useNotesStore.getState().flushPendingSync();
    await Promise.resolve();

    expect(authFetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/notes'),
      expect.objectContaining({
        body: expect.stringContaining('edited body'),
      }),
    );
  });
});

describe('useNotesStore — Settings Reset', () => {
  beforeEach(() => resetStore());

  it('resetAllNotes clears old localStorage and seeds welcome note', () => {
    const old = sampleNote();
    useNotesStore.setState({ notes: [old], folders: [{ id: 'f1', name: 'X', createdAt: 1 }], activeNoteId: old.id });
    storage.set(NOTES_KEY, JSON.stringify([old]));
    storage.set(FOLDERS_KEY, JSON.stringify([{ id: 'f1', name: 'X', createdAt: 1 }]));
    storage.set(ACTIVE_KEY, old.id);

    useNotesStore.getState().resetAllNotes();

    const { notes, folders, syncError } = useNotesStore.getState();
    expect(notes).toHaveLength(1);
    expect(notes[0].id).not.toBe(old.id);
    expect(notes[0].title).toContain('Welcome');
    expect(folders).toHaveLength(0);
    expect(syncError).toBeNull();
    expect(JSON.parse(storage.get(FOLDERS_KEY) ?? '[]')).toEqual([]);
    const stored = JSON.parse(storage.get(NOTES_KEY)!);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(notes[0].id);
  });

  it('after reset, hydrate does not resurrect wiped notes', async () => {
    const old = sampleNote();
    useNotesStore.setState({ notes: [old] });
    useNotesStore.getState().resetAllNotes();

    authFetchMock
      .mockResolvedValueOnce(okJson([]))
      .mockResolvedValueOnce(okJson([]))
      .mockResolvedValue(okJson({}));

    await useNotesStore.getState().hydrateFromDB();

    expect(useNotesStore.getState().notes.some(n => n.id === old.id)).toBe(false);
    const postedOld = authFetchMock.mock.calls.some(([, opts]) => {
      const body = (opts as RequestInit)?.body;
      return typeof body === 'string' && body.includes(old.id);
    });
    expect(postedOld).toBe(false);
  });
});

describe('useNotesStore — per-note pending queue', () => {
  beforeEach(() => {
    resetStore();
    vi.useFakeTimers();
    authFetchMock.mockResolvedValue(okJson({}));
  });
  afterEach(() => vi.useRealTimers());

  function postedBodies() {
    return authFetchMock.mock.calls
      .filter(([url]) => String(url).includes('/api/notes'))
      .map(([, opts]) => JSON.parse((opts as RequestInit).body as string));
  }

  it('flushPendingSync syncs all notes with pending body edits', async () => {
    const idA = 'note-a';
    const idB = 'note-b';
    useNotesStore.setState({
      notes: [
        { id: idA, title: 'A', body: 'a0', updatedAt: 1, folderId: null, deletedAt: null },
        { id: idB, title: 'B', body: 'b0', updatedAt: 2, folderId: null, deletedAt: null },
      ],
      activeNoteId: idA,
    });
    authFetchMock.mockClear();

    useNotesStore.getState().updateNote(idA, { body: 'a-edited' });
    useNotesStore.getState().updateNote(idB, { body: 'b-edited' });
    useNotesStore.getState().flushPendingSync();
    await Promise.resolve();

    const bodies = postedBodies();
    expect(bodies.some(b => b.body === 'a-edited')).toBe(true);
    expect(bodies.some(b => b.body === 'b-edited')).toBe(true);
  });

  it('independent debounce timers sync both notes after note switch', async () => {
    const idA = 'note-a';
    const idB = 'note-b';
    useNotesStore.setState({
      notes: [
        { id: idA, title: 'A', body: 'a0', updatedAt: 1, folderId: null, deletedAt: null },
        { id: idB, title: 'B', body: 'b0', updatedAt: 2, folderId: null, deletedAt: null },
      ],
      activeNoteId: idA,
    });
    authFetchMock.mockClear();

    useNotesStore.getState().updateNote(idA, { body: 'a-edited' });
    useNotesStore.getState().setActiveNoteId(idB);
    useNotesStore.getState().updateNote(idB, { body: 'b-edited' });

    vi.advanceTimersByTime(600);
    await Promise.resolve();

    const bodies = postedBodies();
    expect(bodies.some(b => b.body === 'a-edited')).toBe(true);
    expect(bodies.some(b => b.body === 'b-edited')).toBe(true);
  });
});

describe('useNotesStore — metadata updatedAt & hydrate merge', () => {
  beforeEach(() => resetStore());

  it('moveNoteToTrash bumps updatedAt so trash state wins on hydrate', async () => {
    const before = Date.now();
    const note: NoteBase = {
      id: 'n-trash', title: 'T', body: 'b', updatedAt: 100,
      folderId: null, deletedAt: null,
    };
    useNotesStore.setState({ notes: [note], activeNoteId: note.id });

    useNotesStore.getState().moveNoteToTrash(note.id);
    const trashed = useNotesStore.getState().notes.find(n => n.id === note.id)!;
    expect(trashed.deletedAt).not.toBeNull();
    expect(trashed.updatedAt).toBeGreaterThanOrEqual(before);

    authFetchMock
      .mockResolvedValueOnce(okJson([]))
      .mockResolvedValueOnce(okJson([{
        id: note.id, title: 'T', body: 'b', updated_at: 100, folder_id: null, deleted_at: null,
      }]));

    await useNotesStore.getState().hydrateFromDB();

    const after = useNotesStore.getState().notes.find(n => n.id === note.id)!;
    expect(after.deletedAt).not.toBeNull();
  });

  it('deleteFolder bumps updatedAt on affected notes', () => {
    const folderId = 'folder-1';
    const note: NoteBase = {
      id: 'n-f', title: 'F', body: '', updatedAt: 50,
      folderId, deletedAt: null,
    };
    useNotesStore.setState({
      notes: [note],
      folders: [{ id: folderId, name: 'Work', createdAt: 1 }],
    });

    const before = Date.now();
    useNotesStore.getState().deleteFolder(folderId);
    const updated = useNotesStore.getState().notes.find(n => n.id === note.id)!;
    expect(updated.folderId).toBeNull();
    expect(updated.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it('hydrate keeps local folderId when local updatedAt is newer than DB', async () => {
    const note: NoteBase = {
      id: 'n-folder', title: 'T', body: 'b', updatedAt: 500,
      folderId: 'folder-new', deletedAt: null,
    };
    useNotesStore.setState({ notes: [note] });

    authFetchMock
      .mockResolvedValueOnce(okJson([]))
      .mockResolvedValueOnce(okJson([{
        id: note.id, title: 'T', body: 'b', updated_at: 100,
        folder_id: 'folder-old', deleted_at: null,
      }]));

    await useNotesStore.getState().hydrateFromDB();

    expect(useNotesStore.getState().notes[0].folderId).toBe('folder-new');
  });

  it('updateNote folderId change bumps updatedAt (already via updateNote)', () => {
    authFetchMock.mockResolvedValue(okJson({}));
    const id = useNotesStore.getState().createNote({ title: 'T', body: '' });
    const created = useNotesStore.getState().notes.find(n => n.id === id)!;
    expect(created.createdAt).toBeDefined();
    expect(created.createdAt).toBe(created.updatedAt);
    const prevUpdatedAt = created.updatedAt;

    useNotesStore.getState().updateNote(id, { folderId: 'folder-x' });
    const updated = useNotesStore.getState().notes.find(n => n.id === id)!;
    expect(updated.folderId).toBe('folder-x');
    expect(updated.updatedAt).toBeGreaterThanOrEqual(prevUpdatedAt);
  });
});

describe('useNotesStore — permanentDeleteNote pending cleanup', () => {
  beforeEach(() => {
    resetStore();
    vi.useFakeTimers();
    authFetchMock.mockResolvedValue(okJson({}));
  });
  afterEach(() => vi.useRealTimers());

  it('does not POST deleted note when body debounce timer fires', async () => {
    const id = 'note-del';
    useNotesStore.setState({
      notes: [{ id, title: 'T', body: 'draft', updatedAt: 1, folderId: null, deletedAt: Date.now() }],
      activeNoteId: id,
    });
    authFetchMock.mockClear();

    useNotesStore.getState().updateNote(id, { body: 'unsynced edit' });
    useNotesStore.getState().permanentDeleteNote(id);

    expect(useNotesStore.getState().notes.some(n => n.id === id)).toBe(false);

    vi.advanceTimersByTime(600);
    await Promise.resolve();

    const postCalls = authFetchMock.mock.calls.filter(
      ([url, opts]) =>
        String(url).includes('/api/notes') &&
        (opts as RequestInit)?.method === 'POST',
    );
    expect(postCalls).toHaveLength(0);
  });
});

describe('useNotesStore — delete failure & local save errors', () => {
  beforeEach(() => resetStore());

  it('permanentDeleteNote sets syncError on DELETE failure and retrySync retries DELETE', async () => {
    const id = 'note-del-fail';
    useNotesStore.setState({
      notes: [{ id, title: 'T', body: '', updatedAt: 1, folderId: null, deletedAt: Date.now() }],
      activeNoteId: id,
    });

    authFetchMock.mockResolvedValueOnce(failResponse(503));
    useNotesStore.getState().permanentDeleteNote(id);
    await Promise.resolve();

    expect(useNotesStore.getState().notes.some(n => n.id === id)).toBe(false);
    expect(useNotesStore.getState().syncError).toContain('503');

    authFetchMock.mockResolvedValueOnce(okJson({}));
    useNotesStore.getState().retrySync();
    await Promise.resolve();

    expect(authFetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining(`/api/notes/${id}`),
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(useNotesStore.getState().syncError).toBeNull();
  });

  it('sets syncError when notes localStorage save fails and retrySync clears after recovery', async () => {
    authFetchMock.mockResolvedValue(okJson({}));
    const id = 'note-quota';
    useNotesStore.setState({
      notes: [{ id, title: 'T', body: 'x', updatedAt: 1, folderId: null, deletedAt: null }],
      activeNoteId: id,
    });

    const setItem = vi.spyOn(localStorageMock, 'setItem').mockImplementation((key, value) => {
      if (key === NOTES_KEY) {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      }
      storage.set(key, value);
    });

    useNotesStore.getState().updateNote(id, { title: 'Too big' });
    expect(useNotesStore.getState().syncError).toBe(LOCAL_NOTES_SAVE_ERROR);

    setItem.mockRestore();
    useNotesStore.getState().retrySync();
    await Promise.resolve();
    expect(useNotesStore.getState().syncError).toBeNull();
  });

  it('sets syncError when folders localStorage save fails', () => {
    useNotesStore.setState({ notes: [], folders: [] });

    const setItem = vi.spyOn(localStorageMock, 'setItem').mockImplementation((key, value) => {
      if (key === FOLDERS_KEY) {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      }
      storage.set(key, value);
    });

    useNotesStore.getState().createFolder('Work');
    expect(useNotesStore.getState().syncError).toBe(LOCAL_FOLDERS_SAVE_ERROR);

    setItem.mockRestore();
  });

  it('renameFolder updates folder name and persists', () => {
    useNotesStore.setState({ notes: [], folders: [] });
    const id = useNotesStore.getState().createFolder('Old Name');
    useNotesStore.getState().renameFolder(id, 'Renamed');
    expect(useNotesStore.getState().folders.find(f => f.id === id)?.name).toBe('Renamed');
    const stored = JSON.parse(localStorageMock.getItem(FOLDERS_KEY) ?? '[]') as { id: string; name: string }[];
    expect(stored.find(f => f.id === id)?.name).toBe('Renamed');
  });
});

describe('useNotesStore — multi-tab storage merge', () => {
  beforeEach(() => resetStore());

  it('applyStorageMerge updates notes from peer tab by updatedAt', () => {
    useNotesStore.setState({
      notes: [{ id: '1', title: 'A', body: 'tab-a', updatedAt: 100, folderId: null, deletedAt: null }],
      activeNoteId: '1',
    });

    applyStorageMerge(
      NOTES_KEY,
      JSON.stringify([{ id: '1', title: 'A', body: 'tab-b', updatedAt: 200, folderId: null, deletedAt: null }]),
    );

    expect(useNotesStore.getState().notes[0].body).toBe('tab-b');
    expect(JSON.parse(storage.get(NOTES_KEY)!).find((n: NoteBase) => n.id === '1').body).toBe('tab-b');
  });
});

describe('useNotesStore — Planner + NoteView shared state', () => {
  beforeEach(() => resetStore());

  it('updateNote from Planner path is visible in shared store (NoteView reads same notes)', () => {
    authFetchMock.mockResolvedValue(okJson({}));

    const id = useNotesStore.getState().createNote({ title: 'Memo', body: 'planner text' });
    useNotesStore.getState().updateNote(id, { body: 'updated from planner' });

    const shared = useNotesStore.getState().notes.find(n => n.id === id);
    expect(shared?.body).toBe('updated from planner');
    expect(useNotesStore.getState().activeNoteId).toBe(id);
  });
});

describe('useNotesStore — K-96A trash cleanup', () => {
  beforeEach(() => {
    resetStore();
    authFetchMock.mockResolvedValue(okJson({}));
  });

  it('deleteNotePermanently removes trashed note and picks next trashed active id', () => {
    useNotesStore.setState({
      notes: [
        { id: 'a', title: 'A', body: 'one', updatedAt: 1, folderId: null, deletedAt: 100 },
        { id: 'b', title: 'B', body: 'two', updatedAt: 2, folderId: null, deletedAt: 200 },
      ],
      activeNoteId: 'a',
      activeFolderId: 'trash',
    });

    useNotesStore.getState().deleteNotePermanently('a');

    expect(useNotesStore.getState().notes.map(n => n.id)).toEqual(['b']);
    expect(useNotesStore.getState().activeNoteId).toBe('b');
  });

  it('emptyTrash removes all deleted notes and keeps folders', () => {
    useNotesStore.setState({
      notes: [
        { id: 'keep', title: 'Keep', body: '', updatedAt: 1, folderId: 'f1', deletedAt: null },
        { id: 't1', title: 'T1', body: 'trash', updatedAt: 2, folderId: null, deletedAt: 100 },
        { id: 't2', title: 'T2', body: 'trash', updatedAt: 3, folderId: null, deletedAt: 200 },
      ],
      folders: [{ id: 'f1', name: 'Study', createdAt: 1 }],
      activeNoteId: 't1',
      activeFolderId: 'trash',
    });

    useNotesStore.getState().emptyTrash();

    expect(useNotesStore.getState().notes.map(n => n.id)).toEqual(['keep']);
    expect(useNotesStore.getState().folders).toHaveLength(1);
    expect(useNotesStore.getState().activeNoteId).toBeNull();
  });
});

describe('useNotesStore K-142 notes delta sync foundation', () => {
  beforeEach(() => resetStore());

  it('remote mode pulls changed-since only', async () => {
    skipFolderBootstrap();
    storage.set(NOTES_LAST_SYNC_KEY, '123');
    authFetchMock.mockResolvedValueOnce(okJson([]));

    await useNotesStore.getState().hydrateFromDB();

    expect(authFetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/notes?updated_after=123'),
    );
    expect(noteApiCalls('GET')[0][0]).not.toMatch(/\/api\/notes$/);
  });

  it('empty remote pull does not clear local notes', async () => {
    skipFolderBootstrap();
    storage.set(NOTES_LAST_SYNC_KEY, '200');
    const local = { ...sampleNote(), id: 'local-note', title: 'Keep me', updatedAt: 100 };
    useNotesStore.setState({ notes: [local], activeNoteId: local.id });
    authFetchMock.mockResolvedValueOnce(okJson([]));

    await useNotesStore.getState().hydrateFromDB();

    expect(useNotesStore.getState().notes).toHaveLength(1);
    expect(useNotesStore.getState().notes[0].id).toBe(local.id);
    expect(noteApiCalls('POST')).toHaveLength(0);
  });

  it('dirty local note is pushed after delta pull', async () => {
    skipFolderBootstrap();
    storage.set(NOTES_LAST_SYNC_KEY, '50');
    const local = { ...sampleNote(), id: 'dirty-note', updatedAt: 100 };
    useNotesStore.setState({ notes: [local], activeNoteId: local.id });
    authFetchMock
      .mockResolvedValueOnce(okJson([]))
      .mockResolvedValueOnce(okJson({}));

    await useNotesStore.getState().hydrateFromDB();

    const posts = noteApiCalls('POST');
    expect(posts).toHaveLength(1);
    expect((posts[0][1] as RequestInit).body).toContain('dirty-note');
  });

  it('clean local note is not pushed', async () => {
    skipFolderBootstrap();
    storage.set(NOTES_LAST_SYNC_KEY, '200');
    const local = { ...sampleNote(), id: 'clean-note', updatedAt: 100 };
    useNotesStore.setState({ notes: [local], activeNoteId: local.id });
    authFetchMock.mockResolvedValueOnce(okJson([]));

    await useNotesStore.getState().hydrateFromDB();

    expect(noteApiCalls('POST')).toHaveLength(0);
  });

  it('deleted local note syncs as a tombstone', async () => {
    skipFolderBootstrap();
    storage.set(NOTES_LAST_SYNC_KEY, '50');
    const deleted = { ...sampleNote(), id: 'deleted-note', updatedAt: 100, deletedAt: 120 };
    useNotesStore.setState({ notes: [deleted], activeNoteId: null });
    authFetchMock
      .mockResolvedValueOnce(okJson([]))
      .mockResolvedValueOnce(okJson({}));

    await useNotesStore.getState().hydrateFromDB();

    const posts = noteApiCalls('POST');
    expect(posts).toHaveLength(1);
    expect(JSON.parse((posts[0][1] as RequestInit).body as string)).toMatchObject({
      id: 'deleted-note',
      deleted_at: 120,
    });
  });

  it('remote pull merges into local notes instead of replacing them', async () => {
    skipFolderBootstrap();
    storage.set(NOTES_LAST_SYNC_KEY, '200');
    const local = { ...sampleNote(), id: 'local-note', title: 'Local', updatedAt: 150 };
    useNotesStore.setState({ notes: [local], activeNoteId: local.id });
    authFetchMock.mockResolvedValueOnce(okJson([{
      id: 'remote-note',
      title: 'Remote',
      body: 'remote body',
      updated_at: 300,
      folder_id: null,
      deleted_at: null,
    }]));

    await useNotesStore.getState().hydrateFromDB();

    expect(useNotesStore.getState().notes.map(n => n.id).sort()).toEqual(['local-note', 'remote-note']);
  });

  it('stale late remote data cannot overwrite newer local in-memory edits', async () => {
    skipFolderBootstrap();
    storage.set(NOTES_LAST_SYNC_KEY, '100');
    const local = { ...sampleNote(), id: 'same-note', body: 'new local body', updatedAt: 300 };
    useNotesStore.setState({ notes: [local], activeNoteId: local.id });
    authFetchMock
      .mockResolvedValueOnce(okJson([{
        id: 'same-note',
        title: 'Remote',
        body: 'stale remote body',
        updated_at: 200,
        folder_id: null,
        deleted_at: null,
      }]))
      .mockResolvedValueOnce(okJson({}));

    await useNotesStore.getState().hydrateFromDB();

    expect(useNotesStore.getState().notes.find(n => n.id === 'same-note')?.body).toBe('new local body');
    const posts = noteApiCalls('POST');
    expect(posts).toHaveLength(1);
    expect((posts[0][1] as RequestInit).body).toContain('new local body');
  });

  it('newer remote tombstone hides an older local note', async () => {
    skipFolderBootstrap();
    storage.set(NOTES_LAST_SYNC_KEY, '200');
    const local = { ...sampleNote(), id: 'same-note', body: 'old local body', updatedAt: 100, deletedAt: null };
    useNotesStore.setState({ notes: [local], activeNoteId: local.id });
    authFetchMock
      .mockResolvedValueOnce(okJson([{
        id: 'same-note',
        title: 'Remote deleted',
        body: 'old local body',
        updated_at: 100,
        folder_id: null,
        deleted_at: 300,
      }]))
      .mockResolvedValueOnce(okJson({}));

    await useNotesStore.getState().hydrateFromDB();

    expect(useNotesStore.getState().notes.find(n => n.id === 'same-note')?.deletedAt).toBe(300);
    expect(JSON.parse((noteApiCalls('POST')[0][1] as RequestInit).body as string)).toMatchObject({
      id: 'same-note',
      deleted_at: 300,
    });
  });

  it('stale remote tombstone does not delete a newer local edit', async () => {
    skipFolderBootstrap();
    storage.set(NOTES_LAST_SYNC_KEY, '100');
    const local = { ...sampleNote(), id: 'same-note', body: 'new local body', updatedAt: 400, deletedAt: null };
    useNotesStore.setState({ notes: [local], activeNoteId: local.id });
    authFetchMock
      .mockResolvedValueOnce(okJson([{
        id: 'same-note',
        title: 'Remote deleted',
        body: 'stale tombstone',
        updated_at: 50,
        folder_id: null,
        deleted_at: 300,
      }]))
      .mockResolvedValueOnce(okJson({}));

    await useNotesStore.getState().hydrateFromDB();

    const note = useNotesStore.getState().notes.find(n => n.id === 'same-note');
    expect(note?.deletedAt).toBeNull();
    expect(note?.body).toBe('new local body');
  });

  it('does not advance the cursor when coupled dirty push fails', async () => {
    skipFolderBootstrap();
    storage.set(NOTES_LAST_SYNC_KEY, '100');
    const local = { ...sampleNote(), id: 'dirty-note', updatedAt: 300 };
    useNotesStore.setState({ notes: [local], activeNoteId: local.id });
    authFetchMock
      .mockResolvedValueOnce(okJson([]))
      .mockResolvedValueOnce(failResponse(503));

    await useNotesStore.getState().hydrateFromDB();

    expect(storage.get(NOTES_LAST_SYNC_KEY)).toBe('100');
    expect(useNotesStore.getState().syncError).toContain('503');
  });
});

describe('K-319 recovery freeze guards', () => {
  beforeEach(() => {
    resetStore();
    setRecoveryModeActiveForTest(true);
  });

  it('blocks upload and hydration below the UI without advancing the cursor', async () => {
    storage.set(NOTES_LAST_SYNC_KEY, '123');
    useNotesStore.setState({ notes: [sampleNote()], syncError: null });

    expect(await useNotesStore.getState().syncNoteToDB(sampleNote())).toBe(false);
    await useNotesStore.getState().hydrateFromDB();

    expect(authFetchMock).not.toHaveBeenCalled();
    expect(storage.get(NOTES_LAST_SYNC_KEY)).toBe('123');
    expect(useNotesStore.getState().syncError).toContain('recovery mode');
  });

  it('blocks reset, permanent deletion, and Empty Trash without changing Notes', () => {
    const active = sampleNote();
    const trashed = { ...sampleNote(), id: 'trashed', deletedAt: 200 };
    useNotesStore.setState({ notes: [active, trashed], folders: [{ id: 'f1', name: 'Folder', createdAt: 1 }] });
    const before = useNotesStore.getState().notes;

    useNotesStore.getState().emptyTrash();
    useNotesStore.getState().deleteNotePermanently('trashed');
    useNotesStore.getState().resetAllNotes();

    expect(useNotesStore.getState().notes).toEqual(before);
    expect(useNotesStore.getState().folders).toHaveLength(1);
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('rejects direct partial persistence replacement and leaves storage unchanged', async () => {
    const current = [sampleNote(), { ...sampleNote(), id: 'unrelated' }];
    setCachedNotes(current);
    storage.set(NOTES_KEY, JSON.stringify(current));

    expect(await saveNotesAsync([current[0]])).toMatchObject({ status: 'rejected' });
    expect(JSON.parse(storage.get(NOTES_KEY)!)).toEqual(current);
  });

  it('K-319A rejects cache-null partial, duplicate, and malformed localStorage replacements byte-for-byte', async () => {
    const current = [sampleNote(), { ...sampleNote(), id: 'unrelated' }];
    const original = JSON.stringify(current, null, 2);
    storage.set(NOTES_KEY, original);

    expect(validateLocalStorageNotesReplacement([current[0]])).toEqual({
      ok: false,
      reason: 'missing_existing_id',
    });
    expect(await saveNotesAsync([current[0]])).toEqual({ status: 'rejected', reason: 'missing_existing_id' });
    expect(storage.get(NOTES_KEY)).toBe(original);

    expect(await saveNotesAsync([current[0], current[0], current[1]])).toEqual({ status: 'rejected', reason: 'duplicate_id' });
    expect(storage.get(NOTES_KEY)).toBe(original);

    const malformed = [{ id: current[0].id }, current[1]] as NoteBase[];
    expect(await saveNotesAsync(malformed)).toEqual({ status: 'rejected', reason: 'malformed_note' });
    expect(storage.get(NOTES_KEY)).toBe(original);
  });

  it('K-319A allows a complete valid superset replacement', async () => {
    const current = [sampleNote()];
    storage.set(NOTES_KEY, JSON.stringify(current));
    const replacement = [...current, { ...sampleNote(), id: 'new-note' }];

    expect(await saveNotesAsync(replacement)).toEqual({ status: 'persisted' });
    expect(JSON.parse(storage.get(NOTES_KEY)!)).toEqual(replacement);
  });

  it('K-319B suppresses autosnapshot after a rejected persistence result', async () => {
    resetAutoSnapshotStateForTests();
    const current = [sampleNote(), { ...sampleNote(), id: 'unrelated' }];
    const original = JSON.stringify(current);
    storage.set(NOTES_KEY, original);
    useNotesStore.setState({ notes: [current[0]], activeNoteId: current[0].id });

    useNotesStore.getState().updateNote(current[0].id, { title: 'blocked partial update' });
    await Promise.resolve();
    await Promise.resolve();
    flushAutoSnapshotForTests();

    expect(storage.get(NOTES_KEY)).toBe(original);
    expect(storage.has(SNAPSHOT_INDEX_KEY)).toBe(false);
  });

  it('K-319A drops a stale folder hydration response without state, persistence, or marker changes', async () => {
    setRecoveryModeActiveForTest(false);
    const folders = [{ id: 'local-folder', name: 'Local', createdAt: 1 }];
    const persisted = JSON.stringify(folders);
    useNotesStore.setState({ folders, savedAt: null, syncError: null });
    storage.set(FOLDERS_KEY, persisted);
    const response = deferred<ReturnType<typeof okJson>>();
    authFetchMock.mockReturnValueOnce(response.promise);

    const hydration = useNotesStore.getState().hydrateFromDB();
    await vi.waitFor(() => expect(authFetchMock).toHaveBeenCalledTimes(1));
    activateRecoveryMode();
    response.resolve(okJson([{ id: 'remote-folder', name: 'Remote', created_at: 2 }]));
    await hydration;

    expect(useNotesStore.getState().folders).toEqual(folders);
    expect(storage.get(FOLDERS_KEY)).toBe(persisted);
    expect(storage.has(NOTES_FOLDERS_BOOTSTRAP_KEY)).toBe(false);
    expect(useNotesStore.getState().savedAt).toBeNull();
    expect(useNotesStore.getState().syncError).toContain('recovery mode');
  });

  it('K-319A reports a stale upload as blocked without clearing errors, savedAt, or cursor', async () => {
    setRecoveryModeActiveForTest(false);
    storage.set(NOTES_LAST_SYNC_KEY, '123');
    useNotesStore.setState({ notes: [sampleNote()], savedAt: null, syncError: 'existing error' });
    const response = deferred<ReturnType<typeof okJson>>();
    authFetchMock.mockReturnValueOnce(response.promise);

    const upload = useNotesStore.getState().syncNoteToDB(sampleNote());
    await vi.waitFor(() => expect(authFetchMock).toHaveBeenCalledTimes(1));
    activateRecoveryMode();
    response.resolve(okJson({}));

    expect(await upload).toBe(false);
    expect(useNotesStore.getState().savedAt).toBeNull();
    expect(useNotesStore.getState().syncError).toContain('recovery mode');
    expect(storage.get(NOTES_LAST_SYNC_KEY)).toBe('123');
  });

  it('rejects destructive cross-tab replacement without rebroadcast or state change', () => {
    const current = [sampleNote()];
    useNotesStore.setState({ notes: current });
    const peer = [{ ...sampleNote(), body: 'peer replacement' }];

    applyStorageMerge(NOTES_KEY, JSON.stringify(peer));

    expect(useNotesStore.getState().notes).toEqual(current);
    expect(authFetchMock).not.toHaveBeenCalled();
  });
});

describe('Return-to-Use core replace restore snapshot safety', () => {
  const originalNote = { ...sampleNote(), id: 'note-existing', title: 'Existing', body: 'keep me' };
  const originalFolder = { id: 'folder-existing', name: 'Existing folder', createdAt: 1 };
  const replacementNote = { ...sampleNote(), id: originalNote.id, title: 'Replacement', body: 'new body' };

  beforeEach(() => {
    resetStore();
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'local');
    storage.set(NOTES_KEY, JSON.stringify([originalNote]));
    storage.set(FOLDERS_KEY, JSON.stringify([originalFolder]));
    useNotesStore.setState({
      notes: [originalNote],
      folders: [originalFolder],
      activeNoteId: originalNote.id,
      vaultRestoreCanUndo: false,
      syncError: null,
    });
  });

  afterEach(() => vi.restoreAllMocks());

  function replaceManifest(
    notes = [replacementNote],
    folders = [originalFolder],
  ) {
    return buildVaultBackupManifest(notes, folders);
  }

  function expectOriginalStatePreserved() {
    expect(useNotesStore.getState().notes).toEqual([originalNote]);
    expect(useNotesStore.getState().folders).toEqual([originalFolder]);
    expect(JSON.parse(storage.get(NOTES_KEY) ?? '[]')).toEqual([originalNote]);
    expect(JSON.parse(storage.get(FOLDERS_KEY) ?? '[]')).toEqual([originalFolder]);
    expect(useNotesStore.getState().vaultRestoreCanUndo).toBe(false);
    expect(authFetchMock).not.toHaveBeenCalled();
  }

  function expectDirectManifestRejected(manifest: unknown) {
    setRecoveryModeActiveForTest(true);
    expect(() => useNotesStore.getState().importVaultRestore(
      manifest as VaultBackupManifest,
      'replace',
    )).toThrow('Data recovery mode is active');
    expect(storage.has(VAULT_RESTORE_SNAPSHOT_KEY)).toBe(false);
    expectOriginalStatePreserved();
  }

  it('allows local core restore in recovery mode without advertising blocked undo', async () => {
    setRecoveryModeActiveForTest(true);

    await useNotesStore.getState().importVaultRestore(replaceManifest(), 'replace');

    expect(useNotesStore.getState().notes[0]).toMatchObject({ title: 'Replacement', body: 'new body' });
    expect(useNotesStore.getState().vaultRestoreCanUndo).toBe(false);
    expect(useNotesStore.getState().canUndoVaultRestore()).toBe(false);
    expect(useNotesStore.getState().syncError).toBeNull();
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when the durable Notes write is rejected and preserves the verified snapshot', async () => {
    setRecoveryModeActiveForTest(true);
    vi.spyOn(localStorageMock, 'setItem').mockImplementation((key, value) => {
      if (key === NOTES_KEY && value.includes('Replacement')) throw new Error('notes write rejected');
      storage.set(key, value);
    });

    const restore = useNotesStore.getState().importVaultRestore(replaceManifest(), 'replace');

    await expect(restore).rejects.toBeInstanceOf(VaultRestoreDurabilityError);
    expectOriginalStatePreserved();
    expect(loadVaultRestoreSnapshot()).toMatchObject({ notes: [originalNote], folders: [originalFolder] });
    expect(useNotesStore.getState().syncError).toContain('durable Notes/Folders readback');
  });

  it('fails closed when durable Folders persistence is rejected and marks recovery required', async () => {
    setRecoveryModeActiveForTest(true);
    vi.spyOn(localStorageMock, 'setItem').mockImplementation((key, value) => {
      if (key === FOLDERS_KEY) throw new Error('folders write rejected');
      storage.set(key, value);
    });
    const replacementFolder = { id: 'folder-new', name: 'Replacement folder', createdAt: 2 };

    await expect(useNotesStore.getState().importVaultRestore(
      replaceManifest([replacementNote], [replacementFolder]),
      'replace',
    )).rejects.toBeInstanceOf(VaultRestoreDurabilityError);

    expectOriginalStatePreserved();
    expect(loadVaultRestoreSnapshot()).toMatchObject({ notes: [originalNote], folders: [originalFolder] });
    expect(useNotesStore.getState().syncError).toContain('recovery is required');
  });

  it('fails closed on a Notes readback mismatch and verifies rollback to the previous durable state', async () => {
    setRecoveryModeActiveForTest(true);
    vi.spyOn(localStorageMock, 'setItem').mockImplementation((key, value) => {
      if (key === NOTES_KEY && value.includes('Replacement')) {
        storage.set(key, JSON.stringify([originalNote]));
        return;
      }
      storage.set(key, value);
    });

    const error = await useNotesStore.getState().importVaultRestore(replaceManifest(), 'replace')
      .then(() => null, reason => reason as InstanceType<typeof VaultRestoreDurabilityError>);

    expect(error).toBeInstanceOf(VaultRestoreDurabilityError);
    expect(error?.rollbackVerified).toBe(true);
    expectOriginalStatePreserved();
    expect(loadVaultRestoreSnapshot()).toMatchObject({ notes: [originalNote], folders: [originalFolder] });
  });

  it('fails closed when the durable Notes readback is missing', async () => {
    setRecoveryModeActiveForTest(true);
    let notesReads = 0;
    vi.spyOn(localStorageMock, 'getItem').mockImplementation(key => {
      if (key === NOTES_KEY && ++notesReads === 2) {
        return null;
      }
      return storage.get(key) ?? null;
    });

    const error = await useNotesStore.getState().importVaultRestore(replaceManifest(), 'replace')
      .then(() => null, reason => reason as InstanceType<typeof VaultRestoreDurabilityError>);

    expect(error).toBeInstanceOf(VaultRestoreDurabilityError);
    expect(error?.stage).toBe('notes_readback');
    expect(error?.rollbackVerified).toBe(true);
    expectOriginalStatePreserved();
    expect(useNotesStore.getState().syncError).toContain('durable Notes/Folders readback');
  });

  it('fails closed when the durable Notes readback is incomplete', async () => {
    setRecoveryModeActiveForTest(true);
    const secondOriginalNote = {
      ...sampleNote(),
      id: 'note-second-replacement',
      title: 'Original second',
      body: 'original second body',
    };
    const secondReplacementNote = {
      ...sampleNote(),
      id: secondOriginalNote.id,
      title: 'Second replacement',
      body: 'second replacement body',
    };
    const originalNotes = [originalNote, secondOriginalNote];
    storage.set(NOTES_KEY, JSON.stringify(originalNotes));
    useNotesStore.setState({ notes: originalNotes, activeNoteId: originalNote.id });
    let replacementWritten = false;
    let incompleteReadbackReturned = false;
    vi.spyOn(localStorageMock, 'setItem').mockImplementation((key, value) => {
      if (key === NOTES_KEY && value.includes('Second replacement')) replacementWritten = true;
      storage.set(key, value);
    });
    vi.spyOn(localStorageMock, 'getItem').mockImplementation(key => {
      if (key === NOTES_KEY && replacementWritten && !incompleteReadbackReturned) {
        incompleteReadbackReturned = true;
        const persisted = JSON.parse(storage.get(NOTES_KEY) ?? '[]') as unknown[];
        return JSON.stringify(persisted.slice(0, 1));
      }
      return storage.get(key) ?? null;
    });

    const error = await useNotesStore.getState().importVaultRestore(
      replaceManifest([replacementNote, secondReplacementNote]),
      'replace',
    ).then(() => null, reason => reason as InstanceType<typeof VaultRestoreDurabilityError>);

    expect(error).toBeInstanceOf(VaultRestoreDurabilityError);
    expect(error?.stage).toBe('notes_readback');
    expect(error?.rollbackVerified).toBe(true);
    expect(useNotesStore.getState().notes).toEqual(originalNotes);
    expect(useNotesStore.getState().folders).toEqual([originalFolder]);
    expect(JSON.parse(storage.get(NOTES_KEY) ?? '[]')).toEqual(originalNotes);
    expect(JSON.parse(storage.get(FOLDERS_KEY) ?? '[]')).toEqual([originalFolder]);
    const snapshot = loadVaultRestoreSnapshot();
    expect(snapshot?.notes).toEqual(originalNotes);
    expect(snapshot?.folders).toEqual([originalFolder]);
    expect(useNotesStore.getState().vaultRestoreCanUndo).toBe(false);
    expect(authFetchMock).not.toHaveBeenCalled();
    expect(useNotesStore.getState().syncError).toContain('durable Notes/Folders readback');
  });

  it('fails closed when the durable Folders readback is missing', async () => {
    setRecoveryModeActiveForTest(true);
    let firstFoldersReadback = true;
    vi.spyOn(localStorageMock, 'getItem').mockImplementation(key => {
      if (key === FOLDERS_KEY && firstFoldersReadback) {
        firstFoldersReadback = false;
        return null;
      }
      return storage.get(key) ?? null;
    });

    const error = await useNotesStore.getState().importVaultRestore(replaceManifest(), 'replace')
      .then(() => null, reason => reason as InstanceType<typeof VaultRestoreDurabilityError>);

    expect(error).toBeInstanceOf(VaultRestoreDurabilityError);
    expect(error?.stage).toBe('folders_readback');
    expect(error?.rollbackVerified).toBe(true);
    expectOriginalStatePreserved();
    expect(useNotesStore.getState().syncError).toContain('durable Notes/Folders readback');
  });

  it('fails closed when the durable Folders readback is incomplete', async () => {
    setRecoveryModeActiveForTest(true);
    const replacementFolder = { id: 'folder-new', name: 'Replacement folder', createdAt: 2 };
    let firstFoldersReadback = true;
    vi.spyOn(localStorageMock, 'getItem').mockImplementation(key => {
      if (key === FOLDERS_KEY && firstFoldersReadback) {
        firstFoldersReadback = false;
        return JSON.stringify([]);
      }
      return storage.get(key) ?? null;
    });

    const error = await useNotesStore.getState().importVaultRestore(
      replaceManifest([replacementNote], [replacementFolder]),
      'replace',
    ).then(() => null, reason => reason as InstanceType<typeof VaultRestoreDurabilityError>);

    expect(error).toBeInstanceOf(VaultRestoreDurabilityError);
    expect(error?.stage).toBe('folders_readback');
    expect(error?.rollbackVerified).toBe(true);
    expectOriginalStatePreserved();
    expect(useNotesStore.getState().syncError).toContain('durable Notes/Folders readback');
  });

  it('fails closed when the durable Folders readback mismatches the replacement', async () => {
    setRecoveryModeActiveForTest(true);
    const replacementFolder = { id: 'folder-new', name: 'Replacement folder', createdAt: 2 };
    let firstFoldersReadback = true;
    vi.spyOn(localStorageMock, 'getItem').mockImplementation(key => {
      if (key === FOLDERS_KEY && firstFoldersReadback) {
        firstFoldersReadback = false;
        return JSON.stringify([originalFolder]);
      }
      return storage.get(key) ?? null;
    });

    const error = await useNotesStore.getState().importVaultRestore(
      replaceManifest([replacementNote], [replacementFolder]),
      'replace',
    ).then(() => null, reason => reason as InstanceType<typeof VaultRestoreDurabilityError>);

    expect(error).toBeInstanceOf(VaultRestoreDurabilityError);
    expect(error?.stage).toBe('folders_readback');
    expect(error?.rollbackVerified).toBe(true);
    expectOriginalStatePreserved();
    expect(useNotesStore.getState().syncError).toContain('durable Notes/Folders readback');
  });

  it('does not expose restore success before durable write, readback, and equality complete', async () => {
    setRecoveryModeActiveForTest(true);
    const operations: string[] = [];
    vi.spyOn(localStorageMock, 'setItem').mockImplementation((key, value) => {
      if (key === NOTES_KEY && value.includes('Replacement')) operations.push('notes-write');
      if (key === FOLDERS_KEY) operations.push('folders-write');
      storage.set(key, value);
    });
    vi.spyOn(localStorageMock, 'getItem').mockImplementation(key => {
      if (key === NOTES_KEY && operations.includes('notes-write') && !operations.includes('notes-readback')) {
        operations.push('notes-readback');
      }
      if (key === FOLDERS_KEY && operations.includes('folders-write') && !operations.includes('folders-readback')) {
        operations.push('folders-readback');
      }
      return storage.get(key) ?? null;
    });
    const restore = useNotesStore.getState().importVaultRestore(replaceManifest(), 'replace');

    expect(useNotesStore.getState().notes).toEqual([originalNote]);
    expect(useNotesStore.getState().folders).toEqual([originalFolder]);
    expect(useNotesStore.getState().syncError).toBeNull();
    expect(useNotesStore.getState().vaultRestoreCanUndo).toBe(false);
    expect(operations).not.toContain('folders-write');
    expect(operations).not.toContain('notes-readback');
    expect(operations).not.toContain('folders-readback');

    await restore;

    expect(useNotesStore.getState().notes).toHaveLength(1);
    expect(useNotesStore.getState().notes[0]).toMatchObject({
      id: replacementNote.id,
      title: replacementNote.title,
      body: replacementNote.body,
    });
    expect(useNotesStore.getState().folders).toEqual([originalFolder]);
    expect(useNotesStore.getState().vaultRestoreCanUndo).toBe(false);
    expect(operations).toEqual(['notes-write', 'folders-write', 'notes-readback', 'folders-readback']);
  });

  it('reopens durable Notes and Folders after transient store state is cleared', async () => {
    setRecoveryModeActiveForTest(true);
    const replacementFolder = { id: 'folder-new', name: 'Replacement folder', createdAt: 2 };
    await useNotesStore.getState().importVaultRestore(
      replaceManifest([replacementNote], [replacementFolder]),
      'replace',
    );

    const canonicalize = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;
    const expectedNotes = canonicalize(useNotesStore.getState().notes);
    const expectedFolders = canonicalize(useNotesStore.getState().folders);

    useNotesStore.setState({ notes: [], folders: [], activeNoteId: null, activeFolderId: null });
    resetNotesPersistenceForTests();
    await useNotesStore.getState().initNotesStorage();
    useNotesStore.setState({ folders: loadFolders() });

    expect(canonicalize(useNotesStore.getState().notes)).toEqual(expectedNotes);
    expect(canonicalize(useNotesStore.getState().folders)).toEqual(expectedFolders);
  });

  it('blocks a semantically invalid direct manifest before snapshot or replacement', () => {
    const invalid = { ...replaceManifest(), app: 'other' as 'absinthe' };
    expectDirectManifestRejected(invalid);
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['negative Infinity', Number.NEGATIVE_INFINITY],
    ['fractional', 2.5],
    ['string', '3'],
    ['null', null],
    ['undefined', undefined],
    ['future', 4],
  ])('rejects a direct manifest with %s schema version', (_label, schemaVersion) => {
    expectDirectManifestRejected({ ...replaceManifest(), schemaVersion });
  });

  it.each([
    ['non-object folder', () => [null]],
    ['missing folder id', () => [{ name: 'Folder', createdAt: 1 }]],
    ['empty folder id', () => [{ id: '  ', name: 'Folder', createdAt: 1 }]],
    ['non-string folder id', () => [{ id: 7, name: 'Folder', createdAt: 1 }]],
    ['missing folder name', () => [{ id: 'folder-new', createdAt: 1 }]],
    ['empty folder name', () => [{ id: 'folder-new', name: ' ', createdAt: 1 }]],
    ['invalid createdAt', () => [{ id: 'folder-new', name: 'Folder', createdAt: Number.NaN }]],
    ['duplicate folder ids', () => [originalFolder, { ...originalFolder, name: 'Duplicate' }]],
  ])('rejects a direct manifest with %s', (_label, folders) => {
    expectDirectManifestRejected({ ...replaceManifest(), folders: folders() });
  });

  it.each([
    ['numeric folderId', { folderId: 7 }],
    ['object folderId', { folderId: { id: 'folder-object' } }],
    ['undefined folderId', { folderId: undefined }],
    ['NaN updatedAt', { updatedAt: Number.NaN }],
    ['Infinity updatedAt', { updatedAt: Number.POSITIVE_INFINITY }],
    ['negative Infinity updatedAt', { updatedAt: Number.NEGATIVE_INFINITY }],
    ['string updatedAt', { updatedAt: 'not-a-timestamp' }],
    ['NaN createdAt', { createdAt: Number.NaN }],
    ['Infinity createdAt', { createdAt: Number.POSITIVE_INFINITY }],
    ['malformed createdAt', { createdAt: 'not-a-timestamp' }],
  ])('rejects a direct manifest with malformed persisted note %s', (_label, patch) => {
    const raw = replaceManifest();
    raw.notes = [{ ...raw.notes[0], ...patch } as typeof raw.notes[number]];
    expectDirectManifestRejected(raw);
  });

  it('accepts valid string and null folderId values through canonical note validation', async () => {
    setRecoveryModeActiveForTest(true);
    const raw = replaceManifest();
    raw.notes = [{ ...raw.notes[0], folderId: originalFolder.id }];

    await useNotesStore.getState().importVaultRestore(raw, 'replace');

    expect(useNotesStore.getState().notes[0]?.folderId).toBe(originalFolder.id);
    expect(useNotesStore.getState().notes[0]?.updatedAt).toEqual(raw.notes[0]?.updatedAt);
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('accepts an absent optional createdAt through canonical note validation', async () => {
    setRecoveryModeActiveForTest(true);
    const raw = replaceManifest();
    const { createdAt: _createdAt, ...withoutCreatedAt } = raw.notes[0]!;
    raw.notes = [withoutCreatedAt as typeof raw.notes[number]];

    await useNotesStore.getState().importVaultRestore(raw, 'replace');

    expect(useNotesStore.getState().notes[0]?.createdAt).toBe(raw.notes[0]?.updatedAt);
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('rejects non-finite timestamps before persistence can serialize them', () => {
    const raw = replaceManifest();
    raw.notes = [{ ...raw.notes[0], updatedAt: Number.POSITIVE_INFINITY }];
    const setItem = vi.spyOn(localStorageMock, 'setItem');

    expectDirectManifestRejected(raw);

    expect(setItem).not.toHaveBeenCalledWith(NOTES_KEY, expect.any(String));
    expect(setItem).not.toHaveBeenCalledWith(FOLDERS_KEY, expect.any(String));
    expect(JSON.stringify(raw.notes[0]?.updatedAt)).toBe('null');
  });

  it('applies the same canonical repaired manifest that passed validation', async () => {
    setRecoveryModeActiveForTest(true);
    const raw = replaceManifest();
    raw.notes = [{
      ...raw.notes[0],
      title: '',
      markdown: '# Canonical repaired title\n\nnew body',
    }];

    await useNotesStore.getState().importVaultRestore(raw, 'replace');

    expect(raw.notes[0]?.title).toBe('');
    expect(useNotesStore.getState().notes[0]).toMatchObject({
      title: 'Canonical repaired title',
      body: '# Canonical repaired title\n\nnew body',
    });
    expect(loadVaultRestoreSnapshot()).not.toBeNull();
    expect(useNotesStore.getState().vaultRestoreCanUndo).toBe(false);
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('keeps persisted undo evidence hidden and unusable after a recovery-mode reload', async () => {
    setRecoveryModeActiveForTest(true);
    await useNotesStore.getState().importVaultRestore(replaceManifest(), 'replace');
    expect(loadVaultRestoreSnapshot()).not.toBeNull();

    useNotesStore.setState({ vaultRestoreCanUndo: isVaultRestoreUndoAvailable() });
    expect(useNotesStore.getState().vaultRestoreCanUndo).toBe(false);
    expect(useNotesStore.getState().canUndoVaultRestore()).toBe(false);
    expect(useNotesStore.getState().undoLastVaultRestore()).toBe(false);
    expect(useNotesStore.getState().notes[0]).toMatchObject({ title: 'Replacement' });
    expect(loadVaultRestoreSnapshot()).not.toBeNull();
  });

  it('aborts before replacement when the durable snapshot write fails', () => {
    setRecoveryModeActiveForTest(true);
    const setItem = vi.spyOn(localStorageMock, 'setItem').mockImplementation((key, value) => {
      if (key === VAULT_RESTORE_SNAPSHOT_KEY) {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }
      storage.set(key, value);
    });

    expect(() => useNotesStore.getState().importVaultRestore(replaceManifest(), 'replace'))
      .toThrow(VAULT_RESTORE_SNAPSHOT_FAILURE_MESSAGE);
    expect(setItem).toHaveBeenCalledWith(VAULT_RESTORE_SNAPSHOT_KEY, expect.any(String));
    expectOriginalStatePreserved();
  });

  it('aborts before replacement when persisted snapshot readback is missing', () => {
    vi.spyOn(localStorageMock, 'getItem').mockImplementation(key => (
      key === VAULT_RESTORE_SNAPSHOT_KEY ? null : storage.get(key) ?? null
    ));

    expect(() => useNotesStore.getState().importVaultRestore(replaceManifest(), 'replace'))
      .toThrow(VAULT_RESTORE_SNAPSHOT_FAILURE_MESSAGE);
    expectOriginalStatePreserved();
  });

  it('aborts before replacement when persisted snapshot readback is malformed', () => {
    vi.spyOn(localStorageMock, 'setItem').mockImplementation((key, value) => {
      storage.set(key, key === VAULT_RESTORE_SNAPSHOT_KEY
        ? JSON.stringify({ savedAt: 'invalid', notes: [], folders: [] })
        : value);
    });

    expect(() => useNotesStore.getState().importVaultRestore(replaceManifest(), 'replace'))
      .toThrow(VAULT_RESTORE_SNAPSHOT_FAILURE_MESSAGE);
    expectOriginalStatePreserved();
  });

  it('verifies the persisted snapshot before replacement and restores it on undo', async () => {
    const operations: string[] = [];
    vi.spyOn(localStorageMock, 'setItem').mockImplementation((key, value) => {
      if (key === VAULT_RESTORE_SNAPSHOT_KEY) operations.push('snapshot-write');
      if (key === NOTES_KEY) operations.push('notes-replace');
      storage.set(key, value);
    });
    vi.spyOn(localStorageMock, 'getItem').mockImplementation(key => {
      if (key === VAULT_RESTORE_SNAPSHOT_KEY && storage.has(key)) operations.push('snapshot-readback');
      return storage.get(key) ?? null;
    });

    await useNotesStore.getState().importVaultRestore(replaceManifest(), 'replace');

    expect(useNotesStore.getState().notes[0]).toMatchObject({ title: 'Replacement', body: 'new body' });
    expect(useNotesStore.getState().vaultRestoreCanUndo).toBe(true);
    expect(loadVaultRestoreSnapshot()).toMatchObject({
      notes: [originalNote],
      folders: [originalFolder],
    });
    expect(operations.indexOf('snapshot-write')).toBeLessThan(operations.indexOf('snapshot-readback'));
    expect(operations.indexOf('snapshot-readback')).toBeLessThan(operations.indexOf('notes-replace'));

    expect(useNotesStore.getState().undoLastVaultRestore()).toBe(true);
    expect(useNotesStore.getState().notes).toEqual([originalNote]);
    expect(useNotesStore.getState().folders).toEqual([originalFolder]);
    expect(useNotesStore.getState().vaultRestoreCanUndo).toBe(false);
    expect(loadVaultRestoreSnapshot()).toBeNull();
  });

  it('withdraws undo availability when persisted snapshot data becomes unusable', () => {
    storage.set(VAULT_RESTORE_SNAPSHOT_KEY, '{"savedAt":"invalid","notes":[],"folders":[]}');
    useNotesStore.setState({ vaultRestoreCanUndo: true });

    expect(useNotesStore.getState().canUndoVaultRestore()).toBe(false);
    expect(useNotesStore.getState().undoLastVaultRestore()).toBe(false);
    expect(useNotesStore.getState().vaultRestoreCanUndo).toBe(false);
    expectOriginalStatePreserved();
  });
});
