// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOTES_KEY, FOLDERS_KEY, type NoteBase, type NoteFolder, loadFolders } from '../components/views/noteUtils';
import { clearIndexedDbNotes, saveNotesToIndexedDb } from '../lib/noteIndexedDb';
import {
  loadNotesAsync,
  resetNotesPersistenceForTests,
  saveNotesAsync,
} from '../lib/notePersistence';
import { NOTES_RUNTIME_SYNC_MODE_KEY } from '../lib/notesSyncClient';
import {
  captureOperationEpoch,
  LOCAL_CORE_JSON_RESTORE_OPERATION,
  LOCAL_CORE_JSON_RESTORE_VALIDATION,
  setRecoveryModeActiveForTest,
} from '../lib/recoverySafetyPolicy';
import { buildVaultBackupManifest } from '../lib/exportVaultBackup';
import { loadVaultRestoreSnapshot, VAULT_RESTORE_SNAPSHOT_KEY } from '../lib/vaultRestoreSnapshot';

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => { storage.clear(); },
  key: (index: number) => [...storage.keys()][index] ?? null,
  get length() { return storage.size; },
};
vi.stubGlobal('localStorage', localStorageMock);

const authFetchMock = vi.fn();
vi.mock('../lib/supabase', () => ({ authFetch: (...args: unknown[]) => authFetchMock(...args) }));

const {
  useNotesStore,
  VaultRestoreDurabilityError,
  __testOnlyLocalCoreJsonRestoreAuthorityHooks: authorityHooks,
} = await import('./useNotesStore');

const originalNote: NoteBase = {
  id: 'original-note',
  title: 'Welcome',
  body: 'existing durable note',
  updatedAt: 1,
  folderId: null,
  deletedAt: null,
  starred: false,
};

function notesFixture(prefix: string, count: number, folders: readonly { id: string }[]): NoteBase[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    title: `${prefix} title ${index}`,
    body: `${prefix} body ${index}`,
    updatedAt: 5000 - index,
    folderId: folders[index % folders.length]!.id,
    deletedAt: null,
    starred: false,
  }));
}

function canonical<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function authorityBinding(overrides: Record<string, unknown> = {}) {
  const folder = { id: 'folder-a', name: 'Folder A', createdAt: 10 };
  const notes = [originalNote];
  const folders = [folder];
  return {
    notes,
    folders,
    snapshotNotes: notes,
    snapshotFolders: folders,
    operationEpoch: captureOperationEpoch(),
    ...overrides,
  };
}

function requireAuthorityHooks() {
  expect(authorityHooks).toBeDefined();
  if (!authorityHooks) throw new Error('authority test seam unavailable');
  return authorityHooks;
}

describe('bounded Preview Notes IndexedDB restore authority', () => {
  beforeEach(async () => {
    setRecoveryModeActiveForTest(false);
    storage.clear();
    authFetchMock.mockReset();
    resetNotesPersistenceForTests();
    await clearIndexedDbNotes();
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'local');
    storage.set(NOTES_KEY, JSON.stringify([originalNote]));
    storage.set(FOLDERS_KEY, JSON.stringify([]));
    useNotesStore.setState({
      notes: [originalNote],
      folders: [],
      activeNoteId: originalNote.id,
      activeFolderId: null,
      syncError: null,
      vaultRestoreCanUndo: false,
    });
    await useNotesStore.getState().initNotesStorage();
    setRecoveryModeActiveForTest(true);
  });

  afterEach(() => vi.restoreAllMocks());

  it('rejects the ordinary disjoint replacement and restores 103/8 through IndexedDB', async () => {
    const folders = Array.from({ length: 8 }, (_, index) => ({
      id: `backup-folder-${index}`,
      name: `Backup folder ${index}`,
      createdAt: index + 1,
    }));
    const notes = notesFixture('backup-note', 103, folders);
    expect(await saveNotesAsync(notes)).toEqual({ status: 'failed', reason: 'indexeddb_rejected' });
    expect((await loadNotesAsync()).map(note => note.id)).toEqual([originalNote.id]);

    await useNotesStore.getState().importVaultRestore(
      buildVaultBackupManifest(notes, folders),
      'replace',
    );

    const expectedNotes = canonical(await loadNotesAsync());
    const expectedFolders = canonical(loadFolders());
    expect(expectedNotes).toEqual(canonical(useNotesStore.getState().notes));
    expect(expectedFolders).toEqual(canonical(useNotesStore.getState().folders));
    expect(expectedNotes).toHaveLength(103);
    expect(expectedFolders).toHaveLength(8);
    expect(expectedNotes.some(note => note.id === originalNote.id)).toBe(false);

    useNotesStore.setState({ notes: [], folders: [], activeNoteId: null, activeFolderId: null });
    resetNotesPersistenceForTests();
    await useNotesStore.getState().initNotesStorage();
    useNotesStore.setState({ folders: loadFolders() });
    expect(canonical(useNotesStore.getState().notes)).toEqual(expectedNotes);
    expect(canonical(useNotesStore.getState().folders)).toEqual(expectedFolders);
    expect((await loadNotesAsync()).some(note => note.id === originalNote.id)).toBe(false);
  });

  it('rolls back a committed disjoint replacement and reopens the exact snapshot', async () => {
    const folders = Array.from({ length: 8 }, (_, index) => ({
      id: `rollback-folder-${index}`,
      name: `Rollback folder ${index}`,
      createdAt: index + 1,
    }));
    const notes = notesFixture('rollback-note', 103, folders);
    let failReplacementFolders = true;
    vi.spyOn(localStorageMock, 'setItem').mockImplementation((key, value) => {
      if (key === FOLDERS_KEY && value.includes('rollback-folder-') && failReplacementFolders) {
        failReplacementFolders = false;
        throw new Error('injected folders failure');
      }
      storage.set(key, value);
    });

    const restore = useNotesStore.getState().importVaultRestore(
      buildVaultBackupManifest(notes, folders),
      'replace',
    );
    await expect(restore).rejects.toBeInstanceOf(VaultRestoreDurabilityError);
    expect(useNotesStore.getState().syncError).toContain('durable Notes/Folders readback');

    useNotesStore.setState({ notes: [], folders: [], activeNoteId: null, activeFolderId: null });
    resetNotesPersistenceForTests();
    await useNotesStore.getState().initNotesStorage();
    useNotesStore.setState({ folders: loadFolders() });
    expect(canonical(useNotesStore.getState().notes)).toEqual([originalNote]);
    expect(canonical(useNotesStore.getState().folders)).toEqual([]);
    expect((await loadNotesAsync()).some(note => note.id.startsWith('rollback-note-'))).toBe(false);
    expect(canonical(loadVaultRestoreSnapshot()?.notes)).toEqual([originalNote]);
    expect(canonical(loadVaultRestoreSnapshot()?.folders)).toEqual([]);
    expect(storage.has(VAULT_RESTORE_SNAPSHOT_KEY)).toBe(true);
  });

  it('proves changed Notes payloads and malformed authorized replacements fail before persistence', async () => {
    const hooks = requireAuthorityHooks();
    const binding = authorityBinding();
    expect(hooks.diagnoseNotes([])).toBe('EMPTY_NOTES');
    expect(hooks.diagnoseNotes([{ id: 'valid-note', title: 'Incomplete' }])).toBe('INCOMPLETE_NOTE_SHAPE');
    expect(hooks.diagnoseNotes([{ ...originalNote, id: '   ' }])).toBe('INVALID_NOTE_ID');
    expect(hooks.diagnoseNotes([originalNote, originalNote])).toBe('DUPLICATE_NOTE_ID');
    const variants = [
      { label: 'empty Notes', notes: [] },
      { label: 'modified Note', notes: [{ ...originalNote, body: 'changed' }] },
      { label: 'added Note', notes: [originalNote, { ...originalNote, id: 'added' }] },
      { label: 'removed Note', notes: [{ ...originalNote, id: 'removed' }] },
      { label: 'incomplete Note with valid ID', notes: [{ id: 'incomplete-note', title: 'Incomplete' }] },
      { label: 'complete Note with malformed ID', notes: [{ ...originalNote, id: '   ' }] },
      { label: 'duplicate Note ID', notes: [originalNote, originalNote] },
    ];
    for (const { label, notes } of variants) {
      const authority = hooks.create(binding, 'restore');
      expect(hooks.validatePayload(authority, 'restore', notes, binding.folders, binding.snapshotNotes, binding.snapshotFolders), label).toBe(false);
      await expect(hooks.saveNotes(notes as NoteBase[], authority, 'restore')).resolves.toBe(false);
      expect(canonical(await loadNotesAsync())).toEqual([originalNote]);
    }
    expect(canonical(loadFolders())).toEqual([]);
  });

  it('proves changed Folders payloads fail at validation and preserve durable folders', async () => {
    const hooks = requireAuthorityHooks();
    const binding = authorityBinding({
      folders: [
        { id: 'folder-a', name: 'Folder A', createdAt: 10 },
        { id: 'folder-b', name: 'Folder B', createdAt: 11 },
      ],
      snapshotFolders: [
        { id: 'folder-a', name: 'Folder A', createdAt: 10 },
        { id: 'folder-b', name: 'Folder B', createdAt: 11 },
      ],
    });
    const variants = [
      [{ id: 'folder-a', name: 'Changed', createdAt: 10 }, { id: 'folder-b', name: 'Folder B', createdAt: 11 }],
      [...binding.folders, { id: 'folder-c', name: 'Folder C', createdAt: 12 }],
      [{ id: 'folder-a', name: 'Folder A', createdAt: 10 }],
      [{ id: '', name: 'Malformed', createdAt: 10 }],
    ];
    for (const folders of variants) {
      const authority = hooks.create(binding, 'restore');
      expect(await hooks.saveNotes(binding.notes, authority, 'restore')).toBe(true);
      expect(hooks.validateFolders(authority, 'restore', folders, binding.snapshotNotes, binding.snapshotFolders)).toBe(false);
    }
    expect(canonical(loadFolders())).toEqual([]);
  });

  it('makes array order significant for Notes and Folders authority digests', () => {
    const hooks = requireAuthorityHooks();
    const notes = [originalNote, { ...originalNote, id: 'note-b', title: 'B' }];
    const folders = [
      { id: 'folder-a', name: 'A', createdAt: 10 },
      { id: 'folder-b', name: 'B', createdAt: 11 },
    ];
    const binding = { notes, folders, snapshotNotes: notes, snapshotFolders: folders, operationEpoch: captureOperationEpoch() };
    const authority = hooks.create(binding, 'restore');
    expect(hooks.validatePayload(authority, 'restore', [...notes].reverse(), folders, notes, folders)).toBe(false);
    expect(hooks.validatePayload(authority, 'restore', notes, [...folders].reverse(), notes, folders)).toBe(false);
  });

  it('rejects namespace mismatch at Notes, Folder, and completion boundaries', async () => {
    const hooks = requireAuthorityHooks();
    const binding = authorityBinding({ namespace: 'context-a' });
    const authority = hooks.create(binding, 'restore');
    expect(hooks.validatePayload(authority, 'restore', binding.notes, binding.folders, binding.snapshotNotes, binding.snapshotFolders, 'context-b')).toBe(false);
    expect(await hooks.saveNotes(binding.notes, authority, 'restore', 'context-b')).toBe(false);
    const folderAuthority = hooks.create(binding, 'restore');
    expect(await hooks.saveNotes(binding.notes, folderAuthority, 'restore', 'context-a')).toBe(true);
    expect(hooks.validateFolders(folderAuthority, 'restore', binding.folders, binding.snapshotNotes, binding.snapshotFolders, 'context-b')).toBe(false);
    expect(hooks.complete(folderAuthority, 'restore', 'context-b')).toBe(false);
  });

  it('rejects stale epochs, purpose substitution, and reused or invalidated authorities', async () => {
    const hooks = requireAuthorityHooks();
    const binding = authorityBinding();
    const stale = hooks.create(binding, 'restore');
    setRecoveryModeActiveForTest(false);
    setRecoveryModeActiveForTest(true);
    expect(hooks.validatePayload(stale, 'restore', binding.notes, binding.folders, binding.snapshotNotes, binding.snapshotFolders)).toBe(false);
    expect(await hooks.saveNotes(binding.notes, stale, 'restore')).toBe(false);

    const restore = hooks.create(authorityBinding(), 'restore');
    const rollback = hooks.create(authorityBinding(), 'rollback');
    expect(await hooks.saveNotes(binding.notes, restore, 'rollback')).toBe(false);
    expect(await hooks.saveNotes(binding.notes, rollback, 'restore')).toBe(false);
    expect(await hooks.saveNotes(binding.notes, restore, 'restore')).toBe(true);
    expect(await hooks.saveNotes(binding.notes, rollback, 'rollback')).toBe(true);
    expect(hooks.validateFolders(restore, 'restore', binding.folders, binding.snapshotNotes, binding.snapshotFolders)).toBe(true);
    expect(hooks.validateFolders(rollback, 'rollback', binding.folders, binding.snapshotNotes, binding.snapshotFolders)).toBe(true);
    expect(hooks.validateFolders(restore, 'rollback', binding.folders, binding.snapshotNotes, binding.snapshotFolders)).toBe(false);
    expect(hooks.validateFolders(rollback, 'restore', binding.folders, binding.snapshotNotes, binding.snapshotFolders)).toBe(false);
    expect(hooks.diagnoseFolders(restore, 'rollback', binding.folders, binding.snapshotNotes, binding.snapshotFolders)).toBe('PURPOSE_MISMATCH');
    expect(hooks.diagnoseFolders(rollback, 'restore', binding.folders, binding.snapshotNotes, binding.snapshotFolders)).toBe('PURPOSE_MISMATCH');
    const durableBeforePurposeChecks = {
      notes: canonical(await loadNotesAsync()),
      folders: canonical(loadFolders()),
    };
    useNotesStore.setState({ notes: [], folders: [], activeNoteId: null, activeFolderId: null });
    resetNotesPersistenceForTests();
    await useNotesStore.getState().initNotesStorage();
    useNotesStore.setState({ folders: loadFolders() });
    expect(canonical(useNotesStore.getState().notes)).toEqual(durableBeforePurposeChecks.notes);
    expect(canonical(useNotesStore.getState().folders)).toEqual(durableBeforePurposeChecks.folders);

    const consumed = hooks.create(authorityBinding(), 'restore');
    expect(await hooks.saveNotes(binding.notes, consumed, 'restore')).toBe(true);
    expect(await hooks.saveNotes(binding.notes, consumed, 'restore')).toBe(false);
    expect(hooks.complete(consumed, 'restore')).toBe(true);
    expect(await hooks.saveNotes(binding.notes, consumed, 'restore')).toBe(false);

    const completedRollback = hooks.create(authorityBinding(), 'rollback');
    expect(await hooks.saveNotes(binding.notes, completedRollback, 'rollback')).toBe(true);
    expect(hooks.complete(completedRollback, 'rollback')).toBe(true);
    expect(await hooks.saveNotes(binding.notes, completedRollback, 'rollback')).toBe(false);

    const invalidated = hooks.create(authorityBinding(), 'restore');
    hooks.invalidate(invalidated);
    expect(await hooks.saveNotes(binding.notes, invalidated, 'restore')).toBe(false);
  });

  it('rejects modified rollback snapshots before rollback persistence', async () => {
    const hooks = requireAuthorityHooks();
    const snapshotNotes = [originalNote, { ...originalNote, id: 'snapshot-note-b', title: 'B' }];
    const snapshotFolders = [
      { id: 'snapshot-folder-a', name: 'A', createdAt: 10 },
      { id: 'snapshot-folder-b', name: 'B', createdAt: 11 },
    ];
    setRecoveryModeActiveForTest(false);
    expect(await saveNotesToIndexedDb(snapshotNotes)).toBe(true);
    storage.set(FOLDERS_KEY, JSON.stringify(snapshotFolders));
    resetNotesPersistenceForTests();
    await useNotesStore.getState().initNotesStorage();
    useNotesStore.setState({ folders: loadFolders() });
    setRecoveryModeActiveForTest(true);
    const binding = { notes: snapshotNotes, folders: snapshotFolders, snapshotNotes, snapshotFolders, operationEpoch: captureOperationEpoch() };
    const cases = [
      { label: 'modified Note', notes: [{ ...snapshotNotes[0], body: 'modified snapshot' }, snapshotNotes[1]], folders: snapshotFolders },
      { label: 'added Note', notes: [...snapshotNotes, { ...originalNote, id: 'snapshot-note-c', title: 'C' }], folders: snapshotFolders },
      { label: 'removed Note', notes: [snapshotNotes[0]], folders: snapshotFolders },
      { label: 'modified Folder', notes: snapshotNotes, folders: [{ ...snapshotFolders[0], name: 'Changed' }, snapshotFolders[1]] },
      { label: 'added Folder', notes: snapshotNotes, folders: [...snapshotFolders, { id: 'snapshot-folder-c', name: 'C', createdAt: 12 }] },
      { label: 'removed Folder', notes: snapshotNotes, folders: [snapshotFolders[0]] },
    ];
    for (const testCase of cases) {
      const rollback = hooks.create(binding, 'rollback');
      expect(rollback, testCase.label).toBeDefined();
      expect(hooks.validatePayload(rollback, 'rollback', snapshotNotes, snapshotFolders, snapshotNotes, snapshotFolders)).toBe(true);
      expect(hooks.validatePayload(rollback, 'rollback', testCase.notes, testCase.folders, snapshotNotes, snapshotFolders), testCase.label).toBe(false);
      if (testCase.notes !== snapshotNotes) {
        await expect(hooks.saveNotes(testCase.notes, rollback, 'rollback')).resolves.toBe(false);
      } else {
        expect(await hooks.saveNotes(snapshotNotes, rollback, 'rollback')).toBe(true);
        expect(hooks.validateFolders(rollback, 'rollback', testCase.folders, snapshotNotes, snapshotFolders), testCase.label).toBe(false);
      }
      expect(canonical(await loadNotesAsync())).toEqual(snapshotNotes);
      expect(canonical(loadFolders())).toEqual(snapshotFolders);
    }
  });

  it('invalidates every authority after a failed private restore operation', async () => {
    const hooks = requireAuthorityHooks();
    const failedRestoreNotes = [
      { ...originalNote, id: 'restore-note-001', title: 'Restore 1', body: 'restore body 1' },
      { ...originalNote, id: 'restore-note-002', title: 'Restore 2', body: 'restore body 2' },
    ];
    const binding = authorityBinding({ notes: failedRestoreNotes, snapshotNotes: [originalNote], snapshotFolders: [] });
    const input = {
      operation: LOCAL_CORE_JSON_RESTORE_OPERATION,
      syncMode: 'local' as const,
      strategy: 'replace' as const,
      createVerifiedSnapshot: true as const,
      restoreCore: true as const,
      restoreExtensions: false as const,
      restoreCloud: false as const,
      backupValidation: LOCAL_CORE_JSON_RESTORE_VALIDATION,
      selectedNoteCount: binding.notes.length,
    };
    let captured: { restore: unknown; rollback: unknown } | undefined;
    let failFolders = true;
    vi.spyOn(localStorageMock, 'setItem').mockImplementation((key, value) => {
      if (key === FOLDERS_KEY && value.includes('folder-a') && failFolders) {
        failFolders = false;
        throw new Error('injected post-notes folders failure');
      }
      storage.set(key, value);
    });
    await expect(hooks.run(input, binding, async authorities => {
      captured = authorities;
      return hooks.persist(
        { notes: binding.notes as NoteBase[], folders: binding.folders as NoteFolder[] },
        { notes: binding.snapshotNotes as NoteBase[], folders: binding.snapshotFolders as NoteFolder[] },
        authorities,
      );
    })).rejects.toBeInstanceOf(VaultRestoreDurabilityError);
    expect(captured).toBeDefined();
    expect(await hooks.saveNotes(binding.notes, captured!.restore, 'restore')).toBe(false);
    expect(hooks.validateFolders(captured!.restore, 'restore', binding.folders, binding.snapshotNotes, binding.snapshotFolders)).toBe(false);
    expect(await hooks.saveNotes(binding.notes, captured!.rollback, 'rollback')).toBe(false);
    expect(hooks.validateFolders(captured!.rollback, 'rollback', binding.snapshotFolders, binding.snapshotNotes, binding.snapshotFolders)).toBe(false);
    expect(hooks.validatePayload(captured!.restore, 'restore', binding.notes, binding.folders, binding.snapshotNotes, binding.snapshotFolders)).toBe(false);
    expect(hooks.validatePayload(captured!.rollback, 'rollback', binding.snapshotNotes, binding.snapshotFolders, binding.snapshotNotes, binding.snapshotFolders)).toBe(false);
    expect(await saveNotesAsync([{ ...originalNote, id: 'ordinary-after-failure' }])).toEqual({ status: 'failed', reason: 'indexeddb_rejected' });
    useNotesStore.setState({ notes: [], folders: [], activeNoteId: null, activeFolderId: null });
    resetNotesPersistenceForTests();
    await useNotesStore.getState().initNotesStorage();
    useNotesStore.setState({ folders: loadFolders() });
    expect(canonical(useNotesStore.getState().notes)).toEqual([originalNote]);
    expect(canonical(useNotesStore.getState().folders)).toEqual([]);
    expect((await loadNotesAsync()).some(note => failedRestoreNotes.some(restoreNote => restoreNote.id === note.id))).toBe(false);
  });
});
