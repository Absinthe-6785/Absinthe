import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  createGoogleDriveBlobProvider,
  GoogleDriveBlobAdapter,
  GoogleDriveBlobUploadError,
  type GoogleDriveAccessTokenProvider,
} from './googleDriveBlobAdapter';
import type { RemoteBlobUploadInput } from './remoteBlobProvider';

interface FetchCall {
  readonly url: string;
  readonly init?: RequestInit;
}

function headersFromInit(init: RequestInit | undefined): Headers {
  return new Headers(init?.headers);
}

function jsonBody(init: RequestInit | undefined): Record<string, unknown> {
  return JSON.parse(String(init?.body));
}

function textBlob(text: string, type = 'text/plain'): Blob {
  return new Blob([text], { type });
}

function uploadInput(overrides: Partial<RemoteBlobUploadInput> = {}): RemoteBlobUploadInput {
  const blob = textBlob('hello world');
  return {
    attachmentId: 'att-1',
    localBlobKey: 'local/att-1',
    blob,
    fileName: 'scan.txt',
    mimeType: 'text/plain',
    size: blob.size,
    checksum: 'md5:abc123abc123abc123abc123abc123ab',
    ...overrides,
  };
}

function tokenProvider(token = 'access-token-secret'): GoogleDriveAccessTokenProvider {
  return {
    getAccessToken: vi.fn(async () => token),
  };
}

function responseJson(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...Object.fromEntries(new Headers(init.headers).entries()),
    },
  });
}

function responseWithLocation(location: string): Response {
  return new Response(null, {
    status: 200,
    headers: {
      Location: location,
    },
  });
}

function createMockFetch(responses: Response[]): {
  readonly fetcher: typeof fetch;
  readonly calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      init,
    });

    const response = responses.shift();
    if (!response) {
      throw new Error('Unexpected fetch call');
    }

    return response;
  }) as unknown as typeof fetch;

  return { fetcher, calls };
}

describe('GoogleDriveBlobAdapter', () => {
  it('reports googleDrive provider type and upload-only resumable capabilities', () => {
    const adapter = createGoogleDriveBlobProvider({
      accessTokenProvider: tokenProvider(),
      fetcher: vi.fn() as unknown as typeof fetch,
    });

    expect(adapter).toBeInstanceOf(GoogleDriveBlobAdapter);
    expect(adapter.providerType).toBe('googleDrive');
    expect(adapter.capabilities).toMatchObject({
      supportsUpload: true,
      supportsDownload: true,
      supportsDelete: false,
      supportsResumableUpload: true,
      supportsAppPrivateStorage: true,
      supportsChecksum: true,
    });
    expect('deleteBlob' in adapter).toBe(false);
  });

  it('starts a Drive appDataFolder resumable session and uploads a chunk', async () => {
    const sessionUri = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session-secret';
    const { fetcher, calls } = createMockFetch([
      responseWithLocation(sessionUri),
      responseJson({
        id: 'drive-file-1',
        name: 'scan.txt',
        mimeType: 'text/plain',
        size: '11',
        md5Checksum: 'abc123abc123abc123abc123abc123ab',
        modifiedTime: '2026-06-27T00:00:00.000Z',
      }),
    ]);
    const adapter = new GoogleDriveBlobAdapter({
      accessTokenProvider: tokenProvider(),
      fetcher,
      chunkSizeBytes: 1024,
      now: () => new Date('2026-06-27T00:01:00.000Z'),
    });

    const result = await adapter.uploadBlob(uploadInput());

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable');
    expect(calls[0].url).toContain('fields=id');
    expect(calls[0].init?.method).toBe('POST');
    expect(headersFromInit(calls[0].init).get('Authorization')).toBe('Bearer access-token-secret');
    expect(headersFromInit(calls[0].init).get('X-Upload-Content-Type')).toBe('text/plain');
    expect(headersFromInit(calls[0].init).get('X-Upload-Content-Length')).toBe('11');
    expect(jsonBody(calls[0].init)).toEqual({
      name: 'scan.txt',
      mimeType: 'text/plain',
      parents: ['appDataFolder'],
    });

    expect(calls[1].url).toBe(sessionUri);
    expect(calls[1].init?.method).toBe('PUT');
    expect(headersFromInit(calls[1].init).get('Content-Range')).toBe('bytes 0-10/11');
    expect(calls[1].init?.body).toBeInstanceOf(Blob);

    expect(result).toMatchObject({
      providerType: 'googleDrive',
      remoteProvider: 'googleDrive',
      attachmentId: 'att-1',
      remoteFileId: 'drive-file-1',
      remoteSize: 11,
      remoteChecksum: 'abc123abc123abc123abc123abc123ab',
      remoteMimeType: 'text/plain',
      remoteSyncedAt: '2026-06-27T00:01:00.000Z',
      verification: {
        sizeVerified: true,
        checksumVerified: true,
        checksumAlgorithm: 'md5',
      },
    });
    expect(JSON.stringify(result)).not.toContain('session-secret');
    expect(JSON.stringify(result)).not.toContain(sessionUri);
  });

  it('continues after 308 Resume Incomplete using deterministic chunk ranges', async () => {
    const sessionUri = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session-secret';
    const blob = textBlob('abcdef');
    const { fetcher, calls } = createMockFetch([
      responseWithLocation(sessionUri),
      new Response(null, {
        status: 308,
        headers: {
          Range: 'bytes=0-2',
        },
      }),
      responseJson({
        id: 'drive-file-2',
        mimeType: 'text/plain',
        size: '6',
        md5Checksum: 'abc123abc123abc123abc123abc123ab',
      }),
    ]);
    const adapter = new GoogleDriveBlobAdapter({
      accessTokenProvider: tokenProvider(),
      fetcher,
      chunkSizeBytes: 3,
    });

    await adapter.uploadBlob(uploadInput({ blob, size: blob.size }));

    expect(calls).toHaveLength(3);
    expect(headersFromInit(calls[1].init).get('Content-Range')).toBe('bytes 0-2/6');
    expect(headersFromInit(calls[2].init).get('Content-Range')).toBe('bytes 3-5/6');
  });

  it('fails safely with a sanitized error when remote size mismatches', async () => {
    const sessionUri = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session-secret';
    const { fetcher } = createMockFetch([
      responseWithLocation(sessionUri),
      responseJson({
        id: 'drive-file-1',
        size: '999',
        md5Checksum: 'abc123abc123abc123abc123abc123ab',
      }),
    ]);
    const adapter = new GoogleDriveBlobAdapter({
      accessTokenProvider: tokenProvider(),
      fetcher,
    });

    await expect(adapter.uploadBlob(uploadInput())).rejects.toMatchObject({
      name: 'GoogleDriveBlobUploadError',
      sanitized: {
        code: 'size_mismatch',
      },
    });
  });

  it('fails safely with a sanitized error when compatible md5 mismatches', async () => {
    const sessionUri = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session-secret';
    const { fetcher } = createMockFetch([
      responseWithLocation(sessionUri),
      responseJson({
        id: 'drive-file-1',
        size: '11',
        md5Checksum: 'ffffffffffffffffffffffffffffffff',
      }),
    ]);
    const adapter = new GoogleDriveBlobAdapter({
      accessTokenProvider: tokenProvider(),
      fetcher,
    });

    await expect(adapter.uploadBlob(uploadInput())).rejects.toMatchObject({
      name: 'GoogleDriveBlobUploadError',
      sanitized: {
        code: 'checksum_mismatch',
      },
    });
  });

  it('does not pretend incompatible checksums are verified', async () => {
    const sessionUri = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session-secret';
    const { fetcher } = createMockFetch([
      responseWithLocation(sessionUri),
      responseJson({
        id: 'drive-file-1',
        size: '11',
        md5Checksum: 'abc123abc123abc123abc123abc123ab',
      }),
    ]);
    const adapter = new GoogleDriveBlobAdapter({
      accessTokenProvider: tokenProvider(),
      fetcher,
    });

    const result = await adapter.uploadBlob(uploadInput({ checksum: 'sha256:not-compatible' }));

    expect(result.verification).toMatchObject({
      sizeVerified: true,
      checksumVerified: false,
    });
    expect(result.verification?.checksumAlgorithm).toBeUndefined();
    expect(result.verification?.warnings).toContain('Local checksum algorithm is not compatible with Google Drive md5Checksum.');
  });

  it('sanitizes token provider failures without calling Google endpoints', async () => {
    const tokenProviderFailure: GoogleDriveAccessTokenProvider = {
      getAccessToken: vi.fn(async () => {
        throw new Error('Authorization: Bearer access-token-secret refresh_token=refresh-secret');
      }),
    };
    const fetcher = vi.fn() as unknown as typeof fetch;
    const adapter = new GoogleDriveBlobAdapter({
      accessTokenProvider: tokenProviderFailure,
      fetcher,
    });

    await expect(adapter.uploadBlob(uploadInput())).rejects.toMatchObject({
      name: 'GoogleDriveBlobUploadError',
      sanitized: {
        code: 'auth_unavailable',
        category: 'auth',
      },
    });
    await adapter.uploadBlob(uploadInput()).catch((error: unknown) => {
      expect(error).toBeInstanceOf(GoogleDriveBlobUploadError);
      const message = String((error as GoogleDriveBlobUploadError).message);
      expect(message).not.toContain('access-token-secret');
      expect(message).not.toContain('refresh-secret');
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not include session URI, token, or raw response body in upload errors', async () => {
    const sessionUri = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session-secret';
    const { fetcher } = createMockFetch([
      responseWithLocation(sessionUri),
      new Response('raw body access-token-secret session-secret data:image/png;base64,AAA111', {
        status: 500,
      }),
    ]);
    const adapter = new GoogleDriveBlobAdapter({
      accessTokenProvider: tokenProvider(),
      fetcher,
    });

    await adapter.uploadBlob(uploadInput()).catch((error: unknown) => {
      expect(error).toBeInstanceOf(GoogleDriveBlobUploadError);
      const serialized = JSON.stringify(error);
      const message = String((error as GoogleDriveBlobUploadError).message);
      expect(message).toContain('Google Drive is unavailable');
      expect((error as GoogleDriveBlobUploadError).sanitized.code).toBe('provider_unavailable');
      expect(serialized).not.toContain('access-token-secret');
      expect(serialized).not.toContain('session-secret');
      expect(serialized).not.toContain('AAA111');
      expect(serialized).not.toContain(sessionUri);
    });
  });

  it('classifies upload session HTTP failures without exposing unsafe provider bodies', async () => {
    const cases = [
      { status: 400, code: 'session_start_failed', category: 'upload', retryable: true },
      { status: 401, code: 'auth_expired', category: 'auth', retryable: false },
      { status: 403, code: 'authorization_failed', category: 'auth', retryable: false },
      { status: 404, code: 'remote_file_missing', category: 'upload', retryable: false },
      { status: 409, code: 'remote_conflict', category: 'upload', retryable: false },
      { status: 429, code: 'rate_limited', category: 'upload', retryable: true },
      { status: 500, code: 'provider_unavailable', category: 'upload', retryable: true },
    ] as const;

    for (const item of cases) {
      const body = JSON.stringify({
        error: `access_token=token-secret refresh_token=refresh-secret id_token=id-secret code=auth-secret code_verifier=verifier-secret codeVerifier=camel-secret`,
        callback: 'http://127.0.0.1:5173/oauth/google-drive/callback?code=callback-secret&state=state-secret',
        Authorization: 'Bearer bearer-secret',
        image: 'data:image/png;base64,AAA111',
      });
      const { fetcher } = createMockFetch([new Response(body, { status: item.status })]);
      const adapter = new GoogleDriveBlobAdapter({
        accessTokenProvider: tokenProvider(),
        fetcher,
      });

      await adapter.uploadBlob(uploadInput()).catch((error: unknown) => {
        expect(error, String(item.status)).toBeInstanceOf(GoogleDriveBlobUploadError);
        expect((error as GoogleDriveBlobUploadError).sanitized).toMatchObject({
          code: item.code,
          category: item.category,
          retryable: item.retryable,
        });
        const serialized = JSON.stringify(error);
        expect(serialized).not.toContain('token-secret');
        expect(serialized).not.toContain('refresh-secret');
        expect(serialized).not.toContain('id-secret');
        expect(serialized).not.toContain('auth-secret');
        expect(serialized).not.toContain('verifier-secret');
        expect(serialized).not.toContain('camel-secret');
        expect(serialized).not.toContain('bearer-secret');
        expect(serialized).not.toContain('callback-secret');
        expect(serialized).not.toContain('AAA111');
        expect(serialized).not.toContain('/oauth/google-drive/callback?code=');
      });
    }
  });

  it('classifies upload chunk failures, invalid final bodies, and fetch rejections safely', async () => {
    const sessionUri = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session-secret';
    const chunkCases = [
      { status: 401, code: 'auth_expired', category: 'auth', retryable: false },
      { status: 403, code: 'authorization_failed', category: 'auth', retryable: false },
      { status: 404, code: 'remote_file_missing', category: 'upload', retryable: false },
      { status: 409, code: 'remote_conflict', category: 'upload', retryable: false },
      { status: 429, code: 'rate_limited', category: 'upload', retryable: true },
      { status: 503, code: 'provider_unavailable', category: 'upload', retryable: true },
    ] as const;

    for (const item of chunkCases) {
      const { fetcher } = createMockFetch([
        responseWithLocation(sessionUri),
        new Response('<html>Authorization: Bearer token-secret access_token=secret data:image/png;base64,AAA111</html>', { status: item.status }),
      ]);
      const adapter = new GoogleDriveBlobAdapter({
        accessTokenProvider: tokenProvider(),
        fetcher,
      });

      await adapter.uploadBlob(uploadInput()).catch((error: unknown) => {
        expect(error, String(item.status)).toBeInstanceOf(GoogleDriveBlobUploadError);
        expect((error as GoogleDriveBlobUploadError).sanitized).toMatchObject({
          code: item.code,
          category: item.category,
          retryable: item.retryable,
        });
        const serialized = JSON.stringify(error);
        expect(serialized).not.toContain('token-secret');
        expect(serialized).not.toContain('access_token=secret');
        expect(serialized).not.toContain('AAA111');
        expect(serialized).not.toContain('session-secret');
      });
    }

    const invalidJson = new GoogleDriveBlobAdapter({
      accessTokenProvider: tokenProvider(),
      fetcher: createMockFetch([
        responseWithLocation(sessionUri),
        new Response('<html>access_token=secret</html>', { status: 200 }),
      ]).fetcher,
    });
    await expect(invalidJson.uploadBlob(uploadInput())).rejects.toMatchObject({
      sanitized: {
        code: 'invalid_response',
        retryable: false,
      },
    });

    const emptyBody = new GoogleDriveBlobAdapter({
      accessTokenProvider: tokenProvider(),
      fetcher: createMockFetch([
        responseWithLocation(sessionUri),
        new Response('', { status: 200 }),
      ]).fetcher,
    });
    await expect(emptyBody.uploadBlob(uploadInput())).rejects.toMatchObject({
      sanitized: {
        code: 'invalid_response',
      },
    });

    const bodyReadFailureResponse = {
      ok: true,
      status: 200,
      json: vi.fn(async () => {
        throw new Error('json read failed Authorization: Bearer token-secret');
      }),
    } as unknown as Response;
    const bodyReadFailure = new GoogleDriveBlobAdapter({
      accessTokenProvider: tokenProvider(),
      fetcher: createMockFetch([
        responseWithLocation(sessionUri),
        bodyReadFailureResponse,
      ]).fetcher,
    });
    await bodyReadFailure.uploadBlob(uploadInput()).catch((error: unknown) => {
      expect(error).toBeInstanceOf(GoogleDriveBlobUploadError);
      expect((error as GoogleDriveBlobUploadError).sanitized.code).toBe('invalid_response');
      expect(JSON.stringify(error)).not.toContain('token-secret');
    });

    const rejectionAdapter = new GoogleDriveBlobAdapter({
      accessTokenProvider: tokenProvider(),
      fetcher: vi.fn(async () => {
        throw new Error('network failed Authorization: Bearer token-secret access_token=secret');
      }) as unknown as typeof fetch,
    });
    await rejectionAdapter.uploadBlob(uploadInput()).catch((error: unknown) => {
      expect(error).toBeInstanceOf(GoogleDriveBlobUploadError);
      expect((error as GoogleDriveBlobUploadError).sanitized).toMatchObject({
        code: 'network_failed',
        retryable: true,
      });
      expect(JSON.stringify(error)).not.toContain('token-secret');
      expect(JSON.stringify(error)).not.toContain('access_token=secret');
    });
  });

  it('does not call OAuth token endpoints, store tokens, mutate metadata, or delete blobs', async () => {
    const adapterSource = readFileSync(join(process.cwd(), 'src/lib/googleDriveBlobAdapter.ts'), 'utf8');

    expect(adapterSource).not.toContain('oauth2.googleapis.com/token');
    expect(adapterSource).not.toContain('refresh_token');
    expect(adapterSource).not.toContain('client_secret');
    expect(adapterSource).not.toContain('localStorage');
    expect(adapterSource).not.toContain('indexedDB');
    expect(adapterSource).not.toContain('deleteBlob');
    expect(adapterSource).not.toContain('cleanup');
    expect(adapterSource).not.toContain('AttachmentMetadata');
    expect(adapterSource).not.toContain('useNotesStore');
  });

  it('downloads Drive file media through injected access token without exposing token', async () => {
    const { fetcher, calls } = createMockFetch([
      new Response(new Blob(['hello world'], { type: 'text/plain' }), {
        status: 200,
      }),
    ]);
    const adapter = new GoogleDriveBlobAdapter({
      accessTokenProvider: tokenProvider(),
      fetcher,
      now: () => new Date('2026-06-27T00:02:00.000Z'),
    });

    const result = await adapter.downloadBlob({
      attachmentId: 'att-1',
      remoteFileId: 'drive-file-1',
      expectedSize: 11,
      expectedMimeType: 'text/plain',
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://www.googleapis.com/drive/v3/files/drive-file-1?alt=media');
    expect(calls[0].init?.method).toBe('GET');
    expect(headersFromInit(calls[0].init).get('Authorization')).toBe('Bearer access-token-secret');
    expect(result).toMatchObject({
      providerType: 'googleDrive',
      remoteProvider: 'googleDrive',
      remoteFileId: 'drive-file-1',
      remoteSize: 11,
      remoteMimeType: 'text/plain',
      downloadedAt: '2026-06-27T00:02:00.000Z',
    });
    expect(JSON.stringify(result)).not.toContain('access-token-secret');
  });

  it('sanitizes Drive download failures without exposing raw response bodies', async () => {
    const { fetcher } = createMockFetch([
      new Response('raw body access-token-secret session-secret data:image/png;base64,AAA111', {
        status: 503,
      }),
    ]);
    const adapter = new GoogleDriveBlobAdapter({
      accessTokenProvider: tokenProvider(),
      fetcher,
    });

    await adapter.downloadBlob({ remoteFileId: 'drive-file-1' }).catch((error: unknown) => {
      expect(error).toBeInstanceOf(GoogleDriveBlobUploadError);
      const serialized = JSON.stringify(error);
      expect(String((error as GoogleDriveBlobUploadError).message)).toContain('status 503');
      expect(serialized).not.toContain('access-token-secret');
      expect(serialized).not.toContain('session-secret');
      expect(serialized).not.toContain('AAA111');
    });
  });

  it('classifies Drive download HTTP failures without exposing unsafe provider bodies', async () => {
    const cases = [
      { status: 400, code: 'download_failed', category: 'provider', retryable: false },
      { status: 401, code: 'auth_expired', category: 'auth', retryable: false },
      { status: 403, code: 'authorization_failed', category: 'auth', retryable: false },
      { status: 404, code: 'remote_file_missing', category: 'provider', retryable: false },
      { status: 429, code: 'rate_limited', category: 'provider', retryable: true },
      { status: 500, code: 'provider_unavailable', category: 'provider', retryable: true },
    ] as const;

    for (const item of cases) {
      const body = JSON.stringify({
        error: `access_token=token-secret refresh_token=refresh-secret code=auth-secret code_verifier=verifier-secret`,
        callback: 'http://127.0.0.1:5173/oauth/google-drive/callback?code=callback-secret&state=state-secret',
        Authorization: 'Bearer bearer-secret',
      });
      const { fetcher } = createMockFetch([new Response(body, { status: item.status })]);
      const adapter = new GoogleDriveBlobAdapter({
        accessTokenProvider: tokenProvider(),
        fetcher,
      });

      await adapter.downloadBlob({ remoteFileId: 'drive-file-1', expectedSize: 11 }).catch((error: unknown) => {
        expect(error, String(item.status)).toBeInstanceOf(GoogleDriveBlobUploadError);
        expect((error as GoogleDriveBlobUploadError).sanitized).toMatchObject({
          code: item.code,
          category: item.category,
          retryable: item.retryable,
        });
        const serialized = JSON.stringify(error);
        expect(serialized).not.toContain('token-secret');
        expect(serialized).not.toContain('refresh-secret');
        expect(serialized).not.toContain('auth-secret');
        expect(serialized).not.toContain('verifier-secret');
        expect(serialized).not.toContain('bearer-secret');
        expect(serialized).not.toContain('/oauth/google-drive/callback?code=');
      });
    }
  });

  it('fails Drive download safely on network rejection, empty body, and blob read failure', async () => {
    const rejectionFetcher = vi.fn(async () => {
      throw new Error('network failed Authorization: Bearer token-secret');
    }) as unknown as typeof fetch;
    const rejectionAdapter = new GoogleDriveBlobAdapter({
      accessTokenProvider: tokenProvider(),
      fetcher: rejectionFetcher,
    });

    await rejectionAdapter.downloadBlob({ remoteFileId: 'drive-file-1' }).catch((error: unknown) => {
      expect(error).toBeInstanceOf(GoogleDriveBlobUploadError);
      expect((error as GoogleDriveBlobUploadError).sanitized).toMatchObject({
        code: 'download_failed',
        category: 'network',
        retryable: true,
      });
      expect(JSON.stringify(error)).not.toContain('token-secret');
    });

    const emptyAdapter = new GoogleDriveBlobAdapter({
      accessTokenProvider: tokenProvider(),
      fetcher: createMockFetch([new Response(new Blob([], { type: 'text/plain' }), { status: 200 })]).fetcher,
    });
    await expect(emptyAdapter.downloadBlob({ remoteFileId: 'drive-file-1', expectedSize: 11 })).rejects.toMatchObject({
      sanitized: {
        code: 'invalid_remote_response',
        category: 'provider',
        retryable: true,
      },
    });

    const blobFailureResponse = {
      ok: true,
      status: 200,
      blob: vi.fn(async () => {
        throw new Error('blob read failed access_token=token-secret');
      }),
    } as unknown as Response;
    const blobFailureAdapter = new GoogleDriveBlobAdapter({
      accessTokenProvider: tokenProvider(),
      fetcher: vi.fn(async () => blobFailureResponse) as unknown as typeof fetch,
    });
    await blobFailureAdapter.downloadBlob({ remoteFileId: 'drive-file-1', expectedSize: 11 }).catch((error: unknown) => {
      expect(error).toBeInstanceOf(GoogleDriveBlobUploadError);
      expect((error as GoogleDriveBlobUploadError).sanitized).toMatchObject({
        code: 'invalid_remote_response',
        category: 'provider',
        retryable: true,
      });
      expect(JSON.stringify(error)).not.toContain('token-secret');
    });
  });

  it('does not implement remote delete in K-163', async () => {
    const adapter = new GoogleDriveBlobAdapter({
      accessTokenProvider: tokenProvider(),
      fetcher: vi.fn() as unknown as typeof fetch,
    });

    await expect(adapter.getBlobInfo({ remoteFileId: 'drive-file-1' })).resolves.toBeNull();
    expect(adapter.capabilities.supportsDelete).toBe(false);
    expect('deleteBlob' in adapter).toBe(false);
  });
});
