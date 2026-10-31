// @vitest-environment happy-dom
import { webcrypto, createHash } from 'node:crypto';
import { IDBFactory, IDBObjectStore, IDBDatabase } from 'fake-indexeddb';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { NOTES_CORE_DOMAIN, NOTES_FOLDERS_DOMAIN, activateNotesAccountAuthority, type NotesAuthorityRequest } from './notesAccountAuthority';
import type { NotesPersistenceInitResult } from './notePersistence';
const persistence = vi.hoisted(() => ({ initialize: vi.fn() }));
vi.mock('./notePersistence', async original => ({ ...await original<typeof import('./notePersistence')>(), initNotesPersistence: persistence.initialize }));
vi.mock('./supabase', () => ({ authFetch: vi.fn(), authReadFetch: vi.fn() }));
vi.mock('./vaultSnapshotAuto', () => ({ scheduleAutoSnapshot: vi.fn() }));
import { useNotesStore, observePublishedNotesHydration } from '../store/useNotesStore';
import { resetNotesPersistenceForTests } from './notePersistence';
import { setRecoveryModeActiveForTest } from './recoverySafetyPolicy';
import { NOTES_RUNTIME_SYNC_MODE_KEY } from './notesSyncClient';
import { LocalAttachmentBlobAdapter } from './attachmentBlobIndexedDb';
import { LocalAttachmentMetadataRepository } from './attachmentMetadataIndexedDb';
import { attachLocalImageToNote, LocalImageAttachmentWriteError } from './localImageAttachments';

const repo = new LocalAttachmentMetadataRepository(), blobs = new LocalAttachmentBlobAdapter();
function hydrated(accountId: string, request: NotesAuthorityRequest): NotesPersistenceInitResult {
  const notes = [{ id: 'note', title: 'Note', body: 'authored', updatedAt: 1, folderId: null, deletedAt: null }];
  const domain = (domainId: typeof NOTES_CORE_DOMAIN | typeof NOTES_FOLDERS_DOMAIN, count: number) => ({
    accountId, domainId, schemaVersion: 1, state: count ? 'LOADED_POPULATED' as const : 'LOADED_EMPTY' as const,
    recordCount: count, verifiedAt: 1, legacyGlobalDataPresent: false,
  });
  return { notes, mode: 'accountScoped', accountId, requestGeneration: request.generation, migrated: false, migrationMs: 0, loadMs: 0,
    notesAuthorityState: domain(NOTES_CORE_DOMAIN, 1), foldersAuthorityState: domain(NOTES_FOLDERS_DOMAIN, 0) };
}
async function publish(account: string) {
  await useNotesStore.getState().initNotesStorage(account);
  expect(observePublishedNotesHydration().status).toBe('CURRENT');
  useNotesStore.getState().setActiveNoteId('note');
}
function input(id = 'att-1', content = 'original-bytes') {
  return { accountId: 'A', noteId: 'note', currentBody: 'authored', file: new File([content], ' scan.png', { type: 'image/png' }),
    repository: repo, blobAdapter: blobs, idFactory: () => id };
}
async function failure(work: Promise<unknown>) {
  const result = await work.catch(error => error);
  expect(result).toBeInstanceOf(LocalImageAttachmentWriteError);
  return (result as LocalImageAttachmentWriteError).lifecycle;
}
beforeEach(async () => {
  useNotesStore.getState().detachNotesStorage(); resetNotesPersistenceForTests(); setRecoveryModeActiveForTest(false);
  localStorage.clear(); localStorage.setItem(NOTES_RUNTIME_SYNC_MODE_KEY, 'local');
  vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('crypto', webcrypto);
  vi.stubEnv('VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION', 'false');
  persistence.initialize.mockImplementation(async (account: string, request: NotesAuthorityRequest) => hydrated(account, request));
  await publish('A');
});
afterEach(() => { useNotesStore.getState().detachNotesStorage(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('commits both real IDB stages without publishing a Note; preserves original bytes, name and checksum', async () => {
  const note = useNotesStore.getState().notes[0];
  const result = await attachLocalImageToNote(input());
  expect(result.status).toBe('STAGED'); expect(result.isCurrent()).toBe(true);
  expect(result.reference).toBe('attachment://att-1'); expect(result.body).toBe('authored\n\nattachment://att-1');
  const metadata = await repo.listAttachmentsForAccountNote('A', 'note');
  expect(metadata).toEqual([result.metadata]); expect(metadata[0].fileName).toBe(' scan.png');
  expect(await repo.listAttachmentsForAccountNote('B', 'note')).toEqual([]);
  expect(await blobs.getBlob('local-image/B/att-1')).toBeNull();
  const blob = await blobs.getBlob('local-image/A/att-1');
  expect(await blob!.blob.text()).toBe('original-bytes');
  expect(blob!.checksum).toBe(`sha256:${createHash('sha256').update('original-bytes').digest('hex')}`);
  expect(blob!.mimeType).toBe('image/png'); expect(blob!.size).toBe(input().file.size);
  expect(useNotesStore.getState().notes[0]).toBe(note); expect(note.body).toBe('authored');
});

it.each(['account', 'note', 'body', 'publication', 'active-note'])('denies invalid %s binding before writes', async kind => {
  const operation = input();
  if (kind === 'account') operation.accountId = 'B';
  if (kind === 'note') operation.noteId = 'other';
  if (kind === 'body') operation.currentBody = 'stale body';
  if (kind === 'publication') useNotesStore.setState({ notes: [...useNotesStore.getState().notes] });
  if (kind === 'active-note') useNotesStore.getState().setActiveNoteId(null);
  const open = vi.spyOn(indexedDB, 'open');
  expect(await failure(attachLocalImageToNote(operation))).toEqual({ blob: 'DENIED', metadata: 'NOT_STARTED' });
  expect(open).not.toHaveBeenCalled();
});

it.each(['checksum', 'digest', 'blob-bytes', 'blob-open', 'metadata-open', 'blob-commit', 'metadata-commit'])('fences A/B/A at %s without reattribution or cleanup', async stage => {
  const operation = input(); let reads = 0;
  const arrayBuffer = operation.file.arrayBuffer.bind(operation.file);
  vi.spyOn(operation.file, 'arrayBuffer').mockImplementation(async () => {
    reads++;
    if (stage === 'checksum' && reads === 1) { await publish('B'); await publish('A'); }
    return arrayBuffer();
  });
  if (stage === 'digest') {
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    vi.spyOn(crypto.subtle, 'digest').mockImplementation(async (...args) => { const result = await digest(...args); await publish('B'); await publish('A'); return result; });
  }
  if (stage === 'blob-bytes') {
    const create = blobs.createBlobForAccountNote.bind(blobs);
    vi.spyOn(blobs, 'createBlobForAccountNote').mockImplementation((context, write) => {
      const read = write.blob.arrayBuffer.bind(write.blob);
      vi.spyOn(write.blob, 'arrayBuffer').mockImplementation(async () => { await publish('B'); await publish('A'); return read(); });
      return create(context, write);
    });
  }
  if (stage === 'blob-open' || stage === 'metadata-open') {
    const open = indexedDB.open.bind(indexedDB);
    vi.spyOn(indexedDB, 'open').mockImplementation((...args) => {
      const request = open(...args);
      if (String(args[0]).includes(stage === 'blob-open' ? '.blobs' : '.metadata')) request.addEventListener('success', () => {
        activateNotesAccountAuthority('B'); activateNotesAccountAuthority('A');
      });
      return request;
    });
  }
  if (stage === 'blob-commit') {
    const create = blobs.createBlobForAccountNote.bind(blobs);
    vi.spyOn(blobs, 'createBlobForAccountNote').mockImplementation(async (...args) => { const result = await create(...args); await publish('B'); await publish('A'); return result; });
  }
  if (stage === 'metadata-commit') {
    const create = repo.createAttachmentForAccountNote.bind(repo);
    vi.spyOn(repo, 'createAttachmentForAccountNote').mockImplementation(async (...args) => { const result = await create(...args); await publish('B'); await publish('A'); return result; });
  }
  const removeBlob = vi.spyOn(blobs, 'deleteBlob'), removeMetadata = vi.spyOn(repo, 'deleteAttachmentMetadata');
  const result = await failure(attachLocalImageToNote(operation));
  expect(result.blob).toBe(['checksum', 'digest', 'blob-bytes', 'blob-open'].includes(stage) ? 'DENIED' : 'COMMITTED');
  expect(result.metadata).toBe(stage === 'metadata-commit' ? 'COMMITTED' : result.blob === 'COMMITTED' ? 'DENIED' : 'NOT_STARTED');
  expect(removeBlob).not.toHaveBeenCalled(); expect(removeMetadata).not.toHaveBeenCalled();
  expect(await repo.listAttachmentsForAccountNote('B', 'note')).toEqual([]);
  expect(useNotesStore.getState().notes[0].body).toBe('authored');
});

it.each(['delete', 'replace', 'active'])('blocks metadata after Note %s during blob commit', async change => {
  const create = blobs.createBlobForAccountNote.bind(blobs);
  vi.spyOn(blobs, 'createBlobForAccountNote').mockImplementation(async (...args) => {
    const status = await create(...args);
    const note = useNotesStore.getState().notes[0];
    if (change === 'delete') note.deletedAt = 10;
    if (change === 'replace') useNotesStore.setState({ notes: [{ ...note }] });
    if (change === 'active') useNotesStore.getState().setActiveNoteId(null);
    return status;
  });
  expect(await failure(attachLocalImageToNote(input()))).toEqual({ blob: 'COMMITTED', metadata: 'DENIED' });
  expect(await blobs.hasBlob('local-image/A/att-1')).toBe(true); expect(await repo.getAttachment('att-1')).toBeNull();
});

it('uses atomic add to reject concurrent same-ID writes without overwriting bytes', async () => {
  const outcomes = await Promise.allSettled([attachLocalImageToNote(input('collision', 'first')), attachLocalImageToNote(input('collision', 'second'))]);
  expect(outcomes.filter(row => row.status === 'fulfilled')).toHaveLength(1);
  const rejected = outcomes.find(row => row.status === 'rejected') as PromiseRejectedResult;
  expect(rejected.reason.lifecycle).toEqual({ blob: 'CONFLICT', metadata: 'NOT_STARTED' });
  const success = outcomes.find(row => row.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof attachLocalImageToNote>>>;
  const stored = await blobs.getBlob('local-image/A/collision');
  expect(stored!.checksum).toBe(success.value.metadata.checksum);
});

it.each(['blob', 'metadata'])('reports an actual %s transaction abort and preserves any earlier stage', async stage => {
  const add = IDBObjectStore.prototype.add;
  vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function(this: IDBObjectStore, ...args) {
    if (this.name === (stage === 'blob' ? 'blobs' : 'metadata')) throw new DOMException('clone failure', 'DataCloneError');
    return add.apply(this, args);
  });
  expect(await failure(attachLocalImageToNote(input()))).toEqual(stage === 'blob'
    ? { blob: 'ABORTED', metadata: 'NOT_STARTED' } : { blob: 'COMMITTED', metadata: 'ABORTED' });
});

it('retains both records when a later adapter reply is uncertain instead of claiming durable publication', async () => {
  const create = repo.createAttachmentForAccountNote.bind(repo);
  vi.spyOn(repo, 'createAttachmentForAccountNote').mockImplementation(async (...args) => { await create(...args); throw new Error('reply lost'); });
  expect(await failure(attachLocalImageToNote(input()))).toEqual({ blob: 'COMMITTED', metadata: 'INDETERMINATE' });
  expect(await blobs.hasBlob('local-image/A/att-1')).toBe(true); expect(await repo.getAttachment('att-1')).not.toBeNull();
  expect(useNotesStore.getState().notes[0].body).toBe('authored');
});

it('preserves an existing foreign-account metadata ID and reports the orphaned committed blob', async () => {
  const seeded = { id: 'att-1', accountId: 'B', noteId: 'note', fileName: 'foreign.png', mimeType: 'image/png', size: 1,
    localBlobKey: 'local-image/B/att-1', source: 'local' as const, createdAt: '2026-01-01', updatedAt: '2026-01-01', deletedAt: null };
  await repo.putAttachment(seeded);
  expect(await failure(attachLocalImageToNote(input()))).toEqual({ blob: 'COMMITTED', metadata: 'CONFLICT' });
  expect(await repo.getAttachment('att-1')).toEqual({ ...seeded, syncStatus: 'local' });
  expect(await repo.listAttachmentsForAccountNote('A', 'note')).toEqual([]);
  expect(await blobs.hasBlob('local-image/A/att-1')).toBe(true);
});

it('fails closed if transaction creation is unavailable', async () => {
  const transaction = IDBDatabase.prototype.transaction;
  vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function(this: IDBDatabase, ...args) {
    if (args[0] === 'blobs' && args[1] === 'readwrite') throw new Error('unavailable');
    return transaction.apply(this, args);
  });
  expect(await failure(attachLocalImageToNote(input()))).toEqual({ blob: 'NOT_STARTED', metadata: 'NOT_STARTED' });
});

it('does not interpret a completed transaction with a prevented request error as a committed blob', async () => {
  await attachLocalImageToNote(input());
  const add = IDBObjectStore.prototype.add;
  vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function(this: IDBObjectStore, ...args) {
    const request = add.apply(this, args);
    request.addEventListener('error', event => event.preventDefault());
    return request;
  });
  expect(await failure(attachLocalImageToNote(input()))).toEqual({ blob: 'INDETERMINATE', metadata: 'NOT_STARTED' });
  expect(await (await blobs.getBlob('local-image/A/att-1'))!.blob.text()).toBe('original-bytes');
});

it('snapshots inputs and bytes once, and invalidates staged proposals after A/B/A', async () => {
  const operation = input(); const read = vi.spyOn(operation.file, 'arrayBuffer');
  const pending = attachLocalImageToNote(operation);
  operation.accountId = 'B'; operation.noteId = 'other'; operation.currentBody = 'foreign';
  const result = await pending;
  expect(read).toHaveBeenCalledTimes(1);
  expect(result.metadata).toMatchObject({ accountId: 'A', noteId: 'note' });
  await publish('B'); await publish('A'); expect(result.isCurrent()).toBe(false);
  expect(useNotesStore.getState().notes[0].body).toBe('authored');
});

it('rejects a copied low-level authority request even with a permissive predicate', async () => {
  const observation = observePublishedNotesHydration(); if (observation.status !== 'CURRENT') throw new Error('fixture');
  const context = { accountId: 'A', noteId: 'note', attachmentId: 'att-1', request: { ...observation.request }, isCurrent: () => true };
  const open = vi.spyOn(indexedDB, 'open');
  expect(await blobs.createBlobForAccountNote(context, { key: 'local-image/A/att-1', blob: input().file })).toBe('DENIED');
  expect(open).not.toHaveBeenCalled();
});
