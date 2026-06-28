import {
  GOOGLE_DRIVE_APP_DATA_SCOPE,
  normalizeGoogleDriveOAuthScopes,
  validateGoogleOAuthRedirectUri,
} from './googleDriveOAuthAuthorization';

export type GoogleDriveOAuthCallbackParseStatus =
  | 'success_candidate'
  | 'oauth_error'
  | 'invalid_callback';

export type GoogleDriveOAuthCallbackValidationStatus =
  | 'valid_code'
  | 'oauth_error'
  | 'invalid_state'
  | 'expired_state'
  | 'missing_pending_auth'
  | 'missing_code'
  | 'missing_state'
  | 'redirect_uri_mismatch'
  | 'provider_mismatch'
  | 'invalid_scope'
  | 'invalid_callback';

export interface GoogleDriveOAuthSuccessCallback {
  readonly status: 'success_candidate';
  readonly code: string;
  readonly state: string;
  readonly scope?: string;
  readonly authuser?: string;
  readonly prompt?: string;
}

export interface GoogleDriveOAuthErrorCallback {
  readonly status: 'oauth_error';
  readonly error: GoogleDriveOAuthSafeError;
  readonly state?: string;
}

export interface GoogleDriveOAuthInvalidCallback {
  readonly status: 'invalid_callback';
  readonly reason: string;
  readonly state?: string;
}

export type GoogleDriveOAuthCallback =
  | GoogleDriveOAuthSuccessCallback
  | GoogleDriveOAuthErrorCallback
  | GoogleDriveOAuthInvalidCallback;

export interface GoogleDriveOAuthSafeError {
  readonly code: string;
  readonly category: 'user_cancelled' | 'retryable' | 'provider_error' | 'invalid_request';
  readonly safeMessage: string;
  readonly retryable: boolean;
}

export interface GoogleDriveOAuthPendingAuth {
  readonly providerType: 'googleDrive';
  readonly state: string;
  readonly nonce?: string;
  readonly codeVerifierRef: string;
  readonly redirectUri: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly scope: readonly string[];
  readonly codeChallengeMethod: 'S256' | string;
}

export interface GoogleDriveOAuthPendingAuthStore {
  getPendingAuthByState(state: string): Promise<GoogleDriveOAuthPendingAuth | null>;
  consumePendingAuth?(state: string): Promise<GoogleDriveOAuthPendingAuth | null>;
  clearPendingAuth?(state: string): Promise<void>;
}

export interface ValidateGoogleDriveOAuthCallbackInput {
  readonly callback: string | URL | URLSearchParams | GoogleDriveOAuthCallback;
  readonly pendingAuth?: GoogleDriveOAuthPendingAuth | null;
  readonly pendingAuthStore?: GoogleDriveOAuthPendingAuthStore;
  readonly expectedRedirectUri: string;
  readonly allowedRedirectUris: readonly string[];
  readonly now?: () => Date;
}

export interface GoogleDriveOAuthCallbackValidationResult {
  readonly status: GoogleDriveOAuthCallbackValidationStatus;
  readonly providerType: 'googleDrive';
  readonly state?: string;
  readonly code?: string;
  readonly codeVerifierRef?: string;
  readonly redirectUri?: string;
  readonly scope?: readonly string[];
  readonly error?: GoogleDriveOAuthSafeError;
  readonly safeMessage: string;
}

const TOKEN_LIKE_PARAM_NAMES = new Set([
  ['access', 'token'].join('_'),
  ['refresh', 'token'].join('_'),
  ['id', 'token'].join('_'),
]);

function paramsFromInput(input: string | URL | URLSearchParams): URLSearchParams | null {
  if (input instanceof URLSearchParams) {
    return input;
  }
  if (input instanceof URL) {
    return input.searchParams;
  }

  try {
    return new URL(input).searchParams;
  } catch {
    const query = input.startsWith('?') ? input.slice(1) : input;
    return new URLSearchParams(query);
  }
}

function strictSingleParam(params: URLSearchParams, name: string): string | undefined | 'duplicate' {
  const values = params.getAll(name);
  if (values.length > 1) {
    return 'duplicate';
  }
  const value = values[0]?.trim();
  return value || undefined;
}

function hasSuspiciousTokenParams(params: URLSearchParams): boolean {
  for (const key of params.keys()) {
    if (TOKEN_LIKE_PARAM_NAMES.has(key.toLowerCase())) {
      return true;
    }
  }
  return false;
}

function sanitizeOAuthErrorDescription(description?: string | null): string {
  if (!description) {
    return '';
  }
  return description
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted-secret]')
    .replace(/code=([^&\s]+)/gi, 'code=[redacted-secret]')
    .replace(/(access[-_]?token|refresh[-_]?token|id[-_]?token|client[-_]?secret)=([^&\s]+)/gi, '$1=[redacted-secret]')
    .slice(0, 180);
}

export function formatGoogleDriveOAuthCallbackError(
  code: string,
  description?: string | null,
): GoogleDriveOAuthSafeError {
  const normalizedCode = code.trim() || 'invalid_request';
  const sanitizedDescription = sanitizeOAuthErrorDescription(description);
  const category =
    normalizedCode === 'access_denied'
      ? 'user_cancelled'
      : normalizedCode === 'temporarily_unavailable' || normalizedCode === 'server_error'
        ? 'retryable'
        : normalizedCode === 'invalid_request' || normalizedCode === 'invalid_scope'
          ? 'invalid_request'
          : 'provider_error';

  const fallbackMessage =
    category === 'user_cancelled'
      ? 'Google Drive authorization was cancelled.'
      : category === 'retryable'
        ? 'Google Drive authorization is temporarily unavailable.'
        : 'Google Drive authorization did not complete.';

  return {
    code: normalizedCode,
    category,
    safeMessage: sanitizedDescription || fallbackMessage,
    retryable: category === 'retryable',
  };
}

export function parseGoogleDriveOAuthCallback(input: string | URL | URLSearchParams): GoogleDriveOAuthCallback {
  const params = paramsFromInput(input);
  if (!params) {
    return { status: 'invalid_callback', reason: 'malformed_callback' };
  }
  if (hasSuspiciousTokenParams(params)) {
    return { status: 'invalid_callback', reason: 'token_param_present' };
  }

  const code = strictSingleParam(params, 'code');
  const state = strictSingleParam(params, 'state');
  const error = strictSingleParam(params, 'error');
  const errorDescription = strictSingleParam(params, 'error_description');
  const scope = strictSingleParam(params, 'scope');
  const authuser = strictSingleParam(params, 'authuser');
  const prompt = strictSingleParam(params, 'prompt');
  const duplicate = [code, state, error, errorDescription, scope, authuser, prompt].includes('duplicate');
  const safeState = state !== 'duplicate' ? state : undefined;

  if (duplicate) {
    return { status: 'invalid_callback', reason: 'duplicate_param', state: safeState };
  }
  if (code && error) {
    return { status: 'invalid_callback', reason: 'code_and_error', state };
  }
  if (!state) {
    return { status: 'invalid_callback', reason: 'missing_state' };
  }
  if (error) {
    return {
      status: 'oauth_error',
      state,
      error: formatGoogleDriveOAuthCallbackError(error, errorDescription),
    };
  }
  if (!code) {
    return { status: 'invalid_callback', reason: 'missing_code', state };
  }

  return {
    status: 'success_candidate',
    code,
    state,
    scope,
    authuser,
    prompt,
  };
}

async function resolvePendingAuth(
  state: string,
  input: ValidateGoogleDriveOAuthCallbackInput,
): Promise<GoogleDriveOAuthPendingAuth | null> {
  if (input.pendingAuth) {
    return input.pendingAuth;
  }
  return input.pendingAuthStore?.getPendingAuthByState(state) ?? null;
}

function result(
  status: GoogleDriveOAuthCallbackValidationStatus,
  safeMessage: string,
  extras: Omit<GoogleDriveOAuthCallbackValidationResult, 'providerType' | 'status' | 'safeMessage'> = {},
): GoogleDriveOAuthCallbackValidationResult {
  return {
    providerType: 'googleDrive',
    status,
    safeMessage,
    ...extras,
  };
}

function parseScopeString(scope?: string): string[] | undefined {
  return scope?.split(/\s+/).map(part => part.trim()).filter(Boolean);
}

function validatePendingContext(
  pendingAuth: GoogleDriveOAuthPendingAuth,
  input: ValidateGoogleDriveOAuthCallbackInput,
): GoogleDriveOAuthCallbackValidationResult | null {
  if (pendingAuth.providerType !== 'googleDrive') {
    return result('provider_mismatch', 'OAuth pending authorization belongs to a different provider.');
  }
  if (pendingAuth.codeChallengeMethod !== 'S256') {
    return result('invalid_callback', 'OAuth pending authorization does not use PKCE S256.');
  }

  let expectedRedirectUri: string;
  let pendingRedirectUri: string;
  try {
    expectedRedirectUri = validateGoogleOAuthRedirectUri(input.expectedRedirectUri, input.allowedRedirectUris);
    pendingRedirectUri = validateGoogleOAuthRedirectUri(pendingAuth.redirectUri, input.allowedRedirectUris);
  } catch {
    return result('redirect_uri_mismatch', 'OAuth redirect URI is not allowed.');
  }

  if (pendingRedirectUri !== expectedRedirectUri) {
    return result('redirect_uri_mismatch', 'OAuth redirect URI does not match the pending authorization.');
  }

  try {
    normalizeGoogleDriveOAuthScopes(pendingAuth.scope);
  } catch {
    return result('invalid_scope', 'OAuth pending authorization requested an unsupported scope.');
  }

  return null;
}

export async function validateGoogleDriveOAuthCallbackState(
  input: ValidateGoogleDriveOAuthCallbackInput,
): Promise<GoogleDriveOAuthCallbackValidationResult> {
  const callback =
    typeof input.callback === 'object' && 'status' in input.callback
      ? input.callback
      : parseGoogleDriveOAuthCallback(input.callback);

  if (callback.status === 'invalid_callback') {
    if (callback.reason === 'missing_state') {
      return result('missing_state', 'OAuth callback is missing state.');
    }
    if (callback.reason === 'missing_code') {
      return result('missing_code', 'OAuth callback is missing an authorization code.', { state: callback.state });
    }
    return result('invalid_callback', 'OAuth callback is invalid.', { state: callback.state });
  }

  const pendingAuth = await resolvePendingAuth(callback.state ?? '', input);
  if (!pendingAuth) {
    const status = callback.state ? 'missing_pending_auth' : 'missing_state';
    return result(status, 'OAuth pending authorization was not found.', {
      state: callback.state,
      error: callback.status === 'oauth_error' ? callback.error : undefined,
    });
  }

  if (callback.state !== pendingAuth.state) {
    return result('invalid_state', 'OAuth callback state does not match the pending authorization.', {
      state: callback.state,
    });
  }

  const contextFailure = validatePendingContext(pendingAuth, input);
  if (contextFailure) {
    return result(contextFailure.status, contextFailure.safeMessage, { state: callback.state });
  }

  const now = (input.now ?? (() => new Date()))();
  if (new Date(pendingAuth.expiresAt).getTime() <= now.getTime()) {
    return result('expired_state', 'OAuth pending authorization has expired.', { state: callback.state });
  }

  if (callback.status === 'oauth_error') {
    return result('oauth_error', callback.error.safeMessage, {
      state: callback.state,
      error: callback.error,
    });
  }

  const callbackScopes = parseScopeString(callback.scope);
  if (callbackScopes) {
    try {
      normalizeGoogleDriveOAuthScopes(callbackScopes);
    } catch {
      return result('invalid_scope', 'OAuth callback returned an unsupported scope.', { state: callback.state });
    }
  }

  return result('valid_code', 'OAuth callback contains a valid authorization code.', {
    state: callback.state,
    code: callback.code,
    codeVerifierRef: pendingAuth.codeVerifierRef,
    redirectUri: pendingAuth.redirectUri,
    scope: callbackScopes ?? pendingAuth.scope ?? [GOOGLE_DRIVE_APP_DATA_SCOPE],
  });
}
