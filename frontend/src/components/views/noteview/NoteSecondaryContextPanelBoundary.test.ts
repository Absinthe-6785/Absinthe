// @vitest-environment happy-dom
import { act, createElement, useEffect, useMemo, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../features/knowledge/components/DiscoveryPanel', () => ({
  DiscoveryPanel: () => 'DISCOVER_DISPATCHED',
}));
vi.mock('../features/knowledge/components/TimelinePanel', () => ({
  TimelinePanel: () => 'TIMELINE_DISPATCHED',
}));
vi.mock('../features/knowledge/components/NoteRelationsPanel', () => ({
  NoteRelationsPanel: () => 'RELATIONS_DISPATCHED',
}));

import {
  createLazySecondaryContextPanel,
  NoteSecondaryContextPanelBoundary,
  type SecondaryContextPanelComponent,
  type SecondaryContextPanelLoader,
} from './NoteSecondaryContextPanelBoundary';
import NoteSecondaryContextPanel from './NoteSecondaryContextPanel';
import type {
  NoteSecondaryContextPanelProps,
  SecondaryContextPanel,
} from './NoteSecondaryContextPanelContract';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type RightPanel = SecondaryContextPanel | 'toc';
type TestIdentity = {
  accountId: string;
  noteId: string;
  resultState: 'READY_EMPTY' | 'READY_WITH_RESULTS';
};
type HarnessState = {
  accountId: string;
  noteId: string;
  activePanel: RightPanel;
  showRightPanel: boolean;
  routeActive: boolean;
  resultState: TestIdentity['resultState'];
  retryKey: number;
};
type HarnessController = {
  patch: ((patch: Partial<HarnessState>) => void) | null;
};
type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await Promise.resolve();
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });
  }
}

function candidateProps(
  panel: SecondaryContextPanel,
  accountId: string,
  noteId: string,
  resultState: TestIdentity['resultState'],
): NoteSecondaryContextPanelProps {
  return {
    panel,
    // The production dispatcher passes the concrete component props through
    // unchanged. The test loader uses this small identity payload to assert
    // that the current note/account reach the resolved component.
    panelProps: {
      __testIdentity: { accountId, noteId, resultState },
    } as never,
  } as NoteSecondaryContextPanelProps;
}

const TestPanel: SecondaryContextPanelComponent = ({ panel, panelProps }) => {
  const identity = (panelProps as unknown as { __testIdentity: TestIdentity }).__testIdentity;
  return createElement(
    'div',
    {
      'data-testid': 'resolved-secondary-panel',
      'data-panel': panel,
      'data-account-id': identity.accountId,
      'data-note-id': identity.noteId,
      'data-panel-state': identity.resultState,
    },
    `${panel}:${identity.resultState}`,
  );
};

function PanelHarness({
  initial,
  loader,
  controller,
  trace,
}: {
  initial: HarnessState;
  loader: SecondaryContextPanelLoader;
  controller: HarnessController;
  trace: { editorMounts: number; editorUnmounts: number; authorityMounts: number };
}) {
  const [state, setState] = useState(initial);
  controller.patch = patch => setState(previous => ({ ...previous, ...patch }));
  const LazyPanelComponent = useMemo(
    () => createLazySecondaryContextPanel(loader),
    [loader, state.retryKey],
  );

  useEffect(() => {
    trace.editorMounts += 1;
    trace.authorityMounts += 1;
    return () => {
      trace.editorUnmounts += 1;
    };
  }, [trace]);

  const candidate = state.activePanel === 'toc' ? null : state.activePanel;
  const panelProps = state.routeActive && state.showRightPanel && candidate
    ? candidateProps(candidate, state.accountId, state.noteId, state.resultState)
    : null;

  return createElement(
    'div',
    { 'data-testid': 'notes-production-boundary-harness' },
    state.routeActive
      ? createElement('div', { 'data-testid': 'block-editor' }, 'BlockEditor/current note')
      : null,
    createElement('output', { 'data-testid': 'notes-authority' }, 'Notes authority ready'),
    createElement(
      'section',
      { 'data-testid': 'context-panel-body' },
      panelProps
        ? createElement(NoteSecondaryContextPanelBoundary, {
          ...panelProps,
          LazyPanelComponent,
          retryKey: state.retryKey,
          onRetry: () => setState(previous => ({ ...previous, retryKey: previous.retryKey + 1 })),
        })
        : state.routeActive && state.showRightPanel
          ? createElement('div', { 'data-testid': 'eager-context-panel', 'data-panel': state.activePanel }, 'Eager panel')
          : null,
    ),
  );
}

function initialState(overrides: Partial<HarnessState> = {}): HarnessState {
  return {
    accountId: 'account-a',
    noteId: 'note-a',
    activePanel: 'discover',
    showRightPanel: false,
    routeActive: true,
    resultState: 'READY_WITH_RESULTS',
    retryKey: 0,
    ...overrides,
  };
}

describe('NoteSecondaryContextPanel production lazy boundary', () => {
  let host: HTMLDivElement;
  let root: Root;
  let mounted = false;

  beforeEach(() => {
    document.body.replaceChildren();
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    if (mounted) {
      act(() => root.unmount());
      mounted = false;
    }
    host.remove();
  });

  function mount(
    loader: SecondaryContextPanelLoader,
    overrides: Partial<HarnessState> = {},
  ) {
    const controller: HarnessController = { patch: null };
    const trace = { editorMounts: 0, editorUnmounts: 0, authorityMounts: 0 };
    act(() => {
      root = createRoot(host);
      root.render(createElement(PanelHarness, {
        initial: initialState(overrides),
        loader,
        controller,
        trace,
      }));
    });
    mounted = true;
    return { controller, trace };
  }

  it('keeps the grouped importer idle for closed and eager panels, then loads only on candidate activation', async () => {
    let importerCalls = 0;
    const pending = deferred<{ default: SecondaryContextPanelComponent }>();
    const loader: SecondaryContextPanelLoader = () => {
      importerCalls += 1;
      return pending.promise;
    };
    const { controller, trace } = mount(loader);

    expect(importerCalls).toBe(0);
    expect(host.querySelector('[data-testid="block-editor"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="notes-authority"]')).not.toBeNull();

    await act(async () => controller.patch?.({ showRightPanel: true, activePanel: 'toc' }));
    expect(importerCalls).toBe(0);
    expect(host.querySelector('[data-testid="eager-context-panel"]')).not.toBeNull();

    await act(async () => controller.patch?.({ activePanel: 'discover' }));
    expect(importerCalls).toBe(1);
    expect(host.querySelector('[data-testid="notes-secondary-panel-loading"]')?.getAttribute('data-loading-scope')).toBe('panel-body');
    expect(host.querySelector('[data-testid="block-editor"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="global-loading"]')).toBeNull();
    expect(trace.editorMounts).toBe(1);
    expect(trace.authorityMounts).toBe(1);

    pending.resolve({ default: TestPanel });
    await flush();
    expect(host.querySelector('[data-testid="resolved-secondary-panel"]')).not.toBeNull();
  });

  it('dispatches discover, timeline, and relations through one grouped module entry', () => {
    const props = candidateProps('discover', 'account-a', 'note-a', 'READY_WITH_RESULTS');
    act(() => {
      root = createRoot(host);
      root.render(createElement(NoteSecondaryContextPanel, props));
    });
    mounted = true;
    expect(host.textContent).toContain('DISCOVER_DISPATCHED');

    act(() => {
      root.render(createElement(NoteSecondaryContextPanel, {
        ...candidateProps('timeline', 'account-a', 'note-a', 'READY_WITH_RESULTS'),
      }));
    });
    expect(host.textContent).toContain('TIMELINE_DISPATCHED');

    act(() => {
      root.render(createElement(NoteSecondaryContextPanel, {
        ...candidateProps('relations', 'account-a', 'note-a', 'READY_WITH_RESULTS'),
      }));
    });
    expect(host.textContent).toContain('RELATIONS_DISPATCHED');
  });

  it('reuses a successful grouped lazy identity across candidate switches and preserves current props', async () => {
    let importerCalls = 0;
    const loader: SecondaryContextPanelLoader = async () => {
      importerCalls += 1;
      return { default: TestPanel };
    };
    const { controller, trace } = mount(loader, { showRightPanel: true });
    await flush();
    expect(importerCalls).toBe(1);
    expect(host.querySelector('[data-testid="resolved-secondary-panel"]')?.getAttribute('data-panel')).toBe('discover');

    await act(async () => controller.patch?.({ activePanel: 'timeline' }));
    await flush();
    await act(async () => controller.patch?.({ activePanel: 'relations' }));
    await flush();
    expect(importerCalls).toBe(1);
    expect(host.querySelector('[data-testid="resolved-secondary-panel"]')?.getAttribute('data-panel')).toBe('relations');
    expect(host.querySelector('[data-testid="block-editor"]')).not.toBeNull();
    expect(trace.editorMounts).toBe(1);
    expect(trace.editorUnmounts).toBe(0);
  });

  it('uses the current note and account when a pending candidate resolves', async () => {
    const pending = deferred<{ default: SecondaryContextPanelComponent }>();
    const loader: SecondaryContextPanelLoader = () => pending.promise;
    const { controller, trace } = mount(loader, { showRightPanel: true });

    await act(async () => controller.patch?.({ noteId: 'note-b', accountId: 'account-b' }));
    pending.resolve({ default: TestPanel });
    await flush();

    const panel = host.querySelector('[data-testid="resolved-secondary-panel"]');
    expect(panel?.getAttribute('data-note-id')).toBe('note-b');
    expect(panel?.getAttribute('data-account-id')).toBe('account-b');
    expect(trace.authorityMounts).toBe(1);
  });

  it('does not mount a late candidate after panel or route deactivation', async () => {
    const pending = deferred<{ default: SecondaryContextPanelComponent }>();
    const loader: SecondaryContextPanelLoader = () => pending.promise;
    const { controller, trace } = mount(loader, { showRightPanel: true });
    await act(async () => controller.patch?.({ activePanel: 'toc' }));
    pending.resolve({ default: TestPanel });
    await flush();
    expect(host.querySelector('[data-testid="resolved-secondary-panel"]')).toBeNull();
    expect(host.querySelector('[data-testid="eager-context-panel"]')).not.toBeNull();

    await act(async () => controller.patch?.({ activePanel: 'discover', routeActive: false }));
    expect(host.querySelector('[data-testid="block-editor"]')).toBeNull();
    expect(host.querySelector('[data-testid="resolved-secondary-panel"]')).toBeNull();
    expect(trace.authorityMounts).toBe(1);
  });

  it('keeps MODULE_NOT_READY separate from READY_EMPTY', async () => {
    const pending = deferred<{ default: SecondaryContextPanelComponent }>();
    const loader: SecondaryContextPanelLoader = () => pending.promise;
    mount(loader, { showRightPanel: true, resultState: 'READY_EMPTY' });

    expect(host.querySelector('[data-testid="notes-secondary-panel-loading"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="resolved-secondary-panel"]')).toBeNull();
    pending.resolve({ default: TestPanel });
    await flush();
    expect(host.querySelector('[data-testid="resolved-secondary-panel"]')?.getAttribute('data-panel-state')).toBe('READY_EMPTY');
    expect(host.querySelector('[data-testid="notes-secondary-panel-loading"]')).toBeNull();
  });

  it('contains candidate failure locally and retries with a fresh lazy identity without remounting authority/editor', async () => {
    let importerCalls = 0;
    const loader: SecondaryContextPanelLoader = async () => {
      importerCalls += 1;
      if (importerCalls === 1) throw new Error('private chunk detail');
      return { default: TestPanel };
    };
    const { controller, trace } = mount(loader, {
      showRightPanel: true,
      accountId: 'account-a',
      noteId: 'note-a',
    });
    await flush();

    expect(importerCalls).toBe(1);
    expect(host.querySelector('[data-testid="notes-secondary-panel-error"]')).not.toBeNull();
    expect(host.textContent).not.toContain('private chunk detail');
    expect(host.querySelector('[data-testid="block-editor"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="notes-authority"]')).not.toBeNull();

    await act(async () => controller.patch?.({ showRightPanel: false }));
    await act(async () => controller.patch?.({ showRightPanel: true }));
    await flush();
    expect(importerCalls).toBe(1);
    expect(host.querySelector('[data-testid="notes-secondary-panel-error"]')).not.toBeNull();

    await act(async () => controller.patch?.({ accountId: 'account-b', noteId: 'note-b' }));
    await act(async () => {
      (host.querySelector('[data-testid="notes-secondary-panel-retry"]') as HTMLButtonElement).click();
    });
    await flush();

    expect(importerCalls).toBe(2);
    const panel = host.querySelector('[data-testid="resolved-secondary-panel"]');
    expect(panel?.getAttribute('data-account-id')).toBe('account-b');
    expect(panel?.getAttribute('data-note-id')).toBe('note-b');
    expect(host.querySelector('[data-testid="block-editor"]')).not.toBeNull();
    expect(trace.editorMounts).toBe(1);
    expect(trace.editorUnmounts).toBe(0);
    expect(trace.authorityMounts).toBe(1);
  });
});
