import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FOLDERS_KEY,
  NOTES_KEY,
  saveFolders,
  type NoteBase,
  type NoteFolderBase,
} from '../components/views/noteUtils';

const storage = new Map<string, string>();
let rejectFolderWrites = false;
let folderAuthorityWriteAttempts = 0;
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    if (key === FOLDERS_KEY || key.includes('account-authority.folders.v1')) {
      folderAuthorityWriteAttempts += 1;
    }
    if (rejectFolderWrites && (key === FOLDERS_KEY || key.includes('folders'))) {
      throw new Error('folder storage rejected');
    }
    storage.set(key, value);
  },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => { storage.clear(); },
  key: (index: number) => [...storage.keys()][index] ?? null,
  get length() { return storage.size; },
};
vi.stubGlobal('localStorage', localStorageMock);

const authFetchMock = vi.fn();
const authReadFetchMock = vi.fn();
vi.mock('../lib/supabase', () => ({
  authFetch: (...args: unknown[]) => authFetchMock(...args),
  authReadFetch: (...args: unknown[]) => authReadFetchMock(...args),
}));

import { resetNotesPersistenceForTests } from '../lib/notePersistence';
import {
  activateNotesAccountAuthority,
  listNotesFolderRemoteMutations,
  saveAccountScopedNotes,
} from '../lib/notesAccountAuthority';
import { setRecoveryModeActiveForTest } from '../lib/recoverySafetyPolicy';
import { NOTES_RUNTIME_SYNC_MODE_KEY } from '../lib/notesSyncClient';
import { resetAutoSnapshotStateForTests } from '../lib/vaultSnapshotAuto';
const {
  FOLDER_DELETE_UNDO_WINDOW_MS,
  FOLDER_DELETE_DURABILITY_FAILURE_MESSAGE,
  FOLDER_UNDO_DURABILITY_FAILURE_MESSAGE,
  useNotesStore,
} = await import('./useNotesStore');

const folder = (id: string, name: string, createdAt: number): NoteFolderBase => ({ id, name, createdAt });
const note = (
  id: string,
  folderId: string | null,
  body = `body:${id}`,
  deletedAt: number | null = null,
): NoteBase => ({ id, title: id, body, updatedAt: 10, folderId, deletedAt, starred: false });

function resetStore() {
  useNotesStore.getState().detachNotesStorage();
  setRecoveryModeActiveForTest(false);
  resetNotesPersistenceForTests();
  resetAutoSnapshotStateForTests();
  storage.clear();
  storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'local');
  rejectFolderWrites = false;
  folderAuthorityWriteAttempts = 0;
  authFetchMock.mockReset();
  authReadFetchMock.mockReset();
  authFetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
  authReadFetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
  useNotesStore.setState({
    notes: [],
    folders: [],
    activeNoteId: null,
    activeFolderId: null,
    activeAccountId: null,
    isSyncing: false,
    savedAt: null,
    syncError: null,
    syncIssue: null,
  });
}

function seed(notes: NoteBase[], folders: NoteFolderBase[], activeFolderId: string | null = null) {
  storage.set(NOTES_KEY, JSON.stringify(notes));
  expect(saveFolders(folders)).toBe(true);
  useNotesStore.setState({ notes, folders, activeFolderId });
}

function bindRemoteAccount() {
  activateNotesAccountAuthority('account-a');
  useNotesStore.setState({ activeAccountId: 'account-a' });
  storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
}

async function seedInitializedAccount(
  accountId: string,
  notes: NoteBase[],
  folders: NoteFolderBase[],
): Promise<void> {
  await useNotesStore.getState().initNotesStorage(accountId);
  expect(await saveAccountScopedNotes(accountId, notes)).toBe(true);
  expect(saveFolders(folders)).toBe(true);
  useNotesStore.setState({
    notes,
    folders,
    activeNoteId: notes[0]?.id ?? null,
    activeFolderId: null,
    activeAccountId: accountId,
    syncError: null,
    syncIssue: null,
  });
}

function completeSnapshot(accountId: string, rows: readonly unknown[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      account_id: accountId,
      rows,
      total_count: rows.length,
      offset: 0,
      limit: 500,
      complete: true,
    }),
  };
}

function installRemoteSnapshot(
  accountId: string,
  notes: readonly NoteBase[],
  folders: readonly NoteFolderBase[],
): void {
  authReadFetchMock.mockImplementation((url: string) => Promise.resolve(
    url.includes('/api/notes?')
      ? completeSnapshot(accountId, notes.map(item => ({
        id: item.id,
        user_id: accountId,
        title: item.title,
        body: item.body,
        updated_at: item.updatedAt,
        folder_id: item.folderId,
        deleted_at: item.deletedAt,
        starred: item.starred,
        properties: item.properties ?? null,
        relations: item.relations ?? null,
      })))
      : completeSnapshot(accountId, folders.map(item => ({
        id: item.id,
        user_id: accountId,
        name: item.name,
        created_at: item.createdAt,
      }))),
  ));
}

function successfulRemoteResponse(accountId: string, url: unknown, options?: RequestInit) {
  if (String(url).endsWith('/api/notes') && options?.method === 'POST') {
    const payload = JSON.parse(String(options.body)) as Record<string, unknown>;
    return {
      ok: true,
      status: 200,
      json: async () => ({ properties: null, relations: null, user_id: accountId, ...payload }),
    };
  }
  return { ok: true, status: 200, json: async () => ({}) };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe('Notes folder destructive lifecycle', () => {
  beforeEach(resetStore);
  afterEach(() => {
    rejectFolderWrites = false;
    vi.useRealTimers();
  });

  it('durably deletes one folder, preserves every Note identity/body, and unassigns all members', async () => {
    const folders = [folder('before', 'Before', 1), folder('research', 'Research', 2), folder('after', 'After', 3)];
    const notes = [
      note('active-member', 'research', 'keep active body'),
      note('trashed-member', 'research', 'keep trashed body', 100),
      note('unrelated', 'after', 'keep unrelated body'),
    ];
    seed(notes, folders, 'research');
    const identitiesAndBodies = notes.map(({ id, body }) => ({ id, body }));

    const result = await useNotesStore.getState().deleteFolder('research');

    expect(result.status).toBe('deleted');
    if (result.status !== 'deleted') throw new Error('expected deletion receipt');
    expect(result.receipt.affectedNoteCount).toBe(2);
    const state = useNotesStore.getState();
    expect(state.folders.map(item => item.id)).toEqual(['before', 'after']);
    expect(state.activeFolderId).toBeNull();
    expect(state.notes.map(({ id, body }) => ({ id, body }))).toEqual(identitiesAndBodies);
    expect(state.notes).toHaveLength(notes.length);
    expect(state.notes.filter(item => item.id !== 'unrelated').every(item => item.folderId === null)).toBe(true);
    expect(state.notes.find(item => item.id === 'unrelated')?.folderId).toBe('after');
    expect(JSON.parse(storage.get(NOTES_KEY) ?? '[]')).toEqual(state.notes);
  });

  it('restores only still-unassigned members and preserves a newer explicit assignment', async () => {
    const folders = [folder('research', 'Research', 1), folder('later', 'Later', 2)];
    const notes = [note('restore-me', 'research'), note('move-me', 'research'), note('unrelated', null)];
    seed(notes, folders, 'research');
    const deleted = await useNotesStore.getState().deleteFolder('research');
    if (deleted.status !== 'deleted') throw new Error('expected deletion receipt');

    useNotesStore.getState().updateNote('move-me', { folderId: 'later' });
    const undone = await useNotesStore.getState().undoFolderDeletion(deleted.receipt.token);

    expect(undone).toEqual({
      status: 'restored',
      restoredNoteIds: ['restore-me'],
      preservedNewerAssignmentNoteIds: ['move-me'],
    });
    const state = useNotesStore.getState();
    expect(state.folders.map(item => item.id)).toEqual(['research', 'later']);
    expect(state.folders[0]).toEqual(folder('research', 'Research', 1));
    expect(state.notes.find(item => item.id === 'restore-me')?.folderId).toBe('research');
    expect(state.notes.find(item => item.id === 'move-me')?.folderId).toBe('later');
    expect(state.notes.find(item => item.id === 'unrelated')?.folderId).toBeNull();
    expect(state.notes.map(item => item.body)).toEqual(notes.map(item => item.body));
  });

  it('fails closed when the deleted folder identity already exists at Undo time', async () => {
    seed([note('member', 'research')], [folder('research', 'Research', 1)]);
    const deleted = await useNotesStore.getState().deleteFolder('research');
    if (deleted.status !== 'deleted') throw new Error('expected deletion receipt');
    const conflicting = folder('research', 'Newer identity', 99);
    useNotesStore.setState({ folders: [conflicting] });

    const result = await useNotesStore.getState().undoFolderDeletion(deleted.receipt.token);

    expect(result.status).toBe('folder_id_conflict');
    expect(useNotesStore.getState().folders).toEqual([conflicting]);
    expect(useNotesStore.getState().notes[0]?.folderId).toBeNull();
  });

  it('expires the narrow recovery capability after the bounded Undo window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    seed([note('member', 'research')], [folder('research', 'Research', 1)]);
    const deleted = await useNotesStore.getState().deleteFolder('research');
    if (deleted.status !== 'deleted') throw new Error('expected deletion receipt');

    vi.setSystemTime(1_000 + FOLDER_DELETE_UNDO_WINDOW_MS + 1);
    const result = await useNotesStore.getState().undoFolderDeletion(deleted.receipt.token);

    expect(result.status).toBe('expired');
    expect(useNotesStore.getState().folders).toEqual([]);
    expect(useNotesStore.getState().notes[0]?.folderId).toBeNull();
  });

  it('keeps in-memory and durable state unchanged when deletion persistence fails', async () => {
    const folders = [folder('research', 'Research', 1)];
    const notes = [note('member', 'research', 'irreplaceable')];
    seed(notes, folders, 'research');
    rejectFolderWrites = true;

    const result = await useNotesStore.getState().deleteFolder('research');

    expect(result.status).toBe('persistence_failed');
    expect(useNotesStore.getState().folders).toEqual(folders);
    expect(useNotesStore.getState().notes).toEqual(notes);
    expect(JSON.parse(storage.get(NOTES_KEY) ?? '[]')).toEqual(notes);
    expect(useNotesStore.getState().syncError).toBe(FOLDER_DELETE_DURABILITY_FAILURE_MESSAGE);
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('keeps the coherent deleted state when Undo persistence fails', async () => {
    const folders = [folder('research', 'Research', 1)];
    seed([note('member', 'research', 'irreplaceable')], folders);
    const deleted = await useNotesStore.getState().deleteFolder('research');
    if (deleted.status !== 'deleted') throw new Error('expected deletion receipt');
    const deletedNotes = useNotesStore.getState().notes;
    rejectFolderWrites = true;

    const result = await useNotesStore.getState().undoFolderDeletion(deleted.receipt.token);

    expect(result.status).toBe('persistence_failed');
    expect(useNotesStore.getState().folders).toEqual([]);
    expect(useNotesStore.getState().notes).toEqual(deletedNotes);
    expect(JSON.parse(storage.get(NOTES_KEY) ?? '[]')).toEqual(deletedNotes);
    expect(useNotesStore.getState().syncError).toBe(FOLDER_UNDO_DURABILITY_FAILURE_MESSAGE);
  });

  it('starts one remote folder delete and preserves local Note bodies when remote sync fails', async () => {
    bindRemoteAccount();
    const folders = [folder('research', 'Research', 1)];
    const notes = [note('member', 'research', 'local body survives')];
    seed(notes, folders);
    authFetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });

    const result = await useNotesStore.getState().deleteFolder('research');

    expect(result.status).toBe('deleted');
    await vi.waitFor(() => {
      const folderDeletes = authFetchMock.mock.calls.filter(([url, options]) => (
        String(url).endsWith('/api/note_folders/research')
        && (options as RequestInit | undefined)?.method === 'DELETE'
      ));
      expect(folderDeletes).toHaveLength(1);
    });
    expect(useNotesStore.getState().notes[0]).toMatchObject({ id: 'member', body: 'local body survives', folderId: null });
    expect(useNotesStore.getState().folders).toEqual([]);
    expect(useNotesStore.getState().syncError).toBeTruthy();
  });

  it('settles remote deletion before recreating the folder and syncing current memberships on Undo', async () => {
    bindRemoteAccount();
    const folders = [folder('research', 'Research', 1)];
    seed([note('member', 'research', 'remote-safe body')], folders);
    authFetchMock.mockImplementation(async (url: unknown, options?: RequestInit) => {
      if (String(url).endsWith('/api/notes') && options?.method === 'POST') {
        const payload = JSON.parse(String(options.body)) as Record<string, unknown>;
        return {
          ok: true,
          status: 200,
          json: async () => ({ properties: null, relations: null, user_id: 'account-a', ...payload }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    const deleted = await useNotesStore.getState().deleteFolder('research');
    if (deleted.status !== 'deleted') throw new Error('expected deletion receipt');
    const undone = await useNotesStore.getState().undoFolderDeletion(deleted.receipt.token);
    expect(undone.status).toBe('restored');

    await vi.waitFor(() => {
      const restoredNotePost = authFetchMock.mock.calls.find(([url, options]) => {
        if (!String(url).endsWith('/api/notes') || (options as RequestInit | undefined)?.method !== 'POST') return false;
        const payload = JSON.parse(String((options as RequestInit).body)) as { folder_id?: string | null };
        return payload.folder_id === 'research';
      });
      expect(restoredNotePost).toBeTruthy();
    });

    const calls = authFetchMock.mock.calls;
    const remoteDeleteIndex = calls.findIndex(([url, options]) => (
      String(url).endsWith('/api/note_folders/research')
      && (options as RequestInit | undefined)?.method === 'DELETE'
    ));
    const remoteFolderRestoreIndex = calls.findIndex(([url, options]) => (
      String(url).endsWith('/api/note_folders')
      && (options as RequestInit | undefined)?.method === 'POST'
    ));
    const remoteMembershipRestoreIndex = calls.findIndex(([url, options]) => {
      if (!String(url).endsWith('/api/notes') || (options as RequestInit | undefined)?.method !== 'POST') return false;
      const payload = JSON.parse(String((options as RequestInit).body)) as { folder_id?: string | null };
      return payload.folder_id === 'research';
    });
    expect(remoteDeleteIndex).toBeGreaterThanOrEqual(0);
    expect(remoteFolderRestoreIndex).toBeGreaterThan(remoteDeleteIndex);
    expect(remoteMembershipRestoreIndex).toBeGreaterThan(remoteFolderRestoreIndex);
    expect(useNotesStore.getState().notes[0]).toMatchObject({ body: 'remote-safe body', folderId: 'research' });
  });

  it('durably suppresses a failed remote delete across restart/bootstrap and clears it after retry', async () => {
    const accountId = 'folder-delete-restart';
    const originalFolder = folder('research', 'Research', 1);
    await seedInitializedAccount(accountId, [note('member', 'research')], [originalFolder]);
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
    let remoteFolderExists = true;
    let deleteAttempts = 0;
    let successfulDeletes = 0;
    authFetchMock.mockImplementation(async (url: unknown, options?: RequestInit) => {
      if (String(url).endsWith('/api/note_folders/research') && options?.method === 'DELETE') {
        deleteAttempts += 1;
        if (deleteAttempts === 1) return { ok: false, status: 503, json: async () => ({}) };
        successfulDeletes += 1;
        remoteFolderExists = false;
        return { ok: true, status: 200, json: async () => ({}) };
      }
      return successfulRemoteResponse(accountId, url, options);
    });

    const deleted = await useNotesStore.getState().deleteFolder('research');
    expect(deleted.status).toBe('deleted');
    await vi.waitFor(() => {
      expect(deleteAttempts).toBe(1);
      expect(listNotesFolderRemoteMutations(accountId)).toHaveLength(1);
    });

    const remoteNote = { ...useNotesStore.getState().notes[0]!, folderId: null };
    useNotesStore.getState().detachNotesStorage();
    await useNotesStore.getState().initNotesStorage(accountId);
    installRemoteSnapshot(accountId, [remoteNote], remoteFolderExists ? [originalFolder] : []);
    await useNotesStore.getState().bootstrapFromSupabase();

    expect(useNotesStore.getState().folders).toEqual([]);
    expect(useNotesStore.getState().notes[0]?.folderId).toBeNull();
    expect(listNotesFolderRemoteMutations(accountId)[0]?.operation).toBe('FOLDER_DELETE');

    useNotesStore.getState().retrySync();
    await vi.waitFor(() => {
      expect(deleteAttempts).toBe(2);
      expect(successfulDeletes).toBe(1);
      expect(listNotesFolderRemoteMutations(accountId)).toHaveLength(0);
    });

    installRemoteSnapshot(accountId, [remoteNote], remoteFolderExists ? [originalFolder] : []);
    await useNotesStore.getState().bootstrapFromSupabase();
    expect(useNotesStore.getState().folders).toEqual([]);
  });

  it('treats an owner-scoped 404 on remote delete retry as authoritative convergence', async () => {
    const accountId = 'folder-delete-retry-404';
    await seedInitializedAccount(accountId, [note('member', 'research')], [folder('research', 'Research', 1)]);
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
    let deleteAttempts = 0;
    authFetchMock.mockImplementation(async (url: unknown, options?: RequestInit) => {
      if (String(url).endsWith('/api/note_folders/research') && options?.method === 'DELETE') {
        deleteAttempts += 1;
        return deleteAttempts === 1
          ? { ok: false, status: 503, json: async () => ({}) }
          : { ok: false, status: 404, json: async () => ({ detail: 'not found' }) };
      }
      return successfulRemoteResponse(accountId, url, options);
    });

    expect((await useNotesStore.getState().deleteFolder('research')).status).toBe('deleted');
    await vi.waitFor(() => {
      expect(deleteAttempts).toBe(1);
      expect(listNotesFolderRemoteMutations(accountId)[0]?.operation).toBe('FOLDER_DELETE');
    });

    useNotesStore.getState().retrySync();
    await vi.waitFor(() => {
      expect(deleteAttempts).toBe(2);
      expect(listNotesFolderRemoteMutations(accountId)).toHaveLength(0);
      expect(useNotesStore.getState().syncIssue).toBeNull();
    });
  });

  it('keeps failed remote restore durable and blocks memberships until folder recreation succeeds', async () => {
    const accountId = 'folder-restore-retry';
    const originalFolder = folder('research', 'Research', 1);
    await seedInitializedAccount(accountId, [note('member', 'research')], [originalFolder]);
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
    let failFolderRestore = true;
    authFetchMock.mockImplementation(async (url: unknown, options?: RequestInit) => {
      if (String(url).endsWith('/api/note_folders') && options?.method === 'POST' && failFolderRestore) {
        return { ok: false, status: 503, json: async () => ({}) };
      }
      return successfulRemoteResponse(accountId, url, options);
    });

    const deleted = await useNotesStore.getState().deleteFolder('research');
    if (deleted.status !== 'deleted') throw new Error('expected deletion receipt');
    const restored = await useNotesStore.getState().undoFolderDeletion(deleted.receipt.token);
    expect(restored.status).toBe('restored');

    await vi.waitFor(() => {
      expect(listNotesFolderRemoteMutations(accountId)[0]?.operation).toBe('FOLDER_RESTORE');
      const restoreAttempts = authFetchMock.mock.calls.filter(([url, options]) => (
        String(url).endsWith('/api/note_folders')
        && (options as RequestInit | undefined)?.method === 'POST'
      ));
      expect(restoreAttempts).toHaveLength(1);
      expect(useNotesStore.getState().syncIssue).toMatchObject({
        source: 'folder_remote',
        targetId: 'research',
        retryable: true,
      });
    });
    const membershipsBeforeRetry = authFetchMock.mock.calls.filter(([url, options]) => {
      if (!String(url).endsWith('/api/notes') || (options as RequestInit | undefined)?.method !== 'POST') return false;
      const payload = JSON.parse(String((options as RequestInit).body)) as { folder_id?: string | null };
      return payload.folder_id === 'research';
    });
    expect(membershipsBeforeRetry).toHaveLength(0);

    failFolderRestore = false;
    useNotesStore.getState().retrySync();
    await vi.waitFor(() => {
      const restoreAttempts = authFetchMock.mock.calls.filter(([url, options]) => (
        String(url).endsWith('/api/note_folders')
        && (options as RequestInit | undefined)?.method === 'POST'
      ));
      expect(restoreAttempts).toHaveLength(2);
      const memberships = authFetchMock.mock.calls.filter(([url, options]) => {
        if (!String(url).endsWith('/api/notes') || (options as RequestInit | undefined)?.method !== 'POST') return false;
        const payload = JSON.parse(String((options as RequestInit).body)) as { folder_id?: string | null };
        return payload.folder_id === 'research';
      });
      expect(memberships).toHaveLength(1);
      expect(
        listNotesFolderRemoteMutations(accountId),
        JSON.stringify(useNotesStore.getState().syncIssue),
      ).toHaveLength(0);
    });
  });

  it('supersedes a pending DELETE with RESTORE so retry cannot run the stale destructive intent', async () => {
    const accountId = 'folder-delete-restore-supersession';
    const originalFolder = folder('research', 'Research', 1);
    await seedInitializedAccount(accountId, [note('member', 'research')], [originalFolder]);
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
    let deleteAttempts = 0;
    let failFolderRestore = true;
    authFetchMock.mockImplementation(async (url: unknown, options?: RequestInit) => {
      if (String(url).endsWith('/api/note_folders/research') && options?.method === 'DELETE') {
        deleteAttempts += 1;
        return { ok: false, status: 503, json: async () => ({}) };
      }
      if (String(url).endsWith('/api/note_folders') && options?.method === 'POST' && failFolderRestore) {
        return { ok: false, status: 503, json: async () => ({}) };
      }
      return successfulRemoteResponse(accountId, url, options);
    });

    const deleted = await useNotesStore.getState().deleteFolder('research');
    if (deleted.status !== 'deleted') throw new Error('expected deletion receipt');
    await vi.waitFor(() => expect(listNotesFolderRemoteMutations(accountId)[0]?.operation).toBe('FOLDER_DELETE'));
    const restored = await useNotesStore.getState().undoFolderDeletion(deleted.receipt.token);
    expect(restored.status).toBe('restored');
    await vi.waitFor(() => {
      expect(listNotesFolderRemoteMutations(accountId)[0]?.operation).toBe('FOLDER_RESTORE');
      expect(useNotesStore.getState().syncIssue).toMatchObject({ source: 'folder_remote', retryable: true });
    });

    failFolderRestore = false;
    useNotesStore.getState().retrySync();
    await vi.waitFor(() => {
      const restoreAttempts = authFetchMock.mock.calls.filter(([url, options]) => (
        String(url).endsWith('/api/note_folders')
        && (options as RequestInit | undefined)?.method === 'POST'
      ));
      expect(restoreAttempts).toHaveLength(2);
      const memberships = authFetchMock.mock.calls.filter(([url, options]) => {
        if (!String(url).endsWith('/api/notes') || (options as RequestInit | undefined)?.method !== 'POST') return false;
        const payload = JSON.parse(String((options as RequestInit).body)) as { folder_id?: string | null };
        return payload.folder_id === 'research';
      });
      expect(memberships).toHaveLength(1);
      expect(
        listNotesFolderRemoteMutations(accountId),
        JSON.stringify(useNotesStore.getState().syncIssue),
      ).toHaveLength(0);
    });
    expect(deleteAttempts).toBe(1);
    expect(useNotesStore.getState().folders).toEqual([originalFolder]);
  });

  it('queues a newer DELETE behind an in-flight RESTORE without sending stale memberships', async () => {
    const accountId = 'folder-restore-delete-supersession';
    const originalFolder = folder('research', 'Research', 1);
    await seedInitializedAccount(accountId, [note('member', 'research')], [originalFolder]);
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
    const restoreResponse = deferred<{ ok: boolean; status: number; json: () => Promise<object> }>();
    let folderDeleteAttempts = 0;
    authFetchMock.mockImplementation((url: unknown, options?: RequestInit) => {
      if (String(url).endsWith('/api/note_folders/research') && options?.method === 'DELETE') {
        folderDeleteAttempts += 1;
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
      }
      if (String(url).endsWith('/api/note_folders') && options?.method === 'POST') {
        return restoreResponse.promise;
      }
      return Promise.resolve(successfulRemoteResponse(accountId, url, options));
    });

    const firstDelete = await useNotesStore.getState().deleteFolder('research');
    if (firstDelete.status !== 'deleted') throw new Error('expected deletion receipt');
    await vi.waitFor(() => expect(listNotesFolderRemoteMutations(accountId)).toHaveLength(0));
    expect((await useNotesStore.getState().undoFolderDeletion(firstDelete.receipt.token)).status).toBe('restored');
    await vi.waitFor(() => {
      const folderRestores = authFetchMock.mock.calls.filter(([url, options]) => (
        String(url).endsWith('/api/note_folders')
        && (options as RequestInit | undefined)?.method === 'POST'
      ));
      expect(folderRestores).toHaveLength(1);
    });

    expect((await useNotesStore.getState().deleteFolder('research')).status).toBe('deleted');
    expect(listNotesFolderRemoteMutations(accountId)[0]?.operation).toBe('FOLDER_DELETE');
    restoreResponse.resolve({ ok: true, status: 200, json: async () => ({}) });

    await vi.waitFor(() => {
      expect(folderDeleteAttempts).toBe(2);
      expect(listNotesFolderRemoteMutations(accountId)).toHaveLength(0);
    });
    const staleMemberships = authFetchMock.mock.calls.filter(([url, options]) => {
      if (!String(url).endsWith('/api/notes') || (options as RequestInit | undefined)?.method !== 'POST') return false;
      const payload = JSON.parse(String((options as RequestInit).body)) as { folder_id?: string | null };
      return payload.folder_id === 'research';
    });
    expect(staleMemberships).toHaveLength(0);
    expect(useNotesStore.getState().folders).toEqual([]);
    expect(useNotesStore.getState().notes[0]?.folderId).toBeNull();
  });

  it('does not expose account A delete suppression or retry authority to account B', async () => {
    const folderA = folder('shared-id', 'Account A folder', 1);
    await seedInitializedAccount('folder-account-a', [note('a-note', 'shared-id')], [folderA]);
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
    let accountADeleteAttempts = 0;
    authFetchMock.mockImplementation(async (url: unknown, options?: RequestInit) => {
      if (String(url).endsWith('/api/note_folders/shared-id') && options?.method === 'DELETE') {
        accountADeleteAttempts += 1;
        return { ok: false, status: 503, json: async () => ({}) };
      }
      return successfulRemoteResponse('folder-account-a', url, options);
    });
    expect((await useNotesStore.getState().deleteFolder('shared-id')).status).toBe('deleted');
    await vi.waitFor(() => expect(accountADeleteAttempts).toBe(1));

    useNotesStore.getState().detachNotesStorage();
    await seedInitializedAccount('folder-account-b', [], []);
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
    const folderB = folder('shared-id', 'Account B folder', 2);
    installRemoteSnapshot('folder-account-b', [], [folderB]);
    authFetchMock.mockClear();
    await useNotesStore.getState().bootstrapFromSupabase();
    expect(useNotesStore.getState().folders).toEqual([folderB]);

    useNotesStore.getState().retrySync();
    await Promise.resolve();
    expect(authFetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/note_folders/shared-id'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('invalidates an old Undo token on same-account store replacement without stale writes', async () => {
    const accountId = 'folder-replacement-epoch';
    const originalFolder = folder('research', 'Research', 1);
    await seedInitializedAccount(accountId, [note('reused-note', 'research', 'old body')], [originalFolder]);
    const deleted = await useNotesStore.getState().deleteFolder('research');
    if (deleted.status !== 'deleted') throw new Error('expected deletion receipt');

    const replacementNote = note('reused-note', null, 'replacement body');
    expect(await saveAccountScopedNotes(accountId, [replacementNote])).toBe(true);
    expect(saveFolders([])).toBe(true);
    const previousEpoch = useNotesStore.getState().folderDeletionUndoEpoch;
    await useNotesStore.getState().initNotesStorage(accountId);
    expect(useNotesStore.getState().folderDeletionUndoEpoch).toBeGreaterThan(previousEpoch);
    expect(useNotesStore.getState().notes).toEqual([replacementNote]);

    const storageWrite = vi.spyOn(localStorageMock, 'setItem');
    authFetchMock.mockClear();
    const staleUndo = await useNotesStore.getState().undoFolderDeletion(deleted.receipt.token);
    expect(staleUndo.status).toBe('not_found');
    expect(useNotesStore.getState().folders).toEqual([]);
    expect(useNotesStore.getState().notes[0]).toMatchObject({ id: 'reused-note', body: 'replacement body', folderId: null });
    expect(storageWrite).not.toHaveBeenCalled();
    expect(authFetchMock).not.toHaveBeenCalled();
    storageWrite.mockRestore();
  });

  it('claims one Undo token synchronously and starts only one remote recovery sequence', async () => {
    const accountId = 'folder-undo-single-flight';
    const originalFolder = folder('research', 'Research', 1);
    await seedInitializedAccount(accountId, [note('member', 'research')], [originalFolder]);
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
    authFetchMock.mockImplementation((url: unknown, options?: RequestInit) => (
      Promise.resolve(successfulRemoteResponse(accountId, url, options))
    ));
    const deleted = await useNotesStore.getState().deleteFolder('research');
    if (deleted.status !== 'deleted') throw new Error('expected deletion receipt');

    folderAuthorityWriteAttempts = 0;
    const undoA = useNotesStore.getState().undoFolderDeletion(deleted.receipt.token);
    const undoB = useNotesStore.getState().undoFolderDeletion(deleted.receipt.token);
    const duplicate = await undoB;
    const owner = await undoA;
    expect(duplicate.status).toBe('in_progress');
    expect(owner.status).toBe('restored');
    expect(folderAuthorityWriteAttempts).toBe(1);

    await vi.waitFor(() => {
      const folderRestores = authFetchMock.mock.calls.filter(([url, options]) => (
        String(url).endsWith('/api/note_folders')
        && (options as RequestInit | undefined)?.method === 'POST'
      ));
      const membershipRestores = authFetchMock.mock.calls.filter(([url, options]) => {
        if (!String(url).endsWith('/api/notes') || (options as RequestInit | undefined)?.method !== 'POST') return false;
        const payload = JSON.parse(String((options as RequestInit).body)) as { folder_id?: string | null };
        return payload.folder_id === 'research';
      });
      expect(folderRestores).toHaveLength(1);
      expect(membershipRestores).toHaveLength(1);
    });
    expect(useNotesStore.getState().folders).toEqual([originalFolder]);
  });

  it('releases a failed Undo claim so a later retry can succeed once', async () => {
    const originalFolder = folder('research', 'Research', 1);
    seed([note('member', 'research')], [originalFolder]);
    const deleted = await useNotesStore.getState().deleteFolder('research');
    if (deleted.status !== 'deleted') throw new Error('expected deletion receipt');

    rejectFolderWrites = true;
    const failed = await useNotesStore.getState().undoFolderDeletion(deleted.receipt.token);
    expect(failed.status).toBe('persistence_failed');
    rejectFolderWrites = false;
    const retried = await useNotesStore.getState().undoFolderDeletion(deleted.receipt.token);
    expect(retried.status).toBe('restored');
    expect(useNotesStore.getState().folders).toEqual([originalFolder]);
  });
});
