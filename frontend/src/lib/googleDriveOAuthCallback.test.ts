import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GOOGLE_DRIVE_APP_DATA_SCOPE } from './googleDriveOAuthAuthorization';
import {
  formatGoogleDriveOAuthCallbackError,
  parseGoogleDriveOAuthCallback,
  validateGoogleDriveOAuthCallbackState,
  type GoogleDriveOAuthPendingAuth,
  type GoogleDriveOAuthPendingAuthStore,
} from './googleDriveOAuthCallback';

const REDIRECT_URI = 'http://127.0.0.1:5173/oauth/google-drive/callback';
const STATE = 'opaque-state-123';

const pendingAuth: GoogleDriveOAuthPendingAuth = {
  providerType: 'googleDrive',
  state: STATE,
  nonce: 'opaque-nonce-456',
  codeVerifierRef: 'pkce-ref-789',
  redirectUri: REDIRECT_URI,
  createdAt: '2026-06-28T00:00:00.000Z',
  expiresAt: '2026-06-28T00:10:00.000Z',
  scope: [GOOGLE_DRIVE_APP_DATA_SCOPE],
  codeChallengeMethod: 'S256',
};

function validate(callback: string, override: Partial<GoogleDriveOAuthPendingAuth> = {}) {
  return validateGoogleDriveOAuthCallbackState({
    callback,
    pendingAuth: { ...pendingAuth, ...override },
    expectedRedirectUri: REDIRECT_URI,
    allowedRedirectUris: [REDIRECT_URI],
    now: () => new Date('2026-06-28T00:05:00.000Z'),
  });
}

describe('Google Drive OAuth callback state validation boundary', () => {
  it('parses a success callback with code and state', () => {
    expect(parseGoogleDriveOAuthCallback(`?code=auth-code&state=${STATE}&scope=${encodeURIComponent(GOOGLE_DRIVE_APP_DATA_SCOPE)}`))
      .toEqual({
        status: 'success_candidate',
        code: 'auth-code',
        state: STATE,
        scope: GOOGLE_DRIVE_APP_DATA_SCOPE,
        authuser: undefined,
        prompt: undefined,
      });
  });

  it('rejects missing state, missing code, code plus error, duplicate params, and token-like params', () => {
    expect(parseGoogleDriveOAuthCallback('?code=auth-code')).toMatchObject({
      status: 'invalid_callback',
      reason: 'missing_state',
    });
    expect(parseGoogleDriveOAuthCallback(`?state=${STATE}`)).toMatchObject({
      status: 'invalid_callback',
      reason: 'missing_code',
      state: STATE,
    });
    expect(parseGoogleDriveOAuthCallback(`?code=auth-code&error=access_denied&state=${STATE}`)).toMatchObject({
      status: 'invalid_callback',
      reason: 'code_and_error',
      state: STATE,
    });
    expect(parseGoogleDriveOAuthCallback(`?code=one&code=two&state=${STATE}`)).toMatchObject({
      status: 'invalid_callback',
      reason: 'duplicate_param',
      state: STATE,
    });
    expect(parseGoogleDriveOAuthCallback(`?code=auth-code&state=${STATE}&access_token=secret`)).toMatchObject({
      status: 'invalid_callback',
      reason: 'token_param_present',
    });
  });

  it('parses and sanitizes OAuth error callbacks safely', () => {
    const parsed = parseGoogleDriveOAuthCallback(
      `?error=server_error&error_description=${encodeURIComponent('Bearer secret code=abc access_token=token refresh_token=refresh client_secret=client')}&state=${STATE}`,
    );

    expect(parsed.status).toBe('oauth_error');
    if (parsed.status !== 'oauth_error') throw new Error('expected oauth error');
    expect(parsed.error).toMatchObject({
      code: 'server_error',
      category: 'retryable',
      retryable: true,
    });
    expect(parsed.error.safeMessage).toContain('[redacted-secret]');
    expect(parsed.error.safeMessage).not.toContain('Bearer secret');
    expect(parsed.error.safeMessage).not.toContain('code=abc');
    expect(parsed.error.safeMessage).not.toContain('access_token=token');
    expect(parsed.error.safeMessage).not.toContain('refresh_token=refresh');
    expect(parsed.error.safeMessage).not.toContain('client_secret=client');
  });

  it('maps access_denied to a safe user-cancelled error', () => {
    expect(formatGoogleDriveOAuthCallbackError('access_denied')).toEqual({
      code: 'access_denied',
      category: 'user_cancelled',
      retryable: false,
      safeMessage: 'Google Drive authorization was cancelled.',
    });
  });

  it('returns valid_code without exchanging tokens or changing provider status', async () => {
    await expect(validate(`?code=auth-code&state=${STATE}`)).resolves.toMatchObject({
      status: 'valid_code',
      providerType: 'googleDrive',
      code: 'auth-code',
      codeVerifierRef: 'pkce-ref-789',
      redirectUri: REDIRECT_URI,
      scope: [GOOGLE_DRIVE_APP_DATA_SCOPE],
    });
  });

  it('uses the pending auth lookup interface without persistent storage', async () => {
    const store: GoogleDriveOAuthPendingAuthStore = {
      async getPendingAuthByState(state) {
        return state === STATE ? pendingAuth : null;
      },
    };

    await expect(validateGoogleDriveOAuthCallbackState({
      callback: `?code=auth-code&state=${STATE}`,
      pendingAuthStore: store,
      expectedRedirectUri: REDIRECT_URI,
      allowedRedirectUris: [REDIRECT_URI],
      now: () => new Date('2026-06-28T00:05:00.000Z'),
    })).resolves.toMatchObject({
      status: 'valid_code',
      codeVerifierRef: 'pkce-ref-789',
    });
  });

  it('blocks missing pending auth and state mismatch', async () => {
    await expect(validateGoogleDriveOAuthCallbackState({
      callback: `?code=auth-code&state=${STATE}`,
      pendingAuth: null,
      expectedRedirectUri: REDIRECT_URI,
      allowedRedirectUris: [REDIRECT_URI],
    })).resolves.toMatchObject({
      status: 'missing_pending_auth',
      state: STATE,
    });

    await expect(validateGoogleDriveOAuthCallbackState({
      callback: '?code=auth-code&state=wrong-state',
      pendingAuth,
      expectedRedirectUri: REDIRECT_URI,
      allowedRedirectUris: [REDIRECT_URI],
    })).resolves.toMatchObject({
      status: 'invalid_state',
      state: 'wrong-state',
    });
  });

  it('blocks expired pending auth', async () => {
    await expect(validate(`?code=auth-code&state=${STATE}`, {
      expiresAt: '2026-06-28T00:04:59.000Z',
    })).resolves.toMatchObject({
      status: 'expired_state',
      state: STATE,
    });
  });

  it('blocks provider mismatch, non-S256 PKCE, redirect mismatch, and disallowed redirects', async () => {
    await expect(validateGoogleDriveOAuthCallbackState({
      callback: `?code=auth-code&state=${STATE}`,
      pendingAuth: { ...pendingAuth, providerType: 'other' as 'googleDrive' },
      expectedRedirectUri: REDIRECT_URI,
      allowedRedirectUris: [REDIRECT_URI],
    })).resolves.toMatchObject({ status: 'provider_mismatch' });

    await expect(validate(`?code=auth-code&state=${STATE}`, {
      codeChallengeMethod: 'plain',
    })).resolves.toMatchObject({ status: 'invalid_callback' });

    await expect(validateGoogleDriveOAuthCallbackState({
      callback: `?code=auth-code&state=${STATE}`,
      pendingAuth: { ...pendingAuth, redirectUri: 'http://127.0.0.1:5173/other' },
      expectedRedirectUri: REDIRECT_URI,
      allowedRedirectUris: [REDIRECT_URI, 'http://127.0.0.1:5173/other'],
    })).resolves.toMatchObject({ status: 'redirect_uri_mismatch' });

    for (const redirectUri of ['javascript:alert(1)', 'data:text/plain,ok', 'file:///tmp/callback']) {
      await expect(validateGoogleDriveOAuthCallbackState({
        callback: `?code=auth-code&state=${STATE}`,
        pendingAuth: { ...pendingAuth, redirectUri },
        expectedRedirectUri: REDIRECT_URI,
        allowedRedirectUris: [REDIRECT_URI, redirectUri],
      })).resolves.toMatchObject({ status: 'redirect_uri_mismatch' });
    }
  });

  it('blocks broad or invalid pending and callback scopes', async () => {
    await expect(validate(`?code=auth-code&state=${STATE}`, {
      scope: ['https://www.googleapis.com/auth/drive.file'],
    })).resolves.toMatchObject({ status: 'invalid_scope' });

    await expect(validate(`?code=auth-code&state=${STATE}&scope=${encodeURIComponent('https://www.googleapis.com/auth/drive.metadata')}`))
      .resolves.toMatchObject({ status: 'invalid_scope' });
  });

  it('keeps OAuth error callbacks out of the token-exchange path', async () => {
    await expect(validate(`?error=access_denied&state=${STATE}`)).resolves.toMatchObject({
      status: 'oauth_error',
      state: STATE,
      error: {
        code: 'access_denied',
        category: 'user_cancelled',
      },
    });
  });

  it('does not implement token exchange, storage, UI, popup, redirect, or destructive remote behavior', () => {
    const source = readFileSync(join(process.cwd(), 'src/lib/googleDriveOAuthCallback.ts'), 'utf8');

    expect(source).not.toContain('oauth2.googleapis.com/token');
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('sessionStorage');
    expect(source).not.toContain('indexedDB');
    expect(source).not.toContain('document.cookie');
    expect(source).not.toContain('window.location');
    expect(source).not.toContain('window.open');
    expect(source).not.toContain('deleteBlob');
    expect(source).not.toContain('remoteDelete');
    expect(source).not.toContain('client_secret');
    expect(source).not.toContain('Sign in with Google');
    expect(source).not.toContain('Connect Google Drive');
    expect(source).not.toContain('Authorize Google');
  });
});
