// @vitest-environment happy-dom
import { IDBDatabase, IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalAttachmentMetadataRepository, ATTACHMENT_METADATA_DB_NAME, ATTACHMENT_METADATA_DB_VERSION } from './attachmentMetadataIndexedDb';
import type { AccountScopedAttachmentMetadata, ScopedAttachmentBackupInput, ScopedAttachmentBackupTransition } from './attachmentRepository';
import { activateNotesAccountAuthority, getActiveNotesAuthorityRequest, resetNotesAccountAuthorityForTests } from './notesAccountAuthority';
import { isReturnToUseAttachmentIsolationEnabled } from './returnToUseAttachmentIsolation';

const created = '2026-01-01T00:00:00.000Z';
const start = '2026-01-02T00:00:00.000Z';
const end = '2026-01-03T00:00:00.000Z';
const isolation = 'VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION';
const checksum = `sha256:${'1'.repeat(64)}`;
function original(format: 'pdf' | 'docx' = 'pdf'): AccountScopedAttachmentMetadata {
  return { id: 'doc-a', accountId: 'A', noteId: 'note-a', fileName: `original.${format}`,
    mimeType: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: 5, checksum, localBlobKey: 'local-document/A/doc-a', source: 'local',
    createdAt: created, updatedAt: created, deletedAt: null, syncStatus: 'local' };
}
function operation(expected = original(), transition: ScopedAttachmentBackupTransition = { kind: 'reserve', at: start },
  isCurrent = () => true): ScopedAttachmentBackupInput {
  return { accountId: 'A', noteId: 'note-a', request: getActiveNotesAuthorityRequest()!, expected, transition, isCurrent };
}
function receipt(): ScopedAttachmentBackupTransition {
  return { kind: 'finish', at: end, outcome: 'verified_remote_content', remoteFileId: 'drive-file-a', checksum, size: 5 };
}
async function seed(format: 'pdf' | 'docx' = 'pdf') {
  const repo = new LocalAttachmentMetadataRepository(), source = original(format);
  await repo.putAttachment(source);
  return { repo, source };
}
async function reserve(repo: LocalAttachmentMetadataRepository, source = original()) {
  expect(await repo.transitionBackupForAccountNote(operation(source))).toEqual({ status: 'COMMITTED' });
  return await repo.getAttachment(source.id) as AccountScopedAttachmentMetadata;
}

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubEnv(isolation, 'false'); // Test-only opt-out; product default remains closed.
  activateNotesAccountAuthority('A');
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); resetNotesAccountAuthorityForTests(); });

describe('inactive account-scoped backup attempt/receipt CAS', () => {
  it.each([undefined, 'true', '1'])('denies isolation setting %s before even opening storage', async setting => {
    vi.stubEnv(isolation, setting);
    expect(isReturnToUseAttachmentIsolationEnabled()).toBe(true);
    const repo = new LocalAttachmentMetadataRepository(), open = vi.spyOn(indexedDB, 'open');
    expect(await repo.transitionBackupForAccountNote(operation())).toEqual({ status: 'DENIED' });
    expect(open).not.toHaveBeenCalled();
  });

  it('does not create or migrate an absent metadata DB', async () => {
    const repo = new LocalAttachmentMetadataRepository(), open = vi.spyOn(indexedDB, 'open');
    expect(await repo.transitionBackupForAccountNote(operation())).toEqual({ status: 'NOT_STARTED' });
    expect(open).not.toHaveBeenCalled(); expect(await indexedDB.databases()).toEqual([]);
  });

  it.each(['pdf', 'docx'] as const)('reserves and publishes only remote metadata for an exact %s original', async format => {
    const { repo, source } = await seed(format);
    const pending = await reserve(repo, source);
    expect(pending).toEqual({ ...source, remoteProvider: 'googleDrive', remoteSyncStatus: 'uploading',
      remoteSyncAttemptCount: 1, lastRemoteSyncAttemptAt: start, updatedAt: start });
    const update = vi.spyOn(repo, 'updateAttachment'), get = vi.spyOn(repo, 'getAttachment'), put = vi.spyOn(repo, 'putAttachment');
    const result = await repo.transitionBackupForAccountNote(operation(pending, receipt()));
    expect(result).toEqual({ status: 'COMMITTED' }); expect(Object.isFrozen(result)).toBe(true);
    expect(update).not.toHaveBeenCalled(); expect(get).not.toHaveBeenCalled(); expect(put).not.toHaveBeenCalled();
    const final = await repo.getAttachment(source.id);
    expect(final).toEqual({ ...pending, remoteFileId: 'drive-file-a', remoteChecksum: checksum, remoteSize: 5,
      remoteMimeType: source.mimeType, remoteSyncedAt: end, remoteVerification: {
        sizeVerified: true, checksumVerified: true, checksumAlgorithm: 'sha256',
      }, remoteSyncStatus: 'synced', updatedAt: end });
    // This primitive does not touch a Blob store or invoke an upload. Remote proof is its caller's duty.
    expect((await indexedDB.databases()).map(value => value.name)).toEqual([ATTACHMENT_METADATA_DB_NAME]);
  });

  it.each(['definitive_failure', 'indeterminate', 'verification_unavailable'] as const)('durably blocks retry after %s, including reload', async outcome => {
    const { repo, source } = await seed(); const pending = await reserve(repo, source);
    expect(await repo.transitionBackupForAccountNote(operation(pending, { kind: 'finish', at: end, outcome }))).toEqual({ status: 'COMMITTED' });
    const after = await repo.getAttachment(source.id) as AccountScopedAttachmentMetadata;
    expect(after).toEqual({ ...pending, remoteSyncStatus: 'failed', remoteError: outcome, updatedAt: end });
    expect(await new LocalAttachmentMetadataRepository().transitionBackupForAccountNote(operation(after))).toEqual({ status: 'DENIED' });
    expect(after.localBlobKey).toBe(source.localBlobKey); expect(after.checksum).toBe(source.checksum);
  });

  it('retains only a known locator on unavailable verification, not an unverified synced receipt', async () => {
    const { repo } = await seed(); const pending = await reserve(repo);
    expect(await repo.transitionBackupForAccountNote(operation(pending, { kind: 'finish', at: end,
      outcome: 'verification_unavailable', remoteFileId: 'known-locator' }))).toEqual({ status: 'COMMITTED' });
    const after = await repo.getAttachment(pending.id);
    expect(after).toMatchObject({ remoteFileId: 'known-locator', remoteSyncStatus: 'failed' });
    expect(after?.remoteVerification).toBeUndefined(); expect(after?.remoteChecksum).toBeUndefined();
  });

  it('serializes concurrent reservations using real IDB transactions (one winner)', async () => {
    const { repo, source } = await seed();
    const results = await Promise.all([repo.transitionBackupForAccountNote(operation(source)),
      new LocalAttachmentMetadataRepository().transitionBackupForAccountNote(operation(source))]);
    expect(results.map(value => value.status).sort()).toEqual(['COMMITTED', 'DENIED']);
    expect((await repo.getAttachment(source.id))?.remoteSyncAttemptCount).toBe(1);
    const pending = await repo.getAttachment(source.id) as AccountScopedAttachmentMetadata;
    const finishes = await Promise.all([repo.transitionBackupForAccountNote(operation(pending, receipt())),
      repo.transitionBackupForAccountNote(operation(pending, receipt()))]);
    expect(finishes.map(value => value.status).sort()).toEqual(['COMMITTED', 'DENIED']);
  });

  it.each(['foreign', 'other-note', 'deleted', 'changed-source', 'missing'] as const)('denies %s at the transactional snapshot check without rewriting it', async kind => {
    const { repo, source } = await seed();
    const changed = kind === 'foreign' ? { ...source, accountId: 'B' } : kind === 'other-note' ? { ...source, noteId: 'other' }
      : kind === 'deleted' ? { ...source, deletedAt: end, syncStatus: 'deleted' as const } : { ...source, fileName: 'changed.pdf' };
    if (kind === 'missing') await repo.deleteAttachmentMetadata(source.id); else await repo.putAttachment(changed);
    const put = vi.spyOn(IDBObjectStore.prototype, 'put');
    expect(await repo.transitionBackupForAccountNote(operation(source))).toEqual({ status: 'DENIED' });
    expect(put).not.toHaveBeenCalled();
    expect(await repo.getAttachment(source.id)).toEqual(kind === 'missing' ? null : changed);
  });

  it.each(['checksum', 'size', 'filename', 'deleted', 'unscoped', 'source', 'namespace'] as const)('rejects ineligible expected %s metadata before storage access', async field => {
    const expected = original();
    if (field === 'checksum') expected.checksum = 'md5:legacy';
    if (field === 'size') expected.size = 0;
    if (field === 'filename') expected.fileName = 'original.exe';
    if (field === 'deleted') expected.deletedAt = end;
    if (field === 'unscoped') expected.accountId = '';
    if (field === 'source') expected.source = 'remote';
    if (field === 'namespace') expected.localBlobKey = 'local-image/A/doc-a';
    const open = vi.spyOn(indexedDB, 'open');
    expect(await new LocalAttachmentMetadataRepository().transitionBackupForAccountNote(operation(expected))).toEqual({ status: 'DENIED' });
    expect(open).not.toHaveBeenCalled();
  });

  it.each([{ label: 'array', value: [checksum] }, { label: 'number', value: 123 }, { label: 'object', value: {} }])(
    'rejects a persisted $label checksum without reserving or changing the malformed original', async ({ value }) => {
      const { repo, source } = await seed();
      const malformed = { ...source, checksum: value as unknown as string };
      await repo.putAttachment(malformed);
      const put = vi.spyOn(IDBObjectStore.prototype, 'put');
      expect(await repo.transitionBackupForAccountNote(operation(malformed))).toEqual({ status: 'DENIED' });
      expect(put).not.toHaveBeenCalled();
      expect(await repo.getAttachment(source.id)).toEqual(malformed);
    });

  it.each(['sha', 'size', 'id', 'time', 'no-reservation'] as const)('rejects invalid %s finish evidence without changing the original', async kind => {
    const { repo, source } = await seed(); const expected = kind === 'no-reservation' ? source : await reserve(repo);
    const transition = { ...receipt(), ...(kind === 'sha' ? { checksum: `sha256:${'2'.repeat(64)}` } : {}),
      ...(kind === 'size' ? { size: 6 } : {}), ...(kind === 'id' ? { remoteFileId: '' } : {}),
      ...(kind === 'time' ? { at: created } : {}) } as ScopedAttachmentBackupTransition;
    expect(await repo.transitionBackupForAccountNote(operation(expected, transition))).toEqual({ status: 'DENIED' });
    expect(await repo.getAttachment(source.id)).toEqual(expected);
  });

  it('fails closed for active, failed, or historical remote attempt states', async () => {
    const { repo } = await seed();
    for (const patch of [{ remoteSyncStatus: 'uploading' }, { remoteSyncStatus: 'failed' }, { remoteFileId: 'prior' },
      { remoteSyncAttemptCount: 1 }, { lastRemoteSyncAttemptAt: start }, { remoteProvider: 'other' }]) {
      const expected = { ...original(), ...patch } as AccountScopedAttachmentMetadata;
      await repo.putAttachment(expected);
      expect(await repo.transitionBackupForAccountNote(operation(expected))).toEqual({ status: 'DENIED' });
    }
  });

  it.each(['ABA', 'copied-request', 'caller-stale'] as const)('denies %s even with matching account strings', async kind => {
    const { repo, source } = await seed(); const input = operation(source, { kind: 'reserve', at: start }, () => kind !== 'caller-stale');
    if (kind === 'ABA') { activateNotesAccountAuthority('B'); activateNotesAccountAuthority('A'); }
    const value = kind === 'copied-request' ? { ...input, request: { ...input.request } } : input;
    const open = vi.spyOn(indexedDB, 'open');
    expect(await repo.transitionBackupForAccountNote(value)).toEqual({ status: 'DENIED' });
    expect(open).not.toHaveBeenCalled();
  });

  it.each(['account', 'session', 'isolation'] as const)('rechecks %s inside lookup success immediately before put', async kind => {
    const { repo, source } = await seed(); let live = true;
    const get = IDBObjectStore.prototype.get;
    vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementation(function (this: IDBObjectStore, key) {
      const req = get.call(this, key); req.addEventListener('success', () => {
        if (kind === 'account') { activateNotesAccountAuthority('B'); activateNotesAccountAuthority('A'); }
        if (kind === 'session') live = false;
        if (kind === 'isolation') vi.stubEnv(isolation, 'true');
      }); return req;
    });
    const put = vi.spyOn(IDBObjectStore.prototype, 'put');
    expect(await repo.transitionBackupForAccountNote(operation(source, { kind: 'reserve', at: start }, () => live))).toEqual({ status: 'DENIED' });
    expect(put).not.toHaveBeenCalled();
  });

  it('copies expected metadata and transition before the first await', async () => {
    const { repo, source } = await seed(); const transition = { kind: 'reserve' as const, at: start };
    const pending = repo.transitionBackupForAccountNote(operation(source, transition));
    source.accountId = 'B'; source.noteId = 'other'; transition.at = end;
    expect(await pending).toEqual({ status: 'COMMITTED' });
    expect(await repo.getAttachment('doc-a')).toMatchObject({ accountId: 'A', noteId: 'note-a', lastRemoteSyncAttemptAt: start });
  });

  it('waits for abort after put success instead of acknowledging request success as commit', async () => {
    const { repo, source } = await seed(); const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      const request = key === undefined ? put.call(this, value) : put.call(this, value, key);
      request.addEventListener('success', () => this.transaction.abort()); return request;
    });
    expect(await repo.transitionBackupForAccountNote(operation(source))).toEqual({ status: 'ABORTED' });
    expect(await repo.getAttachment(source.id)).toEqual(source);
  });

  it('aborts when session currentness is lost while the write is pending', async () => {
    const { repo, source } = await seed(); let live = true; const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      const request = key === undefined ? put.call(this, value) : put.call(this, value, key);
      request.addEventListener('success', () => { live = false; }); return request;
    });
    expect(await repo.transitionBackupForAccountNote(operation(source, { kind: 'reserve', at: start }, () => live))).toEqual({ status: 'ABORTED' });
    expect(await repo.getAttachment(source.id)).toEqual(source);
  });

  it('reports INDETERMINATE rather than success if authority is stale at actual completion', async () => {
    const { repo, source } = await seed(); let live = true; const transaction = IDBDatabase.prototype.transaction;
    vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, ...args) {
      const tx = transaction.apply(this, args);
      if (args[1] === 'readwrite') tx.addEventListener('complete', () => { live = false; });
      return tx;
    });
    expect(await repo.transitionBackupForAccountNote(operation(source, { kind: 'reserve', at: start }, () => live))).toEqual({ status: 'INDETERMINATE' });
    expect(await repo.getAttachment(source.id)).toMatchObject({ remoteSyncStatus: 'uploading' });
  });

  it('reports a genuine request-error transaction abort without retrying', async () => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open(ATTACHMENT_METADATA_DB_NAME, ATTACHMENT_METADATA_DB_VERSION);
      open.onupgradeneeded = () => {
        const store = open.result.createObjectStore('metadata', { keyPath: 'id' });
        store.createIndex('test-remote-status', 'remoteSyncStatus', { unique: true });
      };
      open.onerror = () => reject(open.error);
      open.onsuccess = () => { open.result.close(); resolve(); };
    });
    const { repo, source } = await seed();
    await repo.putAttachment({ ...source, id: 'other', remoteSyncStatus: 'uploading' });
    const put = vi.spyOn(IDBObjectStore.prototype, 'put');
    expect(await repo.transitionBackupForAccountNote(operation(source))).toEqual({ status: 'ABORTED' });
    expect(put).toHaveBeenCalledTimes(1); expect(await repo.getAttachment(source.id)).toEqual(source);
  });

  it('distinguishes transaction unavailability from a started/aborted write', async () => {
    const { repo, source } = await seed();
    vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(() => { throw new Error('unavailable'); });
    expect(await repo.transitionBackupForAccountNote(operation(source))).toEqual({ status: 'NOT_STARTED' });
  });
});
