// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteBase } from '../components/views/noteUtils';
import {
  NOTES_ACCOUNT_AUTHORITY_DATABASE_NAME,
  USER_INITIATED_SINGLE_NOTE_DELETE,
  beginNotesSingleDelete,
  initializeAccountScopedNotesAuthority,
  prepareNotesSingleDelete,
  resetNotesAccountAuthorityForTests,
  saveAccountScopedNotes,
} from './notesAccountAuthority';
import { setRecoveryModeActiveForTest } from './recoverySafetyPolicy';

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));
vi.mock('./supabase', () => ({
  supabase: { auth: { getSession: (...args: unknown[]) => getSessionMock(...args) } },
}));

const { deleteSingleRemoteNote } = await import('./notesSingleDeleteRemote');

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => { storage.clear(); },
  key: (index: number) => [...storage.keys()][index] ?? null,
  get length() { return storage.size; },
});

const trashedNote: NoteBase = {
  id: 'note-delete', title: 'Delete', body: 'private body', updatedAt: 20,
  folderId: null, deletedAt: 20,
};

function deleteAuthorityDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(NOTES_ACCOUNT_AUTHORITY_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('authority_database_delete_blocked'));
  });
}

async function pendingAuthorization() {
  await initializeAccountScopedNotesAuthority('account-a');
  expect(await saveAccountScopedNotes('account-a', [trashedNote])).toBe(true);
  const authorization = prepareNotesSingleDelete({
    operation: USER_INITIATED_SINGLE_NOTE_DELETE,
    accountId: 'account-a',
    note: trashedNote,
    explicitUserAction: true,
  });
  expect(authorization).not.toBeNull();
  expect(await beginNotesSingleDelete(authorization!)).toEqual({ accountId: 'account-a', noteId: 'note-delete' });
  return authorization!;
}

beforeEach(async () => {
  resetNotesAccountAuthorityForTests();
  storage.clear();
  await deleteAuthorityDatabase();
  setRecoveryModeActiveForTest(true);
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue({
    data: { session: { access_token: 'safe-test-token', user: { id: 'account-a' } } },
  });
  vi.stubGlobal('fetch', vi.fn());
});

describe('narrow authenticated single-Note remote delete', () => {
  it('sends exactly one DELETE and accepts the exact safe receipt', async () => {
    const authorization = await pendingAuthorization();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      deleted: true, note_id: 'note-delete', account_id: 'account-a',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(deleteSingleRemoteNote(authorization, 'account-a', 'note-delete'))
      .resolves.toEqual({ ok: true, outcome: 'deleted' });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/notes/note-delete'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('rejects a session whose authenticated account does not match', async () => {
    const authorization = await pendingAuthorization();
    getSessionMock.mockResolvedValueOnce({
      data: { session: { access_token: 'safe-test-token', user: { id: 'account-b' } } },
    });
    await expect(deleteSingleRemoteNote(authorization, 'account-a', 'note-delete'))
      .resolves.toEqual({ ok: false, outcome: 'confirmed_not_deleted', error: 'notes_delete_account_mismatch' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a mismatched remote receipt without treating deletion as complete', async () => {
    const authorization = await pendingAuthorization();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      deleted: true, note_id: 'other-note', account_id: 'account-a',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await expect(deleteSingleRemoteNote(authorization, 'account-a', 'note-delete'))
      .resolves.toEqual({ ok: false, outcome: 'ambiguous', error: 'notes_delete_remote_receipt_invalid' });
    expect([...storage.keys()].some(key => key.includes('single-delete'))).toBe(true);
  });

  it('classifies a timeout as ambiguous and leaves the interruption marker intact', async () => {
    const authorization = await pendingAuthorization();
    vi.mocked(fetch).mockRejectedValueOnce(new Error('timeout'));
    await expect(deleteSingleRemoteNote(authorization, 'account-a', 'note-delete'))
      .resolves.toEqual({ ok: false, outcome: 'ambiguous', error: 'notes_delete_remote_unavailable' });
    expect([...storage.keys()].some(key => key.includes('single-delete'))).toBe(true);
  });

  it('classifies an unexpected server response as ambiguous without clearing evidence', async () => {
    const authorization = await pendingAuthorization();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(deleteSingleRemoteNote(authorization, 'account-a', 'note-delete'))
      .resolves.toEqual({ ok: false, outcome: 'ambiguous', error: 'notes_delete_remote_failed_503' });
    expect([...storage.keys()].some(key => key.includes('single-delete'))).toBe(true);
  });

  it('accepts authenticated 404 as the already-absent durable postcondition', async () => {
    const authorization = await pendingAuthorization();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(deleteSingleRemoteNote(authorization, 'account-a', 'note-delete'))
      .resolves.toEqual({ ok: true, outcome: 'already_absent' });
  });
});
