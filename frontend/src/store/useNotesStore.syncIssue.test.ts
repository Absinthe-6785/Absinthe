// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteBase } from '../components/views/noteUtils';
import { FOLDERS_KEY } from '../components/views/noteUtils';
import { NOTES_RUNTIME_SYNC_MODE_KEY } from '../lib/notesSyncClient';
import { resetNotesPersistenceForTests, type NotesPersistenceWriteResult } from '../lib/notePersistence';
import { activateNotesAccountAuthority } from '../lib/notesAccountAuthority';
import { setRecoveryModeActiveForTest } from '../lib/recoverySafetyPolicy';
import { projectNoteSyncPresentation } from '../components/views/noteview/notesSyncPresentation';
import { NOTES_BOOTSTRAP_FAILURE_MESSAGE } from '../lib/notesBootstrapDiagnostics';

const { authFetchMock, authReadFetchMock, snapshotMock, persistenceHarness } = vi.hoisted(() => ({
  authFetchMock: vi.fn(),
  authReadFetchMock: vi.fn(),
  snapshotMock: vi.fn(),
  persistenceHarness: {
    intercept: false,
    saveNotesAsyncMock: vi.fn(),
    interceptFolders: false,
    saveFoldersAsyncMock: vi.fn(),
  },
}));

vi.mock('../lib/supabase', () => ({
  authFetch: (...args: unknown[]) => authFetchMock(...args),
  authReadFetch: (...args: unknown[]) => authReadFetchMock(...args),
}));

vi.mock('../lib/vaultSnapshotAuto', () => ({ scheduleAutoSnapshot: snapshotMock }));

vi.mock('../lib/notePersistence', async importOriginal => {
  const actual = await importOriginal<typeof import('../lib/notePersistence')>();
  return {
    ...actual,
    saveNotesAsync: (...args: unknown[]) => persistenceHarness.intercept
      ? persistenceHarness.saveNotesAsyncMock(...args)
      : actual.saveNotesAsync(...args),
    saveFoldersAsync: (...args: unknown[]) => persistenceHarness.interceptFolders
      ? persistenceHarness.saveFoldersAsyncMock(...args)
      : actual.saveFoldersAsync(...args),
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
  snapshotMock.mockClear();
  authReadFetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
  persistenceHarness.intercept = false;
  persistenceHarness.saveNotesAsyncMock.mockReset();
  persistenceHarness.interceptFolders = false;
  persistenceHarness.saveFoldersAsyncMock.mockReset();
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

function currentSyncPresentation() {
  const { activeNoteId, syncError, syncIssue } = useNotesStore.getState();
  return projectNoteSyncPresentation({ activeNoteId, syncError, syncIssue });
}

describe('Notes sync-issue ownership and clearing contract', () => {
  beforeEach(resetStore);

  const lateResults: NotesPersistenceWriteResult[] = [
    { status: 'persisted' },
    { status: 'failed', reason: 'indexeddb_rejected' },
    { status: 'blocked', reason: 'stale_epoch' },
  ];
  const localIssue = (message: string) => ({
    syncError: message,
    syncIssue: { source: 'local_notes_persistence' as const, retryable: true, message },
  });
  const switchAccount = async (accountId: string) => {
    useNotesStore.getState().detachNotesStorage();
    await useNotesStore.getState().initNotesStorage(accountId);
  };

  it.each(lateResults.flatMap(result => [false, true].map(aba => ({ result, aba }))))(
    'ignores an old Notes $result.status result after account replacement (ABA=$aba)', async ({ result, aba }) => {
      storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'local');
      await switchAccount('account-a');
      const pending = deferred<NotesPersistenceWriteResult>();
      persistenceHarness.intercept = true;
      persistenceHarness.saveNotesAsyncMock.mockReturnValue(pending.promise);
      useNotesStore.getState().importNote(note('old-account-note'));
      await switchAccount('account-b');
      if (aba) await switchAccount('account-a');
      const current = note('current-account-note');
      useNotesStore.setState({ notes: [current], folders: [{ id: 'current-folder', name: 'Current' }], ...localIssue('current issue') });
      const before = useNotesStore.getState();
      pending.resolve(result);
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(useNotesStore.getState().syncError).toBe('current issue');
      expect(useNotesStore.getState().notes).toBe(before.notes);
      expect(useNotesStore.getState().folders).toBe(before.folders);
      expect(useNotesStore.getState().savedAt).toBeNull();
      expect(authFetchMock).not.toHaveBeenCalled();
      expect(snapshotMock).not.toHaveBeenCalled();
    },
  );

  it.each([true, false])('keeps the newest same-account persistence verdict (old success=$oldSuccess)', async oldSuccess => {
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'local');
    await switchAccount('account-a');
    const older = deferred<NotesPersistenceWriteResult>();
    const newer = deferred<NotesPersistenceWriteResult>();
    persistenceHarness.intercept = true;
    persistenceHarness.saveNotesAsyncMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    useNotesStore.getState().importNote(note('same-note'));
    useNotesStore.getState().updateNote('same-note', { title: 'newer title' });
    newer.resolve(oldSuccess ? { status: 'failed', reason: 'indexeddb_rejected' } : { status: 'persisted' });
    await new Promise(resolve => setTimeout(resolve, 0));
    const currentIssue = useNotesStore.getState().syncIssue;
    expect(currentIssue?.source ?? null).toBe(oldSuccess ? 'local_notes_persistence' : null);
    older.resolve(oldSuccess ? { status: 'persisted' } : { status: 'failed', reason: 'indexeddb_rejected' });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(useNotesStore.getState().syncIssue).toBe(currentIssue);
    expect(useNotesStore.getState().notes[0].title).toBe('newer title');
  });

  it.each(lateResults.flatMap(result => [false, true].map(aba => ({ result, aba }))))(
    'does not continue an old retry after account replacement ($result.status, ABA=$aba)', async ({ result, aba }) => {
      storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'local');
      await switchAccount('account-a');
      const pending = deferred<NotesPersistenceWriteResult>();
      persistenceHarness.intercept = true;
      persistenceHarness.saveNotesAsyncMock.mockReturnValue(pending.promise);
      persistenceHarness.interceptFolders = true;
      persistenceHarness.saveFoldersAsyncMock.mockResolvedValue(true);
      useNotesStore.getState().retrySync();
      await switchAccount('account-b');
      if (aba) await switchAccount('account-a');
      useNotesStore.setState(localIssue('new account issue'));
      pending.resolve(result);
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(useNotesStore.getState().syncError).toBe('new account issue');
      expect(persistenceHarness.saveFoldersAsyncMock).not.toHaveBeenCalled();
      expect(authFetchMock).not.toHaveBeenCalled();
    },
  );

  it('does not publish a stale folder result from retrySync after account replacement', async () => {
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'local');
    await switchAccount('account-a');
    persistenceHarness.intercept = true;
    persistenceHarness.saveNotesAsyncMock.mockResolvedValue({ status: 'persisted' });
    persistenceHarness.interceptFolders = true;
    const folderSave = deferred<boolean>();
    persistenceHarness.saveFoldersAsyncMock.mockReturnValue(folderSave.promise);
    useNotesStore.getState().retrySync();
    await vi.waitFor(() => expect(persistenceHarness.saveFoldersAsyncMock).toHaveBeenCalledTimes(1));
    await switchAccount('account-b');
    useNotesStore.setState(localIssue('newer account issue'));
    folderSave.resolve(false);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(useNotesStore.getState().syncError).toBe('newer account issue');
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it.each(['notes', 'retry'])('ignores a %s result after the operation epoch changes', async operation => {
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'local');
    await switchAccount('account-a');
    const pending = deferred<NotesPersistenceWriteResult>();
    persistenceHarness.intercept = true;
    persistenceHarness.saveNotesAsyncMock.mockReturnValue(pending.promise);
    persistenceHarness.interceptFolders = true;
    if (operation === 'retry') useNotesStore.getState().retrySync();
    else useNotesStore.getState().importNote(note('epoch-note'));
    setRecoveryModeActiveForTest(true);
    useNotesStore.setState(localIssue('current recovery issue'));
    pending.resolve({ status: 'persisted' });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(useNotesStore.getState().syncError).toBe('current recovery issue');
    expect(snapshotMock).not.toHaveBeenCalled();
    expect(persistenceHarness.saveFoldersAsyncMock).not.toHaveBeenCalled();
  });

  it('does not continue an older retry after a newer same-account mutation', async () => {
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'local');
    await switchAccount('account-a');
    const pending = deferred<NotesPersistenceWriteResult>();
    persistenceHarness.intercept = true;
    persistenceHarness.saveNotesAsyncMock.mockReturnValueOnce(pending.promise)
      .mockResolvedValue({ status: 'failed', reason: 'indexeddb_rejected' });
    persistenceHarness.interceptFolders = true;
    useNotesStore.getState().retrySync();
    useNotesStore.getState().importNote(note('newer-write'));
    await vi.waitFor(() => expect(useNotesStore.getState().syncIssue?.source).toBe('local_notes_persistence'));
    const issue = useNotesStore.getState().syncIssue;
    pending.resolve({ status: 'persisted' });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(useNotesStore.getState().syncIssue).toBe(issue);
    expect(persistenceHarness.saveFoldersAsyncMock).not.toHaveBeenCalled();
  });

  it('does not snapshot or publish a retry folder result superseded by a Notes mutation', async () => {
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'local');
    await switchAccount('account-a');
    persistenceHarness.intercept = true;
    persistenceHarness.saveNotesAsyncMock.mockResolvedValueOnce({ status: 'persisted' })
      .mockResolvedValue({ status: 'failed', reason: 'indexeddb_rejected' });
    persistenceHarness.interceptFolders = true;
    const pending = deferred<boolean>();
    persistenceHarness.saveFoldersAsyncMock.mockReturnValue(pending.promise);
    useNotesStore.getState().retrySync();
    await vi.waitFor(() => expect(persistenceHarness.saveFoldersAsyncMock).toHaveBeenCalledTimes(1));
    useNotesStore.getState().importNote(note('newer-write'));
    await vi.waitFor(() => expect(useNotesStore.getState().syncIssue?.source).toBe('local_notes_persistence'));
    const issue = useNotesStore.getState().syncIssue;
    snapshotMock.mockClear();
    pending.resolve(true);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(useNotesStore.getState().syncIssue).toBe(issue);
    expect(snapshotMock).not.toHaveBeenCalled();
  });

  it('preserves an unchanged Note upload while a newer unrelated Note owns the local failure', async () => {
    await switchAccount('account-a');
    const first = note('first');
    useNotesStore.setState({ notes: [first, note('second')] });
    const pending = deferred<NotesPersistenceWriteResult>();
    persistenceHarness.intercept = true;
    persistenceHarness.saveNotesAsyncMock.mockReturnValueOnce(pending.promise)
      .mockResolvedValue({ status: 'failed', reason: 'indexeddb_rejected' });
    authFetchMock.mockResolvedValue(okResponse());
    const upload = useNotesStore.getState().syncNoteToDB(first);
    useNotesStore.getState().updateNote('second', { title: 'new title' });
    await vi.waitFor(() => expect(useNotesStore.getState().syncIssue?.source).toBe('local_notes_persistence'));
    pending.resolve({ status: 'persisted' });
    expect(await upload).toBe(true);
    expect(authFetchMock).toHaveBeenCalledTimes(1);
    expect(useNotesStore.getState().syncIssue?.source).toBe('local_notes_persistence');
  });

  it('keeps the current async retry and its remote Note retry operational', async () => {
    await switchAccount('account-a');
    const item = note('valid-retry');
    useNotesStore.setState({ notes: [item] });
    persistenceHarness.intercept = true;
    persistenceHarness.saveNotesAsyncMock.mockResolvedValue({ status: 'persisted' });
    persistenceHarness.interceptFolders = true;
    persistenceHarness.saveFoldersAsyncMock.mockResolvedValue(true);
    authFetchMock.mockResolvedValueOnce(failedResponse()).mockResolvedValueOnce(okResponse());
    expect(await useNotesStore.getState().syncNoteToDB(item)).toBe(false);
    useNotesStore.getState().retrySync();
    await vi.waitFor(() => expect(useNotesStore.getState().syncIssue).toBeNull());
    expect(persistenceHarness.saveFoldersAsyncMock).toHaveBeenCalledTimes(1);
    expect(authFetchMock).toHaveBeenCalledTimes(2);
    expect(snapshotMock).toHaveBeenCalled();
  });

  it('rejects local success publication when the persistence completion has a stale epoch', async () => {
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'local');
    await switchAccount('account-a');
    const item = note('stale-local-success');
    useNotesStore.setState({ notes: [item], savedAt: null });
    const pending = deferred<NotesPersistenceWriteResult>();
    persistenceHarness.intercept = true;
    persistenceHarness.saveNotesAsyncMock.mockReturnValue(pending.promise);
    const upload = useNotesStore.getState().syncNoteToDB(item);
    setRecoveryModeActiveForTest(true);
    pending.resolve({ status: 'persisted' });
    expect(await upload).toBe(false);
    expect(useNotesStore.getState().savedAt).toBeNull();
    expect(snapshotMock).not.toHaveBeenCalled();
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('keeps a newer folder-only failure when an older retry folder write succeeds', async () => {
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'local');
    await switchAccount('account-a');
    useNotesStore.setState({ folders: [{ id: 'folder', name: 'Before' }] });
    persistenceHarness.intercept = true;
    persistenceHarness.saveNotesAsyncMock.mockResolvedValue({ status: 'persisted' });
    persistenceHarness.interceptFolders = true;
    const older = deferred<boolean>();
    const newer = deferred<boolean>();
    persistenceHarness.saveFoldersAsyncMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    useNotesStore.getState().retrySync();
    await vi.waitFor(() => expect(persistenceHarness.saveFoldersAsyncMock).toHaveBeenCalledTimes(1));
    useNotesStore.getState().renameFolder('folder', 'Newer');
    newer.resolve(false);
    await vi.waitFor(() => expect(useNotesStore.getState().syncIssue?.source).toBe('local_folders_persistence'));
    const issue = useNotesStore.getState().syncIssue;
    snapshotMock.mockClear();
    older.resolve(true);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(useNotesStore.getState().syncIssue).toBe(issue);
    expect(useNotesStore.getState().folders[0].name).toBe('Newer');
    expect(snapshotMock).not.toHaveBeenCalled();
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it.each([null, 'folder-view'])('finishes a valid retry through folder selection %s', async folderId => {
    await switchAccount('account-a');
    const item = note('retry-during-navigation');
    useNotesStore.setState({ notes: [item], activeFolderId: null });
    persistenceHarness.intercept = true;
    persistenceHarness.saveNotesAsyncMock.mockResolvedValue({ status: 'persisted' });
    authFetchMock.mockResolvedValueOnce(failedResponse()).mockResolvedValueOnce(okResponse());
    expect(await useNotesStore.getState().syncNoteToDB(item)).toBe(false);
    persistenceHarness.interceptFolders = true;
    const pending = deferred<boolean>();
    persistenceHarness.saveFoldersAsyncMock.mockReturnValue(pending.promise);
    useNotesStore.getState().retrySync();
    await vi.waitFor(() => expect(persistenceHarness.saveFoldersAsyncMock).toHaveBeenCalledTimes(1));
    const { notes, folders } = useNotesStore.getState();
    useNotesStore.getState().setActiveFolderId(folderId);
    expect(useNotesStore.getState().notes).toBe(notes);
    expect(useNotesStore.getState().folders).toBe(folders);
    pending.resolve(true);
    await vi.waitFor(() => expect(useNotesStore.getState().syncIssue).toBeNull());
    expect(authFetchMock).toHaveBeenCalledTimes(2);
    expect(persistenceHarness.saveFoldersAsyncMock).toHaveBeenCalledTimes(1);
  });

  it('clears a failed Note POST only after matching success', async () => {
    bindRemoteAccount();
    const item = note('write-failure');
    authFetchMock.mockResolvedValueOnce(failedResponse()).mockResolvedValueOnce(okResponse());

    useNotesStore.getState().importNote(item);
    await vi.waitFor(() => expect(useNotesStore.getState().syncIssue?.classification).toBe('REMOTE_NOT_CONFIRMED'));
    expect(useNotesStore.getState().syncIssue?.source).toBe('note_remote_write');
    expect(currentSyncPresentation()).toEqual({
      kind: 'remote-pending', messageKey: 'nvSyncPending', retryable: true,
    });

    await useNotesStore.getState().syncNoteToDB(item);
    expect(useNotesStore.getState().syncError).toBeNull();
    expect(useNotesStore.getState().syncIssue).toBeNull();
    expect(currentSyncPresentation()).toEqual({ kind: 'none' });
  });

  it('projects production auth unavailability without a blind retry', async () => {
    const item = note('auth-unavailable');
    useNotesStore.setState({ notes: [item], activeNoteId: item.id });

    expect(await useNotesStore.getState().syncNoteToDB(item)).toBe(false);
    expect(useNotesStore.getState().syncIssue?.classification).toBe('AUTH_UNAVAILABLE');
    expect(currentSyncPresentation()).toEqual({
      kind: 'auth-required', messageKey: 'nvSyncAuthRequired', retryable: false,
    });
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('projects an ambiguous production transport outcome as safely retryable and unconfirmed', async () => {
    bindRemoteAccount();
    const item = note('transport-ambiguous');
    useNotesStore.setState({ notes: [item], activeNoteId: item.id });
    authFetchMock.mockImplementation((_url, _options, control) => {
      control?.onRequestStart?.();
      return Promise.reject(new Error('lost response'));
    });
    authReadFetchMock.mockRejectedValue(new Error('readback unavailable'));

    expect(await useNotesStore.getState().syncNoteToDB(item)).toBe(false);
    expect(useNotesStore.getState().syncIssue?.classification).toBe('TRANSPORT_AMBIGUOUS');
    expect(currentSyncPresentation()).toEqual({
      kind: 'remote-unconfirmed', messageKey: 'nvSyncStatusUnconfirmed', retryable: true,
    });
  });

  it('projects a production remote conflict without a blind retry', async () => {
    bindRemoteAccount();
    const item = note('remote-conflict');
    useNotesStore.setState({ notes: [item], activeNoteId: item.id });
    authFetchMock.mockImplementation((_url, _options, control) => {
      control?.onRequestStart?.();
      return Promise.reject(new Error('lost response'));
    });
    authReadFetchMock.mockResolvedValue(okResponse({
      id: item.id, user_id: 'account-a', title: 'newer remote', body: item.body,
      updated_at: item.updatedAt + 1, folder_id: null, deleted_at: null,
      starred: false, properties: null, relations: null,
    }));

    expect(await useNotesStore.getState().syncNoteToDB(item)).toBe(false);
    expect(useNotesStore.getState().syncIssue?.classification).toBe('REMOTE_CONFLICT');
    expect(currentSyncPresentation()).toEqual({
      kind: 'remote-conflict', messageKey: 'nvSyncConflict', retryable: false,
    });
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
    expect(useNotesStore.getState().syncError).toBe(NOTES_BOOTSTRAP_FAILURE_MESSAGE);
    expect(useNotesStore.getState().syncIssue).toMatchObject({
      classification: 'BOOTSTRAP_FAILURE',
      stage: 'FETCH_NOTES',
      reasonCode: 'REMOTE_FETCH_REJECTED',
      retryable: false,
    });
    expect(JSON.stringify(useNotesStore.getState().syncIssue)).not.toContain('bootstrap network failure');
    expect(currentSyncPresentation()).toEqual({
      kind: 'bootstrap-problem', messageKey: 'nvSyncBootstrapProblem', retryable: false,
    });

    fail = false;
    await useNotesStore.getState().bootstrapFromSupabase();
    expect(useNotesStore.getState().syncError).toBeNull();
    expect(useNotesStore.getState().syncIssue).toBeNull();
    expect(currentSyncPresentation()).toEqual({ kind: 'none' });
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
    expect(currentSyncPresentation()).toEqual({
      kind: 'local-save-problem', messageKey: 'nvSyncLocalSaveProblem', retryable: false,
    });
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
    expect(currentSyncPresentation()).toEqual({ kind: 'none' });
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
