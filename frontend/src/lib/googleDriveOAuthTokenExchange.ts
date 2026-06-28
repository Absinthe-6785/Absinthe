import {
  GOOGLE_DRIVE_APP_DATA_SCOPE,
  isValidCodeVerifier,
  normalizeGoogleDriveOAuthScopes,
  validateGoogleOAuthRedirectUri,
} from './googleDriveOAuthAuthorization';
import type {
  GoogleDriveOAuthCallbackValidationResult,
  GoogleDriveOAuthPendingAuth,
  GoogleDriveOAuthPendingAuthStore,
} from './googleDriveOAuthCallback';
import { sanitizeRemoteBlobProviderErrorMessage } from './remoteBlobProvider';

export const GOOGLE_DRIVE_OAUTH_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

export type GoogleDriveOAuthTokenExchangeStatus =
  | 'exchanged'
  | 'invalid_request'
  | 'replay_or_missing_pending_auth'
  | 'invalid_pending_auth'
  | 'invalid_token_response'
  | 'token_endpoint_error'
  | 'network_error';

export interface GoogleDriveOAuthCodeVerifierLookup {
  getCodeVerifier(codeVerifierRef: string): Promise<string | null>;
  clearCodeVerifier?(codeVerifierRef: string): Promise<void>;
}

export interface GoogleDriveOAuthTokenExchangeRequest {
  readonly endpoint: typeof GOOGLE_DRIVE_OAUTH_TOKEN_ENDPOINT;
  readonly method: 'POST';
  readonly headers: Readonly<Record<string, string>>;
  readonly body: URLSearchParams;
}

export interface BuildGoogleDriveOAuthTokenExchangeRequestInput {
  readonly code: string;
  readonly codeVerifier: string;
  readonly redirectUri: string;
  readonly allowedRedirectUris: readonly string[];
  readonly clientId: string;
}

export interface GoogleDriveOAuthTokenSet {
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresIn?: number;
  readonly expiresAt?: string;
  readonly scope: readonly string[];
  readonly sensitiveRefreshTokenReturned: boolean;
}

export interface GoogleDriveOAuthTokenExchangeError {
  readonly code: string;
  readonly category: 'auth' | 'network' | 'provider' | 'invalid_request';
  readonly retryable: boolean;
  readonly status?: number;
  readonly safeMessage: string;
}

export type GoogleDriveOAuthTokenExchangeResult =
  | {
      readonly status: 'exchanged';
      readonly providerType: 'googleDrive';
      readonly tokenSet: GoogleDriveOAuthTokenSet;
      readonly warnings: readonly string[];
    }
  | {
      readonly status: Exclude<GoogleDriveOAuthTokenExchangeStatus, 'exchanged'>;
      readonly providerType: 'googleDrive';
      readonly error: GoogleDriveOAuthTokenExchangeError;
    };

export interface GoogleDriveOAuthTokenFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
}

export type GoogleDriveOAuthTokenFetch = (
  url: string,
  init: {
    readonly method: 'POST';
    readonly headers: Readonly<Record<string, string>>;
    readonly body: URLSearchParams;
  },
) => Promise<GoogleDriveOAuthTokenFetchResponse>;

export interface ExchangeGoogleDriveOAuthCodeInput {
  readonly callbackValidation: GoogleDriveOAuthCallbackValidationResult;
  readonly pendingAuthStore: Pick<GoogleDriveOAuthPendingAuthStore, 'consumePendingAuth'>;
  readonly codeVerifierLookup: GoogleDriveOAuthCodeVerifierLookup;
  readonly clientId: string;
  readonly expectedRedirectUri: string;
  readonly allowedRedirectUris: readonly string[];
  readonly fetchToken: GoogleDriveOAuthTokenFetch;
  readonly now?: () => Date;
}

function trimRequired(value: string | undefined, label: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  return trimmed;
}

export function buildGoogleDriveOAuthTokenExchangeRequest(
  input: BuildGoogleDriveOAuthTokenExchangeRequestInput,
): GoogleDriveOAuthTokenExchangeRequest {
  const code = trimRequired(input.code, 'Google OAuth authorization code');
  const codeVerifier = trimRequired(input.codeVerifier, 'Google OAuth PKCE verifier');
  const clientId = trimRequired(input.clientId, 'Google OAuth client id');
  const redirectUri = validateGoogleOAuthRedirectUri(input.redirectUri, input.allowedRedirectUris);

  if (!isValidCodeVerifier(codeVerifier)) {
    throw new Error('Google OAuth PKCE verifier is invalid.');
  }

  const body = new URLSearchParams({
    code,
    code_verifier: codeVerifier,
    client_id: clientId,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  return {
    endpoint: GOOGLE_DRIVE_OAUTH_TOKEN_ENDPOINT,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  };
}

function safeExchangeError(
  status: Exclude<GoogleDriveOAuthTokenExchangeStatus, 'exchanged'>,
  code: string,
  safeMessage: unknown,
  options: {
    readonly category?: GoogleDriveOAuthTokenExchangeError['category'];
    readonly retryable?: boolean;
    readonly httpStatus?: number;
  } = {},
): GoogleDriveOAuthTokenExchangeResult {
  return {
    providerType: 'googleDrive',
    status,
    error: {
      code,
      category: options.category ?? 'invalid_request',
      retryable: options.retryable ?? false,
      status: options.httpStatus,
      safeMessage: sanitizeRemoteBlobProviderErrorMessage(safeMessage),
    },
  };
}

function validateConsumedPendingAuth(
  pendingAuth: GoogleDriveOAuthPendingAuth,
  input: ExchangeGoogleDriveOAuthCodeInput,
): GoogleDriveOAuthTokenExchangeResult | null {
  if (pendingAuth.providerType !== 'googleDrive') {
    return safeExchangeError('invalid_pending_auth', 'provider_mismatch', 'OAuth pending authorization belongs to a different provider.');
  }
  if (pendingAuth.state !== input.callbackValidation.state) {
    return safeExchangeError('invalid_pending_auth', 'state_mismatch', 'OAuth pending authorization state does not match.');
  }
  if (pendingAuth.codeChallengeMethod !== 'S256') {
    return safeExchangeError('invalid_pending_auth', 'invalid_pkce_method', 'OAuth pending authorization does not use PKCE S256.');
  }

  let expectedRedirectUri: string;
  let pendingRedirectUri: string;
  try {
    expectedRedirectUri = validateGoogleOAuthRedirectUri(input.expectedRedirectUri, input.allowedRedirectUris);
    pendingRedirectUri = validateGoogleOAuthRedirectUri(pendingAuth.redirectUri, input.allowedRedirectUris);
  } catch {
    return safeExchangeError('invalid_pending_auth', 'redirect_uri_not_allowed', 'OAuth redirect URI is not allowed.');
  }
  if (pendingRedirectUri !== expectedRedirectUri || pendingRedirectUri !== input.callbackValidation.redirectUri) {
    return safeExchangeError('invalid_pending_auth', 'redirect_uri_mismatch', 'OAuth redirect URI does not match pending authorization.');
  }

  try {
    normalizeGoogleDriveOAuthScopes(pendingAuth.scope);
  } catch {
    return safeExchangeError('invalid_pending_auth', 'invalid_scope', 'OAuth pending authorization requested an unsupported scope.');
  }

  const now = (input.now ?? (() => new Date()))();
  if (new Date(pendingAuth.expiresAt).getTime() <= now.getTime()) {
    return safeExchangeError('replay_or_missing_pending_auth', 'expired_pending_auth', 'OAuth pending authorization has expired.');
  }

  return null;
}

function parseTokenResponseJson(text: string): unknown {
  return JSON.parse(text);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function scopeFromResponse(scope: unknown): { scopes: string[]; warnings: string[] } | GoogleDriveOAuthTokenExchangeResult {
  if (scope === undefined || scope === null || scope === '') {
    return safeExchangeError('invalid_token_response', 'missing_scope', 'OAuth token response did not include scope.');
  }
  if (typeof scope !== 'string') {
    return safeExchangeError('invalid_token_response', 'invalid_scope', 'OAuth token response scope is invalid.');
  }

  const scopes = scope.split(/\s+/).map(part => part.trim()).filter(Boolean);
  try {
    normalizeGoogleDriveOAuthScopes(scopes);
  } catch {
    return safeExchangeError('invalid_token_response', 'invalid_scope', 'OAuth token response included an unsupported scope.');
  }
  return { scopes, warnings: [] };
}

function validateTokenResponse(value: unknown, now: Date): GoogleDriveOAuthTokenExchangeResult {
  const record = asRecord(value);
  if (!record) {
    return safeExchangeError('invalid_token_response', 'invalid_json_shape', 'OAuth token response was not a JSON object.');
  }

  const accessToken = record[['access', 'token'].join('_')];
  if (typeof accessToken !== 'string' || accessToken.trim().length === 0) {
    return safeExchangeError('invalid_token_response', 'missing_access_token', 'OAuth token response did not include an access token.');
  }

  const tokenType = record.token_type;
  if (tokenType !== 'Bearer') {
    return safeExchangeError('invalid_token_response', 'invalid_token_type', 'OAuth token response token type is unsupported.');
  }

  const expiresIn = record.expires_in;
  if (!Number.isFinite(expiresIn) || typeof expiresIn !== 'number' || expiresIn <= 0) {
    return safeExchangeError('invalid_token_response', 'invalid_expires_in', 'OAuth token response expiration is invalid.');
  }

  const scopeResult = scopeFromResponse(record.scope);
  if ('providerType' in scopeResult) {
    return scopeResult;
  }

  const expiresAt = new Date(now.getTime() + expiresIn * 1000).toISOString();

  return {
    providerType: 'googleDrive',
    status: 'exchanged',
    warnings: scopeResult.warnings,
    tokenSet: {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      expiresAt,
      scope: scopeResult.scopes,
      sensitiveRefreshTokenReturned: typeof record[['refresh', 'token'].join('_')] === 'string',
    },
  };
}

function safeEndpointErrorBody(value: unknown): { code: string; message: string; retryable: boolean } {
  const record = asRecord(value);
  const code = typeof record?.error === 'string' ? record.error : 'token_endpoint_error';
  const description = typeof record?.error_description === 'string' ? record.error_description : 'OAuth token endpoint request failed.';
  const retryable = code === 'temporarily_unavailable' || code === 'server_error';
  return { code, message: description, retryable };
}

export async function exchangeGoogleDriveOAuthCode(
  input: ExchangeGoogleDriveOAuthCodeInput,
): Promise<GoogleDriveOAuthTokenExchangeResult> {
  if (input.callbackValidation.status !== 'valid_code' || !input.callbackValidation.code || !input.callbackValidation.state) {
    return safeExchangeError('invalid_request', 'invalid_callback_validation', 'OAuth callback validation is not exchangeable.');
  }

  const consumedPendingAuth = await input.pendingAuthStore.consumePendingAuth?.(input.callbackValidation.state);
  if (!consumedPendingAuth) {
    return safeExchangeError(
      'replay_or_missing_pending_auth',
      'replay_or_missing_pending_auth',
      'OAuth pending authorization was already consumed or missing.',
    );
  }

  const pendingFailure = validateConsumedPendingAuth(consumedPendingAuth, input);
  if (pendingFailure) {
    return pendingFailure;
  }

  const codeVerifier = await input.codeVerifierLookup.getCodeVerifier(consumedPendingAuth.codeVerifierRef);
  if (!codeVerifier) {
    return safeExchangeError('replay_or_missing_pending_auth', 'missing_code_verifier', 'OAuth PKCE verifier was not found.');
  }

  let request: GoogleDriveOAuthTokenExchangeRequest;
  try {
    request = buildGoogleDriveOAuthTokenExchangeRequest({
      code: input.callbackValidation.code,
      codeVerifier,
      clientId: input.clientId,
      redirectUri: consumedPendingAuth.redirectUri,
      allowedRedirectUris: input.allowedRedirectUris,
    });
  } catch (error) {
    return safeExchangeError('invalid_request', 'invalid_exchange_request', error);
  } finally {
    await input.codeVerifierLookup.clearCodeVerifier?.(consumedPendingAuth.codeVerifierRef);
  }

  try {
    const response = await input.fetchToken(request.endpoint, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    const text = await response.text();

    let parsed: unknown;
    try {
      parsed = parseTokenResponseJson(text);
    } catch {
      return safeExchangeError('invalid_token_response', 'invalid_json', 'OAuth token endpoint returned invalid JSON.', {
        category: 'provider',
        httpStatus: response.status,
      });
    }

    if (!response.ok) {
      const errorBody = safeEndpointErrorBody(parsed);
      return safeExchangeError('token_endpoint_error', errorBody.code, errorBody.message, {
        category: errorBody.code === 'invalid_grant' || errorBody.code === 'invalid_client' ? 'auth' : 'provider',
        retryable: errorBody.retryable,
        httpStatus: response.status,
      });
    }

    return validateTokenResponse(parsed, (input.now ?? (() => new Date()))());
  } catch (error) {
    return safeExchangeError('network_error', 'network_error', error, {
      category: 'network',
      retryable: true,
    });
  }
}
