import { describe, expect, it } from 'vitest';
import type { NoteBase } from '../components/views/noteUtils';
import type { DbNoteRow } from './notesSyncClient';
import { resolveSameIdNoteAuthority } from './notesBootstrapAuthority';

const ACCOUNT_ID = 'account-a';

function localNote(overrides: Partial<NoteBase> = {}): NoteBase {
  return {
    id: 'note-a',
    title: 'Local title',
    body: 'Local body',
    updatedAt: 20,
    folderId: null,
    deletedAt: null,
    starred: false,
    ...overrides,
  };
}

function remoteNote(overrides: Partial<DbNoteRow> = {}): DbNoteRow {
  return {
    id: 'note-a',
    user_id: ACCOUNT_ID,
    title: 'Remote title',
    body: 'Remote body',
    updated_at: 10,
    folder_id: null,
    deleted_at: null,
    starred: false,
    properties: null,
    relations: null,
    ...overrides,
  };
}

function resolve(
  local: NoteBase,
  remote: DbNoteRow,
  overrides: Partial<{ protectedDeleteConflict: boolean; pendingLocalMutation: boolean }> = {},
) {
  return resolveSameIdNoteAuthority({
    accountId: ACCOUNT_ID,
    local,
    remote,
    protectedDeleteConflict: false,
    pendingLocalMutation: false,
    ...overrides,
  });
}

describe('Notes bootstrap same-ID revision authority', () => {
  it('preserves a newer active local Note and marks later remote convergence pending', () => {
    const local = localNote();
    expect(resolve(local, remoteNote())).toEqual({
      outcome: 'LOCAL_NEWER',
      resolved: local,
      pendingRemoteSync: true,
      conflict: false,
    });
  });

  it('accepts a newer active authoritative remote Note', () => {
    const result = resolve(localNote({ updatedAt: 10 }), remoteNote({ updated_at: 30 }));
    expect(result).toEqual({
      outcome: 'REMOTE_NEWER',
      resolved: expect.objectContaining({ title: 'Remote title', updatedAt: 30 }),
      pendingRemoteSync: false,
      conflict: false,
    });
  });

  it('retains the local object and local-only metadata for equal canonical payloads', () => {
    const local = localNote({
      title: 'Same', body: 'Same body', updatedAt: 20, createdAt: 1, lastOpenedAt: 99,
      properties: { Topic: 'notes' }, relations: { Related: ['note-b'] },
    });
    const result = resolve(local, remoteNote({
      title: 'Same', body: 'Same body', updated_at: 20,
      properties: { Topic: 'notes' }, relations: { Related: ['note-b'] },
    }));
    expect(result).toEqual({
      outcome: 'EQUAL', resolved: local, pendingRemoteSync: false, conflict: false,
    });
    expect(result.resolved).toBe(local);
  });

  it('uses existing payload normalization for equal canonical payload identity', () => {
    const local = localNote({
      title: 'Same',
      body: 'asset data:image/png;base64,AAAA',
      properties: { ' Topic ': 'notes', Alpha: 'one' },
      relations: { ' Related ': [' note-b ', 'note-b'], Parent: ['note-c'] },
    });
    const result = resolve(local, remoteNote({
      title: 'Same',
      body: 'asset [blob-data-omitted:attachment-boundary]',
      updated_at: 20,
      properties: { Alpha: 'one', Topic: 'notes' },
      relations: { Parent: ['note-c'], Related: ['note-b'] },
    }));
    expect(result.outcome).toBe('EQUAL');
    expect(result.conflict).toBe(false);
    expect(result.resolved).toBe(local);
  });

  it('preserves local and reports conflict for equal revisions with different payloads', () => {
    const local = localNote({ updatedAt: 20 });
    const result = resolve(local, remoteNote({ updated_at: 20 }));
    expect(result).toEqual({
      outcome: 'EQUAL', resolved: local, pendingRemoteSync: false, conflict: true,
    });
  });

  it('accepts a newer remote tombstone over an older active local Note', () => {
    const result = resolve(
      localNote({ updatedAt: 10 }),
      remoteNote({ updated_at: 10, deleted_at: 30 }),
    );
    expect(result.outcome).toBe('REMOTE_NEWER');
    expect(result.resolved.deletedAt).toBe(30);
  });

  it('preserves a newer locally restored active Note over an older remote tombstone', () => {
    const local = localNote({ updatedAt: 40, deletedAt: null });
    const result = resolve(local, remoteNote({ updated_at: 10, deleted_at: 30 }));
    expect(result).toEqual({
      outcome: 'LOCAL_NEWER', resolved: local, pendingRemoteSync: true, conflict: false,
    });
  });

  it('preserves a newer local tombstone over an older remote active Note', () => {
    const local = localNote({ updatedAt: 10, deletedAt: 40 });
    const result = resolve(local, remoteNote({ updated_at: 30, deleted_at: null }));
    expect(result).toEqual({
      outcome: 'LOCAL_NEWER', resolved: local, pendingRemoteSync: true, conflict: false,
    });
  });

  it('accepts a newer remote active Note over an older local tombstone', () => {
    const result = resolve(
      localNote({ updatedAt: 10, deletedAt: 20 }),
      remoteNote({ updated_at: 30, deleted_at: null }),
    );
    expect(result.outcome).toBe('REMOTE_NEWER');
    expect(result.resolved.deletedAt).toBeNull();
  });

  it('preserves local on equal effective revision with different deletion state', () => {
    const local = localNote({ updatedAt: 30, deletedAt: null });
    const result = resolve(local, remoteNote({ updated_at: 10, deleted_at: 30 }));
    expect(result).toEqual({
      outcome: 'EQUAL', resolved: local, pendingRemoteSync: false, conflict: true,
    });
  });

  it('treats malformed local tombstone chronology as incomparable', () => {
    const local = localNote({ updatedAt: 30, deletedAt: 20 });
    expect(resolve(local, remoteNote({ updated_at: 40 }))).toEqual({
      outcome: 'INCOMPARABLE', resolved: local, pendingRemoteSync: false, conflict: true,
    });
  });

  it('treats malformed remote tombstone chronology as incomparable', () => {
    const local = localNote({ updatedAt: 10 });
    expect(resolve(local, remoteNote({ updated_at: 40, deleted_at: 30 }))).toEqual({
      outcome: 'INCOMPARABLE', resolved: local, pendingRemoteSync: false, conflict: true,
    });
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])('treats invalid remote revision %s as incomparable', updated_at => {
    const local = localNote({ updatedAt: 10 });
    expect(resolve(local, remoteNote({ updated_at }))).toEqual({
      outcome: 'INCOMPARABLE', resolved: local, pendingRemoteSync: false, conflict: true,
    });
  });

  it('treats an ownership mismatch as incomparable', () => {
    const local = localNote({ updatedAt: 10 });
    expect(resolve(local, remoteNote({ user_id: 'account-b', updated_at: 30 }))).toEqual({
      outcome: 'INCOMPARABLE', resolved: local, pendingRemoteSync: false, conflict: true,
    });
  });

  it('treats incomplete authoritative sync fields as incomparable', () => {
    const local = localNote({ updatedAt: 10 });
    const remote = remoteNote({ updated_at: 30 });
    delete (remote as Partial<DbNoteRow>).relations;
    expect(resolve(local, remote)).toEqual({
      outcome: 'INCOMPARABLE', resolved: local, pendingRemoteSync: false, conflict: true,
    });
  });

  it('preserves existing permanent-delete authority precedence', () => {
    const local = localNote({ updatedAt: 10 });
    expect(resolve(local, remoteNote({ updated_at: 30 }), { protectedDeleteConflict: true })).toEqual({
      outcome: 'INCOMPARABLE', resolved: local, pendingRemoteSync: false, conflict: true,
    });
  });

  it('does not allow a pending local mutation to be superseded', () => {
    const local = localNote({ updatedAt: 10 });
    expect(resolve(local, remoteNote({ updated_at: 30 }), { pendingLocalMutation: true })).toEqual({
      outcome: 'INCOMPARABLE', resolved: local, pendingRemoteSync: true, conflict: true,
    });
  });
});
