// @vitest-environment happy-dom
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOTES_RUNTIME_SYNC_MODE_KEY } from './lib/notesSyncClient';

const getSessionMock = vi.fn();
const onAuthStateChangeMock = vi.fn();

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChangeMock(...args),
      signOut: vi.fn(),
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

  it('boots the app shell with a local user without touching Supabase auth in local mode', async () => {
    const { default: App } = await import('./App');

    await act(async () => {
      root?.render(createElement(App));
    });

    expect(container?.querySelector('[data-testid="app-shell"]')?.textContent).toBe('local@absinthe.dev');
    expect(container?.querySelector('[data-testid="login-screen"]')).toBeNull();
    expect(getSessionMock).not.toHaveBeenCalled();
    expect(onAuthStateChangeMock).not.toHaveBeenCalled();
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
});
