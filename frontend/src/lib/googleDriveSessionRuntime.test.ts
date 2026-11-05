import { describe, expect, it, vi } from 'vitest';
import { createGoogleDriveSessionRuntime, parseDriveRuntimeConfig } from './googleDriveSessionRuntime';
import { GOOGLE_DRIVE_APP_DATA_SCOPE } from './googleDriveOAuthAuthorization';
import type { GoogleDriveSessionConnectionController } from './googleDriveSessionConnectionController';
import type { GoogleDriveOAuthTokenFetchResponse } from './googleDriveOAuthTokenExchange';

const origin = 'https://test.absinthe.example';
const redirectUri = origin + '/oauth/google-drive/callback.html';
const env = {
  VITE_GOOGLE_DRIVE_OAUTH_CLIENT_ID: 'test-client.apps.googleusercontent.com',
  VITE_GOOGLE_DRIVE_OAUTH_REDIRECT_URI: redirectUri,
  VITE_GOOGLE_DRIVE_OAUTH_ALLOWED_REDIRECT_URIS: JSON.stringify([redirectUri]),
};
const config = parseDriveRuntimeConfig(env, origin)!;
const response = (): GoogleDriveOAuthTokenFetchResponse => ({
  ok: true, status: 200,
  text: async () => JSON.stringify({ access_token: 'secret-token', token_type: 'Bearer', expires_in: 3600, scope: GOOGLE_DRIVE_APP_DATA_SCOPE }),
});
async function authorize(controller: GoogleDriveSessionConnectionController) {
  const result = await controller.startAuthorization();
  if (result.status !== 'authorization_url_created') throw new Error('authorization failed');
  const url = new URL(result.authorizationUrl);
  expect(url.searchParams.get('scope')).toBe(GOOGLE_DRIVE_APP_DATA_SCOPE);
  expect(url.searchParams.get('include_granted_scopes')).toBe('false');
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  return redirectUri + '?code=test-code&state=' + encodeURIComponent(result.state);
}
describe('connection-only Drive runtime owner', () => {
  it('discards delayed authorization URL and status publication after generation replacement', async () => {
    const runtime = createGoogleDriveSessionRuntime(config, async () => response());
    runtime.replaceAccount('A');
    const old = runtime.getSnapshot().controller!;
    const pending = old.startAuthorization();
    const status = old.getConnectionStatus();
    runtime.replaceAccount('A');
    expect(await pending).toMatchObject({ status: 'blocked' });
    expect(await status).toMatchObject({ status: 'unconfigured' });
  });

  it('requires explicit reconnect after token expiry', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-05T00:00:00Z'));
      const runtime = createGoogleDriveSessionRuntime(config, async () => response());
      runtime.replaceAccount('A');
      const owner = runtime.getSnapshot().controller!;
      expect((await owner.completeCallback(await authorize(owner))).status).toBe('connected');
      vi.setSystemTime(new Date('2026-11-05T02:00:00Z'));
      expect(await owner.getConnectionStatus()).toMatchObject({ status: 'auth_expired', canUpload: false });
      expect(owner.getAccessTokenProvider()).toBeNull();
    } finally { vi.useRealTimers(); }
  });

  it('accepts only explicitly allowed, same-origin static callback configuration', () => {
    expect(config).toMatchObject({ redirectUri });
    const cases = [
      {}, { ...env, VITE_GOOGLE_DRIVE_OAUTH_CLIENT_ID: 'invalid' },
      { ...env, VITE_GOOGLE_DRIVE_OAUTH_ALLOWED_REDIRECT_URIS: '[]' },
      { ...env, VITE_GOOGLE_DRIVE_OAUTH_REDIRECT_URI: origin + '/oauth/google-drive/callback' },
      { ...env, VITE_GOOGLE_DRIVE_OAUTH_REDIRECT_URI: 'javascript:alert(1)' },
      { ...env, VITE_GOOGLE_DRIVE_OAUTH_ALLOWED_REDIRECT_URIS: 'not JSON' },
    ];
    cases.forEach(value => expect(parseDriveRuntimeConfig(value, origin)).toBeNull());
    expect(parseDriveRuntimeConfig(env, 'https://foreign.example')).toBeNull();
  });

  it('does not connect or fetch automatically and never exposes legacy upload/recovery capability', async () => {
    const fetchToken = vi.fn(async () => response());
    const runtime = createGoogleDriveSessionRuntime(config, fetchToken);
    runtime.replaceAccount('A');
    const controller = runtime.getSnapshot().controller!;
    expect(fetchToken).not.toHaveBeenCalled();
    const callback = await authorize(controller);
    expect(fetchToken).not.toHaveBeenCalled();
    expect(await controller.completeCallback(callback)).toMatchObject({ status: 'connected',
      connectionStatus: { canUpload: false, canRecover: false, canDownload: false } });
    expect(await controller.getConnectionStatus()).toMatchObject({ status: 'available', canUpload: false, canRecover: false });
    expect(controller.getAccessTokenProvider()).toBeNull();
    expect(fetchToken).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(await controller.getConnectionStatus())).not.toContain('secret-token');
    await controller.disconnect();
    expect(await controller.getConnectionStatus()).toMatchObject({ status: 'unconfigured' });
    expect((await controller.completeCallback(callback)).status).not.toBe('connected');
  });

  it.each(['B', 'A', null])('revokes pending callbacks on replacement with %s (including same-account generation)', async account => {
    const fetchToken = vi.fn(async () => response());
    const runtime = createGoogleDriveSessionRuntime(config, fetchToken);
    runtime.replaceAccount('A');
    const old = runtime.getSnapshot();
    const callback = await authorize(old.controller!);
    runtime.replaceAccount(account);
    if (account === 'B') runtime.replaceAccount('A');
    expect(runtime.getSnapshot().generation).toBeGreaterThan(old.generation);
    expect(runtime.getSnapshot().controller).not.toBe(old.controller);
    expect(await old.controller!.completeCallback(callback)).toMatchObject({ status: 'blocked' });
    expect(await old.controller!.startAuthorization()).toMatchObject({ status: 'blocked' });
    expect(old.controller!.getAccessTokenProvider()).toBeNull();
    expect(fetchToken).not.toHaveBeenCalled();
  });

  it.each(['disconnect', 'logout', 'ABA', 'same-account'])('discards delayed token exchange after %s', async transition => {
    let resolve!: (value: GoogleDriveOAuthTokenFetchResponse) => void;
    const fetchToken = vi.fn(() => new Promise<GoogleDriveOAuthTokenFetchResponse>(done => { resolve = done; }));
    const runtime = createGoogleDriveSessionRuntime(config, fetchToken);
    runtime.replaceAccount('A');
    const old = runtime.getSnapshot().controller!;
    const callback = await authorize(old);
    const pending = old.completeCallback(callback);
    await vi.waitFor(() => expect(fetchToken).toHaveBeenCalledTimes(1));
    if (transition === 'disconnect') await old.disconnect();
    if (transition === 'logout') runtime.replaceAccount(null);
    if (transition === 'ABA') { runtime.replaceAccount('B'); runtime.replaceAccount('A'); }
    if (transition === 'same-account') runtime.replaceAccount('A');
    resolve(response());
    expect((await pending).status).not.toBe('connected');
    expect(await old.getConnectionStatus()).not.toMatchObject({ status: 'available' });
    expect(old.getAccessTokenProvider()).toBeNull();
  });

  it('rejects foreign callback URL and wrong PKCE state without exchange', async () => {
    const fetchToken = vi.fn(async () => response());
    const runtime = createGoogleDriveSessionRuntime(config, fetchToken);
    runtime.replaceAccount('A');
    const controller = runtime.getSnapshot().controller!;
    const callback = await authorize(controller);
    expect((await controller.completeCallback(callback.replace(origin, 'https://foreign.example'))).status).toBe('blocked');
    expect((await controller.completeCallback(redirectUri + '?code=code&state=wrong')).status).toBe('invalid_state');
    expect(fetchToken).not.toHaveBeenCalled();
    expect((await controller.completeCallback(callback)).status).toBe('connected');
    await controller.markReconnectRequired();
    expect((await controller.getConnectionStatus()).status).toBe('unconfigured');
  });

  it('fails closed without configuration and notifies subscribers on session replacement', () => {
    const fetchToken = vi.fn(async () => response());
    const runtime = createGoogleDriveSessionRuntime(null, fetchToken);
    const subscriber = vi.fn();
    const unsubscribe = runtime.subscribe(subscriber);
    runtime.replaceAccount('A');
    expect(runtime.getSnapshot().controller).toBeNull();
    expect(subscriber).toHaveBeenCalledTimes(1);
    unsubscribe();
    runtime.replaceAccount(null);
    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(fetchToken).not.toHaveBeenCalled();
  });
});
