import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  authReadFetch: vi.fn(),
}));

import { authReadFetch } from './supabase';
import { fetchCompleteNotesFoldersSnapshot } from './notesSyncClient';
import { collectHealthRecoveryDatasetsReadOnly, HEALTH_RECOVERY_DATASETS } from './healthRecoveryExport';

const ACCOUNT_ID = 'account-a';

function notesPage(rows: unknown[], totalCount = rows.length, complete = rows.length === totalCount) {
  return { account_id: ACCOUNT_ID, rows, total_count: totalCount, offset: 0, limit: 500, complete };
}

function foldersPage(rows: unknown[], totalCount = rows.length, complete = rows.length === totalCount) {
  return { account_id: ACCOUNT_ID, rows, total_count: totalCount, offset: 0, limit: 500, complete };
}

function healthResponse(rows: unknown[], totalCount = rows.length, rangeStart = 0) {
  const rangeEnd = rows.length === 0 ? rangeStart : rangeStart + rows.length - 1;
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-range': `${rows.length === 0 ? '*' : `${rangeStart}-${rangeEnd}`}/${totalCount}` }),
    json: async () => rows,
  };
}

describe('RTU-03 read-only Supabase bootstrap boundaries', () => {
  it('fetches complete Notes/Folders with GET only and preserves tombstone metadata', async () => {
    vi.mocked(authReadFetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(notesPage([
        { id: 'deleted', user_id: ACCOUNT_ID, title: 'old', body: '', updated_at: 10, folder_id: null, deleted_at: 20 },
        { id: 'active', user_id: ACCOUNT_ID, title: 'active', body: '', updated_at: 11, folder_id: null, deleted_at: null },
      ])), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(foldersPage([
        { id: 'folder-1', user_id: ACCOUNT_ID, name: 'Folder', created_at: 1 },
      ])), { status: 200 }));

    const snapshot = await fetchCompleteNotesFoldersSnapshot(ACCOUNT_ID);
    expect(snapshot.notes[0]?.deleted_at).toBe(20);
    expect(snapshot.notes[1]?.folder_id).toBeNull();
    expect(snapshot.notes[1]?.deleted_at).toBeNull();
    expect(snapshot.folders).toHaveLength(1);
    expect(vi.mocked(authReadFetch)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(authReadFetch).mock.calls.every(([, init]) => (init?.method ?? 'GET') === 'GET')).toBe(true);
  });

  it('fails closed on duplicate remote identities before local writes can occur', async () => {
    vi.mocked(authReadFetch).mockReset();
    vi.mocked(authReadFetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(notesPage([
        { id: 'same', user_id: ACCOUNT_ID, title: 'one', body: '', updated_at: 1, folder_id: null, deleted_at: null },
        { id: 'same', user_id: ACCOUNT_ID, title: 'two', body: '', updated_at: 2, folder_id: null, deleted_at: null },
      ])), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(foldersPage([])), { status: 200 }));
    await expect(fetchCompleteNotesFoldersSnapshot(ACCOUNT_ID)).rejects.toThrow('complete_notes_snapshot_invalid');
  });

  it('accepts exactly the proven Notes total and rejects a short successful page', async () => {
    const rows = Array.from({ length: 110 }, (_, index) => ({
      id: `note-${index}`, user_id: ACCOUNT_ID, title: `Note ${index}`, body: '', updated_at: index + 1,
      folder_id: null, deleted_at: null,
    }));
    vi.mocked(authReadFetch).mockReset();
    vi.mocked(authReadFetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(notesPage(rows, 110, true)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(foldersPage([])), { status: 200 }));
    await expect(fetchCompleteNotesFoldersSnapshot(ACCOUNT_ID)).resolves.toMatchObject({ notes: rows, folders: [] });

    vi.mocked(authReadFetch).mockReset();
    vi.mocked(authReadFetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(notesPage(rows.slice(0, 109), 110, false)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(foldersPage([])), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        account_id: ACCOUNT_ID, rows: [], total_count: 110, offset: 109, limit: 500, complete: false,
      }), { status: 200 }));
    await expect(fetchCompleteNotesFoldersSnapshot(ACCOUNT_ID)).rejects.toThrow('complete_notes_snapshot_incomplete');
  });

  it('rejects missing ownership/deletion fields and incomplete equal-count pages', async () => {
    for (const row of [
      { id: 'missing-owner', title: 'one', body: '', updated_at: 1, folder_id: null, deleted_at: null },
      { id: 'missing-folder', user_id: ACCOUNT_ID, title: 'one', body: '', updated_at: 1, deleted_at: null },
      { id: 'missing-deleted', user_id: ACCOUNT_ID, title: 'one', body: '', updated_at: 1, folder_id: null },
    ]) {
      vi.mocked(authReadFetch).mockReset();
      vi.mocked(authReadFetch)
        .mockResolvedValueOnce(new Response(JSON.stringify(notesPage([row])), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(foldersPage([])), { status: 200 }));
      await expect(fetchCompleteNotesFoldersSnapshot(ACCOUNT_ID)).rejects.toThrow('complete_notes_snapshot_invalid');
    }

    vi.mocked(authReadFetch).mockReset();
    vi.mocked(authReadFetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({
        account_id: ACCOUNT_ID,
        rows: [{ id: 'one', user_id: ACCOUNT_ID, title: 'one', body: '', updated_at: 1, folder_id: null, deleted_at: null }],
        total_count: 2, offset: 0, limit: 500, complete: false,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(foldersPage([])), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        account_id: ACCOUNT_ID, rows: [], total_count: 2, offset: 1, limit: 500, complete: false,
      }), { status: 200 }));
    await expect(fetchCompleteNotesFoldersSnapshot(ACCOUNT_ID)).rejects.toThrow('complete_notes_snapshot_incomplete');
  });

  it('collects every Health dataset with the authenticated bearer token and SELECT-only requests', async () => {
    const calls: Array<{ url: string; method: string; authorization: string }> = [];
    const datasets = await collectHealthRecoveryDatasetsReadOnly({
      endpoint: 'https://fhaozlbrmyrzkrlysvmp.supabase.co',
      apiKey: 'anon-key',
      accessToken: 'user-token',
      userId: '18c8ab7d-6ba7-4547-aa55-f254ce900075',
      fetchImpl: async (url, init) => {
        calls.push({
          url,
          method: String(init?.method ?? 'GET'),
          authorization: String((init?.headers as Record<string, string>)?.Authorization),
        });
        return healthResponse([]);
      },
    });
    expect(Object.keys(datasets).sort()).toEqual([...HEALTH_RECOVERY_DATASETS].sort());
    expect(calls).toHaveLength(HEALTH_RECOVERY_DATASETS.length);
    expect(calls.every(call => call.method === 'GET' && call.authorization === 'Bearer user-token')).toBe(true);
  });

  it('rejects a shortened Health page when the independently proven total is nonzero', async () => {
    let calls = 0;
    await expect(collectHealthRecoveryDatasetsReadOnly({
      endpoint: 'https://fhaozlbrmyrzkrlysvmp.supabase.co',
      apiKey: 'anon-key', accessToken: 'user-token',
      userId: '18c8ab7d-6ba7-4547-aa55-f254ce900075',
      fetchImpl: async () => {
        calls += 1;
        return healthResponse([], 1);
      },
    })).rejects.toThrow('health_select_incomplete:exercise_blocks');
    expect(calls).toBe(1);
  });
});
