// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteBase } from '../components/views/noteUtils';
import {
  loadAccountScopedNotes,
  resetNotesAccountAuthorityForTests,
  saveAccountScopedNotes,
} from '../lib/notesAccountAuthority';
import { resetNotesPersistenceForTests } from '../lib/notePersistence';
import {
  activateRecoveryMode,
  setRecoveryModeActiveForTest,
} from '../lib/recoverySafetyPolicy';
import { NOTES_RUNTIME_SYNC_MODE_KEY } from '../lib/notesSyncClient';

const { deleteSingleRemoteNoteMock, authReadFetchMock, authFetchMock, attachmentGcMock } = vi.hoisted(() => ({
  deleteSingleRemoteNoteMock: vi.fn(),
  authReadFetchMock: vi.fn(),
  authFetchMock: vi.fn(),
  attachmentGcMock: vi.fn(),
}));

vi.mock('../lib/notesSingleDeleteRemote', () => ({
  deleteSingleRemoteNote: (...args: unknown[]) => deleteSingleRemoteNoteMock(...args),
}));

vi.mock('../lib/supabase', () => ({
  authFetch: (...args: unknown[]) => authFetchMock(...args),
  authReadFetch: (...args: unknown[]) => authReadFetchMock(...args),
}));

vi.mock('../lib/noteAttachmentGc', async importOriginal => {
  const actual = await importOriginal<typeof import('../lib/noteAttachmentGc')>();
  return { ...actual, gcOrphanedLocalNoteAttachments: (...args: unknown[]) => attachmentGcMock(...args) };
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

function okJson(data: unknown) {
  return { ok: true, status: 200, json: async () => data };
}

function emptySnapshot(accountId: string) {
  return okJson({ account_id: accountId, rows: [], total_count: 0, offset: 0, limit: 500, complete: true });
}

function noteSnapshot(accountId: string, item: NoteBase) {
  return okJson({
    account_id: accountId,
    rows: [{
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
    }],
    total_count: 1,
    offset: 0,
    limit: 500,
    complete: true,
  });
}

function installRemoteSnapshot(accountId: string, notes: readonly NoteBase[]) {
  const remoteNote = notes[0];
  authReadFetchMock.mockImplementation((url: string) => Promise.resolve(
    url.includes('/api/notes?') && remoteNote
      ? noteSnapshot(accountId, remoteNote)
      : emptySnapshot(accountId),
  ));
}

function singleDeleteMarkerPresent(): boolean {
  return [...storage.keys()].some(key => key.includes('single-delete'));
}

function singleDeleteMarkerCount(): number {
  return [...storage.keys()].filter(key => key.includes('single-delete')).length;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

async function seedAccount(accountId: string, notes: NoteBase[]): Promise<void> {
  await useNotesStore.getState().initNotesStorage(accountId);
  expect(await saveAccountScopedNotes(accountId, notes)).toBe(true);
  useNotesStore.setState({
    notes,
    folders: [],
    activeNoteId: notes[0]?.id ?? null,
    activeFolderId: null,
    activeAccountId: accountId,
    syncError: null,
  });
}

async function deletePrepared(noteId: string): Promise<boolean> {
  const authorization = useNotesStore.getState().prepareNotePermanentDelete(noteId);
  expect(authorization).not.toBeNull();
  return useNotesStore.getState().deleteNotePermanently(authorization!);
}

async function createTwoRecoveryConflicts(
  accountId: string,
  noteA: NoteBase,
  noteB: NoteBase,
): Promise<void> {
  deleteSingleRemoteNoteMock
    .mockResolvedValueOnce({ ok: false, outcome: 'ambiguous', error: 'notes_delete_remote_unavailable' })
    .mockResolvedValueOnce({ ok: false, outcome: 'ambiguous', error: 'notes_delete_remote_unavailable' });
  expect(await deletePrepared(noteA.id)).toBe(false);
  expect(await deletePrepared(noteB.id)).toBe(false);
  expect(singleDeleteMarkerCount()).toBe(2);

  useNotesStore.getState().updateNote(noteA.id, { title: 'A newer local revision' });
  useNotesStore.getState().updateNote(noteB.id, { title: 'B newer local revision' });
  await vi.waitFor(async () => {
    const saved = await loadAccountScopedNotes(accountId);
    expect(saved.find(item => item.id === noteA.id))
      .toEqual(expect.objectContaining({ title: 'A newer local revision', deletedAt: noteA.deletedAt }));
    expect(saved.find(item => item.id === noteB.id))
      .toEqual(expect.objectContaining({ title: 'B newer local revision', deletedAt: noteB.deletedAt }));
  });

  useNotesStore.getState().detachNotesStorage();
  await useNotesStore.getState().initNotesStorage(accountId);
  authReadFetchMock.mockImplementation(() => Promise.resolve(emptySnapshot(accountId)));
  await useNotesStore.getState().bootstrapFromSupabase();
}

beforeEach(async () => {
  resetNotesPersistenceForTests();
  resetNotesAccountAuthorityForTests();
  storage.clear();
  storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'local');
  setRecoveryModeActiveForTest(true);
  deleteSingleRemoteNoteMock.mockReset();
  deleteSingleRemoteNoteMock.mockResolvedValue({ ok: true, outcome: 'deleted' });
  authFetchMock.mockReset();
  authReadFetchMock.mockReset();
  attachmentGcMock.mockReset();
  attachmentGcMock.mockResolvedValue({
    candidateCount: 0, reclaimedBlobCount: 0, reclaimedMetadataCount: 0, results: [],
  });
  useNotesStore.setState({
    notes: [], folders: [], activeNoteId: null, activeFolderId: null,
    activeAccountId: null, notesAuthorityState: 'NOT_LOADED', foldersAuthorityState: 'NOT_LOADED',
    isSyncing: false, syncError: null,
  });
});

describe('POST_RTU_03 account-scoped trash and permanent deletion', () => {
  it('moves an active Note to Trash and keeps the action reversible', async () => {
    await seedAccount('account-a', [note('trash-me')]);
    useNotesStore.getState().moveNoteToTrash('trash-me');
    await vi.waitFor(() => expect(useNotesStore.getState().notes[0]?.deletedAt).not.toBeNull());
    expect(useNotesStore.getState().activeNoteId).toBeNull();
  });

  it('restores a trashed Note', async () => {
    await seedAccount('account-a', [note('restore-me', { deletedAt: 20, updatedAt: 20 })]);
    useNotesStore.getState().restoreNote('restore-me');
    expect(useNotesStore.getState().notes[0]?.deletedAt).toBeNull();
    expect(useNotesStore.getState().activeNoteId).toBe('restore-me');
  });

  it('permanently deletes one explicitly prepared trashed Note', async () => {
    await seedAccount('account-a', [note('delete-me', { deletedAt: 20, updatedAt: 20 }), note('keep')]);
    expect(await deletePrepared('delete-me')).toBe(true);
    expect(useNotesStore.getState().notes.map(item => item.id)).toEqual(['keep']);
    expect(deleteSingleRemoteNoteMock).toHaveBeenCalledTimes(1);
    expect((await loadAccountScopedNotes('account-a')).map(item => item.id)).toEqual(['keep']);
  });

  it('keeps the deletion after an in-process reload of account-scoped storage', async () => {
    await seedAccount('account-a', [note('delete-me', { deletedAt: 20, updatedAt: 20 }), note('keep')]);
    expect(await deletePrepared('delete-me')).toBe(true);
    useNotesStore.setState({ notes: [], activeNoteId: null });
    resetNotesPersistenceForTests();
    await useNotesStore.getState().initNotesStorage('account-a');
    expect(useNotesStore.getState().notes.map(item => item.id)).toEqual(['keep']);
  });

  it('keeps the deletion after detach and re-initialization', async () => {
    await seedAccount('account-a', [note('delete-me', { deletedAt: 20, updatedAt: 20 })]);
    expect(await deletePrepared('delete-me')).toBe(true);
    useNotesStore.getState().detachNotesStorage();
    await useNotesStore.getState().initNotesStorage('account-a');
    expect(useNotesStore.getState().notes).toEqual([]);
  });

  it('rejects a prepared delete after switching accounts', async () => {
    await seedAccount('account-a', [note('a-note', { deletedAt: 20, updatedAt: 20 })]);
    const authorization = useNotesStore.getState().prepareNotePermanentDelete('a-note');
    await seedAccount('account-b', [note('b-note')]);
    expect(await useNotesStore.getState().deleteNotePermanently(authorization!)).toBe(false);
    expect(deleteSingleRemoteNoteMock).not.toHaveBeenCalled();
    await useNotesStore.getState().initNotesStorage('account-a');
    expect((await loadAccountScopedNotes('account-a')).map(item => item.id)).toContain('a-note');
  });

  it('rejects a stale operation epoch before the remote mutation', async () => {
    await seedAccount('account-a', [note('stale-note', { deletedAt: 20, updatedAt: 20 })]);
    const authorization = useNotesStore.getState().prepareNotePermanentDelete('stale-note');
    activateRecoveryMode();
    expect(await useNotesStore.getState().deleteNotePermanently(authorization!)).toBe(false);
    expect(deleteSingleRemoteNoteMock).not.toHaveBeenCalled();
    expect(useNotesStore.getState().notes.map(item => item.id)).toContain('stale-note');
  });

  it('clears a markerless permanent-delete issue after matching local state and bootstrap', async () => {
    await seedAccount('account-a', [note('stale-bootstrap')]);
    expect(useNotesStore.getState().prepareNotePermanentDelete('stale-bootstrap')).toBeNull();
    expect(useNotesStore.getState().syncIssue).toEqual(expect.objectContaining({
      source: 'recovery_permanent_delete',
      targetId: 'stale-bootstrap',
    }));

    setRecoveryModeActiveForTest(false);
    useNotesStore.getState().moveNoteToTrash('stale-bootstrap');
    await vi.waitFor(async () => {
      expect((await loadAccountScopedNotes('account-a')).find(item => item.id === 'stale-bootstrap')?.deletedAt)
        .not.toBeNull();
    });

    const trashed = useNotesStore.getState().notes.find(item => item.id === 'stale-bootstrap')!;
    installRemoteSnapshot('account-a', [trashed]);
    await useNotesStore.getState().bootstrapFromSupabase();

    expect(useNotesStore.getState().syncIssue).toBeNull();
  });

  it('attributes and clears a stale permanent-delete issue after a valid authorization becomes stale', async () => {
    await seedAccount('account-a', [note('stale-targetless', { deletedAt: 20, updatedAt: 20 })]);
    const authorization = useNotesStore.getState().prepareNotePermanentDelete('stale-targetless')!;
    activateRecoveryMode();

    expect(await useNotesStore.getState().deleteNotePermanently(authorization)).toBe(false);
    expect(useNotesStore.getState().syncIssue).toEqual(expect.objectContaining({
      source: 'recovery_permanent_delete',
      targetId: 'stale-targetless',
    }));

    await useNotesStore.getState().initNotesStorage('account-a');
    expect(useNotesStore.getState().syncIssue).toBeNull();
  });

  it('keeps active permanent-delete recovery through an unrelated successful local Note write', async () => {
    const recoveryNote = note('active-recovery', { deletedAt: 20, updatedAt: 20 });
    const unrelatedNote = note('unrelated-local-write');
    await seedAccount('account-a', [recoveryNote, unrelatedNote]);
    deleteSingleRemoteNoteMock.mockResolvedValueOnce({
      ok: false, outcome: 'ambiguous', error: 'notes_delete_remote_unavailable',
    });

    expect(await deletePrepared(recoveryNote.id)).toBe(false);
    expect(useNotesStore.getState().syncIssue).toEqual(expect.objectContaining({
      source: 'recovery_permanent_delete',
      targetId: recoveryNote.id,
    }));

    setRecoveryModeActiveForTest(false);
    useNotesStore.getState().updateNote(unrelatedNote.id, { title: 'unrelated local success' });
    await vi.waitFor(async () => {
      expect((await loadAccountScopedNotes('account-a')).find(item => item.id === unrelatedNote.id)?.title)
        .toBe('unrelated local success');
    });

    expect(singleDeleteMarkerPresent()).toBe(true);
    expect(useNotesStore.getState().syncIssue).toEqual(expect.objectContaining({
      source: 'recovery_permanent_delete',
      targetId: recoveryNote.id,
    }));
  });

  it('keeps the Note and surfaces a bounded error when remote deletion fails', async () => {
    await seedAccount('account-a', [note('failed-note', { deletedAt: 20, updatedAt: 20 })]);
    deleteSingleRemoteNoteMock.mockResolvedValueOnce({
      ok: false, outcome: 'confirmed_not_deleted', error: 'notes_delete_remote_failed_503',
    });
    expect(await deletePrepared('failed-note')).toBe(false);
    expect(useNotesStore.getState().notes.map(item => item.id)).toContain('failed-note');
    expect((await loadAccountScopedNotes('account-a')).map(item => item.id)).toContain('failed-note');
    expect(useNotesStore.getState().syncError).toContain('503');
  });

  it('does not delete a later revision with the original authorization while remote delete is pending', async () => {
    await seedAccount('account-a', [note('revision-race', { deletedAt: 20, updatedAt: 20 })]);
    const remote = deferred<{ ok: true; outcome: 'deleted' }>();
    deleteSingleRemoteNoteMock.mockReturnValueOnce(remote.promise);
    const authorization = useNotesStore.getState().prepareNotePermanentDelete('revision-race')!;
    const deletion = useNotesStore.getState().deleteNotePermanently(authorization);
    await vi.waitFor(() => expect(deleteSingleRemoteNoteMock).toHaveBeenCalledTimes(1));

    useNotesStore.getState().updateNote('revision-race', { title: 'R2' });
    remote.resolve({ ok: true, outcome: 'deleted' });

    expect(await deletion).toBe(false);
    const current = useNotesStore.getState().notes.find(item => item.id === 'revision-race');
    expect(current).toEqual(expect.objectContaining({ title: 'R2', deletedAt: 20 }));
    expect(useNotesStore.getState().syncError).toContain('STALE_REVISION');
    expect((await loadAccountScopedNotes('account-a')).find(item => item.id === 'revision-race'))
      .toEqual(expect.objectContaining({ title: 'R2', deletedAt: 20 }));
    expect(singleDeleteMarkerPresent()).toBe(true);
    expect(await useNotesStore.getState().deleteNotePermanently(authorization)).toBe(false);
  });

  it('keeps a restored Note when restoration happens while remote delete is pending', async () => {
    await seedAccount('account-a', [note('restore-race', { deletedAt: 20, updatedAt: 20 })]);
    const remote = deferred<{ ok: true; outcome: 'deleted' }>();
    deleteSingleRemoteNoteMock.mockReturnValueOnce(remote.promise);
    const deletion = deletePrepared('restore-race');
    await vi.waitFor(() => expect(deleteSingleRemoteNoteMock).toHaveBeenCalledTimes(1));

    useNotesStore.getState().restoreNote('restore-race');
    await vi.waitFor(async () => {
      expect((await loadAccountScopedNotes('account-a')).find(item => item.id === 'restore-race')?.deletedAt)
        .toBeNull();
    });
    remote.resolve({ ok: true, outcome: 'deleted' });

    expect(await deletion).toBe(false);
    expect(useNotesStore.getState().notes.find(item => item.id === 'restore-race'))
      .toEqual(expect.objectContaining({ deletedAt: null }));
    expect(useNotesStore.getState().syncError).toContain('RESTORED_DURING_DELETE');
    expect(singleDeleteMarkerPresent()).toBe(true);
  });

  it('retains an ambiguous remote result, local Note, and marker for safe reconciliation', async () => {
    await seedAccount('account-a', [note('ambiguous-delete', { deletedAt: 20, updatedAt: 20 })]);
    deleteSingleRemoteNoteMock.mockResolvedValueOnce({
      ok: false, outcome: 'ambiguous', error: 'notes_delete_remote_unavailable',
    });

    expect(await deletePrepared('ambiguous-delete')).toBe(false);
    expect(useNotesStore.getState().notes.map(item => item.id)).toContain('ambiguous-delete');
    expect((await loadAccountScopedNotes('account-a')).map(item => item.id)).toContain('ambiguous-delete');
    expect(singleDeleteMarkerPresent()).toBe(true);
    expect(useNotesStore.getState().syncError)
      .toBe('Permanent delete could not be confirmed; it will be reconciled safely. The Note was kept.');
  });

  it('does not finalize when the durable target disappeared before local finalization', async () => {
    await seedAccount('account-a', [note('durable-missing', { deletedAt: 20, updatedAt: 20 })]);
    const remote = deferred<{ ok: true; outcome: 'deleted' }>();
    deleteSingleRemoteNoteMock.mockReturnValueOnce(remote.promise);
    const deletion = deletePrepared('durable-missing');
    await vi.waitFor(() => expect(deleteSingleRemoteNoteMock).toHaveBeenCalledTimes(1));

    await saveAccountScopedNotes('account-a', []);
    remote.resolve({ ok: true, outcome: 'deleted' });

    expect(await deletion).toBe(false);
    expect(useNotesStore.getState().notes.map(item => item.id)).toContain('durable-missing');
    expect(useNotesStore.getState().syncError).toContain('TARGET_NOTE_MISSING');
    expect(singleDeleteMarkerPresent()).toBe(true);
  });

  it('clears a pending marker only after reload proves the remote Note still exists', async () => {
    const original = note('remote-exists', { deletedAt: 20, updatedAt: 20 });
    await seedAccount('account-a', [original]);
    deleteSingleRemoteNoteMock.mockResolvedValueOnce({
      ok: false, outcome: 'ambiguous', error: 'notes_delete_remote_unavailable',
    });
    expect(await deletePrepared('remote-exists')).toBe(false);
    expect(singleDeleteMarkerPresent()).toBe(true);

    useNotesStore.getState().detachNotesStorage();
    await useNotesStore.getState().initNotesStorage('account-a');
    installRemoteSnapshot('account-a', [original]);
    await useNotesStore.getState().bootstrapFromSupabase();

    expect(useNotesStore.getState().notes).toEqual([expect.objectContaining({ id: 'remote-exists', deletedAt: 20 })]);
    expect(singleDeleteMarkerPresent()).toBe(false);
    expect(useNotesStore.getState().syncError).toBeNull();
  });

  it('retains a newer local Note and one conflict marker across repeated remote-present bootstraps', async () => {
    const original = note('remote-present-newer', { deletedAt: 20, updatedAt: 20 });
    await seedAccount('account-a', [original]);
    deleteSingleRemoteNoteMock.mockResolvedValueOnce({
      ok: false, outcome: 'ambiguous', error: 'notes_delete_remote_unavailable',
    });
    expect(await deletePrepared(original.id)).toBe(false);

    useNotesStore.getState().updateNote(original.id, { title: 'R2' });
    await vi.waitFor(async () => {
      expect((await loadAccountScopedNotes('account-a')).find(item => item.id === original.id))
        .toEqual(expect.objectContaining({ title: 'R2', deletedAt: 20 }));
    });

    useNotesStore.getState().detachNotesStorage();
    await useNotesStore.getState().initNotesStorage('account-a');
    installRemoteSnapshot('account-a', [original]);
    await useNotesStore.getState().bootstrapFromSupabase();
    await useNotesStore.getState().bootstrapFromSupabase();
    await useNotesStore.getState().bootstrapFromSupabase();

    expect(useNotesStore.getState().notes).toEqual([
      expect.objectContaining({ id: original.id, title: 'R2', deletedAt: 20 }),
    ]);
    expect(singleDeleteMarkerCount()).toBe(1);
    expect(deleteSingleRemoteNoteMock).toHaveBeenCalledTimes(1);
  });

  it('retains a restored local Note and its conflict marker across repeated remote-present bootstraps', async () => {
    const original = note('remote-present-restored', { deletedAt: 20, updatedAt: 20 });
    await seedAccount('account-a', [original]);
    deleteSingleRemoteNoteMock.mockResolvedValueOnce({
      ok: false, outcome: 'ambiguous', error: 'notes_delete_remote_unavailable',
    });
    expect(await deletePrepared(original.id)).toBe(false);

    useNotesStore.getState().restoreNote(original.id);
    await vi.waitFor(async () => {
      expect((await loadAccountScopedNotes('account-a')).find(item => item.id === original.id)?.deletedAt)
        .toBeNull();
    });

    useNotesStore.getState().detachNotesStorage();
    await useNotesStore.getState().initNotesStorage('account-a');
    installRemoteSnapshot('account-a', [original]);
    await useNotesStore.getState().bootstrapFromSupabase();
    await useNotesStore.getState().bootstrapFromSupabase();

    expect(useNotesStore.getState().notes).toEqual([
      expect.objectContaining({ id: original.id, deletedAt: null }),
    ]);
    expect(singleDeleteMarkerCount()).toBe(1);
    expect(deleteSingleRemoteNoteMock).toHaveBeenCalledTimes(1);
  });

  it('finalizes a matching local Note only after reload proves remote absence', async () => {
    const original = note('remote-absent', { deletedAt: 20, updatedAt: 20 });
    await seedAccount('account-a', [original]);
    deleteSingleRemoteNoteMock.mockResolvedValueOnce({
      ok: false, outcome: 'ambiguous', error: 'notes_delete_remote_unavailable',
    });
    expect(await deletePrepared('remote-absent')).toBe(false);
    expect(singleDeleteMarkerPresent()).toBe(true);

    useNotesStore.getState().detachNotesStorage();
    await useNotesStore.getState().initNotesStorage('account-a');
    authReadFetchMock.mockImplementation(() => Promise.resolve(emptySnapshot('account-a')));
    await useNotesStore.getState().bootstrapFromSupabase();

    expect(useNotesStore.getState().notes).toEqual([]);
    expect(await loadAccountScopedNotes('account-a')).toEqual([]);
    expect(singleDeleteMarkerPresent()).toBe(false);
  });

  it('preserves a newer local Note when reload proves the remote row is absent', async () => {
    const original = note('remote-absent-newer', { deletedAt: 20, updatedAt: 20 });
    await seedAccount('account-a', [original]);
    const remote = deferred<{ ok: true; outcome: 'deleted' }>();
    deleteSingleRemoteNoteMock.mockReturnValueOnce(remote.promise);
    const deletion = deletePrepared('remote-absent-newer');
    await vi.waitFor(() => expect(deleteSingleRemoteNoteMock).toHaveBeenCalledTimes(1));
    useNotesStore.getState().restoreNote('remote-absent-newer');
    await vi.waitFor(async () => {
      expect((await loadAccountScopedNotes('account-a')).find(item => item.id === 'remote-absent-newer')?.deletedAt)
        .toBeNull();
    });
    remote.resolve({ ok: true, outcome: 'deleted' });
    expect(await deletion).toBe(false);

    useNotesStore.getState().detachNotesStorage();
    await useNotesStore.getState().initNotesStorage('account-a');
    authReadFetchMock.mockImplementation(() => Promise.resolve(emptySnapshot('account-a')));
    await useNotesStore.getState().bootstrapFromSupabase();

    expect(useNotesStore.getState().notes)
      .toEqual([expect.objectContaining({ id: 'remote-absent-newer', deletedAt: null })]);
    expect(useNotesStore.getState().syncError)
      .toBe('Permanent delete conflict was preserved locally and requires explicit resolution.');
    expect(singleDeleteMarkerPresent()).toBe(true);
    expect((await loadAccountScopedNotes('account-a')).find(item => item.id === 'remote-absent-newer')?.deletedAt)
      .toBeNull();
  });

  it('keeps a Note A recovery conflict when an unrelated Note B is deleted, then clears on matching reconciliation', async () => {
    const noteA = note('recovery-conflict-a', { deletedAt: 20, updatedAt: 20 });
    const noteB = note('recovery-delete-b', { deletedAt: 30, updatedAt: 30 });
    await seedAccount('account-a', [noteA, noteB]);
    deleteSingleRemoteNoteMock.mockResolvedValueOnce({
      ok: false, outcome: 'ambiguous', error: 'notes_delete_remote_unavailable',
    });
    expect(await deletePrepared(noteA.id)).toBe(false);

    useNotesStore.getState().updateNote(noteA.id, { title: 'A newer local revision' });
    await vi.waitFor(async () => {
      expect((await loadAccountScopedNotes('account-a')).find(item => item.id === noteA.id))
        .toEqual(expect.objectContaining({ title: 'A newer local revision', deletedAt: 20 }));
    });

    useNotesStore.getState().detachNotesStorage();
    await useNotesStore.getState().initNotesStorage('account-a');
    authReadFetchMock.mockImplementation((url: string) => Promise.resolve(
      url.includes('/api/notes?') ? noteSnapshot('account-a', noteB) : emptySnapshot('account-a'),
    ));
    await useNotesStore.getState().bootstrapFromSupabase();

    expect(useNotesStore.getState().syncIssue).toEqual(expect.objectContaining({
      source: 'recovery_permanent_delete',
      targetId: noteA.id,
    }));

    expect(await deletePrepared(noteB.id)).toBe(true);
    expect(useNotesStore.getState().syncIssue).toEqual(expect.objectContaining({
      source: 'recovery_permanent_delete',
      targetId: noteA.id,
    }));

    expect(await saveAccountScopedNotes('account-a', [noteA])).toBe(true);
    useNotesStore.setState({ notes: [noteA], activeNoteId: noteA.id });
    authReadFetchMock.mockImplementation(() => Promise.resolve(emptySnapshot('account-a')));
    await useNotesStore.getState().bootstrapFromSupabase();

    expect(useNotesStore.getState().syncError).toBeNull();
    expect(useNotesStore.getState().syncIssue).toBeNull();
    expect(singleDeleteMarkerPresent()).toBe(false);
  });

  it('preserves an unrelated multi-conflict resolution and clears after the final conflict', async () => {
    const noteA = note('recovery-conflict-a', { deletedAt: 20, updatedAt: 20 });
    const noteB = note('recovery-conflict-b', { deletedAt: 30, updatedAt: 30 });
    await seedAccount('account-a', [noteA, noteB]);
    await createTwoRecoveryConflicts('account-a', noteA, noteB);

    expect(useNotesStore.getState().syncIssue).toEqual(expect.objectContaining({
      source: 'recovery_permanent_delete',
      targetId: noteA.id,
    }));
    await useNotesStore.getState().bootstrapFromSupabase();
    expect(useNotesStore.getState().syncIssue).toEqual(expect.objectContaining({ targetId: noteA.id }));

    const conflictedA = useNotesStore.getState().notes.find(item => item.id === noteA.id)!;
    expect(await saveAccountScopedNotes('account-a', [conflictedA, noteB])).toBe(true);
    useNotesStore.setState({ notes: [conflictedA, noteB], activeNoteId: noteA.id });
    await useNotesStore.getState().bootstrapFromSupabase();

    expect(useNotesStore.getState().syncIssue).toEqual(expect.objectContaining({
      source: 'recovery_permanent_delete',
      targetId: noteA.id,
    }));
    expect(singleDeleteMarkerCount()).toBe(1);

    expect(await saveAccountScopedNotes('account-a', [noteA])).toBe(true);
    useNotesStore.setState({ notes: [noteA], activeNoteId: noteA.id });
    await useNotesStore.getState().bootstrapFromSupabase();

    expect(useNotesStore.getState().syncIssue).toBeNull();
    expect(useNotesStore.getState().syncError).toBeNull();
    expect(singleDeleteMarkerPresent()).toBe(false);
  });

  it('rebinds a multi-conflict recovery issue when its representative resolves first', async () => {
    const noteA = note('recovery-conflict-a', { deletedAt: 20, updatedAt: 20 });
    const noteB = note('recovery-conflict-b', { deletedAt: 30, updatedAt: 30 });
    await seedAccount('account-a', [noteA, noteB]);
    await createTwoRecoveryConflicts('account-a', noteA, noteB);

    expect(useNotesStore.getState().syncIssue).toEqual(expect.objectContaining({
      source: 'recovery_permanent_delete',
      targetId: noteA.id,
    }));
    const conflictedB = useNotesStore.getState().notes.find(item => item.id === noteB.id)!;
    expect(await saveAccountScopedNotes('account-a', [noteA, conflictedB])).toBe(true);
    useNotesStore.setState({ notes: [noteA, conflictedB], activeNoteId: noteB.id });
    await useNotesStore.getState().bootstrapFromSupabase();

    expect(useNotesStore.getState().syncIssue).toEqual(expect.objectContaining({
      source: 'recovery_permanent_delete',
      targetId: noteB.id,
    }));
    expect(singleDeleteMarkerCount()).toBe(1);

    expect(await saveAccountScopedNotes('account-a', [noteB])).toBe(true);
    useNotesStore.setState({ notes: [noteB], activeNoteId: noteB.id });
    await useNotesStore.getState().bootstrapFromSupabase();

    expect(useNotesStore.getState().syncIssue).toBeNull();
    expect(useNotesStore.getState().syncError).toBeNull();
    expect(singleDeleteMarkerPresent()).toBe(false);
  });

  it('preserves a newer trashed Note when remote later becomes absent', async () => {
    const original = note('remote-absent-trashed-newer', { deletedAt: 20, updatedAt: 20 });
    await seedAccount('account-a', [original]);
    deleteSingleRemoteNoteMock.mockResolvedValueOnce({
      ok: false, outcome: 'ambiguous', error: 'notes_delete_remote_unavailable',
    });
    expect(await deletePrepared(original.id)).toBe(false);

    useNotesStore.getState().updateNote(original.id, { title: 'R2' });
    await vi.waitFor(async () => {
      expect((await loadAccountScopedNotes('account-a')).find(item => item.id === original.id))
        .toEqual(expect.objectContaining({ title: 'R2', deletedAt: 20 }));
    });

    useNotesStore.getState().detachNotesStorage();
    await useNotesStore.getState().initNotesStorage('account-a');
    authReadFetchMock.mockImplementation(() => Promise.resolve(emptySnapshot('account-a')));
    await useNotesStore.getState().bootstrapFromSupabase();

    expect(useNotesStore.getState().notes).toEqual([
      expect.objectContaining({ id: original.id, title: 'R2', deletedAt: 20 }),
    ]);
    expect(singleDeleteMarkerPresent()).toBe(true);
    expect(deleteSingleRemoteNoteMock).toHaveBeenCalledTimes(1);
  });

  it('keeps bulk and unprepared destructive paths blocked in recovery mode', async () => {
    await seedAccount('account-a', [note('protected', { deletedAt: 20, updatedAt: 20 })]);
    useNotesStore.getState().emptyTrash();
    expect(await useNotesStore.getState().deleteNotePermanently({ marker: Symbol('forged') } as never)).toBe(false);
    expect(useNotesStore.getState().notes.map(item => item.id)).toEqual(['protected']);
    expect(deleteSingleRemoteNoteMock).not.toHaveBeenCalled();
  });

  it('uses an interrupted exact delete marker so complete bootstrap cannot resurrect the Note', async () => {
    await seedAccount('account-a', [note('interrupted', { deletedAt: 20, updatedAt: 20 })]);
    const remote = deferred<{ ok: true; outcome: 'deleted' }>();
    deleteSingleRemoteNoteMock.mockReturnValueOnce(remote.promise);
    const authorization = useNotesStore.getState().prepareNotePermanentDelete('interrupted')!;
    const deletion = useNotesStore.getState().deleteNotePermanently(authorization);
    await vi.waitFor(() => expect(deleteSingleRemoteNoteMock).toHaveBeenCalledTimes(1));
    useNotesStore.getState().detachNotesStorage();
    remote.resolve({ ok: true, outcome: 'deleted' });
    expect(await deletion).toBe(false);

    await useNotesStore.getState().initNotesStorage('account-a');
    authReadFetchMock.mockImplementation(() => Promise.resolve(emptySnapshot('account-a')));
    await useNotesStore.getState().bootstrapFromSupabase();
    expect(useNotesStore.getState().notes).toEqual([]);
    expect(await loadAccountScopedNotes('account-a')).toEqual([]);
  });

  it('deletes an image-heavy Note without cloning its body into a replacement backup', async () => {
    const largeBody = `data:image/png;base64,${'A'.repeat(2_000_000)}`;
    await seedAccount('account-a', [note('image-heavy', { body: largeBody, deletedAt: 20, updatedAt: 20 })]);
    expect(await deletePrepared('image-heavy')).toBe(true);
    expect(useNotesStore.getState().notes).toEqual([]);
    expect(await loadAccountScopedNotes('account-a')).toEqual([]);
    expect(attachmentGcMock).not.toHaveBeenCalled();
  });

  it('does not delete a shared attachment reference from a remaining Note', async () => {
    const shared = 'attachment://shared-image';
    await seedAccount('account-a', [
      note('delete-me', { body: shared, deletedAt: 20, updatedAt: 20 }),
      note('keep-me', { body: shared, updatedAt: 21 }),
    ]);
    expect(await deletePrepared('delete-me')).toBe(true);
    expect(useNotesStore.getState().notes).toEqual([expect.objectContaining({ id: 'keep-me', body: shared })]);
    await vi.waitFor(() => expect(attachmentGcMock).toHaveBeenCalledTimes(1));
    const input = attachmentGcMock.mock.calls[0]?.[0];
    expect([...input.candidateAttachmentIds]).toEqual(['shared-image']);
    expect(input.getSurvivingNotes()).toEqual([expect.objectContaining({ id: 'keep-me', body: shared })]);
  });

  it('keeps the durable Note deletion committed when best-effort attachment GC fails', async () => {
    attachmentGcMock.mockRejectedValueOnce(new Error('attachment gc unavailable'));
    await seedAccount('account-a', [
      note('delete-with-attachment', { body: 'attachment://exclusive-image', deletedAt: 20, updatedAt: 20 }),
    ]);

    expect(await deletePrepared('delete-with-attachment')).toBe(true);
    await vi.waitFor(() => expect(attachmentGcMock).toHaveBeenCalledTimes(1));
    expect(useNotesStore.getState().notes).toEqual([]);
    expect(await loadAccountScopedNotes('account-a')).toEqual([]);
  });

  it('does not start attachment GC when the durable Note deletion fails', async () => {
    deleteSingleRemoteNoteMock.mockResolvedValueOnce({
      ok: false, outcome: 'confirmed_not_deleted', error: 'remote_rejected',
    });
    await seedAccount('account-a', [
      note('kept-with-attachment', { body: 'attachment://kept-image', deletedAt: 20, updatedAt: 20 }),
    ]);

    expect(await deletePrepared('kept-with-attachment')).toBe(false);
    expect(attachmentGcMock).not.toHaveBeenCalled();
    expect(useNotesStore.getState().notes).toHaveLength(1);
  });
});
