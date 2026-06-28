import {
  RemoteBlobProviderUnavailableError,
  sanitizeRemoteBlobProviderError,
  type RemoteBlobDownloadInput,
  type RemoteBlobInfoInput,
  type RemoteBlobInfoResult,
  type RemoteBlobProvider,
  type RemoteBlobProviderCapabilities,
  type RemoteBlobProviderConnectionStatus,
  type RemoteBlobUploadInput,
  type RemoteBlobUploadResult,
  type RemoteBlobUploadVerification,
  type RemoteBlobDownloadResult,
  type SanitizedRemoteBlobProviderError,
} from './remoteBlobProvider';
export type { GoogleDriveAccessTokenProvider } from './googleDriveConnectionBoundary';
import type { GoogleDriveAccessTokenProvider } from './googleDriveConnectionBoundary';

export interface GoogleDriveBlobAdapterOptions {
  readonly accessTokenProvider: GoogleDriveAccessTokenProvider;
  readonly fetcher?: typeof fetch;
  readonly chunkSizeBytes?: number;
  readonly now?: () => Date;
}

export class GoogleDriveBlobUploadError extends Error {
  readonly sanitized: SanitizedRemoteBlobProviderError;

  constructor(sanitized: SanitizedRemoteBlobProviderError) {
    super(sanitized.message);
    this.name = 'GoogleDriveBlobUploadError';
    this.sanitized = sanitized;
  }
}

interface GoogleDriveFileMetadata {
  readonly id?: string;
  readonly name?: string;
  readonly mimeType?: string;
  readonly size?: string | number;
  readonly md5Checksum?: string;
  readonly modifiedTime?: string;
}

const DEFAULT_CHUNK_SIZE_BYTES = 256 * 1024;
const GOOGLE_DRIVE_RESUMABLE_UPLOAD_URL =
  'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,md5Checksum,modifiedTime';

function sanitizeUploadError(error: unknown, code: string): GoogleDriveBlobUploadError {
  return new GoogleDriveBlobUploadError(
    sanitizeRemoteBlobProviderError(error, {
      category: code === 'auth_unavailable' ? 'auth' : 'upload',
      retryable: code !== 'checksum_mismatch' && code !== 'size_mismatch' && code !== 'invalid_response',
      code,
    })
  );
}

function sanitizeDownloadError(
  error: unknown,
  code: string,
  options: { readonly category?: 'auth' | 'network' | 'provider'; readonly retryable?: boolean } = {},
): GoogleDriveBlobUploadError {
  return new GoogleDriveBlobUploadError(
    sanitizeRemoteBlobProviderError(error, {
      category: options.category ?? (code === 'auth_unavailable' ? 'auth' : 'provider'),
      retryable: options.retryable ?? code === 'download_failed',
      code,
    })
  );
}

function driveDownloadHttpError(status: number): GoogleDriveBlobUploadError {
  if (status === 401) {
    return sanitizeDownloadError(new Error('Google Drive authorization expired during download.'), 'auth_expired', {
      category: 'auth',
      retryable: false,
    });
  }
  if (status === 403) {
    return sanitizeDownloadError(new Error('Google Drive download is forbidden for this session.'), 'authorization_failed', {
      category: 'auth',
      retryable: false,
    });
  }
  if (status === 404) {
    return sanitizeDownloadError(new Error('Google Drive file was not found for recovery.'), 'remote_file_missing', {
      category: 'provider',
      retryable: false,
    });
  }
  if (status === 429) {
    return sanitizeDownloadError(new Error('Google Drive rate limit blocked recovery.'), 'rate_limited', {
      category: 'provider',
      retryable: true,
    });
  }
  if (status >= 500) {
    return sanitizeDownloadError(new Error(`Google Drive download failed with status ${status}.`), 'provider_unavailable', {
      category: 'provider',
      retryable: true,
    });
  }
  return sanitizeDownloadError(new Error(`Google Drive download failed with status ${status}.`), 'download_failed', {
    category: 'provider',
    retryable: status >= 500 || status === 408,
  });
}

function parseRemoteSize(size: string | number | undefined): number | undefined {
  if (typeof size === 'number' && Number.isFinite(size)) {
    return size;
  }

  if (typeof size === 'string' && size.trim()) {
    const parsed = Number(size);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function normalizeMd5Checksum(checksum: string | undefined): string | null {
  if (!checksum) {
    return null;
  }

  const normalized = checksum.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith('md5:')) {
    return normalized.slice(4);
  }

  if (/^[a-f0-9]{32}$/.test(normalized)) {
    return normalized;
  }

  return null;
}

function nextOffsetFromRangeHeader(rangeHeader: string | null, fallbackOffset: number): number {
  if (!rangeHeader) {
    return fallbackOffset;
  }

  const match = /bytes=0-(\d+)/i.exec(rangeHeader);
  if (!match) {
    return fallbackOffset;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed + 1 : fallbackOffset;
}

async function parseDriveMetadata(response: Response): Promise<GoogleDriveFileMetadata> {
  try {
    return await response.json() as GoogleDriveFileMetadata;
  } catch (error) {
    throw sanitizeUploadError(error, 'invalid_response');
  }
}

function buildVerification(
  input: RemoteBlobUploadInput,
  metadata: GoogleDriveFileMetadata,
  expectedSize: number
): RemoteBlobUploadVerification {
  const warnings: string[] = [];
  const remoteSize = parseRemoteSize(metadata.size);
  const remoteMd5 = normalizeMd5Checksum(metadata.md5Checksum);
  const localMd5 = normalizeMd5Checksum(input.checksum);

  const sizeVerified = remoteSize === undefined ? false : remoteSize === expectedSize;
  if (remoteSize === undefined) {
    warnings.push('Remote size was not returned by Google Drive.');
  }

  let checksumVerified = false;
  let checksumAlgorithm: string | undefined;
  if (localMd5 && remoteMd5) {
    checksumVerified = localMd5 === remoteMd5;
    checksumAlgorithm = 'md5';
  } else if (input.checksum && metadata.md5Checksum) {
    warnings.push('Local checksum algorithm is not compatible with Google Drive md5Checksum.');
  } else if (input.checksum) {
    warnings.push('Remote checksum was not returned by Google Drive.');
  }

  return {
    sizeVerified,
    checksumVerified,
    checksumAlgorithm,
    warnings: warnings.length ? warnings : undefined,
  };
}

function assertVerifiedUpload(verification: RemoteBlobUploadVerification): void {
  if (!verification.sizeVerified) {
    throw sanitizeUploadError(new Error('Remote upload size verification failed.'), 'size_mismatch');
  }

  if (verification.checksumAlgorithm && !verification.checksumVerified) {
    throw sanitizeUploadError(new Error('Remote upload checksum verification failed.'), 'checksum_mismatch');
  }
}

export class GoogleDriveBlobAdapter implements RemoteBlobProvider {
  readonly providerType = 'googleDrive' as const;

  readonly capabilities: RemoteBlobProviderCapabilities = {
    supportsUpload: true,
    supportsDownload: true,
    supportsDelete: false,
    supportsResumableUpload: true,
    supportsAppPrivateStorage: true,
    supportsChecksum: true,
    supportsQuotaInfo: false,
  };

  private readonly accessTokenProvider: GoogleDriveAccessTokenProvider;
  private readonly fetcher: typeof fetch;
  private readonly chunkSizeBytes: number;
  private readonly now: () => Date;

  constructor(options: GoogleDriveBlobAdapterOptions) {
    this.accessTokenProvider = options.accessTokenProvider;
    this.fetcher = options.fetcher ?? fetch;
    this.chunkSizeBytes = options.chunkSizeBytes ?? DEFAULT_CHUNK_SIZE_BYTES;
    this.now = options.now ?? (() => new Date());
  }

  async getConnectionStatus(): Promise<RemoteBlobProviderConnectionStatus> {
    return {
      providerType: this.providerType,
      state: 'disconnected',
      checkedAt: this.now().toISOString(),
      message: 'Google Drive connection is owned by the OAuth layer; uploads use injected access tokens.',
    };
  }

  async uploadBlob(input: RemoteBlobUploadInput): Promise<RemoteBlobUploadResult> {
    try {
      const expectedSize = input.size ?? input.blob.size;
      const mimeType = input.mimeType || input.blob.type || 'application/octet-stream';
      const accessToken = await this.getAccessToken();
      const sessionUri = await this.startResumableSession(input, mimeType, expectedSize, accessToken);
      const metadata = await this.uploadChunks(input.blob, sessionUri, expectedSize);
      const verification = buildVerification(input, metadata, expectedSize);
      assertVerifiedUpload(verification);

      if (!metadata.id) {
        throw sanitizeUploadError(new Error('Google Drive upload completed without a file id.'), 'invalid_response');
      }

      const syncedAt = this.now().toISOString();
      const remoteSize = parseRemoteSize(metadata.size);

      return {
        providerType: this.providerType,
        remoteProvider: this.providerType,
        attachmentId: input.attachmentId,
        remoteFileId: metadata.id,
        mimeType: metadata.mimeType ?? mimeType,
        remoteMimeType: metadata.mimeType ?? mimeType,
        size: remoteSize,
        remoteSize,
        checksum: metadata.md5Checksum,
        remoteChecksum: metadata.md5Checksum,
        updatedAt: metadata.modifiedTime,
        remoteSyncedAt: syncedAt,
        syncedAt,
        verification,
      };
    } catch (error) {
      if (error instanceof GoogleDriveBlobUploadError) {
        throw error;
      }

      throw sanitizeUploadError(error, 'network_failed');
    }
  }

  async getBlobInfo(_input: RemoteBlobInfoInput): Promise<RemoteBlobInfoResult | null> {
    return null;
  }

  async downloadBlob(input: RemoteBlobDownloadInput): Promise<RemoteBlobDownloadResult> {
    try {
      if (!input.remoteFileId) {
        throw sanitizeUploadError(new Error('Google Drive download requires a remote file id.'), 'invalid_response');
      }

      const accessToken = await this.getAccessToken();
      const response = await this.fetcher(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(input.remoteFileId)}?alt=media`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw driveDownloadHttpError(response.status);
      }

      let blob: Blob;
      try {
        blob = await response.blob();
      } catch (error) {
        throw sanitizeDownloadError(error, 'invalid_remote_response', {
          category: 'provider',
          retryable: true,
        });
      }
      if (blob.size === 0 && input.expectedSize !== undefined && input.expectedSize > 0) {
        throw sanitizeDownloadError(new Error('Google Drive download returned an empty response body.'), 'invalid_remote_response', {
          category: 'provider',
          retryable: true,
        });
      }
      const downloadedAt = this.now().toISOString();
      return {
        blob,
        providerType: this.providerType,
        remoteProvider: this.providerType,
        remoteFileId: input.remoteFileId,
        remoteSize: blob.size,
        remoteMimeType: blob.type || input.expectedMimeType,
        downloadedAt,
      };
    } catch (error) {
      if (error instanceof GoogleDriveBlobUploadError) {
        throw error;
      }

      throw sanitizeDownloadError(error, 'download_failed', {
        category: 'network',
        retryable: true,
      });
    }
  }

  private async startResumableSession(
    input: RemoteBlobUploadInput,
    mimeType: string,
    expectedSize: number,
    accessToken: string
  ): Promise<string> {
    const metadata = {
      name: input.fileName || input.attachmentId,
      mimeType,
      parents: ['appDataFolder'],
    };

    const response = await this.fetcher(GOOGLE_DRIVE_RESUMABLE_UPLOAD_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': String(expectedSize),
      },
      body: JSON.stringify(metadata),
    });

    if (!response.ok) {
      throw sanitizeUploadError(new Error(`Google Drive upload session failed with status ${response.status}.`), 'session_start_failed');
    }

    const sessionUri = response.headers.get('Location');
    if (!sessionUri) {
      throw sanitizeUploadError(new Error('Google Drive upload session did not return a Location header.'), 'invalid_response');
    }

    return sessionUri;
  }

  private async getAccessToken(): Promise<string> {
    try {
      return await this.accessTokenProvider.getAccessToken();
    } catch (error) {
      throw sanitizeUploadError(error, 'auth_unavailable');
    }
  }

  private async uploadChunks(blob: Blob, sessionUri: string, expectedSize: number): Promise<GoogleDriveFileMetadata> {
    if (expectedSize === 0) {
      return this.uploadEmptyBlob(sessionUri);
    }

    let offset = 0;
    while (offset < expectedSize) {
      const end = Math.min(offset + this.chunkSizeBytes, expectedSize) - 1;
      const chunk = blob.slice(offset, end + 1);
      const response = await this.fetcher(sessionUri, {
        method: 'PUT',
        headers: {
          'Content-Range': `bytes ${offset}-${end}/${expectedSize}`,
        },
        body: chunk,
      });

      if (response.status === 308) {
        offset = nextOffsetFromRangeHeader(response.headers.get('Range'), end + 1);
        continue;
      }

      if (response.ok) {
        return parseDriveMetadata(response);
      }

      throw sanitizeUploadError(new Error(`Google Drive chunk upload failed with status ${response.status}.`), 'upload_failed');
    }

    throw sanitizeUploadError(new Error('Google Drive upload ended without final metadata.'), 'invalid_response');
  }

  private async uploadEmptyBlob(sessionUri: string): Promise<GoogleDriveFileMetadata> {
    const response = await this.fetcher(sessionUri, {
      method: 'PUT',
      headers: {
        'Content-Range': 'bytes */0',
      },
      body: new Blob([]),
    });

    if (response.ok) {
      return parseDriveMetadata(response);
    }

    throw sanitizeUploadError(new Error(`Google Drive empty upload failed with status ${response.status}.`), 'upload_failed');
  }
}

export function createGoogleDriveBlobProvider(options: GoogleDriveBlobAdapterOptions): GoogleDriveBlobAdapter {
  return new GoogleDriveBlobAdapter(options);
}
