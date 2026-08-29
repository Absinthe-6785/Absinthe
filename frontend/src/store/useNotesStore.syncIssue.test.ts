// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteBase } from '../components/views/noteUtils';
import { FOLDERS_KEY } from '../components/views/noteUtils';
import { NOTES_RUNTIME_SYNC_MODE_KEY } from '../lib/notesSyncClient';
import { resetNotesPersistenceForTests } from '../lib/notePersistence';
import { setRecoveryModeActiveForTest } from '../lib/recoverySafetyPolicy';

const { authFetchMock, authReadFetchMock, persistenceHarness } = vi.hoisted(() => ({
  authFetchMock: vi.fn(),
  authReadFetchMock: vi.fn(),
  persistenceHarness: {
    intercept: false,
    saveNotesAsyncMock: vi.fn(),
  },
}));

vi.mock('../lib/supabase', () => ({
  authFetch: (...args: unknown[]) => authFetchMock(...args),
  authReadFetch: (...args: unknown[]) => authReadFetchMock(...args),
}));

vi.mock('../lib/notePersistence', async importOriginal => {
  const actual = await importOriginal<typeof import('../lib/notePersistence')>();
  return {
    ...actual,
    saveNotesAsync: (...args: unknown[]) => persistenceHarness.intercept
      ? persistenceHarness.saveNotesAsyncMock(...args)
      : actual.saveNotesAsync(...args),
  };
});

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => { storage.clear(); },
  key: (index: number) => [...storage.keys()][index] ?? null,
  get length() { return storage.size; },
});

const { useNotesStore } = await import('./useNotesStore');

function okResponse(data: unknown = {}) {
  return { ok: true, status: 200, json: async () => data };
}

function failedResponse(status = 503) {
  return { ok: false, status, json: async () => ({}) };
}

function emptySnapshot(accountId: string) {
  return okResponse({
    account_id: accountId,
    rows: [],
    total_count: 0,
    offset: 0,
    limit: 500,
    complete: true,
  });
}

function note(id: string, overrides: Partial<NoteBase> = {}): NoteBase {
  return {
    id,
    title: id,
    body: 'body',
    updatedAt: 10,
    folderId: null,
    deletedAt: null,
    starred: false,
    ...overrides,
  };
}

function resetStore() {
  setRecoveryModeActiveForTest(false);
  storage.clear();
  storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
  authFetchMock.mockReset();
  authReadFetchMock.mockReset();
  persistenceHarness.intercept = false;
  persistenceHarness.saveNotesAsyncMock.mockReset();
  resetNotesPersistenceForTests();
  useNotesStore.setState({
    notes: [],
    folders: [],
    activeNoteId: null,
    activeFolderId: null,
    activeAccountId: null,
    notesAuthorityState: 'NOT_LOADED',
    foldersAuthorityState: 'NOT_LOADED',
    isSyncing: false,
    savedAt: null,
    syncError: null,
    syncIssue: null,
  });
}

describe('Notes sync-issue ownership and clearing contract', () => {
  beforeEach(resetStore);

  it('clears a failed Note POST only after matching success', async () => {
    const item = note('write-failure');
    authFetchMock.mockResolvedValueOnce(failedResponse()).mockResolvedValueOnce(okResponse());

    useNotesStore.getState().importNote(item);
    await vi.waitFor(() => expect(useNotesStore.getState().syncError).toContain('503'));
    expect(useNotesStore.getState().syncIssue?.source).toBe('note_remote_write');

    await useNotesStore.getState().syncNoteToDB(item);
    expect(useNotesStore.getState().syncError).toBeNull();
    expect(useNotesStore.getState().syncIssue).toBeNull();
  });

  it('clears a failed Note DELETE only after matching delete success', async () => {
    const item = note('delete-failure', { deletedAt: 20, updatedAt: 20 });
    useNotesStore.setState({ notes: [item], activeNoteId: item.id });
    authFetchMock.mockResolvedValueOnce(failedResponse()).mockResolvedValueOnce(okResponse());

    useNotesStore.getState().emptyTrash();
    await vi.waitFor(() => expect(useNotesStore.getState().syncError).toContain('503'));
    expect(useNotesStore.getState().syncIssue?.source).toBe('note_remote_delete');

    useNotesStore.getState().retrySync();
    await vi.waitFor(() => expect(useNotesStore.getState().syncError).toBeNull());
    expect(authFetchMock.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ method: 'DELETE' }));
  });

  it('clears a bootstrap-owned issue after a later successful bootstrap', async () => {
    await useNotesStore.getState().initNotesStorage('account-a');
    let fail = true;
    authReadFetchMock.mockImplementation(() => fail
      ? Promise.reject(new Error('bootstrap network failure'))
      : Promise.resolve(emptySnapshot('account-a')));

    await useNotesStore.getState().bootstrapFromSupabase();
    expect(useNotesStore.getState().syncIssue?.source).toBe('bootstrap');
    expect(useNotesStore.getState().syncError).toContain('bootstrap network failure');

    fail = false;
    await useNotesStore.getState().bootstrapFromSupabase();
    expect(useNotesStore.getState().syncError).toBeNull();
    expect(useNotesStore.getState().syncIssue).toBeNull();
  });

  it('does not let an unrelated successful folder write clear a Note failure', async () => {
    const item = note('unrelated-success');
    authFetchMock.mockResolvedValueOnce(failedResponse()).mockResolvedValue(okResponse());
    useNotesStore.getState().importNote(item);
    await vi.waitFor(() => expect(useNotesStore.getState().syncError).toContain('503'));

    useNotesStore.getState().createFolder('Work');
    await vi.waitFor(() => expect(authFetchMock).toHaveBeenCalledTimes(2));
    expect(useNotesStore.getState().syncError).toContain('503');
    expect(useNotesStore.getState().syncIssue?.source).toBe('note_remote_write');
  });

  it('runs Retry for a valid failed Note target', async () => {
    const item = note('retry-note');
    authFetchMock.mockResolvedValueOnce(failedResponse()).mockResolvedValueOnce(okResponse());
    useNotesStore.getState().importNote(item);
    await vi.waitFor(() => expect(useNotesStore.getState().syncError).toContain('503'));

    useNotesStore.getState().retrySync();
    await vi.waitFor(() => expect(useNotesStore.getState().syncError).toBeNull());
    expect(authFetchMock).toHaveBeenCalledTimes(2);
    expect(authFetchMock.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ method: 'POST' }));
  });

  it('clears a stale no-target issue without inventing a remote request', async () => {
    useNotesStore.setState({ syncError: 'stale sync issue', syncIssue: null });
    useNotesStore.getState().retrySync();
    await vi.waitFor(() => expect(useNotesStore.getState().syncError).toBeNull());
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('keeps an active non-retryable no-target issue visible', async () => {
    useNotesStore.setState({
      syncError: 'bootstrap still active',
      syncIssue: { source: 'bootstrap', retryable: false, message: 'bootstrap still active' },
    });
    useNotesStore.getState().retrySync();
    await Promise.resolve();
    expect(useNotesStore.getState().syncError).toBe('bootstrap still active');
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('does not dismiss active local or recovery ownership when no retry target exists', async () => {
    setRecoveryModeActiveForTest(true);
    useNotesStore.setState({
      syncError: 'local durability failure',
      syncIssue: { source: 'local_notes_persistence', retryable: true, message: 'local durability failure' },
    });
    useNotesStore.getState().retrySync();
    await Promise.resolve();
    expect(useNotesStore.getState().syncIssue?.source).toBe('local_notes_persistence');

    setRecoveryModeActiveForTest(false);
    useNotesStore.setState({
      syncError: 'recovery conflict',
      syncIssue: {
        source: 'recovery_permanent_delete', targetId: 'note-a', retryable: false, message: 'recovery conflict',
      },
    });
    useNotesStore.getState().retrySync();
    await Promise.resolve();
    expect(useNotesStore.getState().syncIssue).toEqual(expect.objectContaining({
      source: 'recovery_permanent_delete', targetId: 'note-a',
    }));
  });

  it('clears a local persistence issue after the corresponding local retry succeeds', async () => {
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'local');
    const item = note('local-failure');
    useNotesStore.setState({ notes: [item], activeNoteId: item.id });
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'notes-v2') throw new Error('quota');
      storage.set(key, value);
    });

    useNotesStore.getState().updateNote(item.id, { title: 'changed' });
    expect(useNotesStore.getState().syncIssue?.source).toBe('local_notes_persistence');
    setItem.mockRestore();

    useNotesStore.getState().retrySync();
    await vi.waitFor(() => expect(useNotesStore.getState().syncError).toBeNull());
  });

  it('keeps a local Notes write failure through successful initialization and clears it after a verified write', async () => {
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'local');
    await useNotesStore.getState().initNotesStorage('account-init');
    const item = note('init-read-does-not-prove-write');
    persistenceHarness.intercept = true;
    persistenceHarness.saveNotesAsyncMock.mockResolvedValue({ status: 'failed', reason: 'indexeddb_rejected' });

    useNotesStore.getState().importNote(item);
    await vi.waitFor(() => expect(useNotesStore.getState().syncIssue?.source).toBe('local_notes_persistence'));

    await useNotesStore.getState().initNotesStorage('account-init');
    expect(useNotesStore.getState().syncIssue?.source).toBe('local_notes_persistence');

    persistenceHarness.saveNotesAsyncMock.mockResolvedValue({ status: 'persisted' });
    useNotesStore.getState().updateNote(item.id, { title: 'verified' });
    await vi.waitFor(() => expect(useNotesStore.getState().syncError).toBeNull());
  });

  it('keeps a local Folder write failure visible when its remote sync also fails, then clears after a local write', async () => {
    authFetchMock.mockResolvedValueOnce(failedResponse()).mockResolvedValue(okResponse());
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === FOLDERS_KEY) throw new Error('quota');
      storage.set(key, value);
    });

    const folderId = useNotesStore.getState().createFolder('Local failure');
    expect(useNotesStore.getState().syncIssue?.source).toBe('local_folders_persistence');
    await vi.waitFor(() => expect(authFetchMock).toHaveBeenCalledTimes(1));
    expect(useNotesStore.getState().syncIssue?.source).toBe('local_folders_persistence');

    setItem.mockRestore();
    useNotesStore.getState().renameFolder(folderId, 'Local recovery');
    await vi.waitFor(() => expect(useNotesStore.getState().syncError).toBeNull());
  });

  it('clears issue state on detach during an account transition', () => {
    useNotesStore.setState({
      syncError: 'active issue',
      syncIssue: { source: 'note_remote_write', targetId: 'n', retryable: true, message: 'active issue' },
    });
    useNotesStore.getState().detachNotesStorage();
    expect(useNotesStore.getState().syncError).toBeNull();
    expect(useNotesStore.getState().syncIssue).toBeNull();
  });
});
