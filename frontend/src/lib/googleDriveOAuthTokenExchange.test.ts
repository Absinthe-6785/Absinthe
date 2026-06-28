import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { GOOGLE_DRIVE_APP_DATA_SCOPE } from './googleDriveOAuthAuthorization';
import type { GoogleDriveOAuthCallbackValidationResult, GoogleDriveOAuthPendingAuth } from './googleDriveOAuthCallback';
import {
  GOOGLE_DRIVE_OAUTH_TOKEN_ENDPOINT,
  buildGoogleDriveOAuthTokenExchangeRequest,
  exchangeGoogleDriveOAuthCode,
  type GoogleDriveOAuthCodeVerifierLookup,
  type GoogleDriveOAuthTokenFetch,
} from './googleDriveOAuthTokenExchange';

const REDIRECT_URI = 'http://127.0.0.1:5173/oauth/google-drive/callback';
const STATE = 'opaque-state-123';
const CODE = 'auth-code-123';
const CLIENT_ID = 'public-client-id.apps.googleusercontent.com';
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

const pendingAuth: GoogleDriveOAuthPendingAuth = {
  providerType: 'googleDrive',
  state: STATE,
  codeVerifierRef: 'pkce-ref-789',
  redirectUri: REDIRECT_URI,
  createdAt: '2026-06-28T00:00:00.000Z',
  expiresAt: '2026-06-28T00:10:00.000Z',
  scope: [GOOGLE_DRIVE_APP_DATA_SCOPE],
  codeChallengeMethod: 'S256',
};

const validCallback: GoogleDriveOAuthCallbackValidationResult = {
  status: 'valid_code',
  providerType: 'googleDrive',
  code: CODE,
  state: STATE,
  codeVerifierRef: 'pkce-ref-789',
  redirectUri: REDIRECT_URI,
  scope: [GOOGLE_DRIVE_APP_DATA_SCOPE],
  safeMessage: 'OAuth callback contains a valid authorization code.',
};

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body);
    },
  };
}

function createOneTimePendingStore(auth: GoogleDriveOAuthPendingAuth | null = pendingAuth) {
  let value = auth;
  return {
    async consumePendingAuth(state: string) {
      if (!value || value.state !== state) return null;
      const consumed = value;
      value = null;
      return consumed;
    },
  };
}

function createVerifierLookup(verifier: string | null = VERIFIER): GoogleDriveOAuthCodeVerifierLookup {
  return {
    getCodeVerifier: vi.fn(async () => verifier),
    clearCodeVerifier: vi.fn(async () => undefined),
  };
}

function exchange(overrides: {
  callbackValidation?: GoogleDriveOAuthCallbackValidationResult;
  pendingAuth?: GoogleDriveOAuthPendingAuth | null;
  verifier?: string | null;
  fetchToken?: GoogleDriveOAuthTokenFetch;
  clientId?: string;
} = {}) {
  const fetchToken = overrides.fetchToken ?? vi.fn(async () => jsonResponse(200, {
    access_token: 'access-token-secret',
    expires_in: 3600,
    scope: GOOGLE_DRIVE_APP_DATA_SCOPE,
    token_type: 'Bearer',
    refresh_token: 'refresh-token-secret',
  }));

  return exchangeGoogleDriveOAuthCode({
    callbackValidation: overrides.callbackValidation ?? validCallback,
    pendingAuthStore: createOneTimePendingStore(overrides.pendingAuth === undefined ? pendingAuth : overrides.pendingAuth),
    codeVerifierLookup: createVerifierLookup(overrides.verifier === undefined ? VERIFIER : overrides.verifier),
    clientId: overrides.clientId ?? CLIENT_ID,
    expectedRedirectUri: REDIRECT_URI,
    allowedRedirectUris: [REDIRECT_URI],
    fetchToken,
    now: () => new Date('2026-06-28T00:05:00.000Z'),
  });
}

describe('Google Drive OAuth token exchange boundary', () => {
  it('builds an authorization_code PKCE token exchange request without client secret', () => {
    const request = buildGoogleDriveOAuthTokenExchangeRequest({
      code: CODE,
      codeVerifier: VERIFIER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      allowedRedirectUris: [REDIRECT_URI],
    });

    expect(request.endpoint).toBe(GOOGLE_DRIVE_OAUTH_TOKEN_ENDPOINT);
    expect(request.method).toBe('POST');
    expect(request.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(request.body.get('grant_type')).toBe('authorization_code');
    expect(request.body.get('code')).toBe(CODE);
    expect(request.body.get('code_verifier')).toBe(VERIFIER);
    expect(request.body.get('client_id')).toBe(CLIENT_ID);
    expect(request.body.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(request.body.get('client_secret')).toBeNull();
    expect(request.body.get('refresh_token')).toBeNull();
  });

  it('rejects missing request fields and disallowed redirect URIs', () => {
    expect(() => buildGoogleDriveOAuthTokenExchangeRequest({
      code: '',
      codeVerifier: VERIFIER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      allowedRedirectUris: [REDIRECT_URI],
    })).toThrow(/authorization code/);
    expect(() => buildGoogleDriveOAuthTokenExchangeRequest({
      code: CODE,
      codeVerifier: '',
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      allowedRedirectUris: [REDIRECT_URI],
    })).toThrow(/PKCE verifier/);
    expect(() => buildGoogleDriveOAuthTokenExchangeRequest({
      code: CODE,
      codeVerifier: VERIFIER,
      clientId: '',
      redirectUri: REDIRECT_URI,
      allowedRedirectUris: [REDIRECT_URI],
    })).toThrow(/client id/);
    expect(() => buildGoogleDriveOAuthTokenExchangeRequest({
      code: CODE,
      codeVerifier: VERIFIER,
      clientId: CLIENT_ID,
      redirectUri: 'http://127.0.0.1:5173/other',
      allowedRedirectUris: [REDIRECT_URI],
    })).toThrow(/allowlist/);
  });

  it('does not call the token endpoint until the explicit exchange function is invoked', async () => {
    const fetchToken = vi.fn(async () => jsonResponse(200, {
      access_token: 'access-token-secret',
      token_type: 'Bearer',
      scope: GOOGLE_DRIVE_APP_DATA_SCOPE,
    }));

    expect(fetchToken).not.toHaveBeenCalled();
    const result = await exchange({ fetchToken });

    expect(fetchToken).toHaveBeenCalledTimes(1);
    expect(fetchToken).toHaveBeenCalledWith(GOOGLE_DRIVE_OAUTH_TOKEN_ENDPOINT, expect.objectContaining({
      method: 'POST',
      body: expect.any(URLSearchParams),
    }));
    expect(result.status).toBe('exchanged');
  });

  it('consumes pending auth and blocks replay with the same state', async () => {
    const pendingStore = createOneTimePendingStore();
    const verifierLookup = createVerifierLookup();
    const fetchToken = vi.fn(async () => jsonResponse(200, {
      access_token: 'access-token-secret',
      token_type: 'Bearer',
      scope: GOOGLE_DRIVE_APP_DATA_SCOPE,
    }));
    const input = {
      callbackValidation: validCallback,
      pendingAuthStore: pendingStore,
      codeVerifierLookup: verifierLookup,
      clientId: CLIENT_ID,
      expectedRedirectUri: REDIRECT_URI,
      allowedRedirectUris: [REDIRECT_URI],
      fetchToken,
      now: () => new Date('2026-06-28T00:05:00.000Z'),
    };

    await expect(exchangeGoogleDriveOAuthCode(input)).resolves.toMatchObject({ status: 'exchanged' });
    await expect(exchangeGoogleDriveOAuthCode(input)).resolves.toMatchObject({
      status: 'replay_or_missing_pending_auth',
      error: {
        code: 'replay_or_missing_pending_auth',
      },
    });
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  it('blocks missing pending auth, expired pending auth, invalid context, and missing verifier', async () => {
    await expect(exchange({ pendingAuth: null })).resolves.toMatchObject({
      status: 'replay_or_missing_pending_auth',
    });
    await expect(exchange({
      pendingAuth: { ...pendingAuth, expiresAt: '2026-06-28T00:04:59.000Z' },
    })).resolves.toMatchObject({
      status: 'replay_or_missing_pending_auth',
      error: { code: 'expired_pending_auth' },
    });
    await expect(exchange({
      pendingAuth: { ...pendingAuth, codeChallengeMethod: 'plain' },
    })).resolves.toMatchObject({
      status: 'invalid_pending_auth',
      error: { code: 'invalid_pkce_method' },
    });
    await expect(exchange({ verifier: null })).resolves.toMatchObject({
      status: 'replay_or_missing_pending_auth',
      error: { code: 'missing_code_verifier' },
    });
  });

  it('validates token response schema and omits refresh token from the public result', async () => {
    const result = await exchange();

    expect(result.status).toBe('exchanged');
    if (result.status !== 'exchanged') throw new Error('expected exchanged');
    expect(result.tokenSet).toEqual({
      accessToken: 'access-token-secret',
      tokenType: 'Bearer',
      expiresIn: 3600,
      expiresAt: '2026-06-28T01:05:00.000Z',
      scope: [GOOGLE_DRIVE_APP_DATA_SCOPE],
      sensitiveRefreshTokenReturned: true,
    });
    expect(JSON.stringify(result)).not.toContain('refresh-token-secret');
    expect(JSON.stringify(result)).not.toContain('pkce-ref-789');
    expect(JSON.stringify(result)).not.toContain(VERIFIER);
  });

  it('returns a warning when token response omits scope', async () => {
    const result = await exchange({
      fetchToken: vi.fn(async () => jsonResponse(200, {
        access_token: 'access-token-secret',
        token_type: 'Bearer',
      })),
    });

    expect(result.status).toBe('exchanged');
    if (result.status !== 'exchanged') throw new Error('expected exchanged');
    expect(result.warnings).toEqual([
      'Token response did not include scope; assuming the requested app data scope for this in-memory result.',
    ]);
  });

  it('rejects invalid token type, expiration, missing token, and broad response scopes', async () => {
    await expect(exchange({
      fetchToken: vi.fn(async () => jsonResponse(200, {
        access_token: 'access-token-secret',
        token_type: 'mac',
        scope: GOOGLE_DRIVE_APP_DATA_SCOPE,
      })),
    })).resolves.toMatchObject({ status: 'invalid_token_response', error: { code: 'invalid_token_type' } });

    await expect(exchange({
      fetchToken: vi.fn(async () => jsonResponse(200, {
        access_token: 'access-token-secret',
        expires_in: -1,
        token_type: 'Bearer',
        scope: GOOGLE_DRIVE_APP_DATA_SCOPE,
      })),
    })).resolves.toMatchObject({ status: 'invalid_token_response', error: { code: 'invalid_expires_in' } });

    await expect(exchange({
      fetchToken: vi.fn(async () => jsonResponse(200, {
        token_type: 'Bearer',
        scope: GOOGLE_DRIVE_APP_DATA_SCOPE,
      })),
    })).resolves.toMatchObject({ status: 'invalid_token_response', error: { code: 'missing_access_token' } });

    await expect(exchange({
      fetchToken: vi.fn(async () => jsonResponse(200, {
        access_token: 'access-token-secret',
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive.file',
      })),
    })).resolves.toMatchObject({ status: 'invalid_token_response', error: { code: 'invalid_scope' } });
  });

  it('sanitizes non-2xx token endpoint errors and invalid JSON', async () => {
    await expect(exchange({
      fetchToken: vi.fn(async () => jsonResponse(400, {
        error: 'invalid_grant',
        error_description: `code=${CODE} access_token=token refresh_token=refresh client_secret=client ${VERIFIER}`,
      })),
    })).resolves.toMatchObject({
      status: 'token_endpoint_error',
      error: {
        code: 'invalid_grant',
        category: 'auth',
        retryable: false,
        status: 400,
      },
    });

    const invalidJsonResult = await exchange({
      fetchToken: vi.fn(async () => ({
        ok: true,
        status: 200,
        async text() {
          return '{';
        },
      })),
    });
    expect(invalidJsonResult).toMatchObject({
      status: 'invalid_token_response',
      error: { code: 'invalid_json' },
    });
    expect(JSON.stringify(invalidJsonResult)).not.toContain(CODE);
    expect(JSON.stringify(invalidJsonResult)).not.toContain(VERIFIER);
  });

  it('sanitizes network errors without exposing code, verifier, or token material', async () => {
    const result = await exchange({
      fetchToken: vi.fn(async () => {
        throw new Error(`Authorization: Bearer token-secret code=${CODE} refresh_token=refresh ${VERIFIER}`);
      }),
    });

    expect(result).toMatchObject({
      status: 'network_error',
      error: {
        code: 'network_error',
        category: 'network',
        retryable: true,
      },
    });
    expect(JSON.stringify(result)).not.toContain('token-secret');
    expect(JSON.stringify(result)).not.toContain(CODE);
    expect(JSON.stringify(result)).not.toContain(VERIFIER);
    expect(JSON.stringify(result)).not.toContain('refresh');
  });

  it('does not expose verifier refs in public errors', async () => {
    const result = await exchange({
      pendingAuth: { ...pendingAuth, redirectUri: 'http://127.0.0.1:5173/other' },
    });

    expect(result.status).toBe('invalid_pending_auth');
    expect(JSON.stringify(result)).not.toContain('pkce-ref-789');
    expect(JSON.stringify(result)).not.toContain(VERIFIER);
  });

  it('does not implement storage, provider availability, UI, auto-run, or destructive remote behavior', () => {
    const source = readFileSync(join(process.cwd(), 'src/lib/googleDriveOAuthTokenExchange.ts'), 'utf8');

    expect(source).toContain('oauth2.googleapis.com/token');
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('sessionStorage');
    expect(source).not.toContain('indexedDB');
    expect(source).not.toContain('document.cookie');
    expect(source).not.toContain('window.location');
    expect(source).not.toContain('window.open');
    expect(source).not.toContain('console.log');
    expect(source).not.toContain('deleteBlob');
    expect(source).not.toContain('remoteDelete');
    expect(source).not.toContain('client_secret');
    expect(source).not.toContain('Sign in with Google');
    expect(source).not.toContain('Connect Google Drive');
    expect(source).not.toContain('Authorize Google');
    expect(source).not.toContain('Provider available');
  });
});
