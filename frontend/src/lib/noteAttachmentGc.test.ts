import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AccountScopedAttachmentMetadata,
  AttachmentMetadata,
  AttachmentRepository,
  BlobStorageAdapter,
} from './attachmentRepository';
import {
  collectNoteAttachmentRefs,
  gcOrphanedLocalNoteAttachments,
  type AttachmentReferenceNote,
} from './noteAttachmentGc';
import {
  NOTES_ACCOUNT_AUTHORITY_DATABASE_NAME,
  detachNotesAccountAuthority,
  initializeAccountScopedNotesAuthority,
  loadAccountScopedNotes,
  resetNotesAccountAuthorityForTests,
  runAccountScopedNotesMutation,
} from './notesAccountAuthority';

const localStorageValues = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => localStorageValues.get(key) ?? null,
  setItem: (key: string, value: string) => { localStorageValues.set(key, value); },
  removeItem: (key: string) => { localStorageValues.delete(key); },
  clear: () => { localStorageValues.clear(); },
  key: (index: number) => [...localStorageValues.keys()][index] ?? null,
  get length() { return localStorageValues.size; },
});

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(next => { resolve = next; });
  return { promise, resolve };
}

function deleteNotesAuthorityDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(NOTES_ACCOUNT_AUTHORITY_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('notes_authority_database_delete_blocked'));
  });
}

function durableReferenceNote(attachmentId: string) {
  return {
    id: `durable-${attachmentId}`,
    title: 'Durable reference',
    body: `attachment://${attachmentId}`,
    updatedAt: 1,
    folderId: null,
    deletedAt: null,
  };
}

function putDurableAccountNote(accountId: string, note: ReturnType<typeof durableReferenceNote>): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(NOTES_ACCOUNT_AUTHORITY_DATABASE_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('notes', 'readwrite');
      transaction.objectStore('notes').put({
        key: `${encodeURIComponent(accountId)}\u0000${note.id}`,
        accountId,
        note,
      });
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); reject(transaction.error); };
      transaction.onabort = () => { database.close(); reject(transaction.error); };
    };
  });
}

function metadata(
  id: string,
  accountId = 'account-a',
  overrides: Partial<AccountScopedAttachmentMetadata> & { accountId?: string } = {},
): AccountScopedAttachmentMetadata {
  return {
    id,
    accountId,
    noteId: 'deleted-note',
    fileName: `${id}.png`,
    mimeType: 'image/png',
    size: 10,
    localBlobKey: `local-image/${encodeURIComponent(accountId)}/${id}`,
    source: 'local',
    createdAt: '2026-08-17T00:00:00.000Z',
    updatedAt: '2026-08-17T00:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local',
    ...overrides,
  } as AccountScopedAttachmentMetadata;
}

function memoryRepository(initial: readonly AttachmentMetadata[]) {
  const records = new Map(initial.map(item => [item.id, { ...item }]));
  const repository: AttachmentRepository = {
    async listAttachments() { return [...records.values()]; },
    async listAttachmentsForAccount(accountId) {
      return [...records.values()].filter(
        item => (item as Partial<AccountScopedAttachmentMetadata>).accountId === accountId,
      ) as AccountScopedAttachmentMetadata[];
    },
    async listAttachmentsForNote(noteId) { return [...records.values()].filter(item => item.noteId === noteId); },
    async getAttachment(id) { return records.get(id) ?? null; },
    async putAttachment(item) { records.set(item.id, { ...item }); },
    async updateAttachment(id, patch) {
      const current = records.get(id);
      if (current) records.set(id, { ...current, ...patch, id: current.id });
    },
    async tombstoneAttachment(id, deletedAt = '2026-08-17T00:00:00.000Z') {
      const current = records.get(id);
      if (current) records.set(id, { ...current, deletedAt });
    },
    async deleteAttachmentMetadata(id) { records.delete(id); },
    async deleteAttachmentMetadataForAccount(id, accountId) {
      if ((records.get(id) as Partial<AccountScopedAttachmentMetadata> | undefined)?.accountId !== accountId) return false;
      records.delete(id);
      return true;
    },
    async putMetadata(item) { records.set(item.id, { ...item }); return item; },
    async getMetadata(id) { return records.get(id) ?? null; },
    async listForNote(noteId) { return [...records.values()].filter(item => item.noteId === noteId); },
    async markDeleted(id, deletedAt) {
      const current = records.get(id);
      if (!current) return null;
      const next = { ...current, deletedAt };
      records.set(id, next);
      return next;
    },
  };
  return { repository, records };
}

function memoryBlobs(keys: readonly string[]) {
  const blobs = new Set(keys);
  const deleteBlob = vi.fn(async (key: string) => { blobs.delete(key); });
  const adapter: BlobStorageAdapter = {
    putBlob: vi.fn(async input => ({ key: input.key, blob: input.blob, size: input.blob.size })),
    getBlob: vi.fn(async key => blobs.has(key)
      ? { key, blob: new Blob(['attachment']), size: 10 }
      : null),
    deleteBlob,
    getObjectUrl: vi.fn(async () => null),
    hasBlob: vi.fn(async key => blobs.has(key)),
  };
  return { adapter, blobs, deleteBlob };
}

function run(input: {
  candidateIds: readonly string[];
  notes: () => readonly AttachmentReferenceNote[] | null;
  metadata: readonly AttachmentMetadata[];
  blobKeys: readonly string[];
  adapter?: BlobStorageAdapter;
}) {
  const { repository, records } = memoryRepository(input.metadata);
  const blobs = memoryBlobs(input.blobKeys);
  return {
    records,
    blobs,
    report: gcOrphanedLocalNoteAttachments({
      accountId: 'account-a',
      candidateAttachmentIds: input.candidateIds,
      getSurvivingNotes: input.notes,
      repository,
      blobAdapter: input.adapter ?? blobs.adapter,
    }),
  };
}

describe('POST_RTU_05 candidate-only Notes attachment GC', () => {
  it('extracts stable attachment IDs without treating inline base64 as blob work', () => {
    const refs = collectNoteAttachmentRefs({
      id: 'deleted',
      body: `data:image/png;base64,AAAA\nattachment://att-a\nattachment://att-a`,
    });
    expect([...refs]).toEqual(['att-a']);
    expect(collectNoteAttachmentRefs({ id: 'inline-only', body: 'data:image/png;base64,AAAA' }).size).toBe(0);
  });

  it('reclaims an exclusive account-scoped local blob only after zero surviving references', async () => {
    const item = metadata('exclusive');
    const operation = run({
      candidateIds: ['exclusive'], notes: () => [], metadata: [item], blobKeys: [item.localBlobKey!],
    });
    const report = await operation.report;
    expect(report).toMatchObject({ candidateCount: 1, reclaimedBlobCount: 1, reclaimedMetadataCount: 1 });
    expect(report.results[0]?.classification).toBe('ORPHAN_PROVEN');
    expect(operation.blobs.blobs.has(item.localBlobKey!)).toBe(false);
    expect(operation.records.has(item.id)).toBe(false);
  });

  it('keeps a shared blob after the first Note and reclaims it after the final reference', async () => {
    const item = metadata('shared');
    let surviving: AttachmentReferenceNote[] = [{ id: 'keep', body: 'attachment://shared' }];
    const { repository, records } = memoryRepository([item]);
    const blobs = memoryBlobs([item.localBlobKey!]);
    const input = {
      accountId: 'account-a',
      candidateAttachmentIds: ['shared'],
      getSurvivingNotes: () => surviving,
      repository,
      blobAdapter: blobs.adapter,
    };

    const first = await gcOrphanedLocalNoteAttachments(input);
    expect(first.results[0]?.classification).toBe('REFERENCED');
    expect(blobs.blobs.has(item.localBlobKey!)).toBe(true);
    expect(records.has(item.id)).toBe(true);

    surviving = [];
    const second = await gcOrphanedLocalNoteAttachments(input);
    expect(second.results[0]?.classification).toBe('ORPHAN_PROVEN');
    expect(blobs.blobs.has(item.localBlobKey!)).toBe(false);
    expect(records.has(item.id)).toBe(false);
  });

  it('does not scan or delete unrelated blobs', async () => {
    const candidate = metadata('candidate');
    const unrelated = metadata('unrelated');
    const operation = run({
      candidateIds: ['candidate'], notes: () => [], metadata: [candidate, unrelated],
      blobKeys: [candidate.localBlobKey!, unrelated.localBlobKey!],
    });
    await operation.report;
    expect(operation.blobs.deleteBlob).toHaveBeenCalledTimes(1);
    expect(operation.blobs.deleteBlob).toHaveBeenCalledWith(candidate.localBlobKey);
    expect(operation.blobs.blobs.has(unrelated.localBlobKey!)).toBe(true);
    expect(operation.records.has(unrelated.id)).toBe(true);
  });

  it('blocks legacy-unscoped and other-account candidates without touching their blobs', async () => {
    const legacy = metadata('legacy', 'account-a', { accountId: undefined, localBlobKey: 'local-image/legacy' });
    const foreign = metadata('foreign', 'account-b');
    const operation = run({
      candidateIds: ['legacy', 'foreign'], notes: () => [], metadata: [legacy, foreign],
      blobKeys: [legacy.localBlobKey!, foreign.localBlobKey!],
    });
    const report = await operation.report;
    expect(report.results.map(item => item.classification)).toEqual(['CROSS_ACCOUNT_BLOCKED', 'CROSS_ACCOUNT_BLOCKED']);
    expect(operation.blobs.deleteBlob).not.toHaveBeenCalled();
    expect(operation.records.size).toBe(2);
  });

  it('fails safe for missing or corrupt metadata', async () => {
    const corrupt = metadata('corrupt', 'account-a', { localBlobKey: undefined });
    const operation = run({
      candidateIds: ['corrupt', 'missing'], notes: () => [], metadata: [corrupt], blobKeys: [],
    });
    const report = await operation.report;
    expect(report.results.map(item => item.classification)).toEqual(['CORRUPT_METADATA', 'UNKNOWN_REFERENCE_STATE']);
    expect(operation.records.has('corrupt')).toBe(true);
  });

  it('handles an already-missing blob idempotently by removing only proven scoped metadata', async () => {
    const item = metadata('missing-blob');
    const operation = run({ candidateIds: [item.id], notes: () => [], metadata: [item], blobKeys: [] });
    const report = await operation.report;
    expect(report.results[0]).toMatchObject({
      classification: 'ORPHAN_PROVEN', reclaimedBlob: false, reclaimedMetadata: true,
    });
    expect(operation.blobs.deleteBlob).not.toHaveBeenCalled();
    expect(operation.records.has(item.id)).toBe(false);
  });

  it('keeps metadata for retry when blob deletion fails and never throws', async () => {
    const item = metadata('retry');
    const failing = memoryBlobs([item.localBlobKey!]);
    failing.adapter.deleteBlob = vi.fn(async () => { throw new Error('quota failure'); });
    const operation = run({
      candidateIds: [item.id], notes: () => [], metadata: [item], blobKeys: [item.localBlobKey!], adapter: failing.adapter,
    });
    const report = await operation.report;
    expect(report.results[0]?.classification).toBe('FAILED');
    expect(operation.records.has(item.id)).toBe(true);
  });

  it('is idempotent across repeated GC after the orphan was reclaimed', async () => {
    const item = metadata('repeat');
    const { repository, records } = memoryRepository([item]);
    const blobs = memoryBlobs([item.localBlobKey!]);
    const input = {
      accountId: 'account-a', candidateAttachmentIds: [item.id], getSurvivingNotes: () => [], repository, blobAdapter: blobs.adapter,
    };
    expect((await gcOrphanedLocalNoteAttachments(input)).reclaimedBlobCount).toBe(1);
    const repeated = await gcOrphanedLocalNoteAttachments(input);
    expect(repeated.results[0]?.classification).toBe('UNKNOWN_REFERENCE_STATE');
    expect(blobs.deleteBlob).toHaveBeenCalledTimes(1);
    expect(records.size).toBe(0);
  });

  it('fails closed when the active account changes during revalidation', async () => {
    const item = metadata('stale');
    let calls = 0;
    const operation = run({
      candidateIds: [item.id],
      notes: () => (++calls === 1 ? [] : null),
      metadata: [item],
      blobKeys: [item.localBlobKey!],
    });
    const report = await operation.report;
    expect(report.results[0]?.classification).toBe('UNKNOWN_REFERENCE_STATE');
    expect(operation.blobs.deleteBlob).not.toHaveBeenCalled();
    expect(operation.records.has(item.id)).toBe(true);
  });

  it('keeps a blob when a new durable reference wins the account mutation tail before GC proof', async () => {
    const item = metadata('concurrent');
    let surviving: AttachmentReferenceNote[] = [];
    let writerEntered = false;
    const writerStarted = deferred();
    const releaseWriter = deferred();
    const writer = runAccountScopedNotesMutation('account-a', async () => {
      writerEntered = true;
      writerStarted.resolve();
      surviving = [{ id: 'new-reference', body: 'attachment://concurrent' }];
      await releaseWriter.promise;
    });

    await writerStarted.promise;
    expect(writerEntered).toBe(true);
    const operation = run({
      candidateIds: [item.id], notes: () => surviving, metadata: [item], blobKeys: [item.localBlobKey!],
    });
    releaseWriter.resolve();
    await writer;
    const report = await operation.report;

    expect(report.results[0]?.classification).toBe('REFERENCED');
    expect(operation.blobs.blobs.has(item.localBlobKey!)).toBe(true);
    expect(operation.blobs.deleteBlob).not.toHaveBeenCalled();
    await expect(operation.blobs.adapter.getBlob(item.localBlobKey!)).resolves.not.toBeNull();
  });

  it('makes delete win deterministically when a reference write starts during async blob lookup', async () => {
    const item = metadata('delete-wins');
    const { repository, records } = memoryRepository([item]);
    const blobs = memoryBlobs([item.localBlobKey!]);
    const lookupStarted = deferred();
    const releaseLookup = deferred();
    blobs.adapter.hasBlob = vi.fn(async key => {
      lookupStarted.resolve();
      await releaseLookup.promise;
      return blobs.blobs.has(key);
    });
    let writerEntered = false;
    const report = gcOrphanedLocalNoteAttachments({
      accountId: 'account-a',
      candidateAttachmentIds: [item.id],
      getSurvivingNotes: () => [],
      repository,
      blobAdapter: blobs.adapter,
    });

    await lookupStarted.promise;
    const writer = runAccountScopedNotesMutation('account-a', async () => {
      writerEntered = true;
    });
    expect(writerEntered).toBe(false);
    releaseLookup.resolve();

    const result = await report;
    await writer;
    expect(result.results[0]?.classification).toBe('ORPHAN_PROVEN');
    expect(blobs.deleteBlob).toHaveBeenCalledWith(item.localBlobKey);
    expect(blobs.blobs.has(item.localBlobKey!)).toBe(false);
    expect(records.has(item.id)).toBe(false);
    expect(writerEntered).toBe(true);
  });
});

describe('POST_RTU_05B durable cross-context GC ordering', () => {
  beforeEach(async () => {
    detachNotesAccountAuthority();
    resetNotesAccountAuthorityForTests();
    localStorageValues.clear();
    await deleteNotesAuthorityDatabase();
    await initializeAccountScopedNotesAuthority('account-a');
  });

  afterEach(async () => {
    detachNotesAccountAuthority();
    resetNotesAccountAuthorityForTests();
    localStorageValues.clear();
    await deleteNotesAuthorityDatabase();
  });

  it('keeps the blob when a durable account Note write wins the shared cross-context lock', async () => {
    const item = metadata('durable-write-wins');
    const { repository } = memoryRepository([item]);
    const blobs = memoryBlobs([item.localBlobKey!]);
    const writerEntered = deferred();
    const releaseWriter = deferred();
    const writer = runAccountScopedNotesMutation('account-a', async () => {
      writerEntered.resolve();
      await putDurableAccountNote('account-a', durableReferenceNote(item.id));
      await releaseWriter.promise;
    });

    await writerEntered.promise;
    const report = gcOrphanedLocalNoteAttachments({
      accountId: 'account-a',
      candidateAttachmentIds: [item.id],
      getSurvivingNotes: () => [],
      readDurableSurvivingNotes: () => loadAccountScopedNotes('account-a'),
      repository,
      blobAdapter: blobs.adapter,
    });
    releaseWriter.resolve();
    await writer;
    const result = await report;

    expect(result.results[0]?.classification).toBe('REFERENCED');
    expect((await loadAccountScopedNotes('account-a'))[0]?.body).toBe(`attachment://${item.id}`);
    expect(blobs.blobs.has(item.localBlobKey!)).toBe(true);
    expect(blobs.deleteBlob).not.toHaveBeenCalled();
  });

  it('commits a later durable reference only after GC wins and releases the shared lock', async () => {
    const item = metadata('durable-gc-wins');
    const { repository } = memoryRepository([item]);
    const blobs = memoryBlobs([item.localBlobKey!]);
    const lookupStarted = deferred();
    const releaseLookup = deferred();
    const events: string[] = [];
    blobs.adapter.hasBlob = vi.fn(async key => {
      lookupStarted.resolve();
      await releaseLookup.promise;
      return blobs.blobs.has(key);
    });
    blobs.adapter.deleteBlob = vi.fn(async key => {
      blobs.blobs.delete(key);
      events.push('blob-delete');
    });

    const report = gcOrphanedLocalNoteAttachments({
      accountId: 'account-a',
      candidateAttachmentIds: [item.id],
      getSurvivingNotes: () => [],
      readDurableSurvivingNotes: () => loadAccountScopedNotes('account-a'),
      repository,
      blobAdapter: blobs.adapter,
    });
    await lookupStarted.promise;
    let writerEntered = false;
    const writer = runAccountScopedNotesMutation('account-a', async () => {
      writerEntered = true;
      await putDurableAccountNote('account-a', durableReferenceNote(item.id));
      events.push('reference-commit');
    });
    await Promise.resolve();
    expect(writerEntered).toBe(false);
    releaseLookup.resolve();

    const result = await report;
    await writer;
    expect(result.results[0]?.classification).toBe('ORPHAN_PROVEN');
    expect(events).toEqual(['blob-delete', 'reference-commit']);
    expect(blobs.blobs.has(item.localBlobKey!)).toBe(false);
    expect((await loadAccountScopedNotes('account-a'))[0]?.body).toBe(`attachment://${item.id}`);
  });

  it('releases the shared lock after blob deletion fails so a later durable write proceeds', async () => {
    const item = metadata('durable-delete-failure');
    const { repository } = memoryRepository([item]);
    const blobs = memoryBlobs([item.localBlobKey!]);
    blobs.adapter.deleteBlob = vi.fn(async () => { throw new Error('delete failed'); });
    const result = await gcOrphanedLocalNoteAttachments({
      accountId: 'account-a',
      candidateAttachmentIds: [item.id],
      getSurvivingNotes: () => [],
      readDurableSurvivingNotes: () => loadAccountScopedNotes('account-a'),
      repository,
      blobAdapter: blobs.adapter,
    });
    expect(result.results[0]?.classification).toBe('FAILED');

    await runAccountScopedNotesMutation('account-a', () =>
      putDurableAccountNote('account-a', durableReferenceNote(item.id)));
    expect((await loadAccountScopedNotes('account-a'))[0]?.body).toBe(`attachment://${item.id}`);
  });
});
