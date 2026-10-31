// @vitest-environment happy-dom
import { webcrypto } from 'node:crypto';
import { IDBFactory, IDBObjectStore, IDBDatabase } from 'fake-indexeddb';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import type { NoteBase } from '../components/views/noteUtils';
vi.mock('../lib/supabase', () => ({ authFetch: vi.fn(), authReadFetch: vi.fn() }));
vi.mock('../lib/vaultSnapshotAuto', () => ({ scheduleAutoSnapshot: vi.fn() }));
import { authFetch } from '../lib/supabase';
import { useNotesStore, observePublishedNotesHydration } from './useNotesStore';
import * as authority from '../lib/notesAccountAuthority';
import { resetNotesPersistenceForTests, loadNotesAsync } from '../lib/notePersistence';
import { attachLocalImageToNote } from '../lib/localImageAttachments';
import { LocalAttachmentMetadataRepository } from '../lib/attachmentMetadataIndexedDb';
import { LocalAttachmentBlobAdapter } from '../lib/attachmentBlobIndexedDb';
import { setRecoveryModeActiveForTest } from '../lib/recoverySafetyPolicy';
import { NOTES_RUNTIME_SYNC_MODE_KEY } from '../lib/notesSyncClient';
import { knowledgeIndexService } from '../components/views/features/knowledge';

const original: NoteBase = { id: 'note', title: 'Original', body: 'authored', updatedAt: 1, folderId: null, deletedAt: null };
const other: NoteBase = { ...original, id: 'other', body: 'unrelated' };
const repo = new LocalAttachmentMetadataRepository(), blobs = new LocalAttachmentBlobAdapter();
async function seed(account: string) {
  await useNotesStore.getState().initNotesStorage(account);
  expect(await authority.saveAccountScopedNotes(account, [original, other])).toBe(true);
  await useNotesStore.getState().initNotesStorage(account);
  useNotesStore.getState().setActiveNoteId('note');
  await authority.runAccountScopedNotesMutation(account, async () => {});
}
async function staged(id = 'att-1') {
  const note = useNotesStore.getState().notes.find(item => item.id === 'note')!;
  const observation = observePublishedNotesHydration();
  if (observation.status !== 'CURRENT') throw new Error('fixture_not_published');
  const attachment = await attachLocalImageToNote({ accountId: 'A', noteId: note.id, currentBody: note.body,
    file: new File(['original-bytes'], 'scan.png', { type: 'image/png' }), idFactory: () => id });
  return { note, request: observation.request, attachment,
    run: () => useNotesStore.getState().persistAttachmentReferences(observation.request, note, [attachment]) };
}
function gateLock() {
  let release!: () => void, reached!: () => void;
  const wait = new Promise<void>(yes => { release = yes; }), ready = new Promise<void>(yes => { reached = yes; });
  const delegate = navigator.locks.request.bind(navigator.locks); let first = true;
  vi.spyOn(navigator.locks, 'request').mockImplementation((async (...args: any[]) => {
    if (first) { first = false; reached(); await wait; }
    return (delegate as any)(...args);
  }) as any);
  return { ready, release };
}
async function readRaw() {
  return new Promise<NoteBase[]>((resolve, reject) => {
    const opened = indexedDB.open(authority.NOTES_ACCOUNT_AUTHORITY_DATABASE_NAME, 1);
    opened.onerror = () => reject(opened.error);
    opened.onsuccess = () => {
      const db = opened.result, tx = db.transaction('notes', 'readonly'), read = tx.objectStore('notes').getAll();
      tx.oncomplete = () => { db.close(); resolve(read.result.filter(item => item.accountId === 'A').map(item => item.note)); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  });
}
beforeEach(async () => {
  useNotesStore.getState().detachNotesStorage(); resetNotesPersistenceForTests();
  vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('crypto', webcrypto);
  localStorage.clear(); localStorage.setItem(NOTES_RUNTIME_SYNC_MODE_KEY, 'local'); setRecoveryModeActiveForTest(false);
  vi.stubEnv('VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION', 'false');
  await seed('B'); await seed('A'); vi.mocked(authFetch).mockClear();
});
afterEach(() => {
  authority.__testOnlyNotesAccountAuthorityHooks!.setReadNotesOverride(null);
  vi.restoreAllMocks(); useNotesStore.getState().detachNotesStorage(); resetNotesPersistenceForTests();
  vi.unstubAllEnvs(); vi.unstubAllGlobals();
});

it('acknowledges only the exact account-scoped Note readback, preserving unrelated Notes and staged originals', async () => {
  const operation = await staged();
  expect(useNotesStore.getState().notes.find(item => item.id === 'note')).toBe(operation.note);
  expect(await operation.run()).toEqual({ status: 'REFERENCE_PERSISTED', write: 'COMMITTED', readback: 'MATCHED' });
  const published = useNotesStore.getState().notes;
  expect(await loadNotesAsync()).toEqual(published);
  expect(published.find(item => item.id === 'note')!.body).toBe('authored\n\nattachment://att-1');
  expect(published.find(item => item.id === 'other')).toEqual(other);
  expect((await repo.listAttachmentsForAccountNote('A', 'note'))[0]).toEqual(operation.attachment.metadata);
  expect(await (await blobs.getBlob('local-image/A/att-1'))!.blob.text()).toBe('original-bytes');
  expect(authFetch).not.toHaveBeenCalled();
  await useNotesStore.getState().initNotesStorage('B');
  expect((await loadNotesAsync()).find(item => item.id === 'note')!.body).toBe('authored');
});

it('persists multiple staged references once each, without mutating staged proposals', async () => {
  const first = await staged('one'), second = await staged('two');
  const result = await useNotesStore.getState().persistAttachmentReferences(first.request, first.note, [first.attachment, second.attachment, first.attachment]);
  expect(result.status).toBe('REFERENCE_PERSISTED');
  expect((await loadNotesAsync()).find(item => item.id === 'note')!.body).toBe('authored\n\nattachment://one\n\nattachment://two');
  expect(first.attachment.body).toBe('authored\n\nattachment://one');
});

it.each(['authored \n  ', 'attachment://att-10'])('verifies the exact reference while preserving the original %j body', async body => {
  useNotesStore.getState().updateNote('note', { body });
  await authority.runAccountScopedNotesMutation('A', async () => {});
  const operation = await staged();
  expect((await operation.run()).status).toBe('REFERENCE_PERSISTED');
  expect((await loadNotesAsync()).find(item => item.id === 'note')!.body).toBe(`${body}\n\nattachment://att-1`);
});

it.each(['ABA', 'deleted', 'replacement', 'body', 'unavailable', 'selection', 'isolation'] as const)('denies %s before any Notes mutation', async kind => {
  const operation = await staged();
  if (kind === 'ABA') { await useNotesStore.getState().initNotesStorage('B'); await useNotesStore.getState().initNotesStorage('A'); }
  if (kind === 'deleted') useNotesStore.setState({ notes: [{ ...operation.note, deletedAt: 2 }, other] });
  if (kind === 'replacement') useNotesStore.setState({ notes: [{ ...operation.note }, other] });
  if (kind === 'body') useNotesStore.getState().updateNote('note', { body: 'newer' });
  if (kind === 'unavailable') useNotesStore.setState({ notes: [...useNotesStore.getState().notes] });
  if (kind === 'selection') useNotesStore.getState().setActiveNoteId('other');
  if (kind === 'isolation') vi.stubEnv('VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION', 'true');
  const put = vi.spyOn(IDBObjectStore.prototype, 'put');
  expect((await operation.run()).status).toBe('DENIED');
  expect(put).not.toHaveBeenCalled();
});

it.each(['same-note-edit', 'other-note-edit', 'ABA'] as const)('does not overwrite %s while waiting for the existing lock', async kind => {
  const operation = await staged(), gate = gateLock(); const pending = operation.run();
  await gate.ready;
  if (kind === 'ABA') { authority.activateNotesAccountAuthority('B'); authority.activateNotesAccountAuthority('A'); }
  else useNotesStore.getState().updateNote(kind === 'same-note-edit' ? 'note' : 'other', { body: 'newer ordinary edit' });
  gate.release();
  expect((await pending).status).not.toBe('REFERENCE_PERSISTED');
  await authority.runAccountScopedNotesMutation('A', async () => {});
  if (kind !== 'ABA') expect((await loadNotesAsync()).find(item => item.id === (kind === 'same-note-edit' ? 'note' : 'other'))!.body).toBe('newer ordinary edit');
});

it('compares inside the write transaction and refuses a newer durable revision from another writer', async () => {
  const operation = await staged();
  await authority.saveAccountScopedNotes('A', [{ ...operation.note, body: 'newer durable', updatedAt: 5 }, other]);
  const result = await operation.run();
  expect(result).toMatchObject({ status: 'INCOMPLETE', write: 'ABORTED' });
  expect((await loadNotesAsync()).find(item => item.id === 'note')!.body).toBe('newer durable');
  expect(useNotesStore.getState().notes.find(item => item.id === 'note')).toBe(operation.note);
});

it('revalidates currentness in the asynchronous getAll success callback before put', async () => {
  const operation = await staged(); const get = IDBObjectStore.prototype.getAll;
  vi.spyOn(IDBObjectStore.prototype, 'getAll').mockImplementation(function (...args) {
    const read = get.apply(this, args);
    if (this.name === 'notes' && this.transaction.mode === 'readwrite') read.addEventListener('success', () => {
      authority.activateNotesAccountAuthority('B'); authority.activateNotesAccountAuthority('A');
    });
    return read;
  });
  const put = vi.spyOn(IDBObjectStore.prototype, 'put');
  expect(await operation.run()).toMatchObject({ status: 'INCOMPLETE', write: 'ABORTED' });
  expect(put).not.toHaveBeenCalled();
});

it.each(['mismatch', 'unavailable', 'newer-write', 'replacement', 'ABA'] as const)('retains COMMITTED evidence without false success on readback %s', async kind => {
  const operation = await staged();
  authority.__testOnlyNotesAccountAuthorityHooks!.setReadNotesOverride(async () => {
    if (kind === 'unavailable') throw new Error('readback unavailable');
    const records = await readRaw();
    if (kind === 'mismatch') return { kind: 'valid', records: [original, other] };
    if (kind === 'newer-write') useNotesStore.getState().updateNote('note', { body: 'newer' });
    if (kind === 'replacement') useNotesStore.setState({ notes: [{ ...operation.note }, other] });
    if (kind === 'ABA') { authority.activateNotesAccountAuthority('B'); authority.activateNotesAccountAuthority('A'); }
    return { kind: 'valid', records };
  });
  const result = await operation.run();
  expect(result.status).toBe(kind === 'unavailable' ? 'INDETERMINATE' : 'INCOMPLETE');
  expect(result.write).toBe('COMMITTED');
  expect(result.readback).toBe(kind === 'unavailable' ? 'UNAVAILABLE' : kind === 'mismatch' ? 'MISMATCH' : 'MATCHED');
  expect((await repo.listAttachmentsForAccountNote('A', 'note')).length).toBe(1);
  expect(await blobs.getBlob('local-image/A/att-1')).not.toBeNull();
  authority.__testOnlyNotesAccountAuthorityHooks!.setReadNotesOverride(null);
  await authority.runAccountScopedNotesMutation('A', async () => {});
  if (kind === 'newer-write') expect((await loadNotesAsync()).find(item => item.id === 'note')!.body).toBe('newer');
  else expect(useNotesStore.getState().notes.find(item => item.id === 'note')!.body).toBe('authored');
});

it.each(['open', 'lock', 'transaction', 'abort'] as const)('reports %s failure without publishing an unpersisted body', async kind => {
  const operation = await staged();
  if (kind === 'open') vi.spyOn(indexedDB, 'open').mockImplementation(() => { throw new Error('denied'); });
  if (kind === 'lock') vi.spyOn(navigator.locks, 'request').mockRejectedValue(new Error('denied'));
  if (kind === 'transaction') {
    const transaction = IDBDatabase.prototype.transaction;
    vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (stores, mode, options) {
      if (stores === 'notes' && mode === 'readwrite') throw new Error('denied');
      return transaction.call(this, stores, mode, options);
    });
  }
  if (kind === 'abort') {
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (...args) { const req = put.apply(this, args); this.transaction.abort(); return req; });
  }
  expect(await operation.run()).toMatchObject({ status: kind === 'abort' ? 'INCOMPLETE' : 'NOT_STARTED', write: kind === 'abort' ? 'ABORTED' : 'NOT_STARTED' });
  expect(useNotesStore.getState().notes.find(item => item.id === 'note')).toBe(operation.note);
});

it('does not report success for an error-signalled transaction even if it completes', async () => {
  const operation = await staged(), put = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (...args) {
    const request = put.apply(this, args);
    // Simulate an observed error with default abort prevented, then a real terminal completion.
    this.transaction.onerror?.call(this.transaction, new Event('error'));
    return request;
  });
  expect(await operation.run()).toMatchObject({ status: 'INDETERMINATE', write: 'INDETERMINATE' });
  expect(useNotesStore.getState().notes.find(item => item.id === 'note')).toBe(operation.note);
});

it('does not let reentrant ordinary editing be replaced or receive a false acknowledgement', async () => {
  const operation = await staged(); let edited = false;
  const unsubscribe = useNotesStore.subscribe(state => {
    if (!edited && state.notes.find(item => item.id === 'note')!.body.includes('attachment://')) {
      edited = true; state.updateNote('note', { body: 'subscriber edit' });
    }
  });
  try { expect((await operation.run()).status).toBe('INCOMPLETE'); } finally { unsubscribe(); }
  await authority.runAccountScopedNotesMutation('A', async () => {});
  expect((await loadNotesAsync()).find(item => item.id === 'note')!.body).toBe('subscriber edit');
});

it('updates the local index and retires only the superseded target body-index timer, without remote sync', async () => {
  useNotesStore.getState().updateNote('note', { body: 'ordinary edit before attachment' });
  await authority.runAccountScopedNotesMutation('A', async () => {});
  const operation = await staged(), version = useNotesStore.getState().indexContentVersion;
  const update = vi.spyOn(knowledgeIndexService, 'updateNote');
  expect((await operation.run()).status).toBe('REFERENCE_PERSISTED');
  const latest = useNotesStore.getState().notes.find(item => item.id === 'note')!;
  expect(update).toHaveBeenCalledExactlyOnceWith(latest);
  expect(useNotesStore.getState().indexContentVersion).toBe(version + 1);
  useNotesStore.getState().flushPendingSync();
  expect(update).toHaveBeenCalledExactlyOnceWith(latest);
  expect(authFetch).not.toHaveBeenCalled();
});

it('rejects a newer edit triggered by the index notification without replacing it', async () => {
  const operation = await staged(), version = useNotesStore.getState().indexContentVersion;
  let edited = false;
  const unsubscribe = useNotesStore.subscribe(state => {
    if (!edited && state.indexContentVersion > version) { edited = true; state.updateNote('note', { body: 'index subscriber edit' }); }
  });
  try { expect((await operation.run()).status).toBe('INCOMPLETE'); } finally { unsubscribe(); }
  await authority.runAccountScopedNotesMutation('A', async () => {});
  expect((await loadNotesAsync()).find(item => item.id === 'note')!.body).toBe('index subscriber edit');
});
