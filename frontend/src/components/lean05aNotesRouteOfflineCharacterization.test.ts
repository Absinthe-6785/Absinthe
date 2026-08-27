// @vitest-environment happy-dom
import { act, Component, createElement, lazy, Suspense, useEffect, useRef, useState, type ComponentType, type ErrorInfo, type LazyExoticComponent } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type RouteTab = 'home' | 'planner' | 'note';
type StartupStatus = 'pending' | 'ready' | 'failed';
type NotesViewProps = { accountId: string };
type NotesView = ComponentType<NotesViewProps>;
type LazyNotesView = LazyExoticComponent<NotesView>;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

type CharacterizationTrace = {
  importerCalls: number;
  moduleFactoryCalls: number;
  fallbackRenders: number;
  authorityInitializations: number;
  startupRuns: number;
  persistenceBindings: number;
  syncBindings: number;
  accountBindings: number;
  authorityDetachments: number;
  startupStates: StartupStatus[];
  boundaryCaught: number;
  uncaughtErrors: unknown[];
  remoteRequests: number;
};

type RouteController = {
  setTab: ((tab: RouteTab) => void) | null;
  activeTab: RouteTab | null;
};

type MountedHarness = {
  root: Root;
  host: HTMLDivElement;
  controller: RouteController;
  trace: CharacterizationTrace;
};

function newTrace(): CharacterizationTrace {
  return {
    importerCalls: 0,
    moduleFactoryCalls: 0,
    fallbackRenders: 0,
    authorityInitializations: 0,
    startupRuns: 0,
    persistenceBindings: 0,
    syncBindings: 0,
    accountBindings: 0,
    authorityDetachments: 0,
    startupStates: [],
    boundaryCaught: 0,
    uncaughtErrors: [],
    remoteRequests: 0,
  };
}

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

function createNotesModule(label: string): { default: NotesView } {
  return {
    default: ({ accountId }: NotesViewProps) => createElement(
      'div',
      { 'data-testid': 'notes-view', 'data-account-id': accountId, 'data-module-label': label },
      'Notes',
    ),
  };
}

/**
 * This is the real React.lazy primitive used by the future boundary. The
 * importer and resolved module are traced separately so a rejection cannot be
 * mistaken for a successful module evaluation.
 */
function tracedLazy(
  trace: CharacterizationTrace,
  importer: () => Promise<{ default: NotesView }>,
): LazyNotesView {
  return lazy(async () => {
    trace.importerCalls += 1;
    const module = await importer();
    trace.moduleFactoryCalls += 1;
    return module;
  });
}

type ChunkBoundaryProps = {
  getLazyView: (retryKey: number) => LazyNotesView;
  trace: CharacterizationTrace;
};

type ChunkBoundaryState = {
  error: unknown | null;
  retryKey: number;
};

/**
 * Test-only route boundary. Production currently has no equivalent for lazy
 * NoteView rejection; the no-boundary cases below therefore run separately.
 * This boundary models the narrow future Model-B containment contract:
 * route-local Suspense/error handling with fresh-identity retry, while eager
 * Notes authority stays outside the lazy UI and preload remains optional.
 */
class NotesChunkBoundary extends Component<ChunkBoundaryProps, ChunkBoundaryState> {
  state: ChunkBoundaryState = { error: null, retryKey: 0 };

  static getDerivedStateFromError(error: unknown): ChunkBoundaryState {
    return { error, retryKey: 0 };
  }

  componentDidCatch(_error: unknown, _info: ErrorInfo): void {
    this.props.trace.boundaryCaught += 1;
  }

  private readonly retry = (): void => {
    this.setState(previous => ({ error: null, retryKey: previous.retryKey + 1 }));
  };

  render() {
    if (this.state.error) {
      return createElement(
        'div',
        { 'data-testid': 'notes-chunk-error', role: 'alert' },
        createElement('span', null, 'Notes module unavailable'),
        createElement('button', { type: 'button', 'data-testid': 'notes-chunk-retry', onClick: this.retry }, 'Retry'),
      );
    }

    const LazyView = this.props.getLazyView(this.state.retryKey);
    return createElement(
      Suspense,
      {
        fallback: createElement(NotesLoadingFallback, { trace: this.props.trace }),
      },
      createElement(LazyView, { accountId: 'account-a' }),
    );
  }
}

function NotesLoadingFallback({ trace }: { trace: CharacterizationTrace }) {
  trace.fallbackRenders += 1;
  return createElement('div', { 'data-testid': 'notes-module-fallback', role: 'status' }, 'Loading Notes');
}

type RouteHarnessProps = {
  startupState: StartupStatus;
  getLazyView: (retryKey: number) => LazyNotesView;
  trace: CharacterizationTrace;
  controller: RouteController;
  localOnly?: boolean;
  withLocalBoundary?: boolean;
};

/**
 * Mirrors the production ownership order without changing production code:
 * shell → eager Notes authority/startup → activeTab → route-scoped
 * Suspense/lazy UI. The lazy module itself is test-only so the lifecycle can
 * be driven with deterministic deferred imports. The counters characterize
 * this ownership shape; they do not replace protected persistence internals.
 */
function RouteHarness({
  startupState,
  getLazyView,
  trace,
  controller,
  localOnly = false,
  withLocalBoundary = false,
}: RouteHarnessProps) {
  const authorityRef = useRef(false);
  if (!authorityRef.current) {
    authorityRef.current = true;
    trace.authorityInitializations += 1;
    trace.persistenceBindings += 1;
    trace.syncBindings += 1;
    trace.accountBindings += 1;
  }

  const [activeTab, setActiveTab] = useState<RouteTab>('home');
  controller.setTab = setActiveTab;
  controller.activeTab = activeTab;

  const previousStartup = useRef<StartupStatus | null>(null);
  if (previousStartup.current !== startupState) {
    previousStartup.current = startupState;
    trace.startupStates.push(startupState);
  }

  useEffect(() => {
    trace.startupRuns += 1;
    return () => {
      trace.authorityDetachments += 1;
    };
  }, [trace]);

  const notesRoute = startupState === 'pending'
    ? createElement('div', { 'data-testid': 'notes-startup-pending' }, 'Notes startup pending')
    : startupState === 'failed'
      ? createElement('div', { 'data-testid': 'notes-startup-failed', role: 'alert' }, 'Notes startup failed')
      : withLocalBoundary
        ? createElement(NotesChunkBoundary, { getLazyView, trace })
        : createElement(
          Suspense,
          { fallback: createElement(NotesLoadingFallback, { trace }) },
          createElement(getLazyView(0), { accountId: 'account-a' }),
        );

  const routeContent = activeTab === 'home'
    ? createElement('div', { 'data-testid': 'home-route' }, 'Home')
    : activeTab === 'planner'
      ? createElement('div', { 'data-testid': 'planner-route' }, 'Planner')
      : notesRoute;

  return createElement(
    'div',
    { 'data-testid': 'shell' },
    createElement(
      'nav',
      { 'data-testid': 'navigation' },
      createElement('button', { type: 'button', 'data-testid': 'nav-home', onClick: () => setActiveTab('home') }, 'Home'),
      createElement('button', { type: 'button', 'data-testid': 'nav-planner', onClick: () => setActiveTab('planner') }, 'Planner'),
      createElement('button', { type: 'button', 'data-testid': 'nav-notes', onClick: () => setActiveTab('note') }, 'Notes'),
    ),
    createElement('section', { 'data-testid': 'route-surface' }, routeContent),
    createElement('output', {
      'data-testid': 'notes-authority',
      'data-local-only': String(localOnly),
      'data-authority-ready': 'true',
      'data-remote-requests': String(trace.remoteRequests),
    }, 'Notes authority ready'),
  );
}

function mountHarness(props: Omit<RouteHarnessProps, 'controller'> & { onUncaughtError?: (error: unknown) => void }): MountedHarness {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const controller: RouteController = { setTab: null, activeTab: null };
  const root = createRoot(host, {
    onUncaughtError: error => {
      props.trace.uncaughtErrors.push(error);
      props.onUncaughtError?.(error);
    },
  });
  act(() => {
    root.render(createElement(RouteHarness, { ...props, controller }));
  });
  return { root, host, controller, trace: props.trace };
}

function unmountHarness(mounted: MountedHarness | null): void {
  if (!mounted) return;
  act(() => mounted.root.unmount());
  mounted.host.remove();
}

function cachedLazyFactory(
  create: (retryKey: number) => LazyNotesView,
): (retryKey: number) => LazyNotesView {
  const cache = new Map<number, LazyNotesView>();
  return retryKey => {
    const existing = cache.get(retryKey);
    if (existing) return existing;
    const next = create(retryKey);
    cache.set(retryKey, next);
    return next;
  };
}

function sourceAt(relativePath: string): string {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), relativePath), 'utf8');
}

function walkFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const entries = readdirSync(root, { withFileTypes: true });
  return entries.flatMap(entry => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return walkFiles(path);
    return [path];
  });
}

describe('LEAN_05A Notes route offline-first characterization', () => {
  let mounted: MountedHarness | null = null;

  beforeEach(() => {
    document.body.replaceChildren();
  });

  afterEach(() => {
    unmountHarness(mounted);
    mounted = null;
    document.body.replaceChildren();
  });

  it('records the current production ownership and boundary arrangement', () => {
    const appContent = sourceAt('AppContent.tsx');
    expect(appContent).toContain("import { NoteView } from './views/NoteView';");
    expect(appContent).toContain("import { useNotesStore } from '../store/useNotesStore';");
    expect(appContent).toContain('startIndependentStartup');
    expect(appContent).toContain('await initNotesStorage(authUser.id);');
    expect(appContent).toContain('await bootstrapFromSupabase();');
    expect(appContent).toContain('<Suspense fallback={<ViewLoadingFallback />}>');
    expect(appContent).toContain("startupRunRef.current?.retry('notes')");
    expect(appContent).toContain("activeTab === 'note' && startupState.notes.status === 'pending'");
    expect(appContent).toContain("activeTab === 'note' && startupState.notes.status === 'failed'");

    const suspenseStart = appContent.indexOf('<Suspense fallback={<ViewLoadingFallback />}>');
    const suspenseEnd = appContent.indexOf('</Suspense>', suspenseStart);
    const notesReadyRender = appContent.indexOf("activeTab === 'note' && startupState.notes.status === 'ready'");
    expect(suspenseStart).toBeGreaterThanOrEqual(0);
    expect(suspenseEnd).toBeGreaterThan(suspenseStart);
    expect(notesReadyRender).toBeGreaterThan(suspenseEnd);
    expect(appContent).not.toContain('NotesRouteErrorBoundary');
    expect(appContent).not.toContain('ChunkLoadError');

    const noteView = sourceAt('views/NoteView.tsx');
    expect(noteView).not.toMatch(/ErrorBoundary|<Suspense|lazy\(/);
  });

  it('resolves cold online Notes activation once and keeps authority eager', async () => {
    const trace = newTrace();
    const module = deferred<{ default: NotesView }>();
    const lazyView = tracedLazy(trace, () => module.promise);
    const getLazyView = cachedLazyFactory(() => lazyView);
    mounted = mountHarness({ startupState: 'ready', getLazyView, trace });

    expect(mounted.host.querySelector('[data-testid="home-route"]')).not.toBeNull();
    expect(trace.importerCalls).toBe(0);
    expect(trace.authorityInitializations).toBe(1);
    expect(trace.startupRuns).toBe(1);

    await act(async () => {
      mounted?.controller.setTab?.('note');
    });
    expect(trace.importerCalls).toBe(1);
    expect(mounted.host.querySelector('[data-testid="notes-module-fallback"]')).not.toBeNull();
    expect(mounted.host.querySelector('[data-testid="notes-view"]')).toBeNull();

    module.resolve(createNotesModule('cold-online'));
    await flush();

    expect(mounted.controller.activeTab).toBe('note');
    expect(mounted.host.querySelector('[data-testid="notes-view"]')?.getAttribute('data-account-id')).toBe('account-a');
    expect(trace.moduleFactoryCalls).toBe(1);
    expect(trace.uncaughtErrors).toHaveLength(0);
    expect(trace.authorityInitializations).toBe(1);
    expect(trace.startupRuns).toBe(1);
    expect(trace.persistenceBindings).toBe(1);
    expect(trace.syncBindings).toBe(1);
    expect(trace.accountBindings).toBe(1);
  });

  it('reuses a resolved module across repeated activation without a fallback flash or authority restart', async () => {
    const trace = newTrace();
    const lazyView = tracedLazy(trace, async () => createNotesModule('warm'));
    const getLazyView = cachedLazyFactory(() => lazyView);
    mounted = mountHarness({ startupState: 'ready', getLazyView, trace });

    await act(async () => mounted?.controller.setTab?.('note'));
    await flush();
    const fallbackAfterFirstUse = trace.fallbackRenders;
    expect(trace.importerCalls).toBe(1);
    expect(trace.moduleFactoryCalls).toBe(1);

    for (let i = 0; i < 3; i += 1) {
      await act(async () => mounted?.controller.setTab?.('home'));
      await act(async () => mounted?.controller.setTab?.('note'));
      await flush();
    }

    expect(trace.importerCalls).toBe(1);
    expect(trace.moduleFactoryCalls).toBe(1);
    expect(trace.fallbackRenders).toBe(fallbackAfterFirstUse);
    expect(trace.authorityInitializations).toBe(1);
    expect(trace.startupRuns).toBe(1);
    expect(mounted.host.querySelector('[data-testid="notes-view"]')).not.toBeNull();
  });

  it('does not evaluate the lazy module while Notes startup is pending or failed', async () => {
    const pendingTrace = newTrace();
    const pendingImport = deferred<{ default: NotesView }>();
    const pendingLazy = tracedLazy(pendingTrace, () => pendingImport.promise);
    const pending = mountHarness({
      startupState: 'pending',
      getLazyView: cachedLazyFactory(() => pendingLazy),
      trace: pendingTrace,
    });
    mounted = pending;
    await act(async () => pending.controller.setTab?.('note'));
    expect(pending.host.querySelector('[data-testid="notes-startup-pending"]')).not.toBeNull();
    expect(pendingTrace.importerCalls).toBe(0);
    expect(pendingTrace.authorityInitializations).toBe(1);
    expect(pendingTrace.startupRuns).toBe(1);

    await act(async () => {
      pending.root.render(createElement(RouteHarness, {
        startupState: 'ready',
        getLazyView: cachedLazyFactory(() => pendingLazy),
        trace: pendingTrace,
        controller: pending.controller,
      }));
    });
    expect(pendingTrace.importerCalls).toBe(1);
    pendingImport.resolve(createNotesModule('pending-to-ready'));
    await flush();
    expect(pending.host.querySelector('[data-testid="notes-view"]')).not.toBeNull();
    expect(pendingTrace.authorityInitializations).toBe(1);
    expect(pendingTrace.startupRuns).toBe(1);

    unmountHarness(pending);
    mounted = null;

    const failedTrace = newTrace();
    const failedLazy = tracedLazy(failedTrace, async () => createNotesModule('must-not-run'));
    const failed = mountHarness({
      startupState: 'failed',
      getLazyView: cachedLazyFactory(() => failedLazy),
      trace: failedTrace,
    });
    mounted = failed;
    await act(async () => failed.controller.setTab?.('note'));
    expect(failed.host.querySelector('[data-testid="notes-startup-failed"]')).not.toBeNull();
    expect(failedTrace.importerCalls).toBe(0);
    expect(failedTrace.authorityInitializations).toBe(1);
    expect(failedTrace.startupRuns).toBe(1);
  });

  it('shows an uncaught rejection unmounting the shell and detaching authority without a route boundary', async () => {
    const trace = newTrace();
    const rejected = tracedLazy(trace, async () => {
      throw new Error('ChunkLoadError: stale Notes chunk');
    });
    mounted = mountHarness({
      startupState: 'ready',
      getLazyView: cachedLazyFactory(() => rejected),
      trace,
    });

    let surfacedError: unknown = null;
    try {
      await act(async () => mounted?.controller.setTab?.('note'));
    } catch (error) {
      surfacedError = error;
      // React may surface an uncaught lazy rejection through act in addition
      // to invoking the root's onUncaughtError observation hook.
    }
    try {
      await flush();
    } catch {
      // Keep the production-equivalent observation focused on the captured
      // boundary outcome rather than allowing the expected rejection to abort
      // the test.
    }

    expect(trace.importerCalls).toBe(1);
    expect(trace.moduleFactoryCalls).toBe(0);
    const observedError = trace.uncaughtErrors[0] ?? surfacedError;
    expect(observedError).toBeTruthy();
    expect(String(observedError)).toContain('ChunkLoadError');
    expect(mounted.host.querySelector('[data-testid="notes-chunk-error"]')).toBeNull();
    expect(mounted.host.querySelector('[data-testid="shell"]')).toBeNull();
    expect(mounted.host.querySelector('[data-testid="navigation"]')).toBeNull();
    expect(trace.authorityInitializations).toBe(1);
    expect(trace.startupRuns).toBe(1);
    expect(trace.authorityDetachments).toBe(1);
  });

  it('proves React.lazy rejection caching and the narrow new-identity retry behavior', async () => {
    const sameIdentityTrace = newTrace();
    const sameIdentity = tracedLazy(sameIdentityTrace, async () => {
      throw new Error('ChunkLoadError: offline');
    });
    const sameIdentityMounted = mountHarness({
      startupState: 'ready',
      getLazyView: cachedLazyFactory(() => sameIdentity),
      trace: sameIdentityTrace,
      withLocalBoundary: true,
    });
    mounted = sameIdentityMounted;
    await act(async () => sameIdentityMounted.controller.setTab?.('note'));
    await flush();
    expect(sameIdentityTrace.importerCalls).toBe(1);
    expect(sameIdentityMounted.host.querySelector('[data-testid="notes-chunk-error"]')).not.toBeNull();

    await act(async () => {
      (sameIdentityMounted.host.querySelector('[data-testid="notes-chunk-retry"]') as HTMLButtonElement)?.click();
    });
    await flush();
    expect(sameIdentityTrace.importerCalls).toBe(1);
    expect(sameIdentityTrace.moduleFactoryCalls).toBe(0);
    expect(sameIdentityMounted.host.querySelector('[data-testid="notes-view"]')).toBeNull();
    expect(sameIdentityTrace.authorityInitializations).toBe(1);

    unmountHarness(sameIdentityMounted);
    mounted = null;

    const recoveredTrace = newTrace();
    const firstAttempt = tracedLazy(recoveredTrace, async () => {
      throw new Error('ChunkLoadError: offline');
    });
    const secondAttempt = tracedLazy(recoveredTrace, async () => createNotesModule('recovered-retry'));
    const recovered = mountHarness({
      startupState: 'ready',
      getLazyView: cachedLazyFactory(retryKey => retryKey === 0 ? firstAttempt : secondAttempt),
      trace: recoveredTrace,
      withLocalBoundary: true,
    });
    mounted = recovered;
    await act(async () => recovered.controller.setTab?.('note'));
    await flush();
    expect(recoveredTrace.importerCalls).toBe(1);
    expect(recoveredTrace.boundaryCaught).toBe(1);

    await act(async () => {
      (recovered.host.querySelector('[data-testid="notes-chunk-retry"]') as HTMLButtonElement)?.click();
    });
    await flush();
    expect(recoveredTrace.importerCalls).toBe(2);
    expect(recoveredTrace.moduleFactoryCalls).toBe(1);
    expect(recovered.host.querySelector('[data-testid="notes-view"]')).not.toBeNull();
    expect(recoveredTrace.authorityInitializations).toBe(1);
    expect(recoveredTrace.startupRuns).toBe(1);
    expect(recoveredTrace.persistenceBindings).toBe(1);
    expect(recoveredTrace.syncBindings).toBe(1);
    expect(recoveredTrace.accountBindings).toBe(1);
    expect(recoveredTrace.authorityDetachments).toBe(0);
  });

  it('keeps shell tabs and local-only authority usable with a bounded route boundary after failure', async () => {
    const trace = newTrace();
    const rejected = tracedLazy(trace, async () => {
      throw new Error('ChunkLoadError: uncached offline Notes chunk');
    });
    mounted = mountHarness({
      startupState: 'ready',
      getLazyView: cachedLazyFactory(() => rejected),
      trace,
      localOnly: true,
      withLocalBoundary: true,
    });

    await act(async () => mounted?.controller.setTab?.('note'));
    await flush();
    expect(trace.importerCalls).toBe(1);
    expect(mounted.host.querySelector('[data-testid="notes-chunk-error"]')).not.toBeNull();
    expect(mounted.host.querySelector('[data-testid="navigation"]')).not.toBeNull();
    expect(mounted.host.querySelector('[data-testid="notes-authority"]')?.getAttribute('data-authority-ready')).toBe('true');
    expect(mounted.host.querySelector('[data-testid="notes-authority"]')?.getAttribute('data-local-only')).toBe('true');
    expect(trace.remoteRequests).toBe(0);
    expect(trace.authorityInitializations).toBe(1);
    expect(trace.startupRuns).toBe(1);
    expect(trace.authorityDetachments).toBe(0);

    await act(async () => mounted?.controller.setTab?.('planner'));
    expect(mounted.host.querySelector('[data-testid="planner-route"]')).not.toBeNull();
    expect(mounted.host.querySelector('[data-testid="notes-chunk-error"]')).toBeNull();
    await act(async () => mounted?.controller.setTab?.('note'));
    await flush();
    expect(mounted.host.querySelector('[data-testid="notes-chunk-error"]')).not.toBeNull();
    expect(trace.importerCalls).toBe(1);
    expect(trace.authorityInitializations).toBe(1);
    expect(trace.startupRuns).toBe(1);
  });

  it('keeps Suspense fallback inside the active view and out of global loading state', async () => {
    const trace = newTrace();
    const module = deferred<{ default: NotesView }>();
    const lazyView = tracedLazy(trace, () => module.promise);
    mounted = mountHarness({
      startupState: 'ready',
      getLazyView: cachedLazyFactory(() => lazyView),
      trace,
    });

    await act(async () => mounted?.controller.setTab?.('note'));
    expect(mounted.host.querySelector('[data-testid="notes-module-fallback"]')).not.toBeNull();
    const fallback = mounted.host.querySelector('[data-testid="notes-module-fallback"]');
    expect(fallback?.parentElement?.getAttribute('data-testid')).toBe('route-surface');
    expect(mounted.host.querySelector('[data-testid="shell"]')).not.toBeNull();
    expect(mounted.host.querySelector('[data-testid="navigation"]')).not.toBeNull();
    expect(mounted.host.querySelector('[data-testid="global-spinner"]')).toBeNull();

    await act(async () => mounted?.controller.setTab?.('planner'));
    expect(mounted.host.querySelector('[data-testid="planner-route"]')).not.toBeNull();
    expect(mounted.host.querySelector('[data-testid="notes-module-fallback"]')).toBeNull();
    module.resolve(createNotesModule('scoped-fallback'));
    await flush();
  });

  it('records the repository service-worker/PWA lazy-chunk precache guard, backed by source audit', () => {
    const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const indexHtml = readFileSync(join(frontendRoot, 'index.html'), 'utf8');
    const publicRoot = join(frontendRoot, 'public');
    const publicFiles = walkFiles(publicRoot);
    const registrationFiles = publicFiles.filter(path => /(service[-_]?worker|workbox|sw\.)/i.test(path));

    expect(indexHtml).not.toMatch(/serviceWorker|workbox|precache/i);
    expect(publicFiles.some(path => /manifest\.webmanifest$|manifest\.json$/i.test(path))).toBe(false);
    expect(registrationFiles).toHaveLength(0);
    expect(publicFiles.some(path => /service[-_]?worker|workbox/i.test(path))).toBe(false);
    expect(existsSync(join(frontendRoot, 'src', 'registerServiceWorker.ts'))).toBe(false);
    expect(publicFiles.every(path => statSync(path).isFile())).toBe(true);
  });
});
