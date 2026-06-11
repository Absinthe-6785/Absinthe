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
const { useNotesStore, applyStorageMerge } = await import('./useNotesStore');

function okJson(data: unknown) {
  return { ok: true, status: 200, json: async () => data };
}

function failResponse(status = 500) {
  return { ok: false, status, json: async () => ({}) };
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
  storage.clear();
  authFetchMock.mockReset();
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
