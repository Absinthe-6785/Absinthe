import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteBase, NoteFolderBase } from '@/components/views/noteUtils';
import {
  NOTES_ACCOUNT_AUTHORITY_DATABASE_NAME,
  NOTES_CORE_DOMAIN,
  NOTES_FOLDERS_DOMAIN,
  __testOnlyNotesAccountAuthorityHooks,
  detachNotesAccountAuthority,
  getNotesAuthorityState,
  initializeAccountScopedNotesAuthority,
  createNotesAccountRecoveryContext,
  loadAccountScopedNotes,
  loadNotesForRecoveryContext,
  loadFoldersForRecoveryContext,
  applyNotesFoldersForRecoveryContext,
  saveAccountScopedActiveNoteId,
  saveAccountScopedFolders,
  saveAccountScopedNotes,
} from './notesAccountAuthority';

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => { storage.clear(); },
  key: (index: number) => [...storage.keys()][index] ?? null,
  get length() { return storage.size; },
});

function deleteAuthorityDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(NOTES_ACCOUNT_AUTHORITY_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('authority_database_delete_blocked'));
  });
}

function putRawScopedNote(value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(NOTES_ACCOUNT_AUTHORITY_DATABASE_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('notes', 'readwrite');
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.objectStore('notes').put(value);
    };
  });
}

function foldersKey(accountId: string): string {
  return `absinthe.notes.account-authority.folders.v1:${encodeURIComponent(accountId)}:notes.folders`;
}

function pendingKey(accountId: string): string {
  return `absinthe.notes.account-authority.bootstrap-pending.v1:${encodeURIComponent(accountId)}`;
}

function note(index: number): NoteBase {
  return {
    id: `a-note-${index}`,
    title: `Account A ${index}`,
    body: `Body ${index}`,
    updatedAt: index,
    folderId: index % 8 === 0 ? 'a-folder-0' : null,
    deletedAt: null,
  };
}

function folder(index: number): NoteFolderBase {
  return { id: `a-folder-${index}`, name: `A Folder ${index}`, createdAt: index };
}

describe('account-scoped Notes/Folders local authority', () => {
  beforeEach(async () => {
    detachNotesAccountAuthority();
    __testOnlyNotesAccountAuthorityHooks?.setBootstrapStageOverride(null);
    storage.clear();
    await deleteAuthorityDatabase();
  });

  afterEach(async () => {
    detachNotesAccountAuthority();
    __testOnlyNotesAccountAuthorityHooks?.setBootstrapStageOverride(null);
    storage.clear();
    await deleteAuthorityDatabase();
  });

  it('keeps 103 Notes and 8 Folders with account A, while account B remains empty and A restores exactly', async () => {
    storage.set('notes-v2', JSON.stringify([note(999)]));
    storage.set('note-folders-v2', JSON.stringify([folder(999)]));
    expect(getNotesAuthorityState('account-a', NOTES_CORE_DOMAIN).state).toBe('NOT_LOADED');

    const emptyA = await initializeAccountScopedNotesAuthority('account-a');
    expect(emptyA.notes).toEqual([]);
    expect(emptyA.folders).toEqual([]);
    expect(emptyA.notesState.state).toBe('LOADED_EMPTY');
    expect(emptyA.notesState.legacyGlobalDataPresent).toBe(true);

    const accountANotes = Array.from({ length: 103 }, (_, index) => note(index + 1));
    const accountAFolders = Array.from({ length: 8 }, (_, index) => folder(index));
    expect(await saveAccountScopedNotes('account-a', accountANotes)).toBe(true);
    expect(saveAccountScopedFolders(accountAFolders)).toBe(true);
    expect(saveAccountScopedActiveNoteId('a-note-47')).toBe(true);

    detachNotesAccountAuthority();
    const accountB = await initializeAccountScopedNotesAuthority('account-b');
    expect(accountB.notes).toEqual([]);
    expect(accountB.folders).toEqual([]);
    expect(accountB.notesState.state).toBe('LOADED_EMPTY');
    expect(accountB.foldersState.state).toBe('LOADED_EMPTY');

    detachNotesAccountAuthority();
    const restoredA = await initializeAccountScopedNotesAuthority('account-a');
    expect(restoredA.notes).toHaveLength(103);
    expect(restoredA.folders).toHaveLength(8);
    expect(restoredA.activeNoteId).toBe('a-note-47');
    expect(restoredA.notes.map(item => item.id).sort()).toEqual(accountANotes.map(item => item.id).sort());
    expect(restoredA.folders.map(item => item.id).sort()).toEqual(accountAFolders.map(item => item.id).sort());
  });

  it('writes a recovery replacement only into the currently active account namespace', async () => {
    await initializeAccountScopedNotesAuthority('account-a');
    expect(await saveAccountScopedNotes('account-a', [note(1)])).toBe(true);

    await initializeAccountScopedNotesAuthority('account-b');
    expect(await saveAccountScopedNotes('account-b', [{ ...note(2), id: 'b-existing' }])).toBe(true);

    await initializeAccountScopedNotesAuthority('account-a');
    const recovered = { ...note(3), id: 'a-recovered' };
    expect(await saveAccountScopedNotes('account-a', [recovered])).toBe(true);
    expect((await loadAccountScopedNotes('account-a')).map(item => item.id)).toEqual(['a-recovered']);

    await initializeAccountScopedNotesAuthority('account-b');
    expect((await loadAccountScopedNotes('account-b')).map(item => item.id)).toEqual(['b-existing']);
  });

  it('verifies both domains and restores both after a folder apply failure', async () => {
    await initializeAccountScopedNotesAuthority('account-a');
    const previousNotes = [note(1)];
    const previousFolders = [folder(1)];
    expect(await saveAccountScopedNotes('account-a', previousNotes)).toBe(true);
    expect(saveAccountScopedFolders(previousFolders)).toBe(true);
    const context = createNotesAccountRecoveryContext();
    expect(context).not.toBeNull();
    if (!context) throw new Error('recovery context unavailable');
    const nextNotes = [note(2)];
    const nextFolders = [folder(2)];
    let failReplacement = true;
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (failReplacement && key === foldersKey('account-a') && value.includes('a-folder-2')) {
        failReplacement = false;
        throw new Error('injected folder authority-state failure');
      }
      storage.set(key, value);
    });

    await expect(applyNotesFoldersForRecoveryContext(
      context, previousNotes, previousFolders, nextNotes, nextFolders,
    )).resolves.toEqual({ applied: false, rollbackVerified: true });
    expect(await loadNotesForRecoveryContext(context)).toEqual(previousNotes);
    expect(loadFoldersForRecoveryContext(context)).toEqual(previousFolders);
    expect(getNotesAuthorityState('account-a', NOTES_CORE_DOMAIN).state).toBe('LOADED_POPULATED');
    expect(getNotesAuthorityState('account-a', NOTES_FOLDERS_DOMAIN).state).toBe('LOADED_POPULATED');
    expect(__testOnlyNotesAccountAuthorityHooks?.readPendingBootstrapMarker('account-a')).toBeNull();
  });

  it.each([
    'after-marker',
    'after-notes-write',
    'after-folders-write',
    'before-readback',
    'before-marker-clear',
  ] as const)('fails closed after an interruption at %s', async stage => {
    const hooks = __testOnlyNotesAccountAuthorityHooks;
    expect(hooks).toBeDefined();
    if (!hooks) throw new Error('notes authority test seam unavailable');
    await initializeAccountScopedNotesAuthority('account-a');
    expect(await saveAccountScopedNotes('account-a', [note(1)])).toBe(true);
    expect(saveAccountScopedFolders([folder(1)])).toBe(true);
    const context = createNotesAccountRecoveryContext();
    expect(context).not.toBeNull();
    if (!context) throw new Error('recovery context unavailable');

    let release = () => {};
    let reachedResolve = () => {};
    const reached = new Promise<void>(resolve => { reachedResolve = resolve; });
    hooks.setBootstrapStageOverride(async seen => {
      if (seen !== stage) return;
      reachedResolve();
      await new Promise<void>(resolve => { release = resolve; });
    });
    const applyPromise = applyNotesFoldersForRecoveryContext(
      context, [note(1)], [folder(1)], [note(2)], [folder(2)],
    );
    await reached;
    expect(hooks.readPendingBootstrapMarker('account-a')?.state).toBe('BOOTSTRAP_PENDING');

    await expect(initializeAccountScopedNotesAuthority('account-a'))
      .rejects.toThrow('notes_account_authority_bootstrap_pending');
    expect(getNotesAuthorityState('account-a', NOTES_CORE_DOMAIN).state).toBe('RECOVERY_REQUIRED');
    expect(getNotesAuthorityState('account-a', NOTES_FOLDERS_DOMAIN).state).toBe('RECOVERY_REQUIRED');
    release();
    await expect(applyPromise).resolves.toEqual({ applied: false, rollbackVerified: false });
    expect(hooks.readPendingBootstrapMarker('account-a')?.state).toBe('BOOTSTRAP_PENDING');
    hooks.setBootstrapStageOverride(null);
  });

  it('clears the pending marker only after a verified successful restart', async () => {
    const hooks = __testOnlyNotesAccountAuthorityHooks;
    expect(hooks).toBeDefined();
    if (!hooks) throw new Error('notes authority test seam unavailable');
    await initializeAccountScopedNotesAuthority('account-a');
    expect(await saveAccountScopedNotes('account-a', [note(1)])).toBe(true);
    expect(saveAccountScopedFolders([folder(1)])).toBe(true);
    const context = createNotesAccountRecoveryContext();
    expect(context).not.toBeNull();
    if (!context) throw new Error('recovery context unavailable');
    await expect(applyNotesFoldersForRecoveryContext(
      context, [note(1)], [folder(1)], [note(2)], [folder(2)],
    )).resolves.toEqual({ applied: true, rollbackVerified: true });
    expect(hooks.readPendingBootstrapMarker('account-a')).toBeNull();

    detachNotesAccountAuthority();
    const restarted = await initializeAccountScopedNotesAuthority('account-a');
    expect(restarted.notes.map(item => item.id)).toEqual(['a-note-2']);
    expect(restarted.folders.map(item => item.id)).toEqual(['a-folder-2']);
    expect(restarted.notesState.state).toBe('LOADED_POPULATED');
    expect(restarted.foldersState.state).toBe('LOADED_POPULATED');
  });

  it('keeps recovery evidence when marker clear fails after a verified apply', async () => {
    const hooks = __testOnlyNotesAccountAuthorityHooks;
    expect(hooks).toBeDefined();
    if (!hooks) throw new Error('notes authority test seam unavailable');
    await initializeAccountScopedNotesAuthority('account-a');
    const context = createNotesAccountRecoveryContext();
    expect(context).not.toBeNull();
    if (!context) throw new Error('recovery context unavailable');
    const originalRemove = localStorage.removeItem;
    vi.spyOn(localStorage, 'removeItem').mockImplementation(key => {
      if (key === pendingKey('account-a')) throw new Error('marker clear failure');
      originalRemove.call(localStorage, key);
    });
    await expect(applyNotesFoldersForRecoveryContext(
      context, [], [], [note(2)], [folder(2)],
    )).resolves.toEqual({ applied: false, rollbackVerified: false });
    expect(hooks.readPendingBootstrapMarker('account-a')?.state).toBe('BOOTSTRAP_PENDING');
    expect(getNotesAuthorityState('account-a', NOTES_CORE_DOMAIN).state).toBe('RECOVERY_REQUIRED');
    expect(getNotesAuthorityState('account-a', NOTES_FOLDERS_DOMAIN).state).toBe('RECOVERY_REQUIRED');
    vi.restoreAllMocks();
  });

  it('isolates Account A pending evidence from a normally loaded Account B', async () => {
    const hooks = __testOnlyNotesAccountAuthorityHooks;
    expect(hooks).toBeDefined();
    if (!hooks) throw new Error('notes authority test seam unavailable');
    await initializeAccountScopedNotesAuthority('account-a');
    const context = createNotesAccountRecoveryContext();
    expect(context).not.toBeNull();
    if (!context) throw new Error('recovery context unavailable');
    let release = () => {};
    let reachedResolve = () => {};
    const reached = new Promise<void>(resolve => { reachedResolve = resolve; });
    hooks.setBootstrapStageOverride(async stage => {
      if (stage !== 'after-marker') return;
      reachedResolve();
      await new Promise<void>(resolve => { release = resolve; });
    });
    const applyPromise = applyNotesFoldersForRecoveryContext(
      context, [], [], [note(2)], [folder(2)],
    );
    await reached;
    const accountB = await initializeAccountScopedNotesAuthority('account-b');
    expect(accountB.notesState.state).toBe('LOADED_EMPTY');
    expect(accountB.foldersState.state).toBe('LOADED_EMPTY');
    expect(hooks.readPendingBootstrapMarker('account-b')).toBeNull();
    await expect(initializeAccountScopedNotesAuthority('account-a'))
      .rejects.toThrow('notes_account_authority_bootstrap_pending');
    release();
    await expect(applyPromise).resolves.toEqual({ applied: false, rollbackVerified: false });
    expect(hooks.readPendingBootstrapMarker('account-a')?.state).toBe('BOOTSTRAP_PENDING');
    hooks.setBootstrapStageOverride(null);
  });

  it('does not let a newer account operation be cleared by a stale bootstrap', async () => {
    const hooks = __testOnlyNotesAccountAuthorityHooks;
    expect(hooks).toBeDefined();
    if (!hooks) throw new Error('notes authority test seam unavailable');
    await initializeAccountScopedNotesAuthority('account-a');
    const context = createNotesAccountRecoveryContext();
    expect(context).not.toBeNull();
    if (!context) throw new Error('recovery context unavailable');
    let release = () => {};
    let reachedResolve = () => {};
    const reached = new Promise<void>(resolve => { reachedResolve = resolve; });
    hooks.setBootstrapStageOverride(async stage => {
      if (stage !== 'before-marker-clear') return;
      reachedResolve();
      await new Promise<void>(resolve => { release = resolve; });
    });
    const applyPromise = applyNotesFoldersForRecoveryContext(
      context, [], [], [note(2)], [folder(2)],
    );
    await reached;
    const firstMarker = hooks.readPendingBootstrapMarker('account-a');
    expect(firstMarker).not.toBeNull();
    if (!firstMarker) throw new Error('pending marker unavailable');
    await expect(initializeAccountScopedNotesAuthority('account-a'))
      .rejects.toThrow('notes_account_authority_bootstrap_pending');
    const newerMarker = {
      ...firstMarker,
      operationId: `${firstMarker.operationId}-newer`,
      requestGeneration: firstMarker.requestGeneration + 1,
    };
    storage.set(pendingKey('account-a'), JSON.stringify(newerMarker));
    release();
    await expect(applyPromise).resolves.toEqual({ applied: false, rollbackVerified: false });
    expect(hooks.readPendingBootstrapMarker('account-a')?.operationId).toBe(newerMarker.operationId);
    hooks.setBootstrapStageOverride(null);
  });

  it('marks both domains recovery-required when rollback cannot be proven', async () => {
    await initializeAccountScopedNotesAuthority('account-a');
    const previousNotes = [note(1)];
    const previousFolders = [folder(1)];
    expect(await saveAccountScopedNotes('account-a', previousNotes)).toBe(true);
    expect(saveAccountScopedFolders(previousFolders)).toBe(true);
    const context = createNotesAccountRecoveryContext();
    expect(context).not.toBeNull();
    if (!context) throw new Error('recovery context unavailable');
    let failureCount = 0;
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === foldersKey('account-a') && value.includes('a-folder-2')) throw new Error('apply failure');
      if (key === foldersKey('account-a') && value.includes('a-folder-1') && failureCount++ === 0) {
        throw new Error('rollback failure');
      }
      storage.set(key, value);
    });
    const result = await applyNotesFoldersForRecoveryContext(
      context, previousNotes, previousFolders, [note(2)], [folder(2)],
    );
    expect(result).toEqual({ applied: false, rollbackVerified: false });
    expect(getNotesAuthorityState('account-a', NOTES_CORE_DOMAIN).state).toBe('RECOVERY_REQUIRED');
    expect(getNotesAuthorityState('account-a', NOTES_FOLDERS_DOMAIN).state).toBe('RECOVERY_REQUIRED');
  });

  it('rolls back both domains when the applied Folder readback mismatches', async () => {
    await initializeAccountScopedNotesAuthority('account-a');
    const previousNotes = [note(1)];
    const previousFolders = [folder(1)];
    expect(await saveAccountScopedNotes('account-a', previousNotes)).toBe(true);
    expect(saveAccountScopedFolders(previousFolders)).toBe(true);
    const context = createNotesAccountRecoveryContext();
    expect(context).not.toBeNull();
    if (!context) throw new Error('recovery context unavailable');
    let replacementWritten = false;
    let mismatchReturned = false;
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === foldersKey('account-a') && value.includes('a-folder-2')) replacementWritten = true;
      storage.set(key, value);
    });
    vi.spyOn(localStorage, 'getItem').mockImplementation(key => {
      if (key === foldersKey('account-a') && replacementWritten && !mismatchReturned) {
        mismatchReturned = true;
        return JSON.stringify({
          accountId: 'account-a', domainId: NOTES_FOLDERS_DOMAIN, schemaVersion: 1, folders: [folder(99)],
        });
      }
      return storage.get(key) ?? null;
    });

    await expect(applyNotesFoldersForRecoveryContext(
      context, previousNotes, previousFolders, [note(2)], [folder(2)],
    )).resolves.toEqual({ applied: false, rollbackVerified: true });
    expect(await loadNotesForRecoveryContext(context)).toEqual(previousNotes);
    expect(loadFoldersForRecoveryContext(context)).toEqual(previousFolders);
  });

  it('marks recovery required when rollback readback mismatches after a Folder write failure', async () => {
    await initializeAccountScopedNotesAuthority('account-a');
    const previousNotes = [note(1)];
    const previousFolders = [folder(1)];
    expect(await saveAccountScopedNotes('account-a', previousNotes)).toBe(true);
    expect(saveAccountScopedFolders(previousFolders)).toBe(true);
    const context = createNotesAccountRecoveryContext();
    expect(context).not.toBeNull();
    if (!context) throw new Error('recovery context unavailable');
    let rollbackWritten = false;
    let mismatchReturned = false;
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === foldersKey('account-a') && value.includes('a-folder-2')) throw new Error('apply failure');
      if (key === foldersKey('account-a') && value.includes('a-folder-1')) rollbackWritten = true;
      storage.set(key, value);
    });
    vi.spyOn(localStorage, 'getItem').mockImplementation(key => {
      if (key === foldersKey('account-a') && rollbackWritten && !mismatchReturned) {
        mismatchReturned = true;
        return JSON.stringify({
          accountId: 'account-a', domainId: NOTES_FOLDERS_DOMAIN, schemaVersion: 1, folders: [folder(99)],
        });
      }
      return storage.get(key) ?? null;
    });

    await expect(applyNotesFoldersForRecoveryContext(
      context, previousNotes, previousFolders, [note(2)], [folder(2)],
    )).resolves.toEqual({ applied: false, rollbackVerified: false });
    expect(getNotesAuthorityState('account-a', NOTES_CORE_DOMAIN).state).toBe('RECOVERY_REQUIRED');
    expect(getNotesAuthorityState('account-a', NOTES_FOLDERS_DOMAIN).state).toBe('RECOVERY_REQUIRED');
  });

  it('fails closed for malformed Notes and Folders data without corrupt-to-empty writeback', async () => {
    await initializeAccountScopedNotesAuthority('account-a');
    await putRawScopedNote({ key: 'account-a\u0000a-note-1', accountId: 'account-a', note: note(1) });
    await putRawScopedNote({ key: 'account-a\u0000bad', accountId: 'account-a', note: { id: 'bad' } });
    detachNotesAccountAuthority();

    await expect(initializeAccountScopedNotesAuthority('account-a')).rejects.toThrow('notes_account_authority_notes_malformed');
    expect(getNotesAuthorityState('account-a', NOTES_CORE_DOMAIN).state).toBe('RECOVERY_REQUIRED');
    expect(storage.get(foldersKey('account-a'))).toBeDefined();

    await deleteAuthorityDatabase();
    storage.set(foldersKey('account-b'), JSON.stringify({
      accountId: 'account-b', domainId: NOTES_FOLDERS_DOMAIN, schemaVersion: 2, folders: [],
    }));
    await expect(initializeAccountScopedNotesAuthority('account-b')).rejects.toThrow('notes_account_authority_folders_malformed');
    expect(getNotesAuthorityState('account-b', NOTES_FOLDERS_DOMAIN).state).toBe('RECOVERY_REQUIRED');
    expect(JSON.parse(storage.get(foldersKey('account-b')) ?? '{}').schemaVersion).toBe(2);
  });

  it.each([
    ['missing accountId', { key: 'account-a\u0000missing-owner', note: note(1) }],
    ['malformed accountId', { key: 'account-a\u0000malformed-owner', accountId: 7, note: note(1) }],
    ['wrong accountId', { key: 'account-a\u0000wrong-owner', accountId: 'account-b', note: note(1) }],
  ])('fails closed for a scoped Notes record with %s', async (_label, malformedRecord) => {
    await initializeAccountScopedNotesAuthority('account-a');
    await putRawScopedNote(malformedRecord);
    detachNotesAccountAuthority();

    await expect(initializeAccountScopedNotesAuthority('account-a')).rejects.toThrow('notes_account_authority_notes_malformed');
    expect(getNotesAuthorityState('account-a', NOTES_CORE_DOMAIN).state).toBe('RECOVERY_REQUIRED');
  });

  it('fails closed rather than partially loading mixed valid and invalid scoped ownership', async () => {
    await initializeAccountScopedNotesAuthority('account-a');
    expect(await saveAccountScopedNotes('account-a', [note(1)])).toBe(true);
    await putRawScopedNote({ key: 'account-a\u0000wrong-owner', accountId: 'account-b', note: note(2) });
    detachNotesAccountAuthority();

    await expect(initializeAccountScopedNotesAuthority('account-a')).rejects.toThrow('notes_account_authority_notes_malformed');
    expect(getNotesAuthorityState('account-a', NOTES_CORE_DOMAIN).state).toBe('RECOVERY_REQUIRED');
  });

  it('treats one invalid Folder among valid entries as recovery-required while a valid empty snapshot is loaded empty', async () => {
    storage.set(foldersKey('account-a'), JSON.stringify({
      accountId: 'account-a', domainId: NOTES_FOLDERS_DOMAIN, schemaVersion: 1,
      folders: [folder(1), { id: 'invalid', name: 'Invalid', createdAt: 'not-a-number' }],
    }));
    await expect(initializeAccountScopedNotesAuthority('account-a')).rejects.toThrow('notes_account_authority_folders_malformed');
    expect(getNotesAuthorityState('account-a', NOTES_FOLDERS_DOMAIN).state).toBe('RECOVERY_REQUIRED');

    detachNotesAccountAuthority();
    const validEmpty = await initializeAccountScopedNotesAuthority('account-b');
    expect(validEmpty.notesState.state).toBe('LOADED_EMPTY');
    expect(validEmpty.foldersState.state).toBe('LOADED_EMPTY');
  });

  it('rejects a stale account load instead of publishing it after an account switch', async () => {
    const staleAccountA = initializeAccountScopedNotesAuthority('account-a');
    const staleRejection = expect(staleAccountA).rejects.toThrow('notes_account_scope_inactive');
    const currentAccountB = await initializeAccountScopedNotesAuthority('account-b');

    await staleRejection;
    expect(currentAccountB.accountId).toBe('account-b');
    expect(currentAccountB.notesState.state).toBe('LOADED_EMPTY');
  });

  it('closes A1 → B → A2 → A1-late and logout-during-load races with a request generation', async () => {
    const hooks = __testOnlyNotesAccountAuthorityHooks;
    expect(hooks).toBeDefined();
    if (!hooks) throw new Error('notes authority test seam unavailable');
    const pending = new Map<string, () => void>();
    hooks.setReadNotesOverride(accountId => new Promise(resolve => {
      pending.set(`${accountId}:${pending.size + 1}`, () => resolve({ kind: 'absent' }));
    }));

    const a1 = initializeAccountScopedNotesAuthority('account-a');
    await Promise.resolve();
    const b = initializeAccountScopedNotesAuthority('account-b');
    await Promise.resolve();
    pending.get('account-b:2')?.();
    await b;
    const a2 = initializeAccountScopedNotesAuthority('account-a');
    await Promise.resolve();
    pending.get('account-a:3')?.();
    const currentA = await a2;
    pending.get('account-a:1')?.();
    await expect(a1).rejects.toThrow('notes_account_scope_inactive');
    expect(currentA.requestGeneration).toBeGreaterThan(1);

    const logoutLoad = initializeAccountScopedNotesAuthority('account-a');
    await Promise.resolve();
    detachNotesAccountAuthority();
    pending.get('account-a:4')?.();
    await expect(logoutLoad).rejects.toThrow('notes_account_scope_inactive');
    expect(getNotesAuthorityState('account-a', NOTES_CORE_DOMAIN).state).not.toBe('RECOVERY_REQUIRED');
    hooks.setReadNotesOverride(null);
  });
});
