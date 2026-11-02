import { describe, expect, it, vi } from 'vitest';
import { createNotesCloudCopy, type NotesCloudCopyDependencies } from './notesCloudCopy';
import type { NotesCloudCopyLocalPreflightResult } from './notesCloudCopyLocalPreflight';

const localNoteId = 'local-note-id';
const accountId = 'account-A';
const cloudNoteId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const snapshot = { title: 'Title', body: 'Text [[note:kept|label]]', updated_at: 123, starred: true };
const preview: NotesCloudCopyLocalPreflightResult = {
  status: 'ELIGIBLE_PREVIEW_ONLY', authority: 'NONE', localNoteId, snapshot,
  sourceRevision: { authorityGeneration: 1, vaultStructureVersion: 2, indexContentVersion: 3,
    noteUpdatedAt: 123, durableReadback: 'MATCHED', attachmentMetadata: 'COMPLETE_EMPTY' },
  isCurrentInMemory: () => true,
  isCurrent: async () => true,
};

function deps(overrides: Partial<NotesCloudCopyDependencies> = {}): NotesCloudCopyDependencies {
  return {
    featureEnabled: () => true,
    getRuntimeAccountId: () => accountId,
    isTransportAvailable: () => true,
    getSession: async () => ({ data: { session: { access_token: 'user-token', user: { id: accountId } } }, error: null }) as any,
    fetch: vi.fn(async () => new Response(JSON.stringify({
      status: 'created', localNoteId, cloudNoteId,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })),
    apiUrl: 'https://api.example.test/',
    ...overrides,
  };
}

describe('createNotesCloudCopy', () => {
  it('sends one exact supported snapshot to the dedicated endpoint after durable and account revalidation', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ status: 'created', localNoteId, cloudNoteId }), { status: 200 }));
    const current = vi.fn(() => true);
    const prepared = { ...preview, isCurrent: vi.fn(async () => true) };
    const dependencies = deps({ fetch });
    const result = await createNotesCloudCopy(localNoteId, accountId, prepared, current, dependencies);

    expect(result).toEqual({ status: 'CREATED', cloudNoteId });
    expect(prepared.isCurrent).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, request] = fetch.mock.calls[0];
    expect(url).toBe('https://api.example.test/api/notes/cloud-copy');
    expect(request.method).toBe('POST');
    expect(request.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer user-token' });
    expect(JSON.parse(request.body as string)).toEqual({ localNoteId, snapshot });
    expect(JSON.parse(request.body as string)).not.toHaveProperty('accountId');
    expect(current).toHaveBeenCalled();
  });

  it('fails closed when the dedicated capability is off', async () => {
    const fetch = vi.fn();
    const result = await createNotesCloudCopy(localNoteId, accountId, preview, () => true,
      deps({ featureEnabled: () => false, fetch }));
    expect(result.status).toBe('DISABLED');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not send if the durable source or comparison owner is stale', async () => {
    const fetch = vi.fn();
    const changed: NotesCloudCopyLocalPreflightResult = {
      ...preview, isCurrent: async () => false,
    };
    const stale = await createNotesCloudCopy(localNoteId, accountId, changed, () => true, deps({ fetch }));
    const staleOwner = await createNotesCloudCopy(localNoteId, accountId, preview, () => false, deps({ fetch }));
    expect(stale.status).toBe('SOURCE_CHANGED');
    expect(staleOwner.status).toBe('SOURCE_CHANGED');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rechecks session account and runtime authority after asynchronous session retrieval', async () => {
    const fetch = vi.fn();
    const result = await createNotesCloudCopy(localNoteId, accountId, preview, () => true, deps({
      getRuntimeAccountId: () => 'account-B', fetch,
    }));
    expect(result.status).toBe('SOURCE_CHANGED');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [409, 'CONFLICT'], [423, 'DISABLED'], [503, 'INDETERMINATE'],
  ] as const)('maps HTTP %i without treating it as success', async (status, expected) => {
    const fetch = vi.fn(async () => new Response('opaque-server-detail', { status }));
    const result = await createNotesCloudCopy(localNoteId, accountId, preview, () => true, deps({ fetch }));
    expect(result.status).toBe(expected);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('never reports success for a malformed or wrong-identity server result', async () => {
    for (const body of [
      { status: 'created', localNoteId: 'different-local', cloudNoteId },
      { status: 'created', localNoteId, cloudNoteId: localNoteId },
      { status: 'created', localNoteId, cloudNoteId: 'not-a-uuid' },
      { status: 'anything', localNoteId, cloudNoteId },
    ]) {
      const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
      const result = await createNotesCloudCopy(localNoteId, accountId, preview, () => true, deps({ fetch }));
      expect(result.status).toBe('INDETERMINATE');
    }
  });

  it('suppresses a completed response after account context changes', async () => {
    const current = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValueOnce(true)
      .mockReturnValueOnce(true).mockReturnValue(false);
    const result = await createNotesCloudCopy(localNoteId, accountId, preview, current, deps());
    expect(result.status).toBe('STALE_RESULT');
  });

  it('suppresses a success if account context changes while the response body is being read', async () => {
    let resolveJson!: (value: unknown) => void;
    let markJsonStarted!: () => void;
    const jsonStarted = new Promise<void>(resolve => { markJsonStarted = resolve; });
    let current = true;
    const fetch = vi.fn(async () => ({
      status: 200,
      ok: true,
      json: () => {
        markJsonStarted();
        return new Promise(resolve => { resolveJson = resolve; });
      },
    }) as unknown as Response);
    const pending = createNotesCloudCopy(localNoteId, accountId, preview, () => current, deps({ fetch }));
    await jsonStarted;
    current = false;
    resolveJson({ status: 'created', localNoteId, cloudNoteId });
    expect((await pending).status).toBe('STALE_RESULT');
  });

  it('does not contact a path outside the exact Notes Cloud Copy route', async () => {
    const fetch = vi.fn();
    const result = await createNotesCloudCopy(localNoteId, accountId, preview, () => true,
      deps({ apiUrl: 'https://api.example.test/unexpected', fetch }));
    expect(result.status).toBe('UNAVAILABLE');
    expect(fetch).not.toHaveBeenCalled();
  });
});
