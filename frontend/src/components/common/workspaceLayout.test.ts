// @vitest-environment happy-dom
import { createElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { WorkspaceLayout, WORKSPACE_SCROLL_MODE } from './workspaceLayout';

describe('WorkspaceLayout scroll contract', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('gives an ordinary workspace exactly one page-level scroll owner', async () => {
    await act(async () => root.render(createElement(WorkspaceLayout, {
      workspace: 'ordinary',
      scrollMode: WORKSPACE_SCROLL_MODE.page,
      header: createElement('header', null, 'Header'),
      primary: createElement('main', null, 'Content'),
    })));

    const workspace = container.querySelector('[data-workspace="ordinary"]');
    const owners = workspace?.querySelectorAll('[data-workspace-scroll-owner="page"]');
    expect(workspace?.getAttribute('data-workspace-scroll-mode')).toBe('page');
    expect(owners).toHaveLength(1);
    expect(owners?.[0]?.classList.contains('overflow-y-auto')).toBe(true);
    expect(workspace?.classList.contains('overflow-hidden')).toBe(true);
  });

  it('keeps a pane workspace bounded without adding an outer page scroll owner', async () => {
    await act(async () => root.render(createElement(WorkspaceLayout, {
      workspace: 'specialized',
      scrollMode: WORKSPACE_SCROLL_MODE.pane,
      primary: createElement('div', { 'data-pane-scroll-owner': true }, 'Pane'),
    })));

    const workspace = container.querySelector('[data-workspace="specialized"]');
    const content = workspace?.querySelector('[data-k119-scroll-primary]');
    expect(workspace?.getAttribute('data-workspace-scroll-mode')).toBe('pane');
    expect(workspace?.querySelectorAll('[data-workspace-scroll-owner="page"]')).toHaveLength(0);
    expect(content?.classList.contains('overflow-hidden')).toBe(true);
    expect(content?.classList.contains('overflow-y-auto')).toBe(false);
  });
});
