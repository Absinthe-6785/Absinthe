import { describe, expect, it } from 'vitest';
import { noteSyncPayload, type NoteBase } from '../components/views/noteUtils';
import type { AttachmentMetadata, AttachmentRemoteSyncStatus } from './attachmentRepository';
import { isAttachmentMetadataLightweight } from './attachmentRepository';
import {
  NullRemoteBlobProvider,
  RemoteBlobProviderUnavailableError,
  type RemoteBlobProviderCapabilities,
  type RemoteBlobProviderType,
} from './remoteBlobProvider';

const providerTypes = ['googleDrive', 'icloud', 'r2', 's3', 'custom'] satisfies RemoteBlobProviderType[];

function localMetadata(overrides: Partial<AttachmentMetadata> = {}): AttachmentMetadata {
  return {
    id: 'att-1',
    noteId: 'note-1',
    fileName: 'scan.png',
    mimeType: 'image/png',
    size: 128,
    checksum: 'fnv1a:local',
    localBlobKey: 'local-attachment/att-1',
    createdAt: '2026-06-27T00:00:00.000Z',
    updatedAt: '2026-06-27T00:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local',
    ...overrides,
  };
}

describe('remote blob provider contract', () => {
  it('defines the supported future remote provider types', () => {
    expect(providerTypes).toEqual(['googleDrive', 'icloud', 'r2', 's3', 'custom']);
  });

  it('can represent a future Google Drive resumable upload provider without implementing it', () => {
    const capabilities: RemoteBlobProviderCapabilities = {
      supportsUpload: true,
      supportsDownload: true,
      supportsDelete: false,
      supportsResumableUpload: true,
      supportsAppPrivateStorage: true,
      supportsChecksum: true,
      supportsQuotaInfo: true,
    };

    expect(capabilities).toMatchObject({
      supportsUpload: true,
      supportsResumableUpload: true,
      supportsDelete: false,
      supportsAppPrivateStorage: true,
    });
  });

  it('NullRemoteBlobProvider reports unconfigured and performs no remote upload or download', async () => {
    const provider = new NullRemoteBlobProvider();

    await expect(provider.getConnectionStatus()).resolves.toMatchObject({
      providerType: 'custom',
      state: 'unconfigured',
    });
    expect(provider.capabilities).toEqual({
      supportsUpload: false,
      supportsDownload: false,
      supportsDelete: false,
      supportsResumableUpload: false,
      supportsAppPrivateStorage: false,
      supportsChecksum: false,
      supportsQuotaInfo: false,
    });
    await expect(provider.getBlobInfo({ remoteBlobKey: 'remote/att-1' })).resolves.toBeNull();
    await expect(provider.uploadBlob({
      attachmentId: 'att-1',
      blob: new Blob(['hello'], { type: 'text/plain' }),
      mimeType: 'text/plain',
    })).rejects.toBeInstanceOf(RemoteBlobProviderUnavailableError);
    await expect(provider.downloadBlob({ remoteBlobKey: 'remote/att-1' })).rejects.toBeInstanceOf(RemoteBlobProviderUnavailableError);
  });

  it('keeps existing local-only attachment metadata valid without remote fields', () => {
    const metadata = localMetadata();

    expect(metadata.remoteProvider).toBeUndefined();
    expect(metadata.remoteSyncStatus).toBeUndefined();
    expect(isAttachmentMetadataLightweight(metadata)).toBe(true);
  });

  it('allows optional lightweight remote metadata while keeping local and remote keys distinct', () => {
    const remoteSyncStatus: AttachmentRemoteSyncStatus = 'synced';
    const metadata = localMetadata({
      remoteProvider: 'googleDrive',
      remoteBlobKey: 'drive/appDataFolder/blob-att-1',
      remoteFileId: 'drive-file-id-1',
      remoteChecksum: 'sha256:remote',
      remoteSize: 128,
      remoteMimeType: 'image/png',
      remoteSyncedAt: '2026-06-27T00:05:00.000Z',
      remoteUpdatedAt: '2026-06-27T00:04:00.000Z',
      remoteSyncStatus,
    });

    expect(metadata.localBlobKey).toBe('local-attachment/att-1');
    expect(metadata.remoteBlobKey).toBe('drive/appDataFolder/blob-att-1');
    expect(metadata.remoteBlobKey).not.toBe(metadata.localBlobKey);
    expect(metadata.remoteProvider).toBe('googleDrive');
    expect(metadata.remoteSyncStatus).toBe('synced');
    expect(isAttachmentMetadataLightweight(metadata)).toBe(true);
  });

  it('rejects raw blob/base64/data-url shaped values in remote metadata fields', () => {
    const metadata = localMetadata({
      remoteBlobKey: 'data:image/png;base64,AAA111',
    });

    expect(isAttachmentMetadataLightweight(metadata)).toBe(false);
  });

  it('does not require remote metadata to contain Blob, File, ArrayBuffer, object URLs, or base64', () => {
    const metadata = localMetadata({
      remoteProvider: 'custom',
      remoteBlobKey: 'provider/blob-key',
      remoteFileId: 'file-id',
      remoteSyncStatus: 'pending_upload',
    });
    const serialized = JSON.stringify(metadata);

    expect(serialized).not.toContain('data:image');
    expect(serialized).not.toContain(';base64,');
    expect(serialized).not.toContain('blob:');
    expect(serialized).not.toContain('ArrayBuffer');
    expect(serialized).not.toContain('"raw"');
    expect(serialized).not.toContain('"bytes"');
  });

  it('note sync payload strips raw blob data but preserves attachment references', () => {
    const note: NoteBase = {
      id: 'note-1',
      title: 'Attachment note',
      body: 'keep attachment://att-1 and strip data:image/png;base64,AAA111',
      updatedAt: 1,
      folderId: null,
      deletedAt: null,
    };

    const payload = noteSyncPayload(note);
    const serialized = JSON.stringify(payload);

    expect(serialized).toContain('attachment://att-1');
    expect(serialized).not.toContain('data:image/png;base64,AAA111');
    expect(serialized).not.toContain(';base64,');
  });
});
