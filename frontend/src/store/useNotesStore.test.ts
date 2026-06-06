/**
 * useNotesStore 통합 테스트 — import/sync, sync 실패, Settings Reset, Planner 공유
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NOTES_KEY,
  FOLDERS_KEY,
  ACTIVE_KEY,
  noteSyncPayload,
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
const { useNotesStore } = await import('./useNotesStore');

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
