// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOTES_KEY, FOLDERS_KEY, type NoteBase, type NoteFolder, loadFolders } from '../components/views/noteUtils';
import { clearIndexedDbNotes, loadNotesFromIndexedDb, saveNotesToIndexedDb } from '../lib/noteIndexedDb';
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
import {
  __testOnlyNotesAccountAuthorityHooks,
  detachNotesAccountAuthority,
  getNotesAuthorityState,
  initializeAccountScopedNotesAuthority,
  loadAccountScopedNotes,
  saveAccountScopedFolders,
  saveAccountScopedNotes,
  NOTES_CORE_DOMAIN,
} from '../lib/notesAccountAuthority';

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
const authReadFetchMock = vi.fn();
vi.mock('../lib/supabase', () => ({
  authFetch: (...args: unknown[]) => authFetchMock(...args),
  authReadFetch: (...args: unknown[]) => authReadFetchMock(...args),
}));

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
    authReadFetchMock.mockReset();
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

describe('account-scoped Backup v3 restore authority', () => {
  const legacySentinel = { ...originalNote, id: 'legacy-global-sentinel', title: 'Legacy global sentinel' };
  const accountBSentinel = { ...originalNote, id: 'account-b-sentinel', title: 'Account B sentinel' };
  const accountBFolder = { id: 'account-b-folder', name: 'Account B folder', createdAt: 22 };

  beforeEach(async () => {
    setRecoveryModeActiveForTest(false);
    storage.clear();
    resetNotesPersistenceForTests();
    authReadFetchMock.mockReset();
    detachNotesAccountAuthority();
    await clearIndexedDbNotes();
    await saveNotesToIndexedDb([legacySentinel]);
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'local');

    await initializeAccountScopedNotesAuthority('account-b');
    expect(await saveAccountScopedNotes('account-b', [accountBSentinel])).toBe(true);
    expect(saveAccountScopedFolders([accountBFolder])).toBe(true);

    await useNotesStore.getState().initNotesStorage('account-a');
    useNotesStore.setState({
      notes: [], folders: [], activeNoteId: null, activeFolderId: null, syncError: null,
    });
    setRecoveryModeActiveForTest(true);
  });

  afterEach(() => vi.restoreAllMocks());

  it('restores 103 Notes and 8 Folders only into active account A without touching legacy global or B', async () => {
    const folders = Array.from({ length: 8 }, (_, index) => ({
      id: `account-a-backup-folder-${index}`, name: `Account A folder ${index}`, createdAt: index + 1,
    }));
    const notes = notesFixture('account-a-backup', 103, folders);

    await useNotesStore.getState().importVaultRestore(buildVaultBackupManifest(notes, folders), 'replace');

    const restoredNotes = canonical(useNotesStore.getState().notes);
    expect(restoredNotes).toHaveLength(103);
    expect(await loadAccountScopedNotes('account-a')).toEqual(restoredNotes);
    expect(canonical(loadFolders())).toEqual(canonical(folders));
    expect(await loadNotesFromIndexedDb()).toEqual([legacySentinel]);

    await initializeAccountScopedNotesAuthority('account-b');
    expect(await loadAccountScopedNotes('account-b')).toEqual([accountBSentinel]);
    expect(canonical(loadFolders())).toEqual([accountBFolder]);

    await useNotesStore.getState().initNotesStorage('account-a');
    expect(canonical(useNotesStore.getState().notes)).toEqual(restoredNotes);
    expect(canonical(useNotesStore.getState().folders)).toEqual(canonical(folders));
  });

  it('rolls back the active A namespace after an injected folder write failure without touching legacy global or B', async () => {
    const priorA = { ...originalNote, id: 'account-a-prior', title: 'Account A prior' };
    setRecoveryModeActiveForTest(false);
    expect(await saveNotesAsync([priorA])).toEqual({ status: 'persisted' });
    setRecoveryModeActiveForTest(true);
    useNotesStore.setState({ notes: [priorA], folders: [], activeNoteId: priorA.id, activeFolderId: null });
    const folders = Array.from({ length: 8 }, (_, index) => ({
      id: `rollback-account-a-folder-${index}`, name: `Rollback A folder ${index}`, createdAt: index + 1,
    }));
    const notes = notesFixture('rollback-account-a', 103, folders);
    let failReplacementFolders = true;
    vi.spyOn(localStorageMock, 'setItem').mockImplementation((key, value) => {
      if (key.includes('absinthe.notes.account-authority.folders.v1:account-a')
        && value.includes('rollback-account-a-folder-') && failReplacementFolders) {
        failReplacementFolders = false;
        throw new Error('injected scoped folders failure');
      }
      storage.set(key, value);
    });

    await expect(useNotesStore.getState().importVaultRestore(buildVaultBackupManifest(notes, folders), 'replace'))
      .rejects.toBeInstanceOf(VaultRestoreDurabilityError);

    expect(await loadAccountScopedNotes('account-a')).toEqual([priorA]);
    expect(canonical(loadFolders())).toEqual([]);
    expect(getNotesAuthorityState('account-a', NOTES_CORE_DOMAIN).state).toBe('LOADED_POPULATED');
    expect(await loadNotesFromIndexedDb()).toEqual([legacySentinel]);

    await initializeAccountScopedNotesAuthority('account-b');
    expect(await loadAccountScopedNotes('account-b')).toEqual([accountBSentinel]);
    expect(canonical(loadFolders())).toEqual([accountBFolder]);
  });

  it('rolls an interrupted A restore back only into A when B becomes active after the scoped Notes write', async () => {
    const priorA = { ...originalNote, id: 'account-a-prior-switch', title: 'Account A prior switch' };
    setRecoveryModeActiveForTest(false);
    expect(await saveNotesAsync([priorA])).toEqual({ status: 'persisted' });
    setRecoveryModeActiveForTest(true);
    useNotesStore.setState({ notes: [priorA], folders: [], activeNoteId: priorA.id, activeFolderId: null });
    const folders = Array.from({ length: 8 }, (_, index) => ({
      id: `switch-account-folder-${index}`, name: `Switch folder ${index}`, createdAt: index + 1,
    }));
    const notes = notesFixture('switch-account-note', 103, folders);
    let switched = false;
    let switchToB: Promise<void> | null = null;
    vi.spyOn(localStorageMock, 'setItem').mockImplementation((key, value) => {
      storage.set(key, value);
      if (!switched && key.includes('absinthe.notes.account-authority.state.v1:account-a:notes.core')
        && value.includes('LOADED_POPULATED')) {
        switched = true;
        switchToB = useNotesStore.getState().initNotesStorage('account-b');
      }
    });

    await expect(useNotesStore.getState().importVaultRestore(buildVaultBackupManifest(notes, folders), 'replace'))
      .rejects.toBeInstanceOf(VaultRestoreDurabilityError);
    await switchToB;

    await initializeAccountScopedNotesAuthority('account-a');
    expect(await loadAccountScopedNotes('account-a')).toEqual([priorA]);
    expect(canonical(loadFolders())).toEqual([]);
    expect(await loadNotesFromIndexedDb()).toEqual([legacySentinel]);

    await initializeAccountScopedNotesAuthority('account-b');
    expect(await loadAccountScopedNotes('account-b')).toEqual([accountBSentinel]);
    expect(canonical(loadFolders())).toEqual([accountBFolder]);
  });
});

describe('store-level account initialization generation guard', () => {
  const aFolders = Array.from({ length: 8 }, (_, index) => ({
    id: `store-a-folder-${index}`, name: `Store A folder ${index}`, createdAt: index + 1,
  }));
  const aNotes = notesFixture('store-a-note', 103, aFolders);
  const bNote = { ...originalNote, id: 'store-b-note', title: 'Store B note' };

  beforeEach(async () => {
    setRecoveryModeActiveForTest(false);
    storage.clear();
    resetNotesPersistenceForTests();
    authReadFetchMock.mockReset();
    detachNotesAccountAuthority();
    await clearIndexedDbNotes();
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'local');
    await initializeAccountScopedNotesAuthority('account-a');
    expect(await saveAccountScopedNotes('account-a', aNotes)).toBe(true);
    expect(saveAccountScopedFolders(aFolders)).toBe(true);
    await initializeAccountScopedNotesAuthority('account-b');
    expect(await saveAccountScopedNotes('account-b', [bNote])).toBe(true);
    detachNotesAccountAuthority();
    useNotesStore.setState({
      notes: [], folders: [], activeNoteId: null, activeFolderId: null,
      activeAccountId: null, notesAuthorityState: 'NOT_LOADED', foldersAuthorityState: 'NOT_LOADED', syncError: null,
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('ignores a stale A1 failure after B then successful A2 has published the real store state', async () => {
    const hooks = __testOnlyNotesAccountAuthorityHooks;
    expect(hooks).toBeDefined();
    if (!hooks) throw new Error('notes authority test seam unavailable');
    let aCalls = 0;
    let rejectA1: ((error: Error) => void) | null = null;
    hooks.setReadNotesOverride(accountId => {
      if (accountId === 'account-a' && aCalls++ === 0) return new Promise((_, reject) => { rejectA1 = reject; });
      if (accountId === 'account-a') return Promise.resolve({ kind: 'valid', records: canonical(aNotes) });
      return Promise.resolve({ kind: 'valid', records: [bNote] });
    });

    const a1 = useNotesStore.getState().initNotesStorage('account-a');
    await Promise.resolve();
    await useNotesStore.getState().initNotesStorage('account-b');
    await useNotesStore.getState().initNotesStorage('account-a');
    rejectA1?.(new Error('stale A1 read failure'));
    await a1;

    const state = useNotesStore.getState();
    expect(state.activeAccountId).toBe('account-a');
    expect(state.notes).toHaveLength(103);
    expect(state.folders).toHaveLength(8);
    expect(state.notesAuthorityState).toBe('LOADED_POPULATED');
    expect(state.foldersAuthorityState).toBe('LOADED_POPULATED');
    expect(state.syncError).toBeNull();
    hooks.setReadNotesOverride(null);
  });

  it('ignores a stale A1 success after B then successful A2 has published the real store state', async () => {
    const hooks = __testOnlyNotesAccountAuthorityHooks;
    expect(hooks).toBeDefined();
    if (!hooks) throw new Error('notes authority test seam unavailable');
    let aCalls = 0;
    let resolveA1: ((value: { kind: 'valid'; records: NoteBase[] }) => void) | null = null;
    hooks.setReadNotesOverride(accountId => {
      if (accountId === 'account-a' && aCalls++ === 0) return new Promise(resolve => { resolveA1 = resolve; });
      if (accountId === 'account-a') return Promise.resolve({ kind: 'valid', records: canonical(aNotes) });
      return Promise.resolve({ kind: 'valid', records: [bNote] });
    });

    const a1 = useNotesStore.getState().initNotesStorage('account-a');
    await Promise.resolve();
    await useNotesStore.getState().initNotesStorage('account-b');
    await useNotesStore.getState().initNotesStorage('account-a');
    resolveA1?.({ kind: 'valid', records: [{ ...originalNote, id: 'stale-a1-note' }] });
    await a1;

    const state = useNotesStore.getState();
    expect(state.activeAccountId).toBe('account-a');
    expect(state.notes).toHaveLength(103);
    expect(state.folders).toHaveLength(8);
    expect(state.notes.some(note => note.id === 'stale-a1-note')).toBe(false);
    expect(state.notesAuthorityState).toBe('LOADED_POPULATED');
    hooks.setReadNotesOverride(null);
  });

  it('does not let a stale bootstrap catch/finally mutate account B runtime metadata', async () => {
    let rejectA: ((error: Error) => void) | null = null;
    authReadFetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/notes')) {
        return new Promise((_, reject) => { rejectA = reject; });
      }
      return Promise.resolve(new Response(JSON.stringify({
        account_id: 'account-a', rows: [], total_count: 0, offset: 0, limit: 500, complete: true,
      }), { status: 200 }));
    });

    await useNotesStore.getState().initNotesStorage('account-a');
    const staleA = useNotesStore.getState().bootstrapFromSupabase();
    await Promise.resolve();
    await useNotesStore.getState().initNotesStorage('account-b');
    useNotesStore.setState({ syncError: 'account-b-sentinel', isSyncing: true });
    rejectA?.(new Error('late account A bootstrap failure'));
    await staleA;

    const state = useNotesStore.getState();
    expect(state.activeAccountId).toBe('account-b');
    expect(state.syncError).toBe('account-b-sentinel');
    expect(state.isSyncing).toBe(true);
  });

  it('does not let a stale bootstrap success publish into account B', async () => {
    let resolveA: ((response: Response) => void) | null = null;
    authReadFetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/notes')) return new Promise(resolve => { resolveA = resolve; });
      return Promise.resolve(new Response(JSON.stringify({
        account_id: 'account-a', rows: [], total_count: 0, offset: 0, limit: 500, complete: true,
      }), { status: 200 }));
    });

    await useNotesStore.getState().initNotesStorage('account-a');
    const staleA = useNotesStore.getState().bootstrapFromSupabase();
    await Promise.resolve();
    await useNotesStore.getState().initNotesStorage('account-b');
    useNotesStore.setState({ syncError: 'account-b-success-sentinel', isSyncing: true });
    resolveA?.(new Response(JSON.stringify({
      account_id: 'account-a', rows: [], total_count: 0, offset: 0, limit: 500, complete: true,
    }), { status: 200 }));
    await staleA;

    const state = useNotesStore.getState();
    expect(state.activeAccountId).toBe('account-b');
    expect(state.syncError).toBe('account-b-success-sentinel');
    expect(state.isSyncing).toBe(true);
  });

  it('leaves logged-out runtime untouched when a stale bootstrap rejects', async () => {
    let rejectA: ((error: Error) => void) | null = null;
    authReadFetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/notes')) return new Promise((_, reject) => { rejectA = reject; });
      return Promise.resolve(new Response(JSON.stringify({
        account_id: 'account-a', rows: [], total_count: 0, offset: 0, limit: 500, complete: true,
      }), { status: 200 }));
    });

    await useNotesStore.getState().initNotesStorage('account-a');
    const staleA = useNotesStore.getState().bootstrapFromSupabase();
    await Promise.resolve();
    useNotesStore.getState().detachNotesStorage();
    rejectA?.(new Error('late logged-out bootstrap failure'));
    await staleA;

    const state = useNotesStore.getState();
    expect(state.activeAccountId).toBeNull();
    expect(state.notes).toEqual([]);
    expect(state.folders).toEqual([]);
    expect(state.syncError).toBeNull();
    expect(state.isSyncing).toBe(false);
  });
});
