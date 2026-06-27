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
  readonly attachmentId: string;
  readonly remoteBlobKey?: string;
  readonly remoteFileId?: string;
  readonly mimeType?: string;
  readonly size?: number;
  readonly checksum?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly syncedAt: string;
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
}

export interface RemoteBlobProvider {
  readonly providerType: RemoteBlobProviderType;
  readonly capabilities: RemoteBlobProviderCapabilities;

  getConnectionStatus(): Promise<RemoteBlobProviderConnectionStatus>;
  uploadBlob(input: RemoteBlobUploadInput): Promise<RemoteBlobUploadResult>;
  getBlobInfo(input: RemoteBlobInfoInput): Promise<RemoteBlobInfoResult | null>;
  downloadBlob(input: RemoteBlobDownloadInput): Promise<Blob>;
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

  async downloadBlob(): Promise<Blob> {
    throw new RemoteBlobProviderUnavailableError();
  }
}
