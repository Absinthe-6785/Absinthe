// @vitest-environment happy-dom
import { IDBDatabase, IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ATTACHMENT_METADATA_DB_NAME, ATTACHMENT_METADATA_DB_VERSION, LocalAttachmentMetadataRepository } from './attachmentMetadataIndexedDb';
import type { AccountScopedAttachmentMetadata } from './attachmentRepository';
import { activateNotesAccountAuthority, getActiveNotesAuthorityRequest, resetNotesAccountAuthorityForTests } from './notesAccountAuthority';

const at = '2026-01-01T00:00:00.000Z';
const removedAt = '2026-01-02T00:00:00.000Z';
function metadata(id = 'image-a', accountId = 'A', noteId = 'shared'): AccountScopedAttachmentMetadata {
  return { id, accountId, noteId, fileName: `${id}.png`, mimeType: 'image/png', size: 5,
    localBlobKey: `local-image/${accountId}/${id}`, source: 'local', createdAt: at, updatedAt: at,
    deletedAt: null, syncStatus: 'local' };
}
function input(expected = metadata(), isCurrent = () => true) {
  return { accountId: 'A', noteId: 'shared', request: getActiveNotesAuthorityRequest()!, expected, isCurrent, deletedAt: removedAt };
}
beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); activateNotesAccountAuthority('A'); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); resetNotesAccountAuthorityForTests(); });

describe('ordinary attachment account/Note access', () => {
  it('R01 separates accounts sharing a Note ID and preserves hidden legacy and other-Note records', async () => {
    const repo = new LocalAttachmentMetadataRepository();
    const a = metadata(); const b = metadata('image-b', 'B'); const other = metadata('other', 'A', 'other-note');
    const legacy = { ...metadata('legacy'), accountId: undefined };
    await repo.putAttachment(a); await repo.putAttachment(b); await repo.putAttachment(other); await repo.putAttachment(legacy);
    expect(await repo.listAttachmentsForAccountNote('A', 'shared')).toEqual([a]);
    expect(await repo.listAttachmentsForAccountNote('B', 'shared')).toEqual([b]);
    expect(await repo.listAttachmentsForAccountNote('', 'shared')).toEqual([]);
    expect(await repo.listAttachmentsForAccountNote('A', '')).toEqual([]);
    expect((await repo.listAttachmentsForNote('shared')).map(row => row.id).sort()).toEqual(['image-a', 'image-b', 'legacy']);
    expect(await repo.getAttachment('legacy')).toMatchObject({ id: 'legacy', deletedAt: null });
  });

  it.each(['account', 'note', 'record'])('R02 rejects a mismatching %s snapshot without changing either record', async kind => {
    const repo = new LocalAttachmentMetadataRepository();
    const a = metadata(); const b = metadata('image-b', 'B');
    await repo.putAttachment(a); await repo.putAttachment(b);
    const expected = kind === 'account' ? b : kind === 'note' ? { ...a, noteId: 'other' } : { ...a, fileName: 'replaced.png' };
    expect(await repo.tombstoneAttachmentForAccountNote(input(expected))).toEqual({ status: 'DENIED' });
    expect(await repo.getAttachment(a.id)).toEqual(a);
    expect(await repo.getAttachment(b.id)).toEqual(b);
  });

  it('R03 atomically reads, compares and tombstones the exact record, without legacy update APIs', async () => {
    const repo = new LocalAttachmentMetadataRepository(); const a = metadata();
    await repo.putAttachment(a);
    const read = vi.spyOn(repo, 'getAttachment'); const put = vi.spyOn(repo, 'putAttachment');
    const result = await repo.tombstoneAttachmentForAccountNote(input(a));
    expect(result).toEqual({ status: 'TOMBSTONED' }); expect(Object.isFrozen(result)).toBe(true);
    expect(read).not.toHaveBeenCalled(); expect(put).not.toHaveBeenCalled();
    expect(await repo.getAttachment(a.id)).toEqual({ ...a, deletedAt: removedAt, updatedAt: removedAt, syncStatus: 'deleted' });
  });

  it('R04 denies stale requests before any database open or write', async () => {
    const repo = new LocalAttachmentMetadataRepository();
    const open = vi.spyOn(indexedDB, 'open');
    expect(await repo.tombstoneAttachmentForAccountNote(input(metadata(), () => false))).toEqual({ status: 'DENIED' });
    expect(open).not.toHaveBeenCalled();
  });

  it('R05 rechecks currentness after the real transactional lookup and before put', async () => {
    const repo = new LocalAttachmentMetadataRepository(); const a = metadata(); await repo.putAttachment(a);
    let active = true;
    const get = IDBObjectStore.prototype.get;
    vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementation(function (this: IDBObjectStore, key) {
      const request = get.call(this, key);
      request.addEventListener('success', () => { active = false; });
      return request;
    });
    const put = vi.spyOn(IDBObjectStore.prototype, 'put');
    expect(await repo.tombstoneAttachmentForAccountNote(input(a, () => active))).toEqual({ status: 'DENIED' });
    expect(put).not.toHaveBeenCalled();
    expect(await repo.getAttachment(a.id)).toEqual(a);
  });

  it('R06 a later same-ID replacement is not authorized by an older displayed snapshot', async () => {
    const repo = new LocalAttachmentMetadataRepository(); const a = metadata();
    await repo.putAttachment(a);
    const replacement = { ...a, localBlobKey: 'local-image/A/replacement', checksum: 'changed' };
    await repo.putAttachment(replacement);
    expect(await repo.tombstoneAttachmentForAccountNote(input(a))).toEqual({ status: 'DENIED' });
    expect(await repo.getAttachment(a.id)).toEqual(replacement);
  });

  it('R07 snapshots the expected identity before awaiting database access', async () => {
    const repo = new LocalAttachmentMetadataRepository(); const a = metadata(); const b = metadata('image-b', 'B');
    await repo.putAttachment(a); await repo.putAttachment(b);
    const expected = { ...a };
    const pending = repo.tombstoneAttachmentForAccountNote(input(expected));
    Object.assign(expected, b);
    expect(await pending).toEqual({ status: 'TOMBSTONED' });
    expect(await repo.getAttachment(a.id)).toMatchObject({ deletedAt: removedAt });
    expect(await repo.getAttachment(b.id)).toEqual(b);
  });

  it('R08 reports genuine commit after a switch following write authorization, not a cancelled write', async () => {
    const repo = new LocalAttachmentMetadataRepository(); const a = metadata(); await repo.putAttachment(a);
    let active = true; const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      const request = put.call(this, value, key);
      active = false;
      activateNotesAccountAuthority('B');
      return request;
    });
    expect(await repo.tombstoneAttachmentForAccountNote(input(a, () => active))).toEqual({ status: 'TOMBSTONED' });
    expect(active).toBe(false);
    expect(await repo.getAttachment(a.id)).toMatchObject({ deletedAt: removedAt });
  });

  it('R09 proves ABORTED only from the actual abort event after a synchronous put failure', async () => {
    const repo = new LocalAttachmentMetadataRepository(); const a = metadata(); await repo.putAttachment(a);
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => { throw new DOMException('clone failure', 'DataCloneError'); });
    expect(await repo.tombstoneAttachmentForAccountNote(input(a))).toEqual({ status: 'ABORTED' });
    expect(await repo.getAttachment(a.id)).toEqual(a);
  });

  it('R10 treats real request failure before terminal abort as INDETERMINATE with no retry', async () => {
    // Test-only unique constraint causes an authentic asynchronous IDB request error.
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open(ATTACHMENT_METADATA_DB_NAME, ATTACHMENT_METADATA_DB_VERSION);
      open.onupgradeneeded = () => {
        const store = open.result.createObjectStore('metadata', { keyPath: 'id' });
        store.createIndex('accountId', 'accountId'); store.createIndex('noteId', 'noteId');
        store.createIndex('test-status', 'syncStatus', { unique: true });
      };
      open.onerror = () => reject(open.error);
      open.onsuccess = () => { open.result.close(); resolve(); };
    });
    const repo = new LocalAttachmentMetadataRepository(); const a = metadata();
    await repo.putAttachment(a);
    await repo.putAttachment({ ...metadata('already-deleted'), syncStatus: 'deleted', deletedAt: removedAt });
    const put = vi.spyOn(IDBObjectStore.prototype, 'put');
    const result = await repo.tombstoneAttachmentForAccountNote(input(a));
    expect(result).toEqual({ status: 'INDETERMINATE' }); expect(Object.isFrozen(result)).toBe(true);
    expect(put).toHaveBeenCalledTimes(1);
    expect(await repo.getAttachment(a.id)).toEqual(a);
  });

  it('R11 distinguishes transaction creation failure from terminal abort', async () => {
    const repo = new LocalAttachmentMetadataRepository(); const a = metadata(); await repo.putAttachment(a);
    vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(() => { throw new Error('unavailable'); });
    expect(await repo.tombstoneAttachmentForAccountNote(input(a))).toEqual({ status: 'NOT_STARTED' });
  });

  it('R12 rejects A1 -> B -> A2 even with a permissive caller predicate', async () => {
    const repo = new LocalAttachmentMetadataRepository(); const a = metadata(); await repo.putAttachment(a);
    const operation = input(a);
    activateNotesAccountAuthority('B'); activateNotesAccountAuthority('A');
    expect(await repo.tombstoneAttachmentForAccountNote(operation)).toEqual({ status: 'DENIED' });
    expect(await repo.getAttachment(a.id)).toEqual(a);
  });

  it('R13 rejects a structurally copied request instead of trusting account/generation equality', async () => {
    const repo = new LocalAttachmentMetadataRepository(); const a = metadata(); await repo.putAttachment(a);
    const operation = input(a);
    expect(await repo.tombstoneAttachmentForAccountNote({ ...operation, request: { ...operation.request } })).toEqual({ status: 'DENIED' });
    expect(await repo.getAttachment(a.id)).toEqual(a);
  });
});
