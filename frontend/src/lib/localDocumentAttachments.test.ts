// @vitest-environment happy-dom
import { webcrypto, createHash } from 'node:crypto';
import { IDBFactory, IDBObjectStore, IDBDatabase } from 'fake-indexeddb';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
vi.mock('./supabase', () => ({ authFetch: vi.fn(), authReadFetch: vi.fn() }));
vi.mock('./vaultSnapshotAuto', () => ({ scheduleAutoSnapshot: vi.fn() }));
import { authFetch } from './supabase';
import { useNotesStore, observePublishedNotesHydration } from '../store/useNotesStore';
import * as authority from './notesAccountAuthority';
import { resetNotesPersistenceForTests } from './notePersistence';
import { setRecoveryModeActiveForTest } from './recoverySafetyPolicy';
import { NOTES_RUNTIME_SYNC_MODE_KEY } from './notesSyncClient';
import { LocalAttachmentBlobAdapter } from './attachmentBlobIndexedDb';
import { LocalAttachmentMetadataRepository } from './attachmentMetadataIndexedDb';
import { LocalDocumentAttachmentWriteError } from './localImageAttachments';
import { stageLocalDocumentOriginal, readLocalDocumentOriginal } from './localDocumentAttachments';

const repo = new LocalAttachmentMetadataRepository(), blobs = new LocalAttachmentBlobAdapter();
const original = { id: 'note', title: 'Note', body: 'authored', updatedAt: 1, folderId: null, deletedAt: null };
const docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const bytes = new Uint8Array([0, 255, 13, 10, 128]); // Deliberately not a structurally valid document.
async function seed(account: string) {
  await useNotesStore.getState().initNotesStorage(account);
  expect(await authority.saveAccountScopedNotes(account, [original])).toBe(true);
  await useNotesStore.getState().initNotesStorage(account);
  useNotesStore.getState().setActiveNoteId('note');
  await authority.runAccountScopedNotesMutation(account, async () => {});
}
function input(id = 'att-doc', type = 'application/pdf', name = ' 원본.pdf') {
  const note = useNotesStore.getState().notes[0];
  return { accountId: 'A', noteId: 'note', currentBody: note.body, file: new File([bytes], name, { type }),
    repository: repo, blobAdapter: blobs, idFactory: () => id };
}
function read(staged?: Awaited<ReturnType<typeof stageLocalDocumentOriginal>>) {
  return readLocalDocumentOriginal({ accountId: 'A', noteId: 'note', attachmentId: 'att-doc', staged, repository: repo, blobAdapter: blobs });
}
async function failure(work: Promise<unknown>) {
  const error = await work.catch(e => e);
  expect(error).toBeInstanceOf(LocalDocumentAttachmentWriteError);
  return (error as LocalDocumentAttachmentWriteError).lifecycle;
}
beforeEach(async () => {
  useNotesStore.getState().detachNotesStorage(); resetNotesPersistenceForTests(); setRecoveryModeActiveForTest(false);
  localStorage.clear(); localStorage.setItem(NOTES_RUNTIME_SYNC_MODE_KEY, 'local');
  vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('crypto', webcrypto);
  vi.stubEnv('VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION', 'false');
  await seed('B'); await seed('A'); vi.mocked(authFetch).mockClear();
});
afterEach(() => {
  vi.restoreAllMocks(); useNotesStore.getState().detachNotesStorage(); resetNotesPersistenceForTests();
  vi.unstubAllEnvs(); vi.unstubAllGlobals();
});

it.each([['application/pdf', ' 원본.pdf'], [docx, '日本語.docx']])('stages exact %s originals with create-only stores and verifies original bytes', async (type, name) => {
  const source = input('att-doc', type, name); const originalRead = vi.spyOn(source.file, 'arrayBuffer');
  const staged = await stageLocalDocumentOriginal(source);
  expect(originalRead).toHaveBeenCalledTimes(1);
  expect(staged.metadata).toMatchObject({ accountId: 'A', noteId: 'note', fileName: name, mimeType: type,
    size: bytes.length, localBlobKey: 'local-document/A/att-doc', checksum: `sha256:${createHash('sha256').update(bytes).digest('hex')}` });
  expect(useNotesStore.getState().notes[0].body).toBe('authored');
  expect((await read()).status).toBe('DENIED'); // Staging is not publication.
  const verified = await read(staged);
  expect(verified.status).toBe('VERIFIED');
  if (verified.status !== 'VERIFIED') throw new Error('fixture');
  expect(new Uint8Array(await verified.file.arrayBuffer())).toEqual(bytes);
  expect(verified.file.name).toBe(name); expect(verified.file.type).toBe(type);
  expect(verified.formatIntegrity).toBe('UNVERIFIED');
  expect(await blobs.getBlob('local-image/A/att-doc')).toBeNull();
  expect(authFetch).not.toHaveBeenCalled();
});

it('reuses the exact existing Note reference ACK and requires a current reference for published readback', async () => {
  const note = useNotesStore.getState().notes[0], observation = observePublishedNotesHydration();
  if (observation.status !== 'CURRENT') throw new Error('fixture');
  const staged = await stageLocalDocumentOriginal(input());
  expect(await useNotesStore.getState().persistAttachmentReferences(observation.request, note, [staged]))
    .toEqual({ status: 'REFERENCE_PERSISTED', write: 'COMMITTED', readback: 'MATCHED' });
  expect((await read()).status).toBe('VERIFIED');
  expect((await read(staged)).status).toBe('DENIED'); // Old Note identity is not a reusable permit.
  expect(authFetch).not.toHaveBeenCalled();
});

it.each(['bytes', 'digest', 'blob', 'metadata'])('rejects A/B/A during %s without cleanup', async stage => {
  const operation = input();
  const aba = async () => { await seed('B'); await seed('A'); };
  if (stage === 'bytes') vi.spyOn(operation.file, 'arrayBuffer').mockImplementation(async () => { await aba(); return bytes.slice().buffer; });
  if (stage === 'digest') {
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    vi.spyOn(crypto.subtle, 'digest').mockImplementation(async (...args) => { const result = await digest(...args); await aba(); return result; });
  }
  if (stage === 'blob') {
    const create = blobs.createBlobForAccountNote.bind(blobs);
    vi.spyOn(blobs, 'createBlobForAccountNote').mockImplementation(async (...args) => { const result = await create(...args); await aba(); return result; });
  }
  if (stage === 'metadata') {
    const create = repo.createAttachmentForAccountNote.bind(repo);
    vi.spyOn(repo, 'createAttachmentForAccountNote').mockImplementation(async (...args) => { const result = await create(...args); await aba(); return result; });
  }
  const removeBlob = vi.spyOn(blobs, 'deleteBlob'), removeMetadata = vi.spyOn(repo, 'deleteAttachmentMetadata');
  const outcome = await failure(stageLocalDocumentOriginal(operation));
  expect(outcome.blob).toBe(['bytes', 'digest'].includes(stage) ? 'DENIED' : 'COMMITTED');
  expect(outcome.metadata).toBe(stage === 'metadata' ? 'COMMITTED' : stage === 'blob' ? 'DENIED' : 'NOT_STARTED');
  expect(removeBlob).not.toHaveBeenCalled(); expect(removeMetadata).not.toHaveBeenCalled();
});

it.each(['deleted', 'replaced', 'edited'])('preserves Note %s during staging and denies stale readback', async change => {
  const create = blobs.createBlobForAccountNote.bind(blobs);
  vi.spyOn(blobs, 'createBlobForAccountNote').mockImplementation(async (...args) => {
    const result = await create(...args), note = useNotesStore.getState().notes[0];
    useNotesStore.setState({ notes: [{ ...note, ...(change === 'deleted' ? { deletedAt: 2 } : change === 'edited' ? { body: 'newer user text' } : {}) }] });
    return result;
  });
  expect(await failure(stageLocalDocumentOriginal(input()))).toEqual({ blob: 'COMMITTED', metadata: 'DENIED' });
  expect((await read()).status).toBe('DENIED');
  expect(await blobs.hasBlob('local-document/A/att-doc')).toBe(true);
});

it('rejects concurrent ID collisions without overwriting either original', async () => {
  const outcomes = await Promise.allSettled([stageLocalDocumentOriginal(input()), stageLocalDocumentOriginal(input())]);
  expect(outcomes.filter(item => item.status === 'fulfilled')).toHaveLength(1);
  expect((outcomes.find(item => item.status === 'rejected') as PromiseRejectedResult).reason.lifecycle)
    .toEqual({ blob: 'CONFLICT', metadata: 'NOT_STARTED' });
});

it.each(['blob', 'metadata'])('retains truthful partial outcomes for actual %s abort', async stage => {
  const add = IDBObjectStore.prototype.add;
  vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function(this: IDBObjectStore, ...args) {
    if (this.name === (stage === 'blob' ? 'blobs' : 'metadata')) throw new DOMException('injected', 'DataCloneError');
    return add.apply(this, args);
  });
  expect(await failure(stageLocalDocumentOriginal(input()))).toEqual(stage === 'blob'
    ? { blob: 'ABORTED', metadata: 'NOT_STARTED' } : { blob: 'COMMITTED', metadata: 'ABORTED' });
});

it('reports uncertain metadata replies without deleting committed data', async () => {
  const create = repo.createAttachmentForAccountNote.bind(repo);
  vi.spyOn(repo, 'createAttachmentForAccountNote').mockImplementation(async (...args) => { await create(...args); throw new Error('reply lost'); });
  expect(await failure(stageLocalDocumentOriginal(input()))).toEqual({ blob: 'COMMITTED', metadata: 'INDETERMINATE' });
  expect(await blobs.hasBlob('local-document/A/att-doc')).toBe(true);
  expect(await repo.getAttachment('att-doc')).not.toBeNull();
});

it.each(['account', 'note', 'namespace', 'size', 'mime', 'checksum', 'deleted', 'missing'])('does not disclose originals after metadata %s mismatch', async kind => {
  const staged = await stageLocalDocumentOriginal(input());
  const changes = { account: { accountId: 'B' }, note: { noteId: 'other' }, namespace: { localBlobKey: 'local-image/A/att-doc' },
    size: { size: 100 }, mime: { mimeType: docx }, checksum: { checksum: `sha256:${'0'.repeat(64)}` }, deleted: { deletedAt: 'now' } };
  if (kind === 'missing') await repo.deleteAttachmentMetadata('att-doc');
  else await repo.putAttachment({ ...staged.metadata, ...changes[kind as keyof typeof changes] });
  const result = await read(staged);
  expect(result.status).not.toBe('VERIFIED'); expect(result).not.toHaveProperty('file');
});

it.each(['missing', 'bytes', 'mime', 'size', 'checksum', 'unreadable'])('denies Blob %s corruption', async kind => {
  const staged = await stageLocalDocumentOriginal(input());
  if (kind === 'missing') await blobs.deleteBlob(staged.metadata.localBlobKey!);
  else if (kind === 'unreadable') vi.spyOn(blobs, 'getBlob').mockRejectedValue(new Error('unreadable'));
  else {
    const record = (await blobs.getBlob(staged.metadata.localBlobKey!))!;
    if (kind === 'bytes') await blobs.putBlob({ ...record, blob: new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: record.mimeType }) });
    if (kind === 'mime') await blobs.putBlob({ ...record, blob: new Blob([bytes], { type: docx }), mimeType: docx });
    if (kind === 'checksum') await blobs.putBlob({ ...record, checksum: `sha256:${'0'.repeat(64)}` });
    if (kind === 'size') await blobs.putBlob({ ...record, blob: new Blob(['longer-than-original'], { type: record.mimeType }) });
  }
  expect((await read(staged)).status).not.toBe('VERIFIED');
});

it('revalidates publication and metadata after asynchronous original reads', async () => {
  const staged = await stageLocalDocumentOriginal(input());
  const get = blobs.getBlob.bind(blobs);
  vi.spyOn(blobs, 'getBlob').mockImplementation(async key => { const record = await get(key); await seed('B'); await seed('A'); return record; });
  expect((await read(staged)).status).toBe('DENIED');
});

it.each(['deleted', 'replaced', 'edited'])('denies a Note %s while original bytes are being read', async kind => {
  const staged = await stageLocalDocumentOriginal(input());
  const get = blobs.getBlob.bind(blobs);
  vi.spyOn(blobs, 'getBlob').mockImplementation(async key => {
    const record = await get(key), note = useNotesStore.getState().notes[0];
    useNotesStore.setState({ notes: [{ ...note, ...(kind === 'deleted' ? { deletedAt: 2 } : kind === 'edited' ? { body: 'newer text' } : {}) }] });
    return record;
  });
  expect((await read(staged)).status).toBe('DENIED');
});

it('rejects metadata retired during checksum verification', async () => {
  const staged = await stageLocalDocumentOriginal(input());
  const digest = crypto.subtle.digest.bind(crypto.subtle);
  vi.spyOn(crypto.subtle, 'digest').mockImplementation(async (...args) => {
    const result = await digest(...args); await repo.tombstoneAttachment('att-doc'); return result;
  });
  expect(await read(staged)).toEqual({ status: 'UNAVAILABLE', reason: 'document_metadata_changed' });
});

it('bounds metadata size before loading any Blob', async () => {
  const staged = await stageLocalDocumentOriginal(input());
  await repo.putAttachment({ ...staged.metadata, size: 16 * 1024 * 1024 });
  const get = vi.spyOn(blobs, 'getBlob');
  expect((await read(staged)).status).toBe('UNAVAILABLE'); expect(get).not.toHaveBeenCalled();
});

it('rejects low-level image/document namespace confusion and foreign account/Note identity', async () => {
  const observation = observePublishedNotesHydration(); if (observation.status !== 'CURRENT') throw new Error('fixture');
  const context = { accountId: 'A', noteId: 'note', attachmentId: 'att-doc', request: observation.request, isCurrent: () => true, namespace: 'local-document' as const };
  expect(await blobs.createBlobForAccountNote(context, { key: 'local-image/A/att-doc', blob: input().file })).toBe('DENIED');
  const staged = await stageLocalDocumentOriginal(input());
  expect(await repo.createAttachmentForAccountNote({ ...context, namespace: undefined }, staged.metadata)).toBe('DENIED');
  for (const patch of [{ accountId: 'B' }, { noteId: 'other' }]) {
    expect((await readLocalDocumentOriginal({ accountId: 'A', noteId: 'note', attachmentId: 'att-doc', staged, ...patch })).status).toBe('DENIED');
  }
});

it('keeps default isolation closed and performs no writes when denied', async () => {
  vi.stubEnv('VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION', undefined);
  const open = vi.spyOn(indexedDB, 'open');
  await expect(stageLocalDocumentOriginal(input())).rejects.toThrow('Attachments are temporarily disabled');
  expect((await read()).status).toBe('DENIED'); expect(open).not.toHaveBeenCalled();
  expect(authFetch).not.toHaveBeenCalled();
});

it('fails closed when a write transaction cannot start', async () => {
  const transaction = IDBDatabase.prototype.transaction;
  vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function(this: IDBDatabase, ...args) {
    if (args[0] === 'blobs' && args[1] === 'readwrite') throw new Error('unavailable');
    return transaction.apply(this, args);
  });
  expect(await failure(stageLocalDocumentOriginal(input()))).toEqual({ blob: 'NOT_STARTED', metadata: 'NOT_STARTED' });
});
