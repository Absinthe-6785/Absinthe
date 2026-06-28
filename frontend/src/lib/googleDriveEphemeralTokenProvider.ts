import type {
  GoogleDriveAccessTokenProvider,
  GoogleDriveConnectionController,
  GoogleDriveConnectionResult,
} from './googleDriveConnectionBoundary';
import type { RemoteProviderConnectionBoundary } from './remoteProviderConnectionStatus';
import { resolveRemoteProviderConnectionBoundary } from './remoteProviderConnectionStatus';
import { sanitizeRemoteBlobProviderErrorMessage } from './remoteBlobProvider';
import type { GoogleDriveOAuthTokenExchangeResult, GoogleDriveOAuthTokenSet } from './googleDriveOAuthTokenExchange';

export class GoogleDriveEphemeralTokenExpiredError extends Error {
  readonly code = 'auth_expired';

  constructor(message = 'Google Drive session expired. Reconnect is required.') {
    super(sanitizeRemoteBlobProviderErrorMessage(message));
    this.name = 'GoogleDriveEphemeralTokenExpiredError';
  }
}

export class GoogleDriveEphemeralTokenUnavailableError extends Error {
  readonly code = 'token_unavailable';

  constructor(message = 'Google Drive session token is unavailable.') {
    super(sanitizeRemoteBlobProviderErrorMessage(message));
    this.name = 'GoogleDriveEphemeralTokenUnavailableError';
  }
}

export interface EphemeralGoogleDriveAccessTokenProvider extends GoogleDriveAccessTokenProvider {
  getExpiresAt(): string;
  isExpired(): boolean;
  clear(): void;
  hasToken(): boolean;
}

export interface CreateEphemeralGoogleDriveAccessTokenProviderInput {
  readonly tokenSet: GoogleDriveOAuthTokenSet;
  readonly now?: () => Date;
}

export interface CreateSessionOnlyGoogleDriveConnectionControllerInput {
  readonly tokenProvider?: EphemeralGoogleDriveAccessTokenProvider | null;
  readonly canUpload?: boolean;
  readonly canDownload?: boolean;
  readonly now?: () => Date;
}

function resolveExpiresAt(tokenSet: GoogleDriveOAuthTokenSet, now: () => Date): string {
  if (tokenSet.expiresAt) {
    return tokenSet.expiresAt;
  }
  if (typeof tokenSet.expiresIn === 'number' && Number.isFinite(tokenSet.expiresIn) && tokenSet.expiresIn > 0) {
    return new Date(now().getTime() + tokenSet.expiresIn * 1000).toISOString();
  }
  throw new GoogleDriveEphemeralTokenUnavailableError('Google Drive token set is missing a valid expiration.');
}

export function createEphemeralGoogleDriveAccessTokenProvider(
  input: CreateEphemeralGoogleDriveAccessTokenProviderInput,
): EphemeralGoogleDriveAccessTokenProvider {
  const now = input.now ?? (() => new Date());
  let accessToken: string | null = input.tokenSet.accessToken;
  const expiresAt = resolveExpiresAt(input.tokenSet, now);

  function expired(): boolean {
    return new Date(expiresAt).getTime() <= now().getTime();
  }

  return {
    async getAccessToken() {
      if (!accessToken) {
        throw new GoogleDriveEphemeralTokenUnavailableError();
      }
      if (expired()) {
        accessToken = null;
        throw new GoogleDriveEphemeralTokenExpiredError();
      }
      return accessToken;
    },
    getExpiresAt() {
      return expiresAt;
    },
    isExpired() {
      return !accessToken || expired();
    },
    clear() {
      accessToken = null;
    },
    hasToken() {
      return accessToken !== null;
    },
  };
}

export function createEphemeralGoogleDriveAccessTokenProviderFromExchangeResult(
  result: GoogleDriveOAuthTokenExchangeResult,
  options: { readonly now?: () => Date } = {},
): EphemeralGoogleDriveAccessTokenProvider | null {
  if (result.status !== 'exchanged') {
    return null;
  }
  return createEphemeralGoogleDriveAccessTokenProvider({
    tokenSet: result.tokenSet,
    now: options.now,
  });
}

function statusFromProvider(
  tokenProvider: EphemeralGoogleDriveAccessTokenProvider | null,
  input: CreateSessionOnlyGoogleDriveConnectionControllerInput,
): RemoteProviderConnectionBoundary {
  if (!tokenProvider?.hasToken()) {
    return {
      ...resolveRemoteProviderConnectionBoundary({
        providerType: 'googleDrive',
        status: 'unconfigured',
        capabilities: {
          supportsUpload: false,
          supportsDownload: false,
        },
      }),
      safeMessage: 'Google Drive is not connected for this session.',
    };
  }

  if (tokenProvider.isExpired()) {
    return {
      ...resolveRemoteProviderConnectionBoundary({
        providerType: 'googleDrive',
        status: 'auth_expired',
        capabilities: {
          supportsUpload: false,
          supportsDownload: false,
        },
      }),
      safeMessage: 'Google Drive session expired. Reconnect is required.',
    };
  }

  return resolveRemoteProviderConnectionBoundary({
    providerType: 'googleDrive',
    status: 'available',
    capabilities: {
      supportsUpload: input.canUpload === true,
      supportsDownload: input.canDownload === true,
    },
  });
}

export function createSessionOnlyGoogleDriveConnectionController(
  input: CreateSessionOnlyGoogleDriveConnectionControllerInput = {},
): GoogleDriveConnectionController {
  let tokenProvider = input.tokenProvider ?? null;

  return {
    providerType: 'googleDrive',
    async getConnectionStatus() {
      return statusFromProvider(tokenProvider, input);
    },
    getAccessTokenProvider() {
      return tokenProvider?.hasToken() ? tokenProvider : null;
    },
    async connect(): Promise<GoogleDriveConnectionResult> {
      return {
        providerType: 'googleDrive',
        status: 'not_implemented',
        safeMessage: 'Google Drive connection management is not implemented in this build.',
      };
    },
    async disconnect(): Promise<GoogleDriveConnectionResult> {
      tokenProvider?.clear();
      tokenProvider = null;
      return {
        providerType: 'googleDrive',
        status: 'disconnected',
        safeMessage: 'Google Drive session token was cleared from memory.',
      };
    },
    async markReconnectRequired() {
      tokenProvider?.clear();
      tokenProvider = null;
    },
  };
}
