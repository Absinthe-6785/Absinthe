// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteBase } from '../components/views/noteUtils';
import { FOLDERS_KEY } from '../components/views/noteUtils';
import { NOTES_RUNTIME_SYNC_MODE_KEY } from '../lib/notesSyncClient';
import { resetNotesPersistenceForTests } from '../lib/notePersistence';
import { activateNotesAccountAuthority } from '../lib/notesAccountAuthority';
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
  return {
    ok: true,
    status: 200,
    json: async () => {
      if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length > 0) return data;
      const request = [...authFetchMock.mock.calls].reverse().find(([url, options]) => (
        String(url).endsWith('/api/notes') && (options as RequestInit | undefined)?.method === 'POST'
      ));
      const raw = (request?.[1] as RequestInit | undefined)?.body;
      if (typeof raw !== 'string') return data;
      const sent = JSON.parse(raw) as Record<string, unknown>;
      return { ...sent, user_id: 'account-a', properties: sent.properties ?? null, relations: sent.relations ?? null };
    },
  };
}

function failedResponse(status = 503) {
  return { ok: false, status, json: async () => ({}) };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => { resolve = res; });
  return { promise, resolve };
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
  useNotesStore.getState().detachNotesStorage();
  setRecoveryModeActiveForTest(false);
  storage.clear();
  storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
  authFetchMock.mockReset();
  authReadFetchMock.mockReset();
  authReadFetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
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

function bindRemoteAccount() {
  activateNotesAccountAuthority('account-a');
  useNotesStore.setState({ activeAccountId: 'account-a' });
}

describe('Notes sync-issue ownership and clearing contract', () => {
  beforeEach(resetStore);

  it('clears a failed Note POST only after matching success', async () => {
    bindRemoteAccount();
    const item = note('write-failure');
    authFetchMock.mockResolvedValueOnce(failedResponse()).mockResolvedValueOnce(okResponse());

    useNotesStore.getState().importNote(item);
    await vi.waitFor(() => expect(useNotesStore.getState().syncIssue?.classification).toBe('REMOTE_NOT_CONFIRMED'));
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
    bindRemoteAccount();
    const item = note('unrelated-success');
    authFetchMock.mockResolvedValueOnce(failedResponse()).mockResolvedValue(okResponse());
    useNotesStore.getState().importNote(item);
    await vi.waitFor(() => expect(useNotesStore.getState().syncIssue?.classification).toBe('REMOTE_NOT_CONFIRMED'));

    useNotesStore.getState().createFolder('Work');
    await vi.waitFor(() => expect(authFetchMock).toHaveBeenCalledTimes(2));
    expect(useNotesStore.getState().syncIssue?.classification).toBe('REMOTE_NOT_CONFIRMED');
    expect(useNotesStore.getState().syncIssue?.source).toBe('note_remote_write');
  });

  it('runs Retry for a valid failed Note target', async () => {
    bindRemoteAccount();
    const item = note('retry-note');
    authFetchMock.mockResolvedValueOnce(failedResponse()).mockResolvedValueOnce(okResponse());
    useNotesStore.getState().importNote(item);
    await vi.waitFor(() => expect(useNotesStore.getState().syncIssue?.classification).toBe('REMOTE_NOT_CONFIRMED'));

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

  it('does not start remote POST when the intended local Note write fails', async () => {
    bindRemoteAccount();
    const item = note('local-before-remote');
    useNotesStore.setState({ notes: [item], activeNoteId: item.id });
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'notes-v2') throw new Error('quota');
      storage.set(key, value);
    });

    useNotesStore.getState().updateNote(item.id, { title: 'must stay local' });
    await Promise.resolve();

    expect(authFetchMock).not.toHaveBeenCalled();
    expect(useNotesStore.getState().syncIssue).toEqual(expect.objectContaining({
      source: 'local_notes_persistence',
      classification: 'LOCAL_PERSISTENCE_FAILURE',
    }));
    setItem.mockRestore();
  });

  it('retains the 600ms body debounce and waits for local persistence before POST', async () => {
    vi.useFakeTimers();
    bindRemoteAccount();
    const item = note('debounced-local-first');
    useNotesStore.setState({ notes: [item], activeNoteId: item.id });
    authFetchMock.mockResolvedValue(okResponse());

    useNotesStore.getState().updateNote(item.id, { body: 'edited' });
    await vi.advanceTimersByTimeAsync(599);
    expect(authFetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await vi.runAllTimersAsync();

    expect(authFetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(authFetchMock.mock.calls[0][1].body)).toEqual(expect.objectContaining({ body: 'edited' }));
    vi.useRealTimers();
  });

  it('publishes nothing when account A becomes stale while its POST is pending', async () => {
    bindRemoteAccount();
    const item = note('account-switch-post');
    useNotesStore.setState({ notes: [item], activeNoteId: item.id, savedAt: null });
    const pending = deferred<ReturnType<typeof okResponse>>();
    authFetchMock.mockImplementation((_url, _options, control) => {
      control?.onRequestStart?.();
      return pending.promise;
    });

    const upload = useNotesStore.getState().syncNoteToDB(item);
    await vi.waitFor(() => expect(authFetchMock).toHaveBeenCalledTimes(1));
    activateNotesAccountAuthority('account-b');
    useNotesStore.setState({ notes: [], activeAccountId: 'account-b' });
    pending.resolve(okResponse({
      id: item.id, user_id: 'account-a', title: item.title, body: item.body,
      updated_at: item.updatedAt, folder_id: null, deleted_at: null,
      starred: false, properties: null, relations: null,
    }));

    expect(await upload).toBe(false);
    expect(useNotesStore.getState().savedAt).toBeNull();
    expect(useNotesStore.getState().syncIssue).toBeNull();
  });

  it('publishes nothing when the recovery epoch changes while POST is pending', async () => {
    bindRemoteAccount();
    const item = note('recovery-transition-post');
    useNotesStore.setState({ notes: [item], activeNoteId: item.id, savedAt: null });
    const pending = deferred<ReturnType<typeof okResponse>>();
    authFetchMock.mockImplementation((_url, _options, control) => {
      control?.onRequestStart?.();
      return pending.promise;
    });

    const upload = useNotesStore.getState().syncNoteToDB(item);
    await vi.waitFor(() => expect(authFetchMock).toHaveBeenCalledTimes(1));
    setRecoveryModeActiveForTest(true);
    pending.resolve(okResponse({
      id: item.id, user_id: 'account-a', title: item.title, body: item.body,
      updated_at: item.updatedAt, folder_id: null, deleted_at: null,
      starred: false, properties: null, relations: null,
    }));

    expect(await upload).toBe(false);
    expect(useNotesStore.getState().savedAt).toBeNull();
    expect(useNotesStore.getState().syncIssue).toBeNull();
  });

  it('publishes nothing when the account changes during ambiguous readback', async () => {
    bindRemoteAccount();
    const item = note('account-switch-readback');
    useNotesStore.setState({ notes: [item], activeNoteId: item.id, savedAt: null });
    const pendingRead = deferred<ReturnType<typeof okResponse>>();
    authFetchMock.mockImplementation((_url, _options, control) => {
      control?.onRequestStart?.();
      return Promise.reject(new Error('lost response'));
    });
    authReadFetchMock.mockReturnValue(pendingRead.promise);

    const upload = useNotesStore.getState().syncNoteToDB(item);
    await vi.waitFor(() => expect(authReadFetchMock).toHaveBeenCalledTimes(1));
    activateNotesAccountAuthority('account-b');
    useNotesStore.setState({ notes: [], activeAccountId: 'account-b' });
    pendingRead.resolve(okResponse({
      id: item.id, user_id: 'account-a', title: item.title, body: item.body,
      updated_at: item.updatedAt, folder_id: null, deleted_at: null,
      starred: false, properties: null, relations: null,
    }));

    expect(await upload).toBe(false);
    expect(useNotesStore.getState().syncIssue).toBeNull();
  });

  it('publishes nothing when logout detaches Notes during ambiguous readback', async () => {
    bindRemoteAccount();
    const item = note('logout-readback');
    useNotesStore.setState({ notes: [item], activeNoteId: item.id, savedAt: null });
    const pendingRead = deferred<ReturnType<typeof okResponse>>();
    authFetchMock.mockImplementation((_url, _options, control) => {
      control?.onRequestStart?.();
      return Promise.reject(new Error('lost response'));
    });
    authReadFetchMock.mockReturnValue(pendingRead.promise);

    const upload = useNotesStore.getState().syncNoteToDB(item);
    await vi.waitFor(() => expect(authReadFetchMock).toHaveBeenCalledTimes(1));
    useNotesStore.getState().detachNotesStorage();
    pendingRead.resolve(okResponse({}));

    expect(await upload).toBe(false);
    expect(useNotesStore.getState().activeAccountId).toBeNull();
    expect(useNotesStore.getState().syncIssue).toBeNull();
  });

  it('confirms a committed Note after POST transport loss through the store path', async () => {
    bindRemoteAccount();
    const item = note('committed-after-transport-loss', {
      title: 'Local title',
      body: 'Local body',
      updatedAt: 42,
      starred: true,
    });
    useNotesStore.setState({
      notes: [item],
      activeNoteId: item.id,
      savedAt: null,
      syncError: 'Cloud sync could not be confirmed; the local Note was kept.',
      syncIssue: {
        source: 'note_remote_write',
        targetId: item.id,
        retryable: true,
        message: 'Cloud sync could not be confirmed; the local Note was kept.',
        classification: 'TRANSPORT_AMBIGUOUS',
      },
    });
    const localBeforeSync = useNotesStore.getState().notes[0];
    let remoteCommitted = false;
    authFetchMock.mockImplementation(async (_url, options, control) => {
      expect(options).toEqual(expect.objectContaining({ method: 'POST' }));
      control?.onRequestStart?.();
      remoteCommitted = true;
      throw new Error('transport lost after remote commit');
    });
    authReadFetchMock.mockImplementation(async (url, options, control) => {
      expect(remoteCommitted).toBe(true);
      expect(url).toContain(`/api/notes/${encodeURIComponent(item.id)}`);
      expect(options).toEqual(expect.objectContaining({ method: 'GET' }));
      control?.onRequestStart?.();
      return okResponse({
        id: item.id,
        user_id: 'account-a',
        title: item.title,
        body: item.body,
        updated_at: item.updatedAt,
        folder_id: null,
        deleted_at: null,
        starred: item.starred,
        properties: null,
        relations: null,
      });
    });

    const result = await useNotesStore.getState().syncNoteToDB(item);

    expect(result).toBe(true);
    expect(authFetchMock).toHaveBeenCalledTimes(1);
    expect(authReadFetchMock).toHaveBeenCalledTimes(1);
    expect(useNotesStore.getState().syncIssue).toBeNull();
    expect(useNotesStore.getState().syncError).toBeNull();
    expect(useNotesStore.getState().savedAt).toBeInstanceOf(Date);
    expect(useNotesStore.getState().notes.find(note => note.id === item.id)).toEqual(localBeforeSync);
  });

  it('does not let an older POST success clear a newer local mutation issue', async () => {
    bindRemoteAccount();
    const item = note('newer-local-wins');
    useNotesStore.setState({ notes: [item], activeNoteId: item.id, savedAt: null });
    const pending = deferred<ReturnType<typeof okResponse>>();
    authFetchMock.mockImplementation((_url, _options, control) => {
      control?.onRequestStart?.();
      return pending.promise;
    });

    const oldUpload = useNotesStore.getState().syncNoteToDB(item);
    await vi.waitFor(() => expect(authFetchMock).toHaveBeenCalledTimes(1));
    useNotesStore.getState().updateNote(item.id, { body: 'newer local body' });
    useNotesStore.setState({
      syncError: 'newer local mutation remains pending',
      syncIssue: {
        source: 'note_remote_write', targetId: item.id, retryable: true,
        message: 'newer local mutation remains pending', classification: 'REMOTE_NOT_CONFIRMED',
      },
    });
    pending.resolve(okResponse({
      id: item.id, user_id: 'account-a', title: item.title, body: item.body,
      updated_at: item.updatedAt, folder_id: null, deleted_at: null,
      starred: false, properties: null, relations: null,
    }));

    expect(await oldUpload).toBe(false);
    expect(useNotesStore.getState().syncError).toBe('newer local mutation remains pending');
    expect(useNotesStore.getState().savedAt).toBeNull();
  });
});
