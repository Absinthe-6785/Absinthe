// @vitest-environment happy-dom
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOTES_RUNTIME_SYNC_MODE_KEY } from './lib/notesSyncClient';

const getSessionMock = vi.fn();
const onAuthStateChangeMock = vi.fn();
const signOutMock = vi.fn();

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChangeMock(...args),
      signOut: (...args: unknown[]) => signOutMock(...args),
    },
  },
}));

vi.mock('./components/AppContent', () => ({
  AppContent: ({ authUser }: { authUser: { email?: string } }) =>
    createElement('div', { 'data-testid': 'app-shell' }, authUser.email),
}));

vi.mock('./components/views/LoginScreen', () => ({
  LoginScreen: () => createElement('div', { 'data-testid': 'login-screen' }, 'Login'),
}));

describe('App local-only auth gate', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    localStorage.clear();
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
    getSessionMock.mockResolvedValueOnce({
      data: {
        session: {
          user: {
            id: 'supabase-user',
            email: 'signed-in@example.com',
          },
        },
      },
    });
    const { default: App } = await import('./App');

    await act(async () => {
      root?.render(createElement(App));
    });

    expect(container?.querySelector('[data-testid="app-shell"]')?.textContent).toBe('signed-in@example.com');
    expect(container?.querySelector('[data-testid="login-screen"]')).toBeNull();
    expect(getSessionMock).toHaveBeenCalledTimes(1);
    expect(onAuthStateChangeMock).toHaveBeenCalledTimes(1);
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
});
