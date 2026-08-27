// @vitest-environment happy-dom
import { act, createElement, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  failRender: false,
  renderCount: 0,
  authorityMounts: 0,
}));

vi.mock('./views/NoteView', () => ({
  NoteView: ({ accountId }: { accountId?: string }) => {
    mocks.renderCount += 1;
    if (mocks.failRender) throw new Error('private Notes render detail');
    return createElement('div', { 'data-testid': 'production-notes-view', 'data-account-id': accountId }, 'Notes');
  },
}));

import { NotesRouteBoundary } from './NotesRouteBoundary';

function Harness({ active, accountId }: { active: boolean; accountId: string }) {
  useEffect(() => {
    mocks.authorityMounts += 1;
    return () => undefined;
  }, []);
  return createElement(
    'div',
    { 'data-testid': 'production-shell' },
    createElement('nav', { 'data-testid': 'production-navigation' }, 'Navigation'),
    createElement(NotesRouteBoundary, { active, accountId }),
  );
}

function ToggleHarness({ accountId }: { accountId: string }) {
  const [active, setActive] = useState(false);
  return createElement(
    'div',
    null,
    createElement('button', { type: 'button', 'data-testid': 'activate-notes', onClick: () => setActive(true) }, 'Notes'),
    createElement('button', { type: 'button', 'data-testid': 'leave-notes', onClick: () => setActive(false) }, 'Home'),
    createElement(Harness, { active, accountId }),
  );
}

async function flush(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await Promise.resolve();
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });
  }
}

describe('NotesRouteBoundary production route containment', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    document.body.replaceChildren();
    mocks.failRender = false;
    mocks.renderCount = 0;
    mocks.authorityMounts = 0;
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    act(() => root?.unmount());
    host.remove();
  });

  it('keeps NoteView out of inactive routes, contains a render/import failure, and retries locally', async () => {
    mocks.failRender = true;
    act(() => {
      root = createRoot(host);
      root.render(createElement(ToggleHarness, { accountId: 'account-a' }));
    });
    await flush();

    expect(host.querySelector('[data-testid="production-notes-view"]')).toBeNull();
    expect(mocks.renderCount).toBe(0);
    expect(mocks.authorityMounts).toBe(1);

    await act(async () => {
      (host.querySelector('[data-testid="activate-notes"]') as HTMLButtonElement).click();
    });
    await flush();

    expect(host.querySelector('[data-testid="notes-route-load-error"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="production-shell"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="production-navigation"]')).not.toBeNull();
    expect(host.textContent).not.toContain('private Notes render detail');
    expect(mocks.authorityMounts).toBe(1);

    mocks.failRender = false;
    await act(async () => {
      (host.querySelector('[data-testid="notes-route-retry"]') as HTMLButtonElement).click();
    });
    await flush();

    expect(host.querySelector('[data-testid="production-notes-view"]')?.getAttribute('data-account-id')).toBe('account-a');
    expect(host.querySelector('[data-testid="notes-route-load-error"]')).toBeNull();
    expect(mocks.authorityMounts).toBe(1);
  });

  it('preserves the resolved Notes identity across route switches and uses current account props', async () => {
    act(() => {
      root = createRoot(host);
      root.render(createElement(ToggleHarness, { accountId: 'account-a' }));
    });
    await act(async () => {
      (host.querySelector('[data-testid="activate-notes"]') as HTMLButtonElement).click();
    });
    await flush();
    const initialRenders = mocks.renderCount;
    expect(host.querySelector('[data-testid="production-notes-view"]')).not.toBeNull();

    await act(async () => {
      (host.querySelector('[data-testid="leave-notes"]') as HTMLButtonElement).click();
    });
    await act(async () => {
      (host.querySelector('[data-testid="activate-notes"]') as HTMLButtonElement).click();
    });
    await flush();

    expect(host.querySelector('[data-testid="production-notes-view"]')).not.toBeNull();
    expect(mocks.renderCount).toBeGreaterThanOrEqual(initialRenders);
    expect(mocks.authorityMounts).toBe(1);

    act(() => {
      root.render(createElement(ToggleHarness, { accountId: 'account-b' }));
    });
    await flush();
    expect(host.querySelector('[data-testid="production-notes-view"]')?.getAttribute('data-account-id')).toBe('account-b');
    expect(mocks.authorityMounts).toBe(1);
  });
});
