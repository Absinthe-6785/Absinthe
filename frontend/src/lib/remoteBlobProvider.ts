/**
 * K-159 remote blob provider boundary.
 *
 * Local Blob Adapter:
 * - owns local raw Blob storage and local blob inventory
 * - may delete local blobs only through explicit local cleanup flows
 * - does not know about OAuth, Google Drive, iCloud, R2, S3, or custom provider SDKs
 *
 * Remote Blob Provider:
 * - uploads, downloads, and queries remote provider blobs
 * - does not rewrite notes, delete local blobs, mutate note bodies, or persist attachment metadata
 *
 * Future Attachment Sync Queue:
 * - will orchestrate AttachmentRepository + local BlobStorageAdapter + RemoteBlobProvider
 * - is intentionally not implemented in K-159
 *
 * K-160 should evaluate provider OAuth/security boundaries. K-161 can prototype a concrete
 * Google Drive provider with resumable upload and verified checksum/size handling.
 */

export type RemoteBlobProviderType =
  | 'googleDrive'
  | 'icloud'
  | 'r2'
  | 's3'
  | 'custom';

export interface RemoteBlobProviderCapabilities {
  readonly supportsUpload: boolean;
  readonly supportsDownload: boolean;
  readonly supportsDelete: boolean;
  readonly supportsResumableUpload: boolean;
  readonly supportsAppPrivateStorage: boolean;
  readonly supportsChecksum: boolean;
  readonly supportsQuotaInfo: boolean;
}

export type RemoteBlobProviderConnectionState =
  | 'unconfigured'
  | 'disconnected'
  | 'connected'
  | 'reauth_required'
  | 'unavailable';

export interface RemoteBlobProviderConnectionStatus {
  readonly providerType: RemoteBlobProviderType;
  readonly state: RemoteBlobProviderConnectionState;
  readonly checkedAt: string;
  readonly message?: string;
}

export interface RemoteBlobUploadInput {
  readonly attachmentId: string;
  readonly localBlobKey?: string;
  readonly blob: Blob;
  readonly mimeType?: string;
  readonly size?: number;
  readonly checksum?: string;
  readonly fileName?: string;
}

export interface RemoteBlobUploadResult {
  readonly providerType: RemoteBlobProviderType;
  readonly remoteProvider?: RemoteBlobProviderType;
  readonly attachmentId: string;
  readonly remoteBlobKey?: string;
  readonly remoteFileId?: string;
  readonly mimeType?: string;
  readonly remoteMimeType?: string;
  readonly size?: number;
  readonly remoteSize?: number;
  readonly checksum?: string;
  readonly remoteChecksum?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly remoteSyncedAt?: string;
  readonly syncedAt: string;
  readonly verification?: RemoteBlobUploadVerification;
}

export interface RemoteBlobUploadVerification {
  readonly sizeVerified: boolean;
  readonly checksumVerified: boolean;
  readonly checksumAlgorithm?: string;
  readonly sizeOnlyVerified?: boolean;
  readonly warnings?: string[];
}

export interface RemoteBlobInfoInput {
  readonly attachmentId?: string;
  readonly remoteBlobKey?: string;
  readonly remoteFileId?: string;
}

export interface RemoteBlobInfoResult {
  readonly providerType: RemoteBlobProviderType;
  readonly attachmentId?: string;
  readonly remoteBlobKey?: string;
  readonly remoteFileId?: string;
  readonly mimeType?: string;
  readonly size?: number;
  readonly checksum?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly syncedAt?: string;
}

export interface RemoteBlobDownloadInput {
  readonly attachmentId?: string;
  readonly remoteBlobKey?: string;
  readonly remoteFileId?: string;
  readonly expectedSize?: number;
  readonly expectedChecksum?: string;
  readonly expectedMimeType?: string;
  readonly requestedAt?: string;
}

export interface RemoteBlobDownloadResult {
  readonly blob: Blob;
  readonly providerType: RemoteBlobProviderType;
  readonly remoteProvider?: RemoteBlobProviderType;
  readonly remoteBlobKey?: string;
  readonly remoteFileId?: string;
  readonly remoteSize?: number;
  readonly remoteChecksum?: string;
  readonly remoteMimeType?: string;
  readonly downloadedAt?: string;
  readonly verification?: RemoteBlobUploadVerification;
}

export interface RemoteBlobProvider {
  readonly providerType: RemoteBlobProviderType;
  readonly capabilities: RemoteBlobProviderCapabilities;

  getConnectionStatus(): Promise<RemoteBlobProviderConnectionStatus>;
  uploadBlob(input: RemoteBlobUploadInput): Promise<RemoteBlobUploadResult>;
  getBlobInfo(input: RemoteBlobInfoInput): Promise<RemoteBlobInfoResult | null>;
  downloadBlob(input: RemoteBlobDownloadInput): Promise<Blob | RemoteBlobDownloadResult>;
}

export type RemoteBlobProviderErrorCategory =
  | 'auth'
  | 'network'
  | 'quota'
  | 'provider'
  | 'upload'
  | 'unknown';

export interface SanitizedRemoteBlobProviderError {
  readonly message: string;
  readonly category: RemoteBlobProviderErrorCategory;
  readonly retryable: boolean;
  readonly code?: string;
}

function isSanitizedRemoteBlobProviderError(error: unknown): error is SanitizedRemoteBlobProviderError {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const value = error as Partial<SanitizedRemoteBlobProviderError>;
  return typeof value.message === 'string' && typeof value.category === 'string' && typeof value.retryable === 'boolean';
}

const REDACTED_SECRET = '[redacted-secret]';
const REDACTED_URL = '[redacted-remote-url]';
const REDACTED_BLOB_DATA = '[redacted-blob-data]';
const MAX_REMOTE_ERROR_MESSAGE_LENGTH = 280;

function trimRemoteErrorMessage(message: string): string {
  const normalized = message.replace(/\s+/g, ' ').trim();

  if (normalized.length <= MAX_REMOTE_ERROR_MESSAGE_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_REMOTE_ERROR_MESSAGE_LENGTH - 1).trimEnd()}...`;
}

function extractRemoteErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const maybeRecord = error as Record<string, unknown>;
    const message = maybeRecord.message;
    const status = maybeRecord.status ?? maybeRecord.statusCode;
    const code = maybeRecord.code;

    if (typeof message === 'string') {
      return message;
    }

    if (typeof status === 'number' || typeof status === 'string') {
      return `Remote provider request failed with status ${status}.`;
    }

    if (typeof code === 'string') {
      return `Remote provider request failed with code ${code}.`;
    }
  }

  return 'Remote provider request failed.';
}

export function sanitizeRemoteBlobProviderErrorMessage(error: unknown): string {
  return trimRemoteErrorMessage(
    extractRemoteErrorMessage(error)
      .replace(/data:[^;\s]+;base64,[A-Za-z0-9+/=._-]+/gi, REDACTED_BLOB_DATA)
      .replace(/https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\?[^\s"'<>]+/gi, REDACTED_URL)
      .replace(/https:\/\/oauth2\.googleapis\.com\/(?:token|revoke)\?[^\s"'<>]+/gi, REDACTED_URL)
      .replace(/https?:\/\/[^\s"'<>]*\/oauth\/google-drive\/callback\?[^\s"'<>]*/gi, REDACTED_URL)
      .replace(/https?:\/\/[^\s"'<>]*(?:X-Goog-Signature|X-Amz-Signature|Signature=)[^\s"'<>]*/gi, REDACTED_URL)
      .replace(/\b(Authorization|Set-Cookie)\s*[:=]\s*[^,}\]]+/gi, `$1: ${REDACTED_SECRET}`)
      .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED_SECRET}`)
      .replace(/\b(access_token|refresh_token|id_token|code|code_verifier|codeVerifier|codeVerifierRef|client_secret|upload_id)=([^&\s"']+)/gi, `$1=${REDACTED_SECRET}`)
      .replace(/["']?(access_token|refresh_token|id_token|code|code_verifier|codeVerifier|codeVerifierRef|client_secret)["']?\s*:\s*["'][^"']*["']/gi, '"$1":"[redacted-secret]"')
      .replace(/\b(access_token|refresh_token|id_token|code|code_verifier|codeVerifier|codeVerifierRef|client_secret)\s*:\s*[^,}\]\s"']+/gi, `$1: ${REDACTED_SECRET}`)
  );
}

export function sanitizeRemoteBlobProviderError(
  error: unknown,
  options: {
    readonly category?: RemoteBlobProviderErrorCategory;
    readonly retryable?: boolean;
    readonly code?: string;
  } = {}
): SanitizedRemoteBlobProviderError {
  if (isSanitizedRemoteBlobProviderError(error)) {
    return {
      message: sanitizeRemoteBlobProviderErrorMessage(error.message),
      category: options.category ?? error.category,
      retryable: options.retryable ?? error.retryable,
      code: options.code ?? error.code,
    };
  }

  return {
    message: sanitizeRemoteBlobProviderErrorMessage(error),
    category: options.category ?? 'unknown',
    retryable: options.retryable ?? false,
    code: options.code,
  };
}

export class RemoteBlobProviderUnavailableError extends Error {
  constructor(message = 'Remote blob provider is unavailable or unconfigured.') {
    super(message);
    this.name = 'RemoteBlobProviderUnavailableError';
  }
}

export class NullRemoteBlobProvider implements RemoteBlobProvider {
  readonly providerType: RemoteBlobProviderType = 'custom';

  readonly capabilities: RemoteBlobProviderCapabilities = {
    supportsUpload: false,
    supportsDownload: false,
    supportsDelete: false,
    supportsResumableUpload: false,
    supportsAppPrivateStorage: false,
    supportsChecksum: false,
    supportsQuotaInfo: false,
  };

  async getConnectionStatus(): Promise<RemoteBlobProviderConnectionStatus> {
    return {
      providerType: this.providerType,
      state: 'unconfigured',
      checkedAt: new Date(0).toISOString(),
      message: 'No remote blob provider is configured.',
    };
  }

  async uploadBlob(): Promise<RemoteBlobUploadResult> {
    throw new RemoteBlobProviderUnavailableError();
  }

  async getBlobInfo(): Promise<RemoteBlobInfoResult | null> {
    return null;
  }

  async downloadBlob(): Promise<Blob | RemoteBlobDownloadResult> {
    throw new RemoteBlobProviderUnavailableError();
  }
}
