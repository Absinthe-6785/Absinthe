// @vitest-environment happy-dom
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOTES_RUNTIME_SYNC_MODE_KEY } from './lib/notesSyncClient';
import { runtimeAccountSyncAvailability } from './lib/remoteBoundary';
import { googleDriveSessionRuntime } from './lib/googleDriveSessionRuntime';
import { GOOGLE_DRIVE_APP_DATA_SCOPE } from './lib/googleDriveOAuthAuthorization';
import { createMockSupabaseAuthResponse } from './test-utils/auth/mockSupabaseAuthSession';

const getSessionMock = vi.fn();
const onAuthStateChangeMock = vi.fn();
const signOutMock = vi.fn();
const appContentImportMock = vi.hoisted(() => vi.fn());

vi.mock('./lib/googleDriveSessionRuntime', async importOriginal => {
  const original = await importOriginal<typeof import('./lib/googleDriveSessionRuntime')>();
  const redirectUri = 'https://qa.example/oauth/google-drive/callback.html';
  const runtime = original.createGoogleDriveSessionRuntime({
    clientId: 'test-client.apps.googleusercontent.com', redirectUri, allowedRedirectUris: [redirectUri],
  }, async () => ({
    ok: true, status: 200,
    text: async () => JSON.stringify({
      access_token: 'drive-test-token', token_type: 'Bearer', expires_in: 3600,
      scope: 'https://www.googleapis.com/auth/drive.appdata',
    }),
  }));
  return { ...original, googleDriveSessionRuntime: runtime, replaceGoogleDriveRuntimeAccount: (accountId: string | null) => runtime.replaceAccount(accountId) };
});

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChangeMock(...args),
      signOut: (...args: unknown[]) => signOutMock(...args),
    },
  },
}));

vi.mock('./components/AppContent', () => {
  appContentImportMock();
  return {
    AppContent: ({ authUser }: { authUser: { email?: string } }) =>
      createElement('div', { 'data-testid': 'app-shell' }, authUser.email),
  };
});

vi.mock('./components/views/NotesReadOnlyCloudView', () => ({
  NotesReadOnlyCloudView: ({ accountId, authGeneration }: { accountId: string; authGeneration: number }) =>
    createElement('div', { 'data-testid': 'readonly-cloud', 'data-account': accountId, 'data-generation': authGeneration }),
}));

vi.mock('./components/views/LoginScreen', () => ({
  LoginScreen: () => createElement('div', { 'data-testid': 'login-screen' }, 'Login'),
}));

describe('App local-only auth gate', () => {
  it('mounts the optional cloud reader before AppContent only for the explicit authenticated route', async () => {
    vi.resetModules();
    appContentImportMock.mockClear();
    window.history.replaceState(null, '', '/?notesReadOnly=1');
    getSessionMock.mockResolvedValueOnce(createMockSupabaseAuthResponse({ userId: 'account-a', email: 'a@example.com' }));
    const { default: App } = await import('./App');
    await act(async () => { root?.render(createElement(App)); });
    expect(container?.querySelector('[data-testid="readonly-cloud"]')?.getAttribute('data-account')).toBe('account-a');
    expect(container?.querySelector('[data-testid="app-shell"]')).toBeNull();
    expect(appContentImportMock).not.toHaveBeenCalled();

    const notify = onAuthStateChangeMock.mock.calls[0][0];
    const firstGeneration = Number(container?.querySelector('[data-testid="readonly-cloud"]')?.getAttribute('data-generation'));
    await act(async () => {
      notify('SIGNED_IN', { user: { id: 'account-b' }, access_token: 'token-b', refresh_token: 'refresh-b' });
    });
    const second = container?.querySelector('[data-testid="readonly-cloud"]');
    expect(second?.getAttribute('data-account')).toBe('account-b');
    expect(Number(second?.getAttribute('data-generation'))).toBeGreaterThan(firstGeneration);
    await act(async () => {
      notify('SIGNED_IN', { user: { id: 'account-a' }, access_token: 'token-a-2', refresh_token: 'refresh-a-2' });
    });
    const third = container?.querySelector('[data-testid="readonly-cloud"]');
    expect(third?.getAttribute('data-account')).toBe('account-a');
    expect(Number(third?.getAttribute('data-generation'))).toBeGreaterThan(Number(second?.getAttribute('data-generation')));
    await act(async () => { notify('SIGNED_OUT', null); });
    expect(container?.querySelector('[data-testid="readonly-cloud"]')).toBeNull();
    expect(container?.querySelector('[data-testid="app-shell"]')).toBeNull();
    expect(container?.querySelector('[data-testid="login-screen"]')).not.toBeNull();
  });

  it('invalidates the Drive owner on actual same-account session replacement and A-B-A', async () => {
    const { default: App } = await import('./App');
    await act(async () => { root?.render(createElement(App)); });
    const notify = onAuthStateChangeMock.mock.calls[0][0];
    await act(async () => { notify('SIGNED_IN', { user: { id: 'A' }, access_token: 'session-A-1' }); });
    const first = googleDriveSessionRuntime.getSnapshot();
    expect(first.accountId).toBe('A');
    await act(async () => { notify('TOKEN_REFRESHED', { user: { id: 'A' }, access_token: 'session-A-2' }); });
    expect(googleDriveSessionRuntime.getSnapshot().generation).toBeGreaterThan(first.generation);
    await act(async () => {
      notify('SIGNED_IN', { user: { id: 'B' }, access_token: 'session-B-1' });
      notify('SIGNED_IN', { user: { id: 'A' }, access_token: 'session-A-2' });
    });
    expect(googleDriveSessionRuntime.getSnapshot().generation).toBeGreaterThan(first.generation + 1);
    await act(async () => { notify('SIGNED_OUT', null); });
    expect(googleDriveSessionRuntime.getSnapshot()).toMatchObject({ accountId: null, controller: null });
  });

  it('preserves pending PKCE when tab return repeats SIGNED_IN for the same authenticated session', async () => {
    const { default: App } = await import('./App');
    await act(async () => { root?.render(createElement(App)); });
    const notify = onAuthStateChangeMock.mock.calls[0][0];
    const session = { user: { id: 'A' }, access_token: 'unchanged-absinthe-session' };
    await act(async () => { notify('SIGNED_IN', session); });
    const owner = googleDriveSessionRuntime.getSnapshot();
    const pending = await owner.controller!.startAuthorization();
    if (pending.status !== 'authorization_url_created') throw new Error('expected pending OAuth');
    await act(async () => { notify('SIGNED_IN', { ...session, user: { id: 'A' } }); });
    expect(googleDriveSessionRuntime.getSnapshot()).toBe(owner);
    expect(await owner.controller!.completeCallback(
      'https://qa.example/oauth/google-drive/callback.html?code=test-code&state=' + encodeURIComponent(pending.state)
        + '&scope=' + encodeURIComponent(GOOGLE_DRIVE_APP_DATA_SCOPE),
    )).toMatchObject({ status: 'connected', connectionStatus: { canUpload: false, canRecover: false } });
  });
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    getSessionMock.mockReset();
    onAuthStateChangeMock.mockReset();
    signOutMock.mockReset();
    getSessionMock.mockRejectedValue(new Error('Supabase unavailable'));
    onAuthStateChangeMock.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  afterEach(() => {
    if (root) {
      act(() => { root?.unmount(); });
    }
    container?.remove();
    root = null;
    container = null;
  });

  it('does not let default local sync mode bypass the Supabase auth gate', async () => {
    const { default: App } = await import('./App');

    await act(async () => {
      root?.render(createElement(App));
    });

    expect(container?.querySelector('[data-testid="app-shell"]')).toBeNull();
    expect(container?.querySelector('[data-testid="login-screen"]')).not.toBeNull();
    expect(getSessionMock).toHaveBeenCalledTimes(1);
    expect(onAuthStateChangeMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the login gate for explicit remote mode when Supabase auth fails', async () => {
    localStorage.setItem(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
    const { default: App } = await import('./App');

    await act(async () => {
      root?.render(createElement(App));
    });

    expect(container?.querySelector('[data-testid="login-screen"]')).not.toBeNull();
    expect(getSessionMock).toHaveBeenCalledTimes(1);
    expect(onAuthStateChangeMock).toHaveBeenCalledTimes(1);
  });

  it('renders the protected app shell for a real Supabase session in default local sync mode', async () => {
    getSessionMock.mockResolvedValueOnce(createMockSupabaseAuthResponse({
      userId: 'supabase-user',
      email: 'signed-in@example.com',
    }));
    const { default: App } = await import('./App');

    await act(async () => {
      root?.render(createElement(App));
    });

    expect(container?.querySelector('[data-testid="app-shell"]')?.textContent).toBe('signed-in@example.com');
    expect(container?.querySelector('[data-testid="login-screen"]')).toBeNull();
    expect(getSessionMock).toHaveBeenCalledTimes(1);
    expect(onAuthStateChangeMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the normal authenticated startup path unchanged when the opt-in route is absent', async () => {
    getSessionMock.mockResolvedValueOnce(createMockSupabaseAuthResponse({ userId: 'normal-account', email: 'normal@example.com' }));
    const { default: App } = await import('./App');
    await act(async () => { root?.render(createElement(App)); });
    expect(container?.querySelector('[data-testid="app-shell"]')?.textContent).toBe('normal@example.com');
    expect(container?.querySelector('[data-testid="readonly-cloud"]')).toBeNull();
  });

  it('keeps protected content hidden while the Supabase session is loading', async () => {
    let resolveSession!: (value: { data: { session: null } }) => void;
    getSessionMock.mockReturnValueOnce(new Promise(resolve => {
      resolveSession = resolve;
    }));
    const { default: App } = await import('./App');

    await act(async () => {
      root?.render(createElement(App));
    });

    expect(container?.querySelector('[data-testid="app-shell"]')).toBeNull();
    expect(container?.querySelector('[data-testid="login-screen"]')).toBeNull();

    await act(async () => {
      resolveSession({ data: { session: null } });
    });

    expect(container?.querySelector('[data-testid="app-shell"]')).toBeNull();
    expect(container?.querySelector('[data-testid="login-screen"]')).not.toBeNull();
  });

  it('does not let a stale initial session restore availability after a logout event', async () => {
    const staleResponse = createMockSupabaseAuthResponse({
      userId: 'stale-user',
      email: 'stale@example.com',
    });
    let resolveSession!: (value: typeof staleResponse) => void;
    let authStateCallback: ((event: string, session: null) => void) | null = null;
    getSessionMock.mockReturnValueOnce(new Promise(resolve => {
      resolveSession = resolve;
    }));
    onAuthStateChangeMock.mockImplementationOnce((callback: typeof authStateCallback) => {
      authStateCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    const { default: App } = await import('./App');

    await act(async () => {
      root?.render(createElement(App));
    });
    await act(async () => {
      authStateCallback?.('SIGNED_OUT', null);
      resolveSession(staleResponse);
      await Promise.resolve();
    });

    expect(container?.querySelector('[data-testid="app-shell"]')).toBeNull();
    expect(container?.querySelector('[data-testid="login-screen"]')).not.toBeNull();
    expect(runtimeAccountSyncAvailability()).toEqual({
      state: 'UNAUTHENTICATED',
      transportAvailable: false,
    });
  });
});
