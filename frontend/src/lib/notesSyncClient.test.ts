import { beforeEach, describe, expect, it, vi } from 'vitest';
const { authFetchMock, authReadFetchMock } = vi.hoisted(() => ({
  authFetchMock: vi.fn(),
  authReadFetchMock: vi.fn(),
}));

vi.mock('./supabase', () => ({
  authFetch: (...args: unknown[]) => authFetchMock(...args),
  authReadFetch: (...args: unknown[]) => authReadFetchMock(...args),
}));

import {
  getNoteSyncStatus,
  isNotesCloudSyncEnabled,
  NOTES_RUNTIME_SYNC_MODE_KEY,
  RETURN_TO_USE_LOCAL_LOCK_ENV,
  resolveNotesRuntimeSyncMode,
  writeNoteWithAuthoritativeReadback,
  type NoteWritePayload,
} from './notesSyncClient';

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v); },
  removeItem: (k: string) => { storage.delete(k); },
  clear: () => { storage.clear(); },
});

beforeEach(() => {
  storage.clear();
  vi.stubEnv(RETURN_TO_USE_LOCAL_LOCK_ENV, 'false');
  vi.stubEnv('VITE_ABSINTHE_SYNC_MODE', '');
  authFetchMock.mockReset();
  authReadFetchMock.mockReset();
});

const accountId = 'account-a';
const payload = (overrides: Partial<NoteWritePayload> = {}): NoteWritePayload => ({
  id: 'note-1',
  title: 'Title',
  body: 'Body',
  updated_at: 100,
  folder_id: null,
  deleted_at: null,
  starred: false,
  properties: { Type: 'Test' },
  relations: { Related: ['note-2'] },
  ...overrides,
});

function authoritativeRow(overrides: Record<string, unknown> = {}) {
  return {
    ...payload(),
    user_id: accountId,
    ...overrides,
  };
}

function response(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function startedResponse(value: Response | Error) {
  return (_url: string, _options: RequestInit, control?: { onRequestStart?: () => void }) => {
    control?.onRequestStart?.();
    return value instanceof Error ? Promise.reject(value) : Promise.resolve(value);
  };
}

describe('notesSyncClient', () => {
  const legacyNotesLastSyncKey = 'absinthe-notes-last-sync-at';

  it('defaults runtime sync to local-only', () => {
    expect(resolveNotesRuntimeSyncMode()).toBe('local');
    expect(isNotesCloudSyncEnabled()).toBe(false);
  });

  it('local safety lock defeats a stale remote browser override', () => {
    vi.stubEnv(RETURN_TO_USE_LOCAL_LOCK_ENV, 'true');
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
    expect(resolveNotesRuntimeSyncMode()).toBe('local');
    expect(isNotesCloudSyncEnabled()).toBe(false);
  });

  it('local safety lock defeats a stale hybrid browser override', () => {
    vi.stubEnv(RETURN_TO_USE_LOCAL_LOCK_ENV, '1');
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'hybrid');
    expect(resolveNotesRuntimeSyncMode()).toBe('local');
    expect(isNotesCloudSyncEnabled()).toBe(false);
  });

  it('local safety lock outranks a remote environment mode', () => {
    vi.stubEnv(RETURN_TO_USE_LOCAL_LOCK_ENV, 'true');
    vi.stubEnv('VITE_ABSINTHE_SYNC_MODE', 'remote');
    expect(resolveNotesRuntimeSyncMode()).toBe('local');
    expect(isNotesCloudSyncEnabled()).toBe(false);
  });

  it('falls back closed for a malformed browser mode value', () => {
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'unexpected');
    expect(resolveNotesRuntimeSyncMode()).toBe('local');
    expect(isNotesCloudSyncEnabled()).toBe(false);
  });

  it('can explicitly enable remote notes sync for future adapters', () => {
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
    expect(resolveNotesRuntimeSyncMode()).toBe('remote');
    expect(isNotesCloudSyncEnabled()).toBe(true);
  });

  it('classifies an eligible note as dirty from note-local state', () => {
    expect(getNoteSyncStatus({ updatedAt: 100, deletedAt: null })).toBe('dirty');
  });

  it('classifies tombstoned notes as deleted from note-local state', () => {
    expect(getNoteSyncStatus({ updatedAt: 101, deletedAt: 120 })).toBe('deleted');
  });

  it.each([
    ['stale', '100'],
    ['future-dated', String(Number.MAX_SAFE_INTEGER)],
    ['malformed', 'not-a-timestamp'],
  ])('ignores %s historical legacy cursor state for upload eligibility', (_label, value) => {
    storage.set(legacyNotesLastSyncKey, value);
    expect(getNoteSyncStatus({ updatedAt: 100, deletedAt: null })).toBe('dirty');
  });

  it('keeps account-scoped Note decisions independent from the shared legacy cursor', () => {
    storage.set(legacyNotesLastSyncKey, String(Number.MAX_SAFE_INTEGER));
    expect(getNoteSyncStatus({ updatedAt: 100, deletedAt: null })).toBe('dirty');
    expect(getNoteSyncStatus({ updatedAt: 200, deletedAt: null })).toBe('dirty');
  });

});

describe('authoritative single-Note write classification', () => {
  const currentState = vi.fn(() => 'CURRENT' as const);

  beforeEach(() => currentState.mockReturnValue('CURRENT'));

  it('accepts only a matching authoritative POST row', async () => {
    authFetchMock.mockImplementation(startedResponse(response(200, authoritativeRow())));

    await expect(writeNoteWithAuthoritativeReadback({ accountId, payload: payload(), currentState }))
      .resolves.toEqual({ classification: 'REMOTE_CONFIRMED' });
    expect(authReadFetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['wrong id', { id: 'wrong-id' }],
    ['wrong owner', { user_id: 'account-b' }],
    ['older revision', { updated_at: 99 }],
    ['payload mismatch', { body: 'different' }],
  ])('rejects %s in a 2xx and performs one bounded readback', async (_label, mismatch) => {
    authFetchMock.mockImplementation(startedResponse(response(200, authoritativeRow(mismatch))));
    authReadFetchMock.mockResolvedValue(response(404, {}));

    const result = await writeNoteWithAuthoritativeReadback({ accountId, payload: payload(), currentState });

    expect(result.classification).toBe('REMOTE_NOT_CONFIRMED');
    expect(authReadFetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not read back a deterministic owner collision', async () => {
    authFetchMock.mockImplementation(startedResponse(response(409, { detail: 'NOTE_ID_UNAVAILABLE' })));

    const result = await writeNoteWithAuthoritativeReadback({ accountId, payload: payload(), currentState });

    expect(result).toEqual({ classification: 'HTTP_REJECTION', httpStatus: 409, code: 'NOTE_ID_UNAVAILABLE' });
    expect(authReadFetchMock).not.toHaveBeenCalled();
  });

  it('does not read back when authentication fails before the request starts', async () => {
    authFetchMock.mockRejectedValue(new Error('Not authenticated'));

    const result = await writeNoteWithAuthoritativeReadback({ accountId, payload: payload(), currentState });

    expect(result.classification).toBe('AUTH_UNAVAILABLE');
    expect(authReadFetchMock).not.toHaveBeenCalled();
  });

  it('does not read back when request construction fails before request start', async () => {
    authFetchMock.mockRejectedValue(new Error('request construction failed'));

    const result = await writeNoteWithAuthoritativeReadback({ accountId, payload: payload(), currentState });

    expect(result.classification).toBe('REQUEST_NOT_STARTED');
    expect(authReadFetchMock).not.toHaveBeenCalled();
  });

  it('confirms a remote commit after the POST transport response is lost', async () => {
    authFetchMock.mockImplementation(startedResponse(new Error('connection reset')));
    authReadFetchMock.mockResolvedValue(response(200, authoritativeRow()));

    const result = await writeNoteWithAuthoritativeReadback({ accountId, payload: payload(), currentState });

    expect(result.classification).toBe('REMOTE_CONFIRMED_AFTER_READBACK');
    expect(authReadFetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps an uncommitted transport failure pending after an absent readback', async () => {
    authFetchMock.mockImplementation(startedResponse(new Error('connection reset')));
    authReadFetchMock.mockResolvedValue(response(404, {}));

    await expect(writeNoteWithAuthoritativeReadback({ accountId, payload: payload(), currentState }))
      .resolves.toEqual({ classification: 'REMOTE_NOT_CONFIRMED', httpStatus: 404 });
  });

  it('classifies an older readback as not confirmed', async () => {
    authFetchMock.mockImplementation(startedResponse(response(503, {})));
    authReadFetchMock.mockResolvedValue(response(200, authoritativeRow({ updated_at: 99 })));

    const result = await writeNoteWithAuthoritativeReadback({ accountId, payload: payload(), currentState });

    expect(result.classification).toBe('REMOTE_NOT_CONFIRMED');
  });

  it.each([
    ['newer', { updated_at: 101, body: 'remote-newer' }],
    ['equal revision mismatch', { updated_at: 100, body: 'remote-conflict' }],
  ])('classifies a %s readback as a conflict', async (_label, remote) => {
    authFetchMock.mockImplementation(startedResponse(response(503, {})));
    authReadFetchMock.mockResolvedValue(response(200, authoritativeRow(remote)));

    const result = await writeNoteWithAuthoritativeReadback({ accountId, payload: payload(), currentState });

    expect(result.classification).toBe('REMOTE_CONFLICT');
  });

  it('keeps transport ambiguity when its single readback also fails', async () => {
    authFetchMock.mockImplementation(startedResponse(new Error('connection reset')));
    authReadFetchMock.mockRejectedValue(new Error('readback unavailable'));

    const result = await writeNoteWithAuthoritativeReadback({ accountId, payload: payload(), currentState });

    expect(result.classification).toBe('TRANSPORT_AMBIGUOUS');
    expect(authReadFetchMock).toHaveBeenCalledTimes(1);
  });

  it('publishes nothing after the account becomes stale during POST', async () => {
    authFetchMock.mockImplementation(async (_url: string, _options: RequestInit, control: { onRequestStart: () => void }) => {
      control.onRequestStart();
      currentState.mockReturnValue('STALE_ACCOUNT');
      return response(200, authoritativeRow());
    });

    const result = await writeNoteWithAuthoritativeReadback({ accountId, payload: payload(), currentState });

    expect(result.classification).toBe('STALE_ACCOUNT');
    expect(authReadFetchMock).not.toHaveBeenCalled();
  });

  it('does not start POST after context becomes stale during auth acquisition', async () => {
    authFetchMock.mockImplementation(async (
      _url: string,
      _options: RequestInit,
      control: { onRequestStart: () => void },
    ) => {
      currentState.mockReturnValue('STALE_OPERATION');
      control.onRequestStart();
      throw new Error('unreachable');
    });

    const result = await writeNoteWithAuthoritativeReadback({ accountId, payload: payload(), currentState });

    expect(result.classification).toBe('STALE_OPERATION');
    expect(authReadFetchMock).not.toHaveBeenCalled();
  });

  it('does not start readback after context becomes stale during auth acquisition', async () => {
    authFetchMock.mockImplementation(startedResponse(new Error('connection reset')));
    authReadFetchMock.mockImplementation(async (
      _url: string,
      _options: RequestInit,
      control: { onRequestStart: () => void },
    ) => {
      currentState.mockReturnValue('STALE_ACCOUNT');
      control.onRequestStart();
      throw new Error('unreachable');
    });

    const result = await writeNoteWithAuthoritativeReadback({ accountId, payload: payload(), currentState });

    expect(result.classification).toBe('STALE_ACCOUNT');
    expect(authReadFetchMock).toHaveBeenCalledTimes(1);
  });

  it('publishes nothing after logout during readback', async () => {
    authFetchMock.mockImplementation(startedResponse(new Error('connection reset')));
    authReadFetchMock.mockImplementation(async () => {
      currentState.mockReturnValue('STALE_ACCOUNT');
      return response(200, authoritativeRow());
    });

    const result = await writeNoteWithAuthoritativeReadback({ accountId, payload: payload(), currentState });

    expect(result.classification).toBe('STALE_ACCOUNT');
  });
});
