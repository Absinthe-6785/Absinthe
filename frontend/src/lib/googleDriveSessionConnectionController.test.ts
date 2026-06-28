import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { GOOGLE_DRIVE_APP_DATA_SCOPE } from './googleDriveOAuthAuthorization';
import type { GoogleDriveOAuthTokenFetch } from './googleDriveOAuthTokenExchange';
import { createGoogleDriveSessionConnectionController } from './googleDriveSessionConnectionController';

const CLIENT_ID = 'public-client-id.apps.googleusercontent.com';
const REDIRECT_URI = 'http://127.0.0.1:5173/oauth/google-drive/callback';
const STATE = 'opaque-state-123';
const WRONG_STATE = 'wrong-state-456';
const CODE = 'auth-code-123';
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const ACCESS_TOKEN = 'access-token-secret';
const REFRESH_TOKEN = 'refresh-token-secret';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body);
    },
  };
}

function createFetchToken(body: Record<string, unknown> = {}): GoogleDriveOAuthTokenFetch {
  return vi.fn(async () => jsonResponse(200, {
    access_token: ACCESS_TOKEN,
    expires_in: 3600,
    token_type: 'Bearer',
    scope: GOOGLE_DRIVE_APP_DATA_SCOPE,
    refresh_token: REFRESH_TOKEN,
    ...body,
  }));
}

function createController(overrides: {
  fetchToken?: GoogleDriveOAuthTokenFetch;
  now?: () => Date;
  authorizationTtlMs?: number;
} = {}) {
  return createGoogleDriveSessionConnectionController({
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    allowedRedirectUris: [REDIRECT_URI],
    fetchToken: overrides.fetchToken ?? createFetchToken(),
    canDownload: true,
    canUpload: true,
    authorizationTtlMs: overrides.authorizationTtlMs,
    now: overrides.now ?? (() => new Date('2026-06-28T00:05:00.000Z')),
  });
}

async function start(controller = createController()) {
  const result = await controller.startAuthorization({
    state: STATE,
    codeVerifier: VERIFIER,
    nonce: 'nonce-123',
  });
  if (result.status !== 'authorization_url_created') {
    throw new Error('expected authorization url');
  }
  return result;
}

function callbackUrl(state = STATE, code = CODE): string {
  return `${REDIRECT_URI}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(GOOGLE_DRIVE_APP_DATA_SCOPE)}`;
}

describe('Google Drive explicit session connection controller', () => {
  it('builds an authorization URL and stores pending auth only in controller memory', async () => {
    const fetchToken = createFetchToken();
    const controller = createController({ fetchToken });

    const result = await start(controller);
    const url = new URL(result.authorizationUrl);

    expect(result).toMatchObject({
      providerType: 'googleDrive',
      status: 'authorization_url_created',
      state: STATE,
      expiresAt: '2026-06-28T00:15:00.000Z',
    });
    expect(url.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(url.searchParams.get('state')).toBe(STATE);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('include_granted_scopes')).toBe('false');
    expect(JSON.stringify(result)).not.toContain(VERIFIER);
    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN);
    expect(JSON.stringify(result)).not.toContain(REFRESH_TOKEN);
    expect(fetchToken).not.toHaveBeenCalled();
    expect(controller.getAccessTokenProvider()).toBeNull();
    await expect(controller.getConnectionStatus()).resolves.toMatchObject({
      status: 'unconfigured',
      canRecover: false,
    });
  });

  it('does not restore pending auth in a new controller instance', async () => {
    const original = createController();
    await start(original);

    const fresh = createController();
    await expect(fresh.completeCallback(callbackUrl())).resolves.toMatchObject({
      status: 'missing_pending_auth',
      connectionStatus: { status: 'unconfigured' },
    });
  });

  it('completes an explicit callback and creates a memory-only token provider on success', async () => {
    const fetchToken = createFetchToken();
    const controller = createController({ fetchToken });
    await start(controller);

    const result = await controller.completeCallback({ callbackUrl: callbackUrl() });

    expect(result).toMatchObject({
      providerType: 'googleDrive',
      status: 'connected',
      connectionStatus: {
        providerType: 'googleDrive',
        status: 'available',
        canRecover: true,
        canDownload: true,
        canUpload: true,
      },
    });
    expect(fetchToken).toHaveBeenCalledTimes(1);
    const provider = controller.getAccessTokenProvider();
    expect(provider).not.toBeNull();
    await expect(provider?.getAccessToken()).resolves.toBe(ACCESS_TOKEN);
    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN);
    expect(JSON.stringify(result)).not.toContain(REFRESH_TOKEN);
    expect(JSON.stringify(result)).not.toContain(VERIFIER);
    expect(JSON.stringify(result)).not.toContain(CODE);
  });

  it('rejects missing pending auth, state mismatch, and expired pending auth without exchanging tokens', async () => {
    const missingFetch = createFetchToken();
    const missing = createController({ fetchToken: missingFetch });
    await expect(missing.completeCallback(callbackUrl())).resolves.toMatchObject({
      status: 'missing_pending_auth',
    });
    expect(missingFetch).not.toHaveBeenCalled();

    const mismatchFetch = createFetchToken();
    const mismatch = createController({ fetchToken: mismatchFetch });
    await start(mismatch);
    await expect(mismatch.completeCallback(callbackUrl(WRONG_STATE))).resolves.toMatchObject({
      status: 'invalid_state',
    });
    expect(mismatchFetch).not.toHaveBeenCalled();

    let now = new Date('2026-06-28T00:00:00.000Z');
    const expiredFetch = createFetchToken();
    const expired = createController({
      fetchToken: expiredFetch,
      authorizationTtlMs: 1000,
      now: () => now,
    });
    await start(expired);
    now = new Date('2026-06-28T00:00:01.000Z');
    await expect(expired.completeCallback(callbackUrl())).resolves.toMatchObject({
      status: 'expired_state',
    });
    expect(expiredFetch).not.toHaveBeenCalled();
  });

  it('replaces previous pending auth when startAuthorization is called again', async () => {
    const fetchToken = createFetchToken();
    const controller = createController({ fetchToken });
    const first = await start(controller);
    const secondState = 'second-state-789';
    const second = await controller.startAuthorization({
      state: secondState,
      codeVerifier: VERIFIER,
    });

    expect(second.status).toBe('authorization_url_created');
    await expect(controller.completeCallback(callbackUrl(first.state))).resolves.toMatchObject({
      status: 'invalid_state',
    });
    expect(fetchToken).not.toHaveBeenCalled();

    await expect(controller.completeCallback(callbackUrl(secondState))).resolves.toMatchObject({
      status: 'connected',
    });
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  it('handles oauth error callbacks without creating a provider or exchanging tokens', async () => {
    const fetchToken = createFetchToken();
    const controller = createController({ fetchToken });
    await start(controller);

    const result = await controller.completeCallback(
      `${REDIRECT_URI}?error=access_denied&state=${encodeURIComponent(STATE)}`,
    );

    expect(result).toMatchObject({
      status: 'oauth_error',
      connectionStatus: { status: 'unconfigured' },
    });
    expect(controller.getAccessTokenProvider()).toBeNull();
    expect(fetchToken).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN);
    expect(JSON.stringify(result)).not.toContain(CODE);
    expect(JSON.stringify(result)).not.toContain(VERIFIER);
  });

  it('blocks replay after token exchange failure consumes pending auth', async () => {
    const fetchToken: GoogleDriveOAuthTokenFetch = vi.fn(async () => jsonResponse(400, {
      error: 'invalid_grant',
      error_description: 'Authorization code expired.',
    }));
    const controller = createController({ fetchToken });
    await start(controller);

    await expect(controller.completeCallback(callbackUrl())).resolves.toMatchObject({
      status: 'token_exchange_failed',
    });
    await expect(controller.completeCallback(callbackUrl())).resolves.toMatchObject({
      status: 'missing_pending_auth',
    });
    expect(fetchToken).toHaveBeenCalledTimes(1);
    expect(controller.getAccessTokenProvider()).toBeNull();
  });

  it('consumes pending auth and blocks replay with the same callback', async () => {
    const fetchToken = createFetchToken();
    const controller = createController({ fetchToken });
    await start(controller);

    await expect(controller.completeCallback(callbackUrl())).resolves.toMatchObject({ status: 'connected' });
    await expect(controller.completeCallback(callbackUrl())).resolves.toMatchObject({ status: 'missing_pending_auth' });
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  it('does not make the provider available when token exchange fails and sanitizes errors', async () => {
    const fetchToken: GoogleDriveOAuthTokenFetch = vi.fn(async () => jsonResponse(400, {
      error: 'invalid_grant',
      error_description: `code=${CODE} access_token=${ACCESS_TOKEN} refresh_token=${REFRESH_TOKEN} ${VERIFIER}`,
    }));
    const controller = createController({ fetchToken });
    await start(controller);

    const result = await controller.completeCallback(callbackUrl());

    expect(result).toMatchObject({
      status: 'token_exchange_failed',
      connectionStatus: { status: 'unconfigured' },
      error: {
        code: 'invalid_grant',
        category: 'auth',
        retryable: false,
        status: 400,
      },
    });
    expect(controller.getAccessTokenProvider()).toBeNull();
    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN);
    expect(JSON.stringify(result)).not.toContain(REFRESH_TOKEN);
    expect(JSON.stringify(result)).not.toContain(CODE);
    expect(JSON.stringify(result)).not.toContain(VERIFIER);
  });

  it('disconnect clears pending auth, token provider, and stale provider references', async () => {
    const controller = createController();
    await start(controller);
    await expect(controller.disconnect()).resolves.toMatchObject({
      status: 'disconnected',
    });
    await expect(controller.completeCallback(callbackUrl())).resolves.toMatchObject({
      status: 'missing_pending_auth',
    });

    await start(controller);
    await controller.completeCallback(callbackUrl());
    const staleProvider = controller.getAccessTokenProvider();
    expect(staleProvider).not.toBeNull();

    await controller.disconnect();

    expect(controller.getAccessTokenProvider()).toBeNull();
    await expect(staleProvider?.getAccessToken()).rejects.toThrow(/unavailable/);
    await expect(controller.getConnectionStatus()).resolves.toMatchObject({
      status: 'unconfigured',
    });
  });

  it('markReconnectRequired clears provider status and expired tokens are not handed out', async () => {
    let now = new Date('2026-06-28T00:05:00.000Z');
    const controller = createController({
      fetchToken: createFetchToken({ expires_in: 1 }),
      now: () => now,
    });
    await start(controller);
    await controller.completeCallback(callbackUrl());

    expect(controller.getAccessTokenProvider()).not.toBeNull();
    now = new Date('2026-06-28T00:05:01.000Z');

    expect(controller.getAccessTokenProvider()).toBeNull();
    await expect(controller.getConnectionStatus()).resolves.toMatchObject({
      status: 'auth_expired',
    });

    await controller.markReconnectRequired();

    await expect(controller.getConnectionStatus()).resolves.toMatchObject({
      status: 'unconfigured',
    });
  });

  it('does not implement persistence, UI, navigation, auto-run, or destructive remote behavior', () => {
    const source = readFileSync(join(process.cwd(), 'src/lib/googleDriveSessionConnectionController.ts'), 'utf8');

    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('sessionStorage');
    expect(source).not.toContain('indexedDB');
    expect(source).not.toContain('document.cookie');
    expect(source).not.toContain('window.location');
    expect(source).not.toContain('window.open');
    expect(source).not.toContain('console.log');
    expect(source).not.toContain('client_secret');
    expect(source).not.toContain('Sign in with Google');
    expect(source).not.toContain('Connect Google Drive');
    expect(source).not.toContain('Authorize Google');
    expect(source).not.toContain('Sync now');
    expect(source).not.toContain('Upload all');
    expect(source).not.toContain('Recover all');
    expect(source).not.toContain('deleteBlob');
    expect(source).not.toContain('remoteDelete');
  });
});
