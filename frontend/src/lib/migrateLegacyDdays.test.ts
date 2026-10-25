import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteBase } from '../components/views/noteUtils';

vi.mock('./supabase', () => ({ authFetch: vi.fn() }));
vi.mock('../store/useNotesStore', () => ({ useNotesStore: { getState: vi.fn() } }));

import { authFetch } from './supabase';
import { useNotesStore } from '../store/useNotesStore';
import { applyEventToNote } from '../components/views/features/knowledge/trace/eventNotes';
import { migrateLegacyDdays, resetDdayMigrationFlag } from './migrateLegacyDdays';
import { setRuntimeAccountSyncAccount } from './remoteBoundary';
import { NOTES_RUNTIME_SYNC_MODE_KEY } from './syncMode';

const KEY = 'absinthe:dday-migration-v1';
const mockFetch = vi.mocked(authFetch);
const mockGetState = vi.mocked(useNotesStore.getState);
const storage = new Map<string, string>();
const createNote = vi.fn();
const updateNote = vi.fn();
const syncNoteToDB = vi.fn();
const setItem = vi.fn();
let rows: { id: string; text: string; date: string }[];
let notes: NoteBase[];

function response(value: unknown, ok = true): Response {
  return { ok, json: async () => structuredClone(value) } as Response;
}
function note(id: string): NoteBase {
  return { id, title: 'Existing user Note', body: 'Keep this body', folderId: null,
    createdAt: 1, updatedAt: 2, deletedAt: null, properties: { user: 'keep' }, relations: {} };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
function expectNoUnprovenEffects() {
  expect(mockFetch.mock.calls.filter(([, options]) => options?.method === 'DELETE')).toHaveLength(0);
  expect(createNote).not.toHaveBeenCalled();
  expect(updateNote).not.toHaveBeenCalled();
  expect(syncNoteToDB).not.toHaveBeenCalled();
  expect(mockGetState).not.toHaveBeenCalled();
  expect(setItem).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  storage.clear();
  rows = [{ id: 'sch-1', text: 'EJU Exam', date: '2026-11-15' }];
  notes = [note('user-note')];
  vi.stubEnv('VITE_ABSINTHE_ACCOUNT_SYNC_DISABLED', 'false');
  vi.stubGlobal('navigator', { onLine: true });
  setRuntimeAccountSyncAccount('account-a');
  setItem.mockImplementation((key: string, value: string) => { storage.set(key, value); });
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null, setItem,
    removeItem: (key: string) => { storage.delete(key); }, clear: () => storage.clear(),
  });
  resetDdayMigrationFlag();
  createNote.mockImplementation(({ title }: { title: string }) => {
    const id = 'unverified-' + notes.length;
    notes.push({ ...note(id), title });
    return id;
  });
  updateNote.mockImplementation((id: string, patch: Partial<NoteBase>) => {
    notes = notes.map(item => item.id === id ? { ...item, ...patch } : item);
  });
  syncNoteToDB.mockResolvedValue(true);
  mockGetState.mockImplementation(() => ({
    notes, createNote, updateNote, syncNoteToDB,
  } as unknown as ReturnType<typeof useNotesStore.getState>));
  // Fake server only: accidental DELETE would remove this fixture's original.
  mockFetch.mockImplementation(async (url, options) => {
    if (options?.method === 'DELETE') {
      rows = rows.filter(row => row.id !== String(url).split('/').pop());
      return response(null);
    }
    return response(rows);
  });
});
afterEach(() => {
  setRuntimeAccountSyncAccount(null);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('migrateLegacyDdays deletion safety', () => {
  it('preserves the normal legacy row instead of treating in-memory creation as durable migration', async () => {
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
    const originals = structuredClone(rows);
    const savedNotes = structuredClone(notes);
    const onMigrated = vi.fn();
    expect(await migrateLegacyDdays(onMigrated)).toBe(0);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/schedules/ddays'));
    expect(rows).toEqual(originals);
    expect(notes).toEqual(savedNotes);
    expect(onMigrated).not.toHaveBeenCalled();
    expectNoUnprovenEffects();
    expect(storage.has(KEY)).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('replacement_durability_unverified'));
  });

  it.each(['creation throws', 'update throws', 'persistence rejects', 'persistence stays pending'])(
    'never enters an unacknowledged writer when %s', async failure => {
      if (failure === 'creation throws') createNote.mockImplementation(() => { throw new Error('create failed'); });
      if (failure === 'update throws') updateNote.mockImplementation(() => { throw new Error('update failed'); });
      if (failure === 'persistence rejects') syncNoteToDB.mockRejectedValue(new Error('save rejected'));
      if (failure === 'persistence stays pending') syncNoteToDB.mockReturnValue(deferred<boolean>().promise);
      const originals = structuredClone(rows);
      expect(await migrateLegacyDdays()).toBe(0);
      expect(rows).toEqual(originals);
      expectNoUnprovenEffects();
      expect(storage.has(KEY)).toBe(false);
    },
  );

  it('does not treat a matching memory-only Event Note or generic sync success as per-record proof', async () => {
    notes.push(applyEventToNote(note('memory-only'), { title: rows[0].text, eventDate: rows[0].date }));
    const before = structuredClone(notes);
    const originals = structuredClone(rows);
    expect(await migrateLegacyDdays()).toBe(0);
    expect(notes).toEqual(before);
    expect(rows).toEqual(originals);
    expectNoUnprovenEffects();
  });

  it('preserves all rows across retries when a previous interrupted attempt left only some matching Notes', async () => {
    rows.push({ id: 'sch-2', text: 'Second exam', date: '2026-12-01' });
    notes.push(applyEventToNote(note('earlier-attempt'), { title: rows[0].text, eventDate: rows[0].date }));
    const originals = structuredClone(rows);
    const before = structuredClone(notes);
    const onMigrated = vi.fn();
    expect(await migrateLegacyDdays(onMigrated)).toBe(0);
    expect(await migrateLegacyDdays(onMigrated)).toBe(0);
    expect(rows).toEqual(originals);
    expect(notes).toEqual(before);
    expect(onMigrated).not.toHaveBeenCalled();
    expectNoUnprovenEffects();
  });

  it('cannot continue old-account destructive work after a pending read resolves across an account switch', async () => {
    const pending = deferred<Response>();
    const originals = structuredClone(rows);
    const before = structuredClone(notes);
    const onMigrated = vi.fn();
    mockFetch.mockReturnValueOnce(pending.promise);
    const run = migrateLegacyDdays(onMigrated);
    setRuntimeAccountSyncAccount('account-b');
    pending.resolve(response(originals));
    expect(await run).toBe(0);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(rows).toEqual(originals);
    expect(notes).toEqual(before);
    expect(onMigrated).not.toHaveBeenCalled();
    expectNoUnprovenEffects();
  });

  it('never attempts DELETE or completion when the legacy DELETE endpoint would reject', async () => {
    mockFetch.mockImplementation(async (_url, options) => response(
      options?.method === 'DELETE' ? null : rows, options?.method !== 'DELETE',
    ));
    const onMigrated = vi.fn();
    expect(await migrateLegacyDdays(onMigrated)).toBe(0);
    expect(onMigrated).not.toHaveBeenCalled();
    expectNoUnprovenEffects();
    expect(storage.has(KEY)).toBe(false);
  });

  it('remains retryable after an interrupted read without duplicate Notes or a done flag', async () => {
    mockFetch.mockRejectedValueOnce(new Error('interrupted read'));
    const originals = structuredClone(rows);
    const before = structuredClone(notes);
    expect(await migrateLegacyDdays()).toBe(0);
    expect(await migrateLegacyDdays()).toBe(0);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(rows).toEqual(originals);
    expect(notes).toEqual(before);
    expectNoUnprovenEffects();
  });

  it('does not trust the old global completion flag as durable per-record proof', async () => {
    storage.set(KEY, 'done');
    expect(await migrateLegacyDdays()).toBe(0);
    expect(mockFetch).toHaveBeenCalledOnce();
    expectNoUnprovenEffects();
    // Leave historical storage untouched, but no longer read this flag as authority.
    expect(storage.get(KEY)).toBe('done');
  });

  it('returns zero for an empty successful read without writing a global completion flag', async () => {
    rows = [];
    expect(await migrateLegacyDdays()).toBe(0);
    expectNoUnprovenEffects();
    expect(storage.has(KEY)).toBe(false);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('does not mark a failed legacy read complete', async () => {
    mockFetch.mockResolvedValueOnce(response(null, false));
    expect(await migrateLegacyDdays()).toBe(0);
    expectNoUnprovenEffects();
    expect(storage.has(KEY)).toBe(false);
  });

  it.each([null, {}, 'malformed rows'])('does not mark an unverified response complete: %j', async value => {
    mockFetch.mockResolvedValueOnce(response(value));
    expect(await migrateLegacyDdays()).toBe(0);
    expectNoUnprovenEffects();
    expect(storage.has(KEY)).toBe(false);
  });

  it('does not let Notes local mode suppress the read-only remote D-Day boundary', async () => {
    rows = [];
    expect(await migrateLegacyDdays()).toBe(0);
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/schedules/ddays'));
    expectNoUnprovenEffects();
  });

  it.each(['signed out', 'disabled', 'offline'])('does not read or write when the remote boundary is %s', async state => {
    if (state === 'signed out') setRuntimeAccountSyncAccount(null);
    if (state === 'disabled') vi.stubEnv('VITE_ABSINTHE_ACCOUNT_SYNC_DISABLED', 'true');
    if (state === 'offline') vi.stubGlobal('navigator', { onLine: false });
    expect(await migrateLegacyDdays()).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
    expectNoUnprovenEffects();
  });
});
