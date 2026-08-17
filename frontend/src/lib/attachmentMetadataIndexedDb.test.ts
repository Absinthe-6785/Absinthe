// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountScopedAttachmentMetadata, AttachmentMetadata, BlobStorageAdapter } from './attachmentRepository';
import {
  ATTACHMENT_METADATA_DB_NAME,
  ATTACHMENT_METADATA_DB_VERSION,
  clearAttachmentMetadataIndexedDb,
  createLocalAttachmentMetadataRepository,
  normalizeAttachmentMetadata,
} from './attachmentMetadataIndexedDb';

const CREATED_AT = '2026-01-01T00:00:00.000Z';
const UPDATED_AT = '2026-01-02T00:00:00.000Z';

function sampleAttachment(id: string, noteId = 'note-1', accountId = 'account-a'): AccountScopedAttachmentMetadata {
  return {
    id,
    accountId,
    noteId,
    fileName: `${id}.pdf`,
    mimeType: 'application/pdf',
    size: 2048,
    checksum: `sha256:${id}`,
    localBlobKey: `local/${id}`,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    deletedAt: null,
    syncStatus: 'local',
  };
}

describe('attachment metadata IndexedDB repository', () => {
  beforeEach(async () => {
    try {
      await clearAttachmentMetadataIndexedDb();
    } catch {
      /** first open */
    }
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(ATTACHMENT_METADATA_DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Attachment metadata test database delete blocked'));
    });
  });

  it('uses an explicit local metadata store name', () => {
    expect(ATTACHMENT_METADATA_DB_NAME).toBe('absinthe.attachments.metadata');
    expect(ATTACHMENT_METADATA_DB_VERSION).toBe(2);
  });

  it('upgrades the legacy global store without assigning ownership to legacy records', async () => {
    const legacy = sampleAttachment('legacy-upgrade');
    delete (legacy as Partial<AccountScopedAttachmentMetadata>).accountId;
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(ATTACHMENT_METADATA_DB_NAME, 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('metadata', { keyPath: 'id' });
        store.createIndex('noteId', 'noteId', { unique: false });
        store.put(legacy);
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { request.result.close(); resolve(); };
    });

    const repo = createLocalAttachmentMetadataRepository();
    await expect(repo.getAttachment('legacy-upgrade')).resolves.toMatchObject({ id: 'legacy-upgrade' });
    await expect(repo.listAttachmentsForAccount?.('account-a')).resolves.toEqual([]);
    await expect(repo.deleteAttachmentMetadataForAccount?.('legacy-upgrade', 'account-a')).resolves.toBe(false);
  });

  it('creates and reads attachment metadata locally', async () => {
    const repo = createLocalAttachmentMetadataRepository();
    const attachment = sampleAttachment('att-1');

    await repo.putAttachment(attachment);

    await expect(repo.getAttachment('att-1')).resolves.toEqual(attachment);
  });

  it('lists attachment metadata by noteId', async () => {
    const repo = createLocalAttachmentMetadataRepository();

    await repo.putAttachment(sampleAttachment('att-1', 'note-1'));
    await repo.putAttachment(sampleAttachment('att-2', 'note-1'));
    await repo.putAttachment(sampleAttachment('att-3', 'note-2'));

    const noteAttachments = await repo.listAttachmentsForNote('note-1');
    expect(noteAttachments.map(item => item.id)).toEqual(['att-1', 'att-2']);
  });

  it('lists and conditionally deletes metadata inside one explicit account namespace', async () => {
    const repo = createLocalAttachmentMetadataRepository();
    await repo.putAttachment(sampleAttachment('att-a', 'note-a', 'account-a'));
    await repo.putAttachment(sampleAttachment('att-b', 'note-b', 'account-b'));
    await repo.putAttachment({ ...sampleAttachment('legacy'), accountId: undefined });

    await expect(repo.listAttachmentsForAccount?.('account-a')).resolves.toEqual([
      expect.objectContaining({ id: 'att-a', accountId: 'account-a' }),
    ]);
    await expect(repo.deleteAttachmentMetadataForAccount?.('att-b', 'account-a')).resolves.toBe(false);
    await expect(repo.getAttachment('att-b')).resolves.toMatchObject({ accountId: 'account-b' });
    await expect(repo.deleteAttachmentMetadataForAccount?.('att-a', 'account-a')).resolves.toBe(true);
    await expect(repo.getAttachment('att-a')).resolves.toBeNull();
    await expect(repo.getAttachment('legacy')).resolves.not.toBeNull();
  });

  it('updates metadata while preserving id and createdAt', async () => {
    const repo = createLocalAttachmentMetadataRepository();
    await repo.putAttachment(sampleAttachment('att-1'));

    await repo.updateAttachment('att-1', {
      id: 'changed',
      createdAt: '2030-01-01T00:00:00.000Z',
      fileName: 'renamed.pdf',
      updatedAt: '2026-01-03T00:00:00.000Z',
    });

    await expect(repo.getAttachment('att-1')).resolves.toMatchObject({
      id: 'att-1',
      createdAt: CREATED_AT,
      fileName: 'renamed.pdf',
      updatedAt: '2026-01-03T00:00:00.000Z',
    });
    await expect(repo.getAttachment('changed')).resolves.toBeNull();
  });

  it('tombstones metadata instead of requiring hard delete', async () => {
    const repo = createLocalAttachmentMetadataRepository();
    await repo.putAttachment(sampleAttachment('att-1'));

    await repo.tombstoneAttachment('att-1', '2026-01-04T00:00:00.000Z');

    await expect(repo.getAttachment('att-1')).resolves.toMatchObject({
      deletedAt: '2026-01-04T00:00:00.000Z',
      updatedAt: '2026-01-04T00:00:00.000Z',
      syncStatus: 'deleted',
    });
  });

  it('persists metadata across repository reloads', async () => {
    const firstRepo = createLocalAttachmentMetadataRepository();
    await firstRepo.putAttachment(sampleAttachment('att-1'));

    const secondRepo = createLocalAttachmentMetadataRepository();

    await expect(secondRepo.getAttachment('att-1')).resolves.toMatchObject({
      id: 'att-1',
      localBlobKey: 'local/att-1',
    });
  });

  it('hard deletes metadata only when explicitly requested', async () => {
    const repo = createLocalAttachmentMetadataRepository();
    await repo.putAttachment(sampleAttachment('att-1'));

    await repo.deleteAttachmentMetadata('att-1');

    await expect(repo.getAttachment('att-1')).resolves.toBeNull();
  });

  it('rejects raw blob data inside metadata fields', () => {
    expect(() => normalizeAttachmentMetadata({
      ...sampleAttachment('att-1'),
      thumbnailKey: 'data:image/png;base64,AAA111',
    })).toThrow('Attachment metadata cannot contain raw blob data');
  });

  it('persists optional remote metadata fields without requiring them for local attachments', async () => {
    const repo = createLocalAttachmentMetadataRepository();
    const remoteAttachment = sampleAttachment('att-remote');
    await repo.putAttachment({
      ...remoteAttachment,
      remoteProvider: 'googleDrive',
      remoteBlobKey: 'drive/appDataFolder/att-remote',
      remoteFileId: 'drive-file-1',
      remoteChecksum: 'sha256:remote',
      remoteSize: 2048,
      remoteMimeType: 'application/pdf',
      remoteSyncedAt: '2026-01-03T00:00:00.000Z',
      remoteUpdatedAt: '2026-01-03T00:00:00.000Z',
      remoteSyncStatus: 'synced',
    });
    await repo.putAttachment(sampleAttachment('att-local'));

    await expect(repo.getAttachment('att-remote')).resolves.toMatchObject({
      id: 'att-remote',
      localBlobKey: 'local/att-remote',
      remoteProvider: 'googleDrive',
      remoteBlobKey: 'drive/appDataFolder/att-remote',
      remoteFileId: 'drive-file-1',
      remoteSyncStatus: 'synced',
    });
    const local = await repo.getAttachment('att-local');
    expect(local).toMatchObject({ id: 'att-local' });
    expect(local).not.toHaveProperty('remoteProvider');
    expect(local).not.toHaveProperty('remoteSyncStatus');
  });

  it('local metadata operations do not call remote blob adapters', async () => {
    const adapter: BlobStorageAdapter = {
      putBlob: vi.fn(),
      getBlob: vi.fn(),
      deleteBlob: vi.fn(),
      getObjectUrl: vi.fn(),
    };
    const repo = createLocalAttachmentMetadataRepository();

    await repo.putAttachment(sampleAttachment('att-1'));
    await repo.getAttachment('att-1');
    await repo.listAttachmentsForNote('note-1');
    await repo.tombstoneAttachment('att-1');

    expect(adapter.putBlob).not.toHaveBeenCalled();
    expect(adapter.getBlob).not.toHaveBeenCalled();
    expect(adapter.deleteBlob).not.toHaveBeenCalled();
    expect(adapter.getObjectUrl).not.toHaveBeenCalled();
  });
});
