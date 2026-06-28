import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GOOGLE_DRIVE_APP_DATA_SCOPE,
  GOOGLE_DRIVE_OAUTH_AUTHORIZATION_ENDPOINT,
  buildGoogleDriveOAuthAuthorizationUrl,
  deriveCodeChallengeS256,
  generateCodeVerifier,
  generateOAuthNonce,
  generateOAuthState,
  normalizeGoogleDriveOAuthScopes,
  validateGoogleOAuthRedirectUri,
  type RandomBytesSource,
} from './googleDriveOAuthAuthorization';

const REDIRECT_URI = 'http://127.0.0.1:5173/oauth/google-drive/callback';
const CLIENT_ID = 'public-client-id.apps.googleusercontent.com';
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

function deterministicRandom(byte: number): RandomBytesSource {
  return {
    getRandomValues<T extends Uint8Array>(array: T): T {
      array.fill(byte);
      return array;
    },
  };
}

describe('Google Drive OAuth authorization URL boundary', () => {
  it('derives PKCE S256 code challenge with base64url and no padding', async () => {
    await expect(deriveCodeChallengeS256(VERIFIER)).resolves.toBe(CHALLENGE);
    expect(CHALLENGE).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(CHALLENGE).not.toContain('=');
  });

  it('generates URL-safe high-entropy verifier, state, and nonce values', () => {
    const verifier = generateCodeVerifier(deterministicRandom(1));
    const state = generateOAuthState(deterministicRandom(2));
    const nonce = generateOAuthNonce(deterministicRandom(3));

    expect(verifier).toHaveLength(43);
    expect(state).toHaveLength(43);
    expect(nonce).toHaveLength(32);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('builds a Google authorization URL with code flow and PKCE S256', async () => {
    const result = await buildGoogleDriveOAuthAuthorizationUrl({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      allowedRedirectUris: [REDIRECT_URI],
      codeVerifier: VERIFIER,
      state: 'opaque-state-123',
      nonce: 'opaque-nonce-456',
      now: () => new Date('2026-06-28T00:00:00.000Z'),
    });
    const url = new URL(result.authorizationUrl);

    expect(`${url.origin}${url.pathname}`).toBe(GOOGLE_DRIVE_OAUTH_AUTHORIZATION_ENDPOINT);
    expect(url.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe(GOOGLE_DRIVE_APP_DATA_SCOPE);
    expect(url.searchParams.get('state')).toBe('opaque-state-123');
    expect(url.searchParams.get('nonce')).toBe('opaque-nonce-456');
    expect(url.searchParams.get('code_challenge')).toBe(CHALLENGE);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('include_granted_scopes')).toBe('false');
    expect(url.searchParams.get('client_secret')).toBeNull();
    expect(url.searchParams.get('access_token')).toBeNull();
    expect(url.searchParams.get('refresh_token')).toBeNull();
    expect(result).toMatchObject({
      state: 'opaque-state-123',
      codeVerifier: VERIFIER,
      codeChallenge: CHALLENGE,
      scopes: [GOOGLE_DRIVE_APP_DATA_SCOPE],
      createdAt: '2026-06-28T00:00:00.000Z',
    });
    expect(result.authorizationUrl).not.toContain('note-');
    expect(result.authorizationUrl).not.toContain('attachment-');
    expect(result.authorizationUrl).not.toContain(VERIFIER);
  });

  it('allows include_granted_scopes only when explicitly requested', async () => {
    const result = await buildGoogleDriveOAuthAuthorizationUrl({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      allowedRedirectUris: [REDIRECT_URI],
      codeVerifier: VERIFIER,
      state: 'opaque-state-123',
      includeGrantedScopes: true,
    });

    const url = new URL(result.authorizationUrl);
    expect(url.searchParams.get('include_granted_scopes')).toBe('true');
  });

  it('requires exact redirect URI allowlist matching and rejects unsafe schemes', () => {
    expect(validateGoogleOAuthRedirectUri(REDIRECT_URI, [REDIRECT_URI])).toBe(REDIRECT_URI);
    expect(() => validateGoogleOAuthRedirectUri('http://127.0.0.1:5173/other', [REDIRECT_URI])).toThrow(/allowlist/);
    expect(() => validateGoogleOAuthRedirectUri('javascript:alert(1)', ['javascript:alert(1)'])).toThrow(/scheme/);
    expect(() => validateGoogleOAuthRedirectUri('data:text/plain,ok', ['data:text/plain,ok'])).toThrow(/scheme/);
    expect(() => validateGoogleOAuthRedirectUri('file:///tmp/callback', ['file:///tmp/callback'])).toThrow(/scheme/);
  });

  it('deduplicates deterministic scopes and rejects broad Drive scopes', () => {
    expect(normalizeGoogleDriveOAuthScopes([
      GOOGLE_DRIVE_APP_DATA_SCOPE,
      GOOGLE_DRIVE_APP_DATA_SCOPE,
    ])).toEqual([GOOGLE_DRIVE_APP_DATA_SCOPE]);
    expect(() => normalizeGoogleDriveOAuthScopes(['https://www.googleapis.com/auth/drive'])).toThrow(/broader/);
    expect(() => normalizeGoogleDriveOAuthScopes(['https://www.googleapis.com/auth/drive.readonly'])).toThrow(/broader/);
    expect(() => normalizeGoogleDriveOAuthScopes(['https://www.googleapis.com/auth/drive.file'])).toThrow(/broader/);
    expect(() => normalizeGoogleDriveOAuthScopes(['https://www.googleapis.com/auth/drive.metadata'])).toThrow(/broader/);
    expect(() => normalizeGoogleDriveOAuthScopes(['https://www.googleapis.com/auth/drive.metadata.readonly'])).toThrow(/broader/);
    expect(() => normalizeGoogleDriveOAuthScopes(['https://www.googleapis.com/auth/userinfo.email'])).toThrow(/app data/);
  });

  it('rejects invalid PKCE verifiers and never uses plain challenge method', async () => {
    await expect(deriveCodeChallengeS256('short')).rejects.toThrow(/43-128/);
    const result = await buildGoogleDriveOAuthAuthorizationUrl({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      allowedRedirectUris: [REDIRECT_URI],
      codeVerifier: VERIFIER,
      state: 'state',
    });

    const url = new URL(result.authorizationUrl);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(result.authorizationUrl).not.toContain('plain');
  });

  it('does not implement token exchange, storage, popup, redirect, or destructive remote behavior', () => {
    const source = readFileSync(join(process.cwd(), 'src/lib/googleDriveOAuthAuthorization.ts'), 'utf8');

    expect(source).toContain('accounts.google.com/o/oauth2/v2/auth');
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
    expect(source).not.toContain('refresh_token');
    expect(source).not.toContain('access_token');
    expect(source).not.toContain('Sign in with Google');
    expect(source).not.toContain('Connect Google Drive');
    expect(source).not.toContain('Authorize Google');
  });
});
