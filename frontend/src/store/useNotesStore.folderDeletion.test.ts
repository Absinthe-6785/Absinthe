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
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
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
import { activateNotesAccountAuthority } from '../lib/notesAccountAuthority';
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
          json: async () => ({ user_id: 'account-a', ...payload }),
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
});
