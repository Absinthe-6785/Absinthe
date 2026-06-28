import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GoogleDriveOAuthTokenExchangeResult, GoogleDriveOAuthTokenSet } from './googleDriveOAuthTokenExchange';
import {
  GoogleDriveEphemeralTokenExpiredError,
  createEphemeralGoogleDriveAccessTokenProvider,
  createEphemeralGoogleDriveAccessTokenProviderFromExchangeResult,
  createSessionOnlyGoogleDriveConnectionController,
} from './googleDriveEphemeralTokenProvider';

const ACCESS_TOKEN = 'access-token-secret';
const REFRESH_TOKEN = 'refresh-token-secret';

function tokenSet(overrides: Partial<GoogleDriveOAuthTokenSet> = {}): GoogleDriveOAuthTokenSet {
  return {
    accessToken: ACCESS_TOKEN,
    tokenType: 'Bearer',
    expiresIn: 3600,
    expiresAt: '2026-06-28T01:00:00.000Z',
    scope: ['https://www.googleapis.com/auth/drive.appdata'],
    sensitiveRefreshTokenReturned: true,
    ...overrides,
  };
}

function exchangedResult(set: GoogleDriveOAuthTokenSet = tokenSet()): GoogleDriveOAuthTokenExchangeResult {
  return {
    status: 'exchanged',
    providerType: 'googleDrive',
    tokenSet: set,
    warnings: [],
  };
}

describe('Google Drive ephemeral token provider boundary', () => {
  it('creates a memory-only access token provider from an exchange result', async () => {
    const provider = createEphemeralGoogleDriveAccessTokenProviderFromExchangeResult(exchangedResult(), {
      now: () => new Date('2026-06-28T00:00:00.000Z'),
    });

    expect(provider).not.toBeNull();
    await expect(provider?.getAccessToken()).resolves.toBe(ACCESS_TOKEN);
    expect(provider?.getExpiresAt()).toBe('2026-06-28T01:00:00.000Z');
    expect(provider?.hasToken()).toBe(true);
    expect(provider?.isExpired()).toBe(false);
  });

  it('returns null for failed exchange results and never creates a default provider', () => {
    const provider = createEphemeralGoogleDriveAccessTokenProviderFromExchangeResult({
      status: 'invalid_request',
      providerType: 'googleDrive',
      error: {
        code: 'invalid_request',
        category: 'invalid_request',
        retryable: false,
        safeMessage: 'Invalid request.',
      },
    });

    expect(provider).toBeNull();
    expect(createSessionOnlyGoogleDriveConnectionController().getAccessTokenProvider()).toBeNull();
  });

  it('expires access and returns sanitized auth errors without token material', async () => {
    const provider = createEphemeralGoogleDriveAccessTokenProvider({
      tokenSet: tokenSet({ expiresAt: '2026-06-28T00:00:01.000Z' }),
      now: () => new Date('2026-06-28T00:00:02.000Z'),
    });

    await expect(provider.getAccessToken()).rejects.toBeInstanceOf(GoogleDriveEphemeralTokenExpiredError);
    await expect(provider.getAccessToken()).rejects.not.toThrow(ACCESS_TOKEN);
    expect(provider.hasToken()).toBe(false);
    expect(provider.isExpired()).toBe(true);
  });

  it('clear removes the token from memory', async () => {
    const provider = createEphemeralGoogleDriveAccessTokenProvider({
      tokenSet: tokenSet(),
      now: () => new Date('2026-06-28T00:00:00.000Z'),
    });

    provider.clear();

    expect(provider.hasToken()).toBe(false);
    await expect(provider.getAccessToken()).rejects.toThrow(/unavailable/);
    await expect(provider.getAccessToken()).rejects.not.toThrow(ACCESS_TOKEN);
  });

  it('marks session controller available only while memory token is valid and capabilities allow it', async () => {
    const provider = createEphemeralGoogleDriveAccessTokenProvider({
      tokenSet: tokenSet(),
      now: () => new Date('2026-06-28T00:00:00.000Z'),
    });
    const controller = createSessionOnlyGoogleDriveConnectionController({
      tokenProvider: provider,
      canDownload: true,
      canUpload: false,
    });

    expect(controller.getAccessTokenProvider()).toBe(provider);
    await expect(controller.getConnectionStatus()).resolves.toMatchObject({
      providerType: 'googleDrive',
      status: 'available',
      canDownload: true,
      canUpload: false,
      canRecover: true,
      requiresUserAction: false,
    });
  });

  it('keeps available status non-recoverable when download capability is absent', async () => {
    const provider = createEphemeralGoogleDriveAccessTokenProvider({
      tokenSet: tokenSet(),
      now: () => new Date('2026-06-28T00:00:00.000Z'),
    });
    const controller = createSessionOnlyGoogleDriveConnectionController({
      tokenProvider: provider,
      canDownload: false,
    });

    await expect(controller.getConnectionStatus()).resolves.toMatchObject({
      status: 'unsupported',
      canDownload: false,
      canRecover: false,
    });
  });

  it('reports auth_expired when the memory token expires', async () => {
    const provider = createEphemeralGoogleDriveAccessTokenProvider({
      tokenSet: tokenSet({ expiresAt: '2026-06-28T00:00:01.000Z' }),
      now: () => new Date('2026-06-28T00:00:02.000Z'),
    });
    const controller = createSessionOnlyGoogleDriveConnectionController({
      tokenProvider: provider,
      canDownload: true,
      canUpload: true,
    });

    await expect(controller.getConnectionStatus()).resolves.toMatchObject({
      providerType: 'googleDrive',
      status: 'auth_expired',
      canDownload: false,
      canUpload: false,
      canRecover: false,
      requiresUserAction: true,
      safeMessage: 'Google Drive session expired. Reconnect is required.',
    });
  });

  it('does not hand out expired token providers and treats expiresAt equal to now as expired', async () => {
    const provider = createEphemeralGoogleDriveAccessTokenProvider({
      tokenSet: tokenSet({ expiresAt: '2026-06-28T00:00:01.000Z' }),
      now: () => new Date('2026-06-28T00:00:01.000Z'),
    });
    const controller = createSessionOnlyGoogleDriveConnectionController({
      tokenProvider: provider,
      canDownload: true,
    });

    expect(provider.isExpired()).toBe(true);
    expect(controller.getAccessTokenProvider()).toBeNull();
    await expect(provider.getAccessToken()).rejects.toBeInstanceOf(GoogleDriveEphemeralTokenExpiredError);
  });

  it('disconnect clears memory token and returns unconfigured status afterward', async () => {
    const provider = createEphemeralGoogleDriveAccessTokenProvider({
      tokenSet: tokenSet(),
      now: () => new Date('2026-06-28T00:00:00.000Z'),
    });
    const controller = createSessionOnlyGoogleDriveConnectionController({
      tokenProvider: provider,
      canDownload: true,
    });

    await expect(controller.disconnect?.()).resolves.toEqual({
      providerType: 'googleDrive',
      status: 'disconnected',
      safeMessage: 'Google Drive session token was cleared from memory.',
    });
    expect(controller.getAccessTokenProvider()).toBeNull();
    expect(provider.hasToken()).toBe(false);
    await expect(controller.getConnectionStatus()).resolves.toMatchObject({
      status: 'unconfigured',
      canRecover: false,
    });
  });

  it('stale provider references fail after disconnect clears the session', async () => {
    const provider = createEphemeralGoogleDriveAccessTokenProvider({
      tokenSet: tokenSet(),
      now: () => new Date('2026-06-28T00:00:00.000Z'),
    });
    const controller = createSessionOnlyGoogleDriveConnectionController({
      tokenProvider: provider,
      canDownload: true,
    });
    const staleProvider = controller.getAccessTokenProvider();

    expect(staleProvider).toBe(provider);
    await controller.disconnect?.();

    expect(controller.getAccessTokenProvider()).toBeNull();
    await expect(staleProvider?.getAccessToken()).rejects.toThrow(/unavailable/);
  });

  it('markReconnectRequired clears the provider and returns unconfigured status', async () => {
    const provider = createEphemeralGoogleDriveAccessTokenProvider({
      tokenSet: tokenSet(),
      now: () => new Date('2026-06-28T00:00:00.000Z'),
    });
    const controller = createSessionOnlyGoogleDriveConnectionController({
      tokenProvider: provider,
      canDownload: true,
    });

    await controller.markReconnectRequired?.();

    expect(controller.getAccessTokenProvider()).toBeNull();
    expect(provider.hasToken()).toBe(false);
    await expect(controller.getConnectionStatus()).resolves.toMatchObject({
      status: 'unconfigured',
      canRecover: false,
    });
  });

  it('does not expose access or refresh token material in status or errors', async () => {
    const provider = createEphemeralGoogleDriveAccessTokenProvider({
      tokenSet: tokenSet({ expiresAt: '2026-06-28T00:00:01.000Z' }),
      now: () => new Date('2026-06-28T00:00:02.000Z'),
    });
    const controller = createSessionOnlyGoogleDriveConnectionController({
      tokenProvider: provider,
      canDownload: true,
    });
    const status = await controller.getConnectionStatus();

    expect(JSON.stringify(status)).not.toContain(ACCESS_TOKEN);
    expect(JSON.stringify(status)).not.toContain(REFRESH_TOKEN);
    await expect(provider.getAccessToken()).rejects.not.toThrow(ACCESS_TOKEN);
    await expect(provider.getAccessToken()).rejects.not.toThrow(REFRESH_TOKEN);
  });

  it('ignores refresh token markers from exchange results', () => {
    const provider = createEphemeralGoogleDriveAccessTokenProviderFromExchangeResult(exchangedResult(tokenSet({
      sensitiveRefreshTokenReturned: true,
    })));

    expect(provider).not.toBeNull();
    expect(JSON.stringify(provider)).not.toContain(REFRESH_TOKEN);
  });

  it('does not implement persistence, silent refresh, UI, auto-run, or destructive remote behavior', () => {
    const source = readFileSync(join(process.cwd(), 'src/lib/googleDriveEphemeralTokenProvider.ts'), 'utf8');

    expect(source).not.toContain('oauth2.googleapis.com/token');
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('sessionStorage');
    expect(source).not.toContain('indexedDB');
    expect(source).not.toContain('document.cookie');
    expect(source).not.toContain('window.location');
    expect(source).not.toContain('window.open');
    expect(source).not.toContain('console.log');
    expect(source).not.toContain('refresh_token');
    expect(source).not.toContain('client_secret');
    expect(source).not.toContain('deleteBlob');
    expect(source).not.toContain('remoteDelete');
    expect(source).not.toContain('Sign in with Google');
    expect(source).not.toContain('Connect Google Drive');
    expect(source).not.toContain('Authorize Google');
    expect(source).not.toContain('Sync now');
    expect(source).not.toContain('Upload all');
    expect(source).not.toContain('Recover all');
  });
});
