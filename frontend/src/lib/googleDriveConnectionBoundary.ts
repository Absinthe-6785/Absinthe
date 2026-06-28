import {
  resolveRemoteProviderConnectionBoundary,
  type RemoteProviderConnectionBoundary,
  type RemoteProviderConnectionBoundaryStatus,
} from './remoteProviderConnectionStatus';

export interface GoogleDriveAccessTokenProvider {
  getAccessToken(): Promise<string>;
}

export type GoogleDriveConnectionResultStatus =
  | 'unavailable'
  | 'not_implemented'
  | 'disconnected';

export interface GoogleDriveConnectionResult {
  readonly providerType: 'googleDrive';
  readonly status: GoogleDriveConnectionResultStatus;
  readonly safeMessage: string;
}

export interface GoogleDriveConnectionController {
  readonly providerType: 'googleDrive';
  getConnectionStatus(): Promise<RemoteProviderConnectionBoundary>;
  getAccessTokenProvider(): GoogleDriveAccessTokenProvider | null;
  connect?(): Promise<GoogleDriveConnectionResult>;
  disconnect?(): Promise<GoogleDriveConnectionResult>;
  markReconnectRequired?(): Promise<void>;
}

export interface CreateGoogleDriveConnectionBoundaryInput {
  readonly status?: RemoteProviderConnectionBoundaryStatus;
  readonly canUpload?: boolean;
  readonly canDownload?: boolean;
  readonly safeMessage?: string;
  readonly lastCheckedAt?: string;
  readonly error?: unknown;
  readonly accessTokenProvider?: GoogleDriveAccessTokenProvider | null;
}

const DEFAULT_GOOGLE_DRIVE_UNCONFIGURED_MESSAGE = 'Google Drive is not configured in this build.';

function googleDriveStatus(input: CreateGoogleDriveConnectionBoundaryInput = {}): RemoteProviderConnectionBoundary {
  const status = resolveRemoteProviderConnectionBoundary({
    providerType: 'googleDrive',
    status: input.status ?? 'unconfigured',
    capabilities: {
      supportsUpload: input.canUpload === true,
      supportsDownload: input.canDownload === true,
    },
    lastCheckedAt: input.lastCheckedAt,
    error: input.error,
  });

  return {
    ...status,
    safeMessage: input.safeMessage ?? (input.status ? status.safeMessage : DEFAULT_GOOGLE_DRIVE_UNCONFIGURED_MESSAGE),
  };
}

export function createGoogleDriveConnectionBoundary(
  input: CreateGoogleDriveConnectionBoundaryInput = {},
): GoogleDriveConnectionController {
  const accessTokenProvider = input.accessTokenProvider ?? null;

  return {
    providerType: 'googleDrive',
    async getConnectionStatus() {
      return googleDriveStatus(input);
    },
    getAccessTokenProvider() {
      return accessTokenProvider;
    },
    async connect() {
      return {
        providerType: 'googleDrive',
        status: 'not_implemented',
        safeMessage: 'Google Drive connection management is not implemented in this build.',
      };
    },
    async disconnect() {
      return {
        providerType: 'googleDrive',
        status: 'not_implemented',
        safeMessage: 'Google Drive disconnection is not implemented in this build.',
      };
    },
    async markReconnectRequired() {
      // K-168 exposes the boundary only. Future OAuth work owns state mutation.
    },
  };
}

export function createUnavailableGoogleDriveConnectionController(): GoogleDriveConnectionController {
  return createGoogleDriveConnectionBoundary();
}

export async function refreshGoogleDriveConnectionStatus(
  controller?: GoogleDriveConnectionController | null,
): Promise<RemoteProviderConnectionBoundary> {
  if (!controller) {
    return googleDriveStatus();
  }

  return controller.getConnectionStatus();
}
