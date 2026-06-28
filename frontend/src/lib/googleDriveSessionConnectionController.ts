import type { GoogleDriveAccessTokenProvider, GoogleDriveConnectionResult } from './googleDriveConnectionBoundary';
import {
  buildGoogleDriveOAuthAuthorizationUrl,
  type GoogleDriveOAuthAuthorizationUrlInput,
} from './googleDriveOAuthAuthorization';
import {
  parseGoogleDriveOAuthCallback,
  validateGoogleDriveOAuthCallbackState,
  type GoogleDriveOAuthCallbackValidationStatus,
  type GoogleDriveOAuthPendingAuth,
  type GoogleDriveOAuthPendingAuthStore,
} from './googleDriveOAuthCallback';
import {
  exchangeGoogleDriveOAuthCode,
  type GoogleDriveOAuthCodeVerifierLookup,
  type GoogleDriveOAuthTokenExchangeError,
  type GoogleDriveOAuthTokenFetch,
} from './googleDriveOAuthTokenExchange';
import {
  createEphemeralGoogleDriveAccessTokenProviderFromExchangeResult,
  type EphemeralGoogleDriveAccessTokenProvider,
} from './googleDriveEphemeralTokenProvider';
import type { RemoteProviderConnectionBoundary } from './remoteProviderConnectionStatus';
import { resolveRemoteProviderConnectionBoundary } from './remoteProviderConnectionStatus';
import { sanitizeRemoteBlobProviderErrorMessage } from './remoteBlobProvider';

export type GoogleDriveStartAuthorizationStatus = 'authorization_url_created' | 'blocked' | 'error';

export type GoogleDriveCompleteCallbackStatus =
  | 'connected'
  | 'oauth_error'
  | 'invalid_state'
  | 'expired_state'
  | 'token_exchange_failed'
  | 'blocked'
  | 'missing_pending_auth'
  | 'missing_code'
  | 'missing_state'
  | 'redirect_uri_mismatch'
  | 'provider_mismatch'
  | 'invalid_scope'
  | 'invalid_callback';

export interface GoogleDriveStartAuthorizationInput {
  readonly state?: string;
  readonly codeVerifier?: string;
  readonly nonce?: string;
  readonly scopes?: readonly string[];
  readonly includeGrantedScopes?: boolean;
  readonly accessType?: 'online' | 'offline';
}

export type GoogleDriveCompleteCallbackInput =
  | string
  | URL
  | URLSearchParams
  | {
      readonly callbackUrl: string | URL | URLSearchParams;
    };

export type GoogleDriveStartAuthorizationResult =
  | {
      readonly providerType: 'googleDrive';
      readonly status: 'authorization_url_created';
      readonly authorizationUrl: string;
      readonly state: string;
      readonly expiresAt: string;
      readonly warnings: readonly string[];
    }
  | {
      readonly providerType: 'googleDrive';
      readonly status: 'blocked' | 'error';
      readonly safeMessage: string;
      readonly error?: string;
    };

export interface GoogleDriveCompleteCallbackResult {
  readonly providerType: 'googleDrive';
  readonly status: GoogleDriveCompleteCallbackStatus;
  readonly connectionStatus: RemoteProviderConnectionBoundary;
  readonly safeMessage: string;
  readonly error?: {
    readonly code: string;
    readonly category?: string;
    readonly retryable?: boolean;
    readonly status?: number;
    readonly safeMessage: string;
  };
  readonly warnings?: readonly string[];
}

export interface GoogleDriveSessionConnectionController {
  readonly providerType: 'googleDrive';
  startAuthorization(input?: GoogleDriveStartAuthorizationInput): Promise<GoogleDriveStartAuthorizationResult>;
  completeCallback(input: GoogleDriveCompleteCallbackInput): Promise<GoogleDriveCompleteCallbackResult>;
  disconnect(): Promise<GoogleDriveConnectionResult>;
  getConnectionStatus(): Promise<RemoteProviderConnectionBoundary>;
  getAccessTokenProvider(): GoogleDriveAccessTokenProvider | null;
  markReconnectRequired(): Promise<void>;
}

export interface CreateGoogleDriveSessionConnectionControllerInput {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly allowedRedirectUris: readonly string[];
  readonly fetchToken: GoogleDriveOAuthTokenFetch;
  readonly canUpload?: boolean;
  readonly canDownload?: boolean;
  readonly authorizationTtlMs?: number;
  readonly now?: () => Date;
}

const DEFAULT_AUTHORIZATION_TTL_MS = 10 * 60 * 1000;

function safeError(value: unknown): string {
  return sanitizeRemoteBlobProviderErrorMessage(value);
}

function redactKnownSecrets(message: string, values: readonly (string | undefined)[]): string {
  return values.reduce<string>((current, value) => {
    if (!value) return current;
    return current.split(value).join('[redacted-secret]');
  }, message);
}

function pendingAuthRef(state: string): string {
  return `google-drive-session-pkce:${state}`;
}

function callbackInput(input: GoogleDriveCompleteCallbackInput): string | URL | URLSearchParams {
  if (typeof input === 'object' && !(input instanceof URL) && !(input instanceof URLSearchParams) && 'callbackUrl' in input) {
    return input.callbackUrl;
  }
  return input;
}

function statusFromTokenProvider(
  tokenProvider: EphemeralGoogleDriveAccessTokenProvider | null,
  input: CreateGoogleDriveSessionConnectionControllerInput,
): RemoteProviderConnectionBoundary {
  if (!tokenProvider?.hasToken()) {
    return {
      ...resolveRemoteProviderConnectionBoundary({
        providerType: 'googleDrive',
        status: 'unconfigured',
        capabilities: { supportsUpload: false, supportsDownload: false },
      }),
      safeMessage: 'Google Drive is not connected for this session.',
    };
  }

  if (tokenProvider.isExpired()) {
    return {
      ...resolveRemoteProviderConnectionBoundary({
        providerType: 'googleDrive',
        status: 'auth_expired',
        capabilities: { supportsUpload: false, supportsDownload: false },
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

function completeStatusFromValidation(status: GoogleDriveOAuthCallbackValidationStatus): GoogleDriveCompleteCallbackStatus {
  return status === 'valid_code' ? 'blocked' : status;
}

function safeExchangeError(
  error: GoogleDriveOAuthTokenExchangeError,
  knownSecrets: readonly (string | undefined)[] = [],
): GoogleDriveCompleteCallbackResult['error'] {
  return {
    code: error.code,
    category: error.category,
    retryable: error.retryable,
    status: error.status,
    safeMessage: redactKnownSecrets(safeError(error.safeMessage), knownSecrets),
  };
}

export function createGoogleDriveSessionConnectionController(
  input: CreateGoogleDriveSessionConnectionControllerInput,
): GoogleDriveSessionConnectionController {
  const pendingAuthByState = new Map<string, GoogleDriveOAuthPendingAuth>();
  const verifierByRef = new Map<string, string>();
  let tokenProvider: EphemeralGoogleDriveAccessTokenProvider | null = null;

  function clearPendingAuth(state: string): void {
    const pendingAuth = pendingAuthByState.get(state);
    if (pendingAuth) {
      verifierByRef.delete(pendingAuth.codeVerifierRef);
    }
    pendingAuthByState.delete(state);
  }

  function clearAllPendingAuth(): void {
    for (const state of Array.from(pendingAuthByState.keys())) {
      clearPendingAuth(state);
    }
  }

  function consumePendingAuth(state: string): GoogleDriveOAuthPendingAuth | null {
    const pendingAuth = pendingAuthByState.get(state) ?? null;
    pendingAuthByState.delete(state);
    return pendingAuth;
  }

  const pendingAuthStore: GoogleDriveOAuthPendingAuthStore = {
    async getPendingAuthByState(state) {
      return pendingAuthByState.get(state) ?? null;
    },
    async consumePendingAuth(state) {
      return consumePendingAuth(state);
    },
    async clearPendingAuth(state) {
      clearPendingAuth(state);
    },
  };

  const codeVerifierLookup: GoogleDriveOAuthCodeVerifierLookup = {
    async getCodeVerifier(codeVerifierRef) {
      return verifierByRef.get(codeVerifierRef) ?? null;
    },
    async clearCodeVerifier(codeVerifierRef) {
      verifierByRef.delete(codeVerifierRef);
    },
  };

  async function status(): Promise<RemoteProviderConnectionBoundary> {
    return statusFromTokenProvider(tokenProvider, input);
  }

  function clearSession(): void {
    for (const state of Array.from(pendingAuthByState.keys())) {
      clearPendingAuth(state);
    }
    tokenProvider?.clear();
    tokenProvider = null;
  }

  return {
    providerType: 'googleDrive',
    async startAuthorization(startInput = {}) {
      try {
        const authorization = await buildGoogleDriveOAuthAuthorizationUrl({
          clientId: input.clientId,
          redirectUri: input.redirectUri,
          allowedRedirectUris: input.allowedRedirectUris,
          state: startInput.state,
          codeVerifier: startInput.codeVerifier,
          nonce: startInput.nonce,
          scopes: startInput.scopes,
          includeGrantedScopes: startInput.includeGrantedScopes,
          accessType: startInput.accessType,
          now: input.now,
        } satisfies GoogleDriveOAuthAuthorizationUrlInput);
        const createdAt = new Date(authorization.createdAt);
        const expiresAt = new Date(createdAt.getTime() + (input.authorizationTtlMs ?? DEFAULT_AUTHORIZATION_TTL_MS)).toISOString();
        const codeVerifierRef = pendingAuthRef(authorization.state);

        clearAllPendingAuth();

        pendingAuthByState.set(authorization.state, {
          providerType: 'googleDrive',
          state: authorization.state,
          nonce: authorization.nonce,
          codeVerifierRef,
          redirectUri: input.redirectUri,
          createdAt: authorization.createdAt,
          expiresAt,
          scope: authorization.scopes,
          codeChallengeMethod: 'S256',
        });
        verifierByRef.set(codeVerifierRef, authorization.codeVerifier);

        return {
          providerType: 'googleDrive',
          status: 'authorization_url_created',
          authorizationUrl: authorization.authorizationUrl,
          state: authorization.state,
          expiresAt,
          warnings: [],
        };
      } catch (error) {
        return {
          providerType: 'googleDrive',
          status: 'error',
          safeMessage: 'Google Drive authorization URL could not be created.',
          error: safeError(error),
        };
      }
    },
    async completeCallback(inputValue) {
      const callback = parseGoogleDriveOAuthCallback(callbackInput(inputValue));
      const attemptedState = callback.state;
      if (attemptedState && !pendingAuthByState.has(attemptedState) && pendingAuthByState.size > 0) {
        return {
          providerType: 'googleDrive',
          status: 'invalid_state',
          connectionStatus: await status(),
          safeMessage: 'OAuth callback state does not match the pending authorization.',
        };
      }

      const validation = await validateGoogleDriveOAuthCallbackState({
        callback,
        pendingAuthStore,
        expectedRedirectUri: input.redirectUri,
        allowedRedirectUris: input.allowedRedirectUris,
        now: input.now,
      });

      if (validation.status !== 'valid_code') {
        if (validation.state) {
          await pendingAuthStore.clearPendingAuth?.(validation.state);
        }
        return {
          providerType: 'googleDrive',
          status: completeStatusFromValidation(validation.status),
          connectionStatus: await status(),
          safeMessage: safeError(validation.safeMessage),
          error: validation.error
            ? {
                code: validation.error.code,
                category: validation.error.category,
                retryable: validation.error.retryable,
                safeMessage: safeError(validation.error.safeMessage),
              }
            : undefined,
        };
      }

      const exchangeSecrets = [
        validation.code,
        validation.codeVerifierRef ? verifierByRef.get(validation.codeVerifierRef) : undefined,
      ];
      const exchange = await exchangeGoogleDriveOAuthCode({
        callbackValidation: validation,
        pendingAuthStore,
        codeVerifierLookup,
        clientId: input.clientId,
        expectedRedirectUri: input.redirectUri,
        allowedRedirectUris: input.allowedRedirectUris,
        fetchToken: input.fetchToken,
        now: input.now,
      });

      if (exchange.status !== 'exchanged') {
        return {
          providerType: 'googleDrive',
          status: 'token_exchange_failed',
          connectionStatus: await status(),
          safeMessage: 'Google Drive token exchange did not complete.',
          error: safeExchangeError(exchange.error, exchangeSecrets),
        };
      }

      tokenProvider = createEphemeralGoogleDriveAccessTokenProviderFromExchangeResult(exchange, {
        now: input.now,
      });

      return {
        providerType: 'googleDrive',
        status: tokenProvider ? 'connected' : 'token_exchange_failed',
        connectionStatus: await status(),
        safeMessage: tokenProvider
          ? 'Google Drive is connected for this session.'
          : 'Google Drive token provider could not be created.',
        warnings: exchange.warnings,
      };
    },
    async disconnect() {
      clearSession();
      return {
        providerType: 'googleDrive',
        status: 'disconnected',
        safeMessage: 'Google Drive session state was cleared from memory.',
      };
    },
    async getConnectionStatus() {
      return status();
    },
    getAccessTokenProvider() {
      return tokenProvider?.hasToken() && !tokenProvider.isExpired() ? tokenProvider : null;
    },
    async markReconnectRequired() {
      clearSession();
    },
  };
}
