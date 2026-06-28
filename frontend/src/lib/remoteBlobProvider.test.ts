import { describe, expect, it } from 'vitest';
import { noteSyncPayload, type NoteBase } from '../components/views/noteUtils';
import type { AttachmentMetadata, AttachmentRemoteSyncStatus } from './attachmentRepository';
import { isAttachmentMetadataLightweight } from './attachmentRepository';
import {
  NullRemoteBlobProvider,
  RemoteBlobProviderUnavailableError,
  sanitizeRemoteBlobProviderError,
  sanitizeRemoteBlobProviderErrorMessage,
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

describe('remote blob provider error sanitization', () => {
  it('redacts OAuth tokens, authorization headers, and cookie headers', () => {
    const sanitized = sanitizeRemoteBlobProviderErrorMessage(
      'Authorization: Bearer ya29.access-token, Set-Cookie: session=secret, refresh_token=refresh-1&access_token=access-1&id_token=id-1&code=auth-code'
    );

    expect(sanitized).toContain('Authorization: [redacted-secret]');
    expect(sanitized).toContain('Set-Cookie: [redacted-secret]');
    expect(sanitized).toContain('refresh_token=[redacted-secret]');
    expect(sanitized).toContain('access_token=[redacted-secret]');
    expect(sanitized).toContain('id_token=[redacted-secret]');
    expect(sanitized).toContain('code=[redacted-secret]');
    expect(sanitized).not.toContain('ya29.access-token');
    expect(sanitized).not.toContain('refresh-1');
    expect(sanitized).not.toContain('auth-code');
  });

  it('redacts bare camelCase code verifier forms', () => {
    const sanitized = sanitizeRemoteBlobProviderErrorMessage(
      `failed codeVerifier=super-secret-verifier "codeVerifier":"json-secret-verifier" codeVerifier: colon-secret-verifier 'codeVerifier': 'single-secret-verifier'`
    );

    expect(sanitized).toContain('codeVerifier=[redacted-secret]');
    expect(sanitized).toContain('"codeVerifier":"[redacted-secret]"');
    expect(sanitized).toContain('codeVerifier: [redacted-secret]');
    expect(sanitized).not.toContain('super-secret-verifier');
    expect(sanitized).not.toContain('json-secret-verifier');
    expect(sanitized).not.toContain('colon-secret-verifier');
    expect(sanitized).not.toContain('single-secret-verifier');
  });

  it('redacts Google OAuth URLs that carry query secrets', () => {
    const sanitized = sanitizeRemoteBlobProviderErrorMessage(
      'POST https://oauth2.googleapis.com/token?client_secret=secret-1&code=code-1 failed'
    );

    expect(sanitized).toBe(`POST [redacted-remote-url] failed`);
    expect(sanitized).not.toContain('client_secret');
    expect(sanitized).not.toContain('code-1');
  });

  it('redacts Drive resumable upload session URLs and upload ids', () => {
    const sanitized = sanitizeRemoteBlobProviderErrorMessage(
      'Resume at https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=ABCD1234 with upload_id=ABCD1234'
    );

    expect(sanitized).toContain('[redacted-remote-url]');
    expect(sanitized).toContain('upload_id=[redacted-secret]');
    expect(sanitized).not.toContain('ABCD1234');
    expect(sanitized).not.toContain('https://www.googleapis.com/upload/drive/v3/files');
  });

  it('redacts signed URLs and embedded blob data', () => {
    const sanitized = sanitizeRemoteBlobProviderErrorMessage(
      'Failed https://storage.example.test/blob?X-Goog-Signature=sig-1 payload data:image/png;base64,AAA111BBB222'
    );

    expect(sanitized).toContain('[redacted-remote-url]');
    expect(sanitized).toContain('[redacted-blob-data]');
    expect(sanitized).not.toContain('sig-1');
    expect(sanitized).not.toContain('AAA111BBB222');
  });

  it('returns structured safe remote errors without raw response objects', () => {
    const sanitized = sanitizeRemoteBlobProviderError(
      {
        status: 401,
        access_token: 'must-not-leak',
        headers: {
          Authorization: 'Bearer must-not-leak',
        },
      },
      {
        category: 'auth',
        retryable: false,
        code: 'reauth_required',
      }
    );

    expect(sanitized).toEqual({
      message: 'Remote provider request failed with status 401.',
      category: 'auth',
      retryable: false,
      code: 'reauth_required',
    });
    expect(JSON.stringify(sanitized)).not.toContain('must-not-leak');
  });
});
