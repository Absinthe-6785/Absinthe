import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NOTES_ACCOUNT_AUTHORITY_DATABASE_NAME, __testOnlyNotesAccountAuthorityHooks as hooks,
  activateNotesAccountAuthority, detachNotesAccountAuthority, initializeAccountScopedNotesAuthority,
  observeAccountScopedNotesReadback, receiveAccountScopedNote, runAccountScopedNotesMutation,
  saveAccountScopedNotes, saveAccountScopedFolders, saveAccountScopedActiveNoteId,
  getNotesSingleDeleteMarkerNoteIds,
  type NotesSingleReceiveInput,
} from './notesAccountAuthority';
import { useNotesStore } from '../store/useNotesStore';
import type { NoteBase } from '../components/views/noteUtils';
import { captureOperationEpoch } from './recoverySafetyPolicy';

const storage = new Map<string, string>();
const fetchSpy = vi.fn(() => { throw new Error('network prohibited in storage proof'); });
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
  key: (index: number) => [...storage.keys()][index] ?? null,
  get length() { return storage.size; },
});
vi.stubGlobal('fetch', fetchSpy);
const candidate = (id = 'cloud-exact-id'): NoteBase => ({
  id, title: '같은 제목', body: '# 本文\r\nexact 🧪  ', updatedAt: 7,
  deletedAt: null, folderId: null, starred: false, properties: {}, relations: {},
});
function deleteDb() {
  return new Promise<void>((resolve, reject) => {
    const r = indexedDB.deleteDatabase(NOTES_ACCOUNT_AUTHORITY_DATABASE_NAME);
    r.onsuccess = () => resolve(); r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('test database blocked'));
  });
}
async function rawPut(value: unknown) {
  await new Promise<void>((resolve, reject) => {
    const r = indexedDB.open(NOTES_ACCOUNT_AUTHORITY_DATABASE_NAME, 1);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const db = r.result, tx = db.transaction('notes', 'readwrite');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
      tx.objectStore('notes').put(value);
    };
  });
}
async function context(accountId = 'A'): Promise<NotesSingleReceiveInput> {
  const request = activateNotesAccountAuthority(accountId);
  await initializeAccountScopedNotesAuthority(accountId, request);
  return { accountId, request, note: candidate(), isCurrent: () => true };
}
const proof = (input: NotesSingleReceiveInput) => {
  if (!hooks) throw new Error('test-only primitive unavailable');
  return hooks.insertSingleNoteStorageForProof(input);
};
async function notes(input: NotesSingleReceiveInput) {
  const read = await observeAccountScopedNotesReadback(input.request);
  if (read.status !== 'CURRENT') throw new Error('test readback unavailable');
  return read.notes;
}
beforeEach(async () => {
  detachNotesAccountAuthority(); hooks?.setReadNotesOverride(null);
  storage.clear(); fetchSpy.mockClear(); await deleteDb();
});
afterEach(async () => {
  vi.restoreAllMocks(); detachNotesAccountAuthority(); hooks?.setReadNotesOverride(null);
  storage.clear(); await deleteDb();
});

describe('production receive admission stays closed (not a retirement certificate)', () => {
  it('denies even a complete absent ID without touching IndexedDB or runtime', async () => {
    const input = await context();
    const runtime = useNotesStore.getState(), before = new Map(storage);
    const open = vi.spyOn(indexedDB, 'open'), add = vi.spyOn(IDBObjectStore.prototype, 'add');
    expect(await receiveAccountScopedNote({ ...input, retirementApproved: true } as NotesSingleReceiveInput))
      .toEqual({ status: 'DENIED', write: 'NOT_STARTED', readback: 'NOT_RUN', reason: 'RETIREMENT_UNPROVEN' });
    expect(open).not.toHaveBeenCalled(); expect(add).not.toHaveBeenCalled();
    expect(storage).toEqual(before); expect(useNotesStore.getState()).toBe(runtime);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it('rejects wrong account and stale request without a write', async () => {
    const input = await context();
    expect(await receiveAccountScopedNote({ ...input, accountId: 'B' })).toMatchObject({ status: 'STALE', write: 'NOT_STARTED' });
    activateNotesAccountAuthority('B'); activateNotesAccountAuthority('A');
    expect(await receiveAccountScopedNote(input)).toMatchObject({ status: 'STALE', write: 'NOT_STARTED' });
  });
});

describe('isolated insert-only storage mechanism — test seam ONLY, not real receive admission', () => {
  it('inserts exactly one Note after transaction completion and matching readback, with no replacement or runtime/remote changes', async () => {
    const b = await context('B'); await saveAccountScopedNotes('B', [candidate('B-note')]);
    const input = await context();
    await saveAccountScopedNotes('A', [candidate('unrelated')]);
    await saveAccountScopedFolders([{ id: 'folder', name: 'preserved', createdAt: 1 }]);
    await saveAccountScopedActiveNoteId('unrelated');
    const runtime = useNotesStore.getState(), before = new Map(storage);
    const put = vi.spyOn(IDBObjectStore.prototype, 'put'), remove = vi.spyOn(IDBObjectStore.prototype, 'delete');
    const clear = vi.spyOn(IDBObjectStore.prototype, 'clear');
    const nativeAdd = IDBObjectStore.prototype.add;
    let resolved = false, requestCompletedBeforeResult = false;
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function(value, key) {
      const request = nativeAdd.call(this, value, key);
      request.addEventListener('success', () => { requestCompletedBeforeResult = !resolved; });
      return request;
    });
    const result = await proof(input).then(result => { resolved = true; return result; });
    expect(result).toEqual({ status: 'INSERT_VERIFIED', write: 'COMMITTED', readback: 'MATCHED' });
    expect(requestCompletedBeforeResult).toBe(true);
    expect(await notes(input)).toEqual([candidate(), candidate('unrelated')]);
    expect(put).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled(); expect(clear).not.toHaveBeenCalled();
    expect(storage).toEqual(before); expect(useNotesStore.getState()).toBe(runtime);
    expect(fetchSpy).not.toHaveBeenCalled();
    const nextB = await context('B');
    expect(await notes(nextB)).toEqual([candidate('B-note')]);
    expect(b.request).not.toBe(nextB.request);
  });
  it.each([null, 9])('rejects a durable existing identity (deletedAt=%s), not just an in-memory duplicate', async deletedAt => {
    const input = await context();
    await rawPut({ key: 'A\u0000cloud-exact-id', accountId: 'A', note: { ...candidate(), deletedAt } });
    const add = vi.spyOn(IDBObjectStore.prototype, 'add');
    expect(await proof(input)).toMatchObject({ status: 'CONFLICT', write: 'NOT_STARTED', reason: 'IDENTITY_EXISTS' });
    expect(add).not.toHaveBeenCalled();
    expect((await notes(input))[0].deletedAt).toBe(deletedAt);
  });
  it('serializes concurrent attempts for the same ID: one insert and one conflict', async () => {
    const input = await context();
    const results = await Promise.all([proof(input), proof(input)]);
    expect(results.map(r => r.status)).toEqual(['INSERT_VERIFIED', 'CONFLICT']);
    expect(await notes(input)).toEqual([candidate()]);
  });
  it('observes an existing account writer queued before the insertion, preserving its content', async () => {
    const input = await context();
    let enter!: () => void, release!: () => void;
    const ready = new Promise<void>(r => { enter = r; }), gate = new Promise<void>(r => { release = r; });
    const holder = runAccountScopedNotesMutation('A', async () => { enter(); await gate; });
    await ready;
    const writer = saveAccountScopedNotes('A', [candidate('other-writer')]);
    const insertion = proof(input);
    release(); await holder; expect(await writer).toBe(true);
    expect(await insertion).toMatchObject({ status: 'INSERT_VERIFIED' });
    expect(await notes(input)).toEqual([candidate(), candidate('other-writer')]);
  });
  it('captures candidate bytes before waiting on the lock', async () => {
    const input = await context();
    let release!: () => void, enter!: () => void;
    const ready = new Promise<void>(r => { enter = r; }), gate = new Promise<void>(r => { release = r; });
    const holder = runAccountScopedNotesMutation('A', async () => { enter(); await gate; });
    await ready;
    const pending = proof(input);
    (input.note as NoteBase).body = 'changed by caller';
    release(); await holder;
    expect(await pending).toMatchObject({ status: 'INSERT_VERIFIED' });
    expect((await notes(input))[0].body).toBe(candidate().body);
  });
  it.each(['malformed', 'pending'])('denies %s deletion evidence without creating an identity', async kind => {
    const input = await context();
    storage.set('absinthe.notes.account-authority.single-delete.v1:A:cloud-exact-id', kind === 'malformed' ? '{malformed' : JSON.stringify({
      accountId: 'A', noteId: 'cloud-exact-id', expectedUpdatedAt: 7, expectedDeletedAt: 9,
      requestGeneration: input.request.generation, operationEpoch: captureOperationEpoch(), state: 'REMOTE_DELETE_PENDING', startedAt: 10,
    }));
    if (kind === 'pending') expect(getNotesSingleDeleteMarkerNoteIds('A')).toEqual(['cloud-exact-id']);
    else expect(() => getNotesSingleDeleteMarkerNoteIds('A')).toThrow('notes_single_delete_marker_malformed');
    expect(await proof(input)).toMatchObject({ status: 'DENIED', write: 'NOT_STARTED', reason: 'DELETE_EVIDENCE' });
    expect(await notes(input)).toEqual([]);
  });
  it('denies malformed durable account data', async () => {
    const input = await context();
    await rawPut({ key: 'A\u0000bad', accountId: 'A', note: { id: 'bad' } });
    expect(await proof(input)).toMatchObject({ status: 'DENIED', write: 'NOT_STARTED', reason: 'MALFORMED_DURABLE_NOTES' });
  });
  it.each([
    { folderId: 'missing-folder' }, { properties: { tag: 'value' } }, { relations: { related: ['another'] } },
    { properties: undefined }, { starred: undefined }, { deletedAt: 1 }, { updatedAt: NaN },
    { history: ['unmodeled'] }, { createdAt: undefined }, { id: ' ' },
    { body: '[original](attachment://incomplete)' }, { body: '![image](https://example.invalid/image.png)' },
    { body: '<img src="unknown">' }, { body: 'blob:missing' },
  ])('rejects unsupported metadata or unresolved dependencies %j', async patch => {
    const input = await context();
    const add = vi.spyOn(IDBObjectStore.prototype, 'add');
    expect(await proof({ ...input, note: { ...candidate(), ...patch } })).toMatchObject({ status: 'DENIED', write: 'NOT_STARTED' });
    expect(add).not.toHaveBeenCalled(); expect(await notes(input)).toEqual([]);
  });
  it.each(['wrong-account', 'A-B-A', 'same-account', 'source'])('denies invalid authority before transaction: %s', async kind => {
    const input = await context();
    if (kind === 'wrong-account') (input as { accountId: string }).accountId = 'B';
    if (kind === 'A-B-A') { activateNotesAccountAuthority('B'); activateNotesAccountAuthority('A'); }
    if (kind === 'same-account') activateNotesAccountAuthority('A');
    if (kind === 'source') (input as { isCurrent: () => boolean }).isCurrent = () => false;
    const add = vi.spyOn(IDBObjectStore.prototype, 'add');
    expect(await proof(input)).toMatchObject({ status: 'STALE', write: 'NOT_STARTED' });
    expect(add).not.toHaveBeenCalled();
  });
  it('does not allow a caller to retarget a queued operation to a different account request', async () => {
    const input = await context();
    let release!: () => void, enter!: () => void;
    const ready = new Promise<void>(r => { enter = r; }), gate = new Promise<void>(r => { release = r; });
    const holder = runAccountScopedNotesMutation('A', async () => { enter(); await gate; });
    await ready;
    const pending = proof(input);
    const b = await context('B');
    Object.assign(input, { accountId: b.accountId, request: b.request });
    release(); await holder;
    expect(await pending).toMatchObject({ status: 'STALE', write: 'NOT_STARTED' });
    expect(await notes(b)).toEqual([]);
  });
  it('denies uninitialized local authority without opening a mutation transaction', async () => {
    const request = activateNotesAccountAuthority('A');
    expect(await proof({ accountId: 'A', request, note: candidate(), isCurrent: () => true }))
      .toMatchObject({ status: 'DENIED', write: 'NOT_STARTED', reason: 'LOCAL_AUTHORITY_UNAVAILABLE' });
  });
  it('rechecks source lifetime in the asynchronous transaction callback before add', async () => {
    const input = await context(); let live = true;
    const nativeGetAll = IDBObjectStore.prototype.getAll;
    vi.spyOn(IDBObjectStore.prototype, 'getAll').mockImplementation(function(...args) {
      const request = nativeGetAll.apply(this, args);
      request.addEventListener('success', () => { live = false; });
      return request;
    });
    const add = vi.spyOn(IDBObjectStore.prototype, 'add');
    expect(await proof({ ...input, isCurrent: () => live })).toMatchObject({ status: 'STALE', write: 'NOT_STARTED' });
    expect(add).not.toHaveBeenCalled();
  });
  it('reports actual transaction abort, without an inserted row', async () => {
    const input = await context();
    const nativeAdd = IDBObjectStore.prototype.add;
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function(value, key) {
      const request = nativeAdd.call(this, value, key); this.transaction.abort(); return request;
    });
    expect(await proof(input)).toMatchObject({ status: 'ABORTED', write: 'ABORTED', readback: 'NOT_RUN' });
    expect(await notes(input)).toEqual([]);
  });
  it.each(['throw', 'mismatch'])('never claims success or no-write after committed insert with %s readback', async kind => {
    const input = await context();
    hooks!.setReadNotesOverride(async () => {
      if (kind === 'throw') throw new Error('readback unavailable');
      return { kind: 'valid', records: [{ ...candidate(), body: 'different readback' }] };
    });
    expect(await proof(input)).toMatchObject({
      status: 'INDETERMINATE', write: 'COMMITTED', readback: kind === 'throw' ? 'UNAVAILABLE' : 'MISMATCH',
    });
    hooks!.setReadNotesOverride(null);
    expect(await notes(input)).toEqual([candidate()]); // Never rollback/delete a possible successful insert.
  });
  it('reports stale-after-commit truthfully without rolling back or publishing', async () => {
    const input = await context();
    hooks!.setReadNotesOverride(async () => {
      activateNotesAccountAuthority('B');
      return { kind: 'valid', records: [candidate()] };
    });
    const runtime = useNotesStore.getState();
    expect(await proof(input)).toMatchObject({ status: 'STALE', write: 'COMMITTED', readback: 'MATCHED' });
    expect(useNotesStore.getState()).toBe(runtime);
    hooks!.setReadNotesOverride(null);
    expect(await notes(await context('A'))).toEqual([candidate()]);
  });
  it('fails closed if the existing account lock is unavailable', async () => {
    const input = await context();
    vi.spyOn(navigator.locks, 'request').mockRejectedValueOnce(new Error('lock denied'));
    expect(await proof(input)).toMatchObject({ status: 'NOT_STARTED', write: 'NOT_STARTED' });
    expect(await notes(input)).toEqual([]);
  });
});
