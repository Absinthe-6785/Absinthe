// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteBase, NoteFolderBase } from '../components/views/noteUtils';
import {
  __testOnlyNotesAccountAuthorityHooks,
  NOTES_ACCOUNT_AUTHORITY_DATABASE_NAME,
  resetNotesAccountAuthorityForTests,
  saveAccountScopedFolders,
  saveAccountScopedNotes,
} from '../lib/notesAccountAuthority';
import { NOTES_BOOTSTRAP_FAILURE_MESSAGE } from '../lib/notesBootstrapDiagnostics';
import { resetNotesPersistenceForTests } from '../lib/notePersistence';
import { NOTES_RUNTIME_SYNC_MODE_KEY } from '../lib/notesSyncClient';

const { authReadFetchMock, authFetchMock } = vi.hoisted(() => ({
  authReadFetchMock: vi.fn(),
  authFetchMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  authFetch: (...args: unknown[]) => authFetchMock(...args),
  authReadFetch: (...args: unknown[]) => authReadFetchMock(...args),
}));

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => { storage.clear(); },
  key: (index: number) => [...storage.keys()][index] ?? null,
  get length() { return storage.size; },
});

const {
  useNotesStore,
  NOTES_BOOTSTRAP_DIAGNOSTIC_ACCESSOR,
  getNotesBootstrapRuntimeDiagnostic,
} = await import('./useNotesStore');

const ACCOUNT_ID = 'synthetic-account';
const NOTE_COUNT = 108;
const FOLDER_COUNT = 8;

function deleteAuthorityDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(NOTES_ACCOUNT_AUTHORITY_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('authority_database_delete_blocked'));
  });
}

function syntheticFolders(): NoteFolderBase[] {
  return Array.from({ length: FOLDER_COUNT }, (_, index) => ({
    id: `folder-${String(index + 1).padStart(3, '0')}`,
    name: `Synthetic folder ${index + 1}`,
    createdAt: index + 1,
  }));
}

function syntheticNotes(folders: readonly NoteFolderBase[]): NoteBase[] {
  return Array.from({ length: NOTE_COUNT }, (_, index) => ({
    id: `note-${String(index + 1).padStart(3, '0')}`,
    title: `Synthetic note ${index + 1}`,
    body: 'Synthetic placeholder content.',
    updatedAt: index + 1,
    folderId: index % 5 === 0 ? folders[index % folders.length]!.id : null,
    deletedAt: null,
    starred: false,
  }));
}

function noteRows(notes: readonly NoteBase[]) {
  return notes.map(note => ({
    id: note.id,
    user_id: ACCOUNT_ID,
    title: note.title,
    body: note.body,
    updated_at: note.updatedAt,
    folder_id: note.folderId,
    deleted_at: note.deletedAt,
    starred: Boolean(note.starred),
    properties: note.properties ?? null,
    relations: note.relations ?? null,
  }));
}

function folderRows(folders: readonly NoteFolderBase[]) {
  return folders.map(folder => ({
    id: folder.id,
    user_id: ACCOUNT_ID,
    name: folder.name,
    created_at: folder.createdAt,
  }));
}

function okJson(data: unknown) {
  return { ok: true, status: 200, json: async () => data };
}

function installRemoteSnapshots(
  notes: readonly NoteBase[],
  folders: readonly NoteFolderBase[],
  options: { noteRows?: unknown[]; noteTotal?: number; noteComplete?: boolean } = {},
): void {
  const remoteNotes = options.noteRows ?? noteRows(notes);
  authReadFetchMock.mockImplementation((url: string) => Promise.resolve(url.includes('/api/note_folders?')
    ? okJson({
      account_id: ACCOUNT_ID,
      rows: folderRows(folders),
      total_count: folders.length,
      offset: 0,
      limit: 500,
      complete: true,
    })
    : okJson({
      account_id: ACCOUNT_ID,
      rows: remoteNotes,
      total_count: options.noteTotal ?? remoteNotes.length,
      offset: 0,
      limit: 500,
      complete: options.noteComplete ?? true,
    })));
}

async function seedSyntheticAuthority() {
  const folders = syntheticFolders();
  const notes = syntheticNotes(folders);
  await useNotesStore.getState().initNotesStorage(ACCOUNT_ID);
  expect(await saveAccountScopedNotes(ACCOUNT_ID, notes)).toBe(true);
  expect(saveAccountScopedFolders(folders)).toBe(true);
  useNotesStore.setState({
    notes,
    folders,
    activeNoteId: notes[0]!.id,
    activeAccountId: ACCOUNT_ID,
    notesAuthorityState: 'LOADED_POPULATED',
    foldersAuthorityState: 'LOADED_POPULATED',
    syncError: null,
    syncIssue: null,
  });
  return { notes, folders };
}

function expectBootstrapFailure(stage: string, reasonCode: string) {
  expect(useNotesStore.getState().syncError).toBe(NOTES_BOOTSTRAP_FAILURE_MESSAGE);
  expect(useNotesStore.getState().syncIssue).toMatchObject({
    source: 'bootstrap',
    classification: 'BOOTSTRAP_FAILURE',
    stage,
    reasonCode,
    retryable: false,
  });
}

describe('production-shaped Notes bootstrap diagnostics', () => {
  beforeEach(async () => {
    useNotesStore.getState().detachNotesStorage();
    resetNotesAccountAuthorityForTests();
    resetNotesPersistenceForTests();
    __testOnlyNotesAccountAuthorityHooks?.setBootstrapStageOverride(null);
    storage.clear();
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
    authReadFetchMock.mockReset();
    authFetchMock.mockReset();
    await deleteAuthorityDatabase();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    useNotesStore.getState().detachNotesStorage();
    resetNotesAccountAuthorityForTests();
    __testOnlyNotesAccountAuthorityHooks?.setBootstrapStageOverride(null);
    storage.clear();
    await deleteAuthorityDatabase();
  });

  it('completes a synthetic 108-Note/8-Folder bootstrap and clears prior bootstrap evidence', async () => {
    const { notes, folders } = await seedSyntheticAuthority();
    installRemoteSnapshots(notes, folders);
    useNotesStore.setState({
      syncError: NOTES_BOOTSTRAP_FAILURE_MESSAGE,
      syncIssue: {
        source: 'bootstrap',
        retryable: false,
        message: NOTES_BOOTSTRAP_FAILURE_MESSAGE,
        classification: 'BOOTSTRAP_FAILURE',
        stage: 'VALIDATE_NOTES_SNAPSHOT',
        reasonCode: 'SNAPSHOT_INCOMPLETE',
      },
    });

    await useNotesStore.getState().bootstrapFromSupabase();

    expect(useNotesStore.getState().notes).toHaveLength(NOTE_COUNT);
    expect(useNotesStore.getState().folders).toHaveLength(FOLDER_COUNT);
    expect(useNotesStore.getState().syncError).toBeNull();
    expect(useNotesStore.getState().syncIssue).toBeNull();
    expect(getNotesBootstrapRuntimeDiagnostic()).toBeNull();
  });

  it('classifies a complete-page count mismatch at the Notes response-contract stage', async () => {
    const { notes, folders } = await seedSyntheticAuthority();
    installRemoteSnapshots(notes, folders, { noteTotal: NOTE_COUNT - 1, noteComplete: false });

    await useNotesStore.getState().bootstrapFromSupabase();

    expectBootstrapFailure('VALIDATE_NOTES_SNAPSHOT', 'SNAPSHOT_INCOMPLETE');
  });

  it('classifies a malformed durable folder marker before any remote fetch', async () => {
    const { notes, folders } = await seedSyntheticAuthority();
    installRemoteSnapshots(notes, folders);
    storage.set(
      `absinthe.notes.account-authority.folder-remote-mutation.v1:${ACCOUNT_ID}:folder-001`,
      '{malformed',
    );

    await useNotesStore.getState().bootstrapFromSupabase();

    expectBootstrapFailure('RECONCILE_FOLDER_LIFECYCLE', 'FOLDER_MARKER_MALFORMED');
    expect(authReadFetchMock).not.toHaveBeenCalled();
  });

  it('classifies failure to persist the atomic bootstrap marker as local persistence', async () => {
    const { notes, folders } = await seedSyntheticAuthority();
    installRemoteSnapshots(notes, folders);
    vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
      if (key.startsWith('absinthe.notes.account-authority.bootstrap-pending.v1:')) {
        throw new Error('synthetic marker failure');
      }
      storage.set(key, value);
    });

    await useNotesStore.getState().bootstrapFromSupabase();

    expectBootstrapFailure('PERSIST_LOCAL', 'PENDING_MARKER_PERSIST_FAILED');
    expect(getNotesBootstrapRuntimeDiagnostic()).toMatchObject({
      localNoteCount: NOTE_COUNT,
      localFolderCount: FOLDER_COUNT,
      remoteNoteCount: NOTE_COUNT,
      remoteFolderCount: FOLDER_COUNT,
      notesAuthorityState: 'RECOVERY_REQUIRED',
      foldersAuthorityState: 'RECOVERY_REQUIRED',
      rollbackVerified: false,
    });
  });

  it('classifies an atomic post-persist readback mismatch as local revalidation', async () => {
    const { notes, folders } = await seedSyntheticAuthority();
    installRemoteSnapshots(notes, folders);
    __testOnlyNotesAccountAuthorityHooks?.setBootstrapStageOverride(stage => {
      if (stage !== 'before-readback') return;
      const key = [...storage.keys()].find(item => (
        item.startsWith('absinthe.notes.account-authority.folders.v1:')
      ));
      if (!key) throw new Error('synthetic folders envelope missing');
      const envelope = JSON.parse(storage.get(key)!) as Record<string, unknown>;
      storage.set(key, JSON.stringify({ ...envelope, folders: [] }));
    });

    await useNotesStore.getState().bootstrapFromSupabase();

    expectBootstrapFailure('REVALIDATE_LOCAL', 'LOCAL_READBACK_MISMATCH');
    expect(getNotesBootstrapRuntimeDiagnostic()?.rollbackVerified).toBe(true);
  });

  it('isolates missing authoritative Note fields after HTTP success without exposing content', async () => {
    const { notes, folders } = await seedSyntheticAuthority();
    const rows = noteRows(notes).map((row, index) => {
      if (index !== 0) return row;
      const { relations: _relations, ...missingRelations } = row;
      return missingRelations;
    });
    installRemoteSnapshots(notes, folders, { noteRows: rows });

    await useNotesStore.getState().bootstrapFromSupabase();

    expectBootstrapFailure('VALIDATE_NOTES_SNAPSHOT', 'SNAPSHOT_CONTRACT_INVALID');
    const diagnostic = getNotesBootstrapRuntimeDiagnostic();
    expect(diagnostic).toMatchObject({
      remoteNoteCount: null,
      remoteFolderCount: null,
      targetIdPresent: false,
    });
    expect(JSON.stringify(diagnostic)).not.toContain(ACCOUNT_ID);
    expect(JSON.stringify(diagnostic)).not.toContain('note-001');
    const accessor = (window as unknown as Record<string, unknown>)[NOTES_BOOTSTRAP_DIAGNOSTIC_ACCESSOR];
    expect(accessor).toBe(getNotesBootstrapRuntimeDiagnostic);
  });

  it('classifies an equal-revision payload mismatch as merge authority conflict', async () => {
    const { notes, folders } = await seedSyntheticAuthority();
    const rows = noteRows(notes).map((row, index) => index === 0
      ? { ...row, title: 'Different synthetic title at the same revision' }
      : row);
    installRemoteSnapshots(notes, folders, { noteRows: rows });

    await useNotesStore.getState().bootstrapFromSupabase();

    expectBootstrapFailure('MERGE_NOTES', 'EQUAL_REVISION_PAYLOAD_MISMATCH');
    expect(getNotesBootstrapRuntimeDiagnostic()?.targetIdPresent).toBe(true);
  });
});
