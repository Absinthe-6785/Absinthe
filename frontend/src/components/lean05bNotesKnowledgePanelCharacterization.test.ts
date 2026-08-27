// @vitest-environment happy-dom
import {
  act,
  Component,
  createElement,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ErrorInfo,
  type LazyExoticComponent,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type CandidatePanel = 'discover' | 'timeline' | 'relations';
type RightPanel = CandidatePanel | 'toc';
type PanelResultState = 'empty' | 'results';

type PanelProps = {
  panel: CandidatePanel;
  accountId: string;
  noteId: string;
  resultState: PanelResultState;
};

type PanelModule = { default: ComponentType<PanelProps> };
type LazyPanel = LazyExoticComponent<ComponentType<PanelProps>>;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

type PanelCounters = Record<CandidatePanel, number>;

type CharacterizationTrace = {
  importerCalls: PanelCounters;
  moduleFactoryCalls: PanelCounters;
  panelMounts: PanelCounters;
  panelUnmounts: PanelCounters;
  panelRenders: Array<{ panel: CandidatePanel; accountId: string; noteId: string; resultState: PanelResultState }>;
  fallbackRenders: number;
  authorityInitializations: number;
  authorityDetachments: number;
  startupRuns: number;
  boundaryCaught: number;
  uncaughtErrors: unknown[];
  remoteRequests: number;
  editorMounts: number;
  editorUnmounts: number;
  startupStates: string[];
};

type HostState = {
  accountId: string;
  noteId: string;
  activePanel: RightPanel;
  showRightPanel: boolean;
  routeActive: boolean;
  resultState: PanelResultState;
  retryGeneration: number;
};

type HostController = {
  patch: ((patch: Partial<HostState>) => void) | null;
  state: HostState | null;
};

type PanelLoader = () => Promise<PanelModule>;
type PanelLoaders = Record<CandidatePanel, PanelLoader>;

type MountedHarness = {
  root: Root;
  host: HTMLDivElement;
  controller: HostController;
  trace: CharacterizationTrace;
};

function panelCounters(): PanelCounters {
  return { discover: 0, timeline: 0, relations: 0 };
}

function newTrace(): CharacterizationTrace {
  return {
    importerCalls: panelCounters(),
    moduleFactoryCalls: panelCounters(),
    panelMounts: panelCounters(),
    panelUnmounts: panelCounters(),
    panelRenders: [],
    fallbackRenders: 0,
    authorityInitializations: 0,
    authorityDetachments: 0,
    startupRuns: 0,
    boundaryCaught: 0,
    uncaughtErrors: [],
    remoteRequests: 0,
    editorMounts: 0,
    editorUnmounts: 0,
    startupStates: [],
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

function panelModule(panel: CandidatePanel, trace: CharacterizationTrace): PanelModule {
  function CharacterizedPanel({ accountId, noteId, resultState }: PanelProps) {
    trace.panelRenders.push({ panel, accountId, noteId, resultState });
    useEffect(() => {
      trace.panelMounts[panel] += 1;
      return () => {
        trace.panelUnmounts[panel] += 1;
      };
    }, []);
    return createElement(
      'div',
      {
        'data-testid': 'knowledge-panel',
        'data-panel': panel,
        'data-account-id': accountId,
        'data-note-id': noteId,
        'data-panel-state': resultState === 'empty' ? 'READY_EMPTY' : 'READY_WITH_RESULTS',
      },
      `${panel}:${resultState}`,
    );
  }
  return { default: CharacterizedPanel };
}

function tracedLazy(
  panel: CandidatePanel,
  trace: CharacterizationTrace,
  loader: PanelLoader,
): LazyPanel {
  return lazy(async () => {
    trace.importerCalls[panel] += 1;
    const module = await loader();
    trace.moduleFactoryCalls[panel] += 1;
    return module;
  });
}

function panelLoaders(
  trace: CharacterizationTrace,
  overrides: Partial<PanelLoaders> = {},
): PanelLoaders {
  return {
    discover: overrides.discover ?? (async () => panelModule('discover', trace)),
    timeline: overrides.timeline ?? (async () => panelModule('timeline', trace)),
    relations: overrides.relations ?? (async () => panelModule('relations', trace)),
  };
}

function PanelLoading({ trace }: { trace: CharacterizationTrace }) {
  trace.fallbackRenders += 1;
  return createElement(
    'div',
    { 'data-testid': 'panel-loading', role: 'status', 'data-loading-scope': 'panel-body' },
    'Loading context panel',
  );
}

type PanelErrorBoundaryProps = {
  panel: CandidatePanel;
  accountId: string;
  noteId: string;
  resultState: PanelResultState;
  LazyPanelComponent: LazyPanel;
  trace: CharacterizationTrace;
  onRetry: () => void;
};

type PanelErrorBoundaryState = { error: unknown | null };

class PanelErrorBoundary extends Component<PanelErrorBoundaryProps, PanelErrorBoundaryState> {
  state: PanelErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): PanelErrorBoundaryState {
    return { error };
  }

  componentDidCatch(_error: unknown, _info: ErrorInfo): void {
    this.props.trace.boundaryCaught += 1;
  }

  render() {
    if (this.state.error) {
      return createElement(
        'div',
        {
          'data-testid': 'panel-error',
          role: 'alert',
          'data-error-panel': this.props.panel,
          'data-error-account-id': this.props.accountId,
          'data-error-note-id': this.props.noteId,
        },
        createElement('span', null, 'Context panel unavailable'),
        createElement('button', { type: 'button', 'data-testid': 'panel-retry', onClick: this.props.onRetry }, 'Retry'),
      );
    }

    return createElement(
      Suspense,
      { fallback: createElement(PanelLoading, { trace: this.props.trace }) },
      createElement(this.props.LazyPanelComponent, {
        panel: this.props.panel,
        accountId: this.props.accountId,
        noteId: this.props.noteId,
        resultState: this.props.resultState,
      }),
    );
  }
}

function EditorSurface({ trace }: { trace: CharacterizationTrace }) {
  useEffect(() => {
    trace.editorMounts += 1;
    return () => {
      trace.editorUnmounts += 1;
    };
  }, []);
  return createElement('div', { 'data-testid': 'editor-surface' }, 'BlockEditor/current note');
}

type PanelHostProps = {
  initial: HostState;
  trace: CharacterizationTrace;
  loaders: PanelLoaders;
  controller: HostController;
  localOnly?: boolean;
};

/**
 * Test-only host that mirrors the current production ownership order:
 * Notes authority/account → active note → rightPanel/showRightPanel →
 * context-panel body. The editor and authority stay outside the lazy panel.
 */
function PanelHost({ initial, trace, loaders, controller, localOnly = false }: PanelHostProps) {
  const [state, setState] = useState(initial);
  controller.patch = patch => setState(previous => ({ ...previous, ...patch }));
  controller.state = state;

  const authorityInitialized = useRef(false);
  if (!authorityInitialized.current) {
    authorityInitialized.current = true;
    trace.authorityInitializations += 1;
    trace.startupStates.push('ready');
  }

  const lazyCache = useRef(new Map<string, LazyPanel>());
  const getLazyPanel = (panel: CandidatePanel): LazyPanel => {
    const cacheKey = `${panel}:${state.retryGeneration}`;
    const cached = lazyCache.current.get(cacheKey);
    if (cached) return cached;
    const next = tracedLazy(panel, trace, loaders[panel]);
    lazyCache.current.set(cacheKey, next);
    return next;
  };

  useEffect(() => {
    trace.startupRuns += 1;
    return () => {
      trace.authorityDetachments += 1;
    };
  }, [trace]);

  const candidate = state.activePanel === 'toc' ? null : state.activePanel;
  const panelBody = state.routeActive && state.showRightPanel
    ? candidate
      ? createElement(
        PanelErrorBoundary,
        {
          key: `${state.accountId}:${state.noteId}:${candidate}:${state.retryGeneration}`,
          panel: candidate,
          accountId: state.accountId,
          noteId: state.noteId,
          resultState: state.resultState,
          LazyPanelComponent: getLazyPanel(candidate),
          trace,
          onRetry: () => setState(previous => ({ ...previous, retryGeneration: previous.retryGeneration + 1 })),
        },
      )
      : createElement('div', { 'data-testid': 'eager-context-panel', 'data-panel': state.activePanel }, 'TOC / eager context panel')
    : null;

  return createElement(
    'div',
    {
      'data-testid': 'notes-shell',
      'data-local-only': String(localOnly),
      'data-remote-requests': String(trace.remoteRequests),
    },
    createElement(
      'main',
      { 'data-testid': 'notes-route', 'data-route-active': String(state.routeActive) },
      state.routeActive ? createElement(EditorSurface, { trace }) : null,
      createElement('section', { 'data-testid': 'context-panel-body' }, panelBody),
    ),
    createElement('output', { 'data-testid': 'authority', 'data-authority-ready': 'true' }, 'Notes authority ready'),
  );
}

function mountHarness(props: Omit<PanelHostProps, 'controller'>): MountedHarness {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const controller: HostController = { patch: null, state: null };
  const root = createRoot(host, {
    onUncaughtError: error => props.trace.uncaughtErrors.push(error),
  });
  act(() => {
    root.render(createElement(PanelHost, { ...props, controller }));
  });
  return { root, host, controller, trace: props.trace };
}

function unmountHarness(mounted: MountedHarness | null): void {
  if (!mounted) return;
  act(() => mounted.root.unmount());
  mounted.host.remove();
}

function sourceAt(relativePath: string): string {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), relativePath), 'utf8');
}

function initialState(overrides: Partial<HostState> = {}): HostState {
  return {
    accountId: 'account-a',
    noteId: 'note-1',
    activePanel: 'discover',
    showRightPanel: false,
    routeActive: true,
    resultState: 'results',
    retryGeneration: 0,
    ...overrides,
  };
}

describe('LEAN_05B Notes knowledge-panel tab split characterization', () => {
  let mounted: MountedHarness | null = null;

  beforeEach(() => {
    document.body.replaceChildren();
  });

  afterEach(() => {
    unmountHarness(mounted);
    mounted = null;
    document.body.replaceChildren();
  });

  it('inventories the exact current panel keys, static imports, activation gates, and eager authority', () => {
    const noteView = sourceAt('views/NoteView.tsx');
    const body = sourceAt('views/noteview/NoteContextPanelBody.tsx');
    const config = sourceAt('views/noteview/useNoteViewPanelConfig.tsx');
    const gates = sourceAt('views/noteview/contextPanelTabGate.ts');
    const panelsHook = sourceAt('views/noteview/useNoteViewPanels.ts');
    const dashboardHook = sourceAt('views/noteview/useNoteViewDashboard.ts');

    const currentPanelKeys = [
      'toc', 'links', 'graph', 'discover', 'properties', 'insights', 'actions', 'timeline', 'tags', 'relations', 'stats',
    ];
    for (const key of currentPanelKeys) {
      expect(config).toContain(`key: '${key}'`);
      expect(body).toContain(`rightPanel === '${key}'`);
    }

    expect(noteView).toContain("import { KnowledgeContextPanel, type KnowledgeContextTab } from './features/knowledge/components/KnowledgeContextPanel';");
    expect(noteView).toContain('NoteContextPanelBody');
    expect(noteView).toContain('knowledgeIndexService');
    expect(noteView).toContain('registerSearchNoteHandlers');
    expect(noteView).toContain('parseQuery');
    expect(noteView).not.toMatch(/import\([^)]*(DiscoveryPanel|TimelinePanel|NoteRelationsPanel)/);

    expect(body).toContain("import { DiscoveryPanel } from '../features/knowledge/components/DiscoveryPanel';");
    expect(body).toContain("import { TimelinePanel } from '../features/knowledge/components/TimelinePanel';");
    expect(body).toContain('NoteRelationsPanel');
    expect(body).not.toContain('lazy(');
    expect(body).toContain("rightPanel === 'discover'");
    expect(body).toContain("rightPanel === 'timeline'");
    expect(body).toContain("rightPanel === 'relations'");

    expect(gates).toContain("tab === 'discover'");
    expect(gates).toContain("tab === 'timeline'");
    expect(gates).toContain("tab === 'relations'");
    expect(dashboardHook).toContain('discoverEnabled');
    expect(dashboardHook).toContain('timelineEnabled');
    expect(panelsHook).toContain('knowledgeIndexService');
    expect(panelsHook).toContain('buildNoteIntelligenceSnapshot');

    const directCandidateSources = [
      'views/features/knowledge/components/DiscoveryPanel.tsx',
      'views/features/knowledge/components/TimelinePanel.tsx',
      'views/features/knowledge/components/NoteRelationsPanel.tsx',
    ];
    for (const sourcePath of directCandidateSources) {
      expect(sourceAt(sourcePath).length).toBeGreaterThan(0);
    }
  });

  it('keeps the editor and Notes authority eager until explicit candidate activation', async () => {
    const trace = newTrace();
    const pending = deferred<PanelModule>();
    mounted = mountHarness({
      initial: initialState(),
      trace,
      loaders: panelLoaders(trace, { discover: () => pending.promise }),
    });

    expect(trace.importerCalls.discover).toBe(0);
    expect(mounted.host.querySelector('[data-testid="editor-surface"]')).not.toBeNull();
    expect(mounted.host.querySelector('[data-testid="authority"]')).not.toBeNull();

    await act(async () => mounted?.controller.patch?.({ showRightPanel: true, activePanel: 'discover' }));
    expect(trace.importerCalls.discover).toBe(1);
    expect(mounted.host.querySelector('[data-testid="panel-loading"]')?.getAttribute('data-loading-scope')).toBe('panel-body');
    expect(mounted.host.querySelector('[data-testid="editor-surface"]')).not.toBeNull();
    expect(trace.authorityInitializations).toBe(1);
    expect(trace.startupRuns).toBe(1);

    pending.resolve(panelModule('discover', trace));
    await flush();
    expect(mounted.host.querySelector('[data-testid="knowledge-panel"]')?.getAttribute('data-note-id')).toBe('note-1');
    expect(mounted.host.querySelector('[data-testid="knowledge-panel"]')?.getAttribute('data-account-id')).toBe('account-a');
    expect(trace.moduleFactoryCalls.discover).toBe(1);
    expect(trace.uncaughtErrors).toHaveLength(0);
  });

  it('reuses successful panel modules while panel switching leaves the editor mounted', async () => {
    const trace = newTrace();
    mounted = mountHarness({
      initial: initialState({ showRightPanel: true }),
      trace,
      loaders: panelLoaders(trace),
    });
    await flush();
    expect(trace.importerCalls.discover).toBe(1);
    expect(trace.moduleFactoryCalls.discover).toBe(1);

    await act(async () => mounted?.controller.patch?.({ activePanel: 'toc' }));
    expect(mounted.host.querySelector('[data-testid="eager-context-panel"]')).not.toBeNull();
    await act(async () => mounted?.controller.patch?.({ activePanel: 'discover' }));
    await flush();
    await act(async () => mounted?.controller.patch?.({ activePanel: 'timeline' }));
    await flush();
    await act(async () => mounted?.controller.patch?.({ activePanel: 'discover' }));
    await flush();

    expect(trace.importerCalls.discover).toBe(1);
    expect(trace.moduleFactoryCalls.discover).toBe(1);
    expect(trace.importerCalls.timeline).toBe(1);
    expect(trace.editorMounts).toBe(1);
    expect(trace.editorUnmounts).toBe(0);
    expect(mounted.host.querySelector('[data-testid="knowledge-panel"]')?.getAttribute('data-panel')).toBe('discover');
  });

  it('delivers the current note when a candidate resolves after an N1 to N2 switch', async () => {
    const trace = newTrace();
    const pending = deferred<PanelModule>();
    mounted = mountHarness({
      initial: initialState({ noteId: 'note-1', showRightPanel: true }),
      trace,
      loaders: panelLoaders(trace, { discover: () => pending.promise }),
    });

    expect(trace.importerCalls.discover).toBe(1);
    await act(async () => mounted?.controller.patch?.({ noteId: 'note-2' }));
    pending.resolve(panelModule('discover', trace));
    await flush();

    expect(mounted.host.querySelector('[data-testid="knowledge-panel"]')?.getAttribute('data-note-id')).toBe('note-2');
    expect(trace.panelRenders.every(render => render.noteId === 'note-2')).toBe(true);
    expect(trace.panelRenders.some(render => render.noteId === 'note-1')).toBe(false);
    expect(trace.authorityInitializations).toBe(1);
  });

  it('does not let a late P1 result replace the active P2 panel', async () => {
    const trace = newTrace();
    const p1 = deferred<PanelModule>();
    const p2 = deferred<PanelModule>();
    mounted = mountHarness({
      initial: initialState({ showRightPanel: true, activePanel: 'discover' }),
      trace,
      loaders: panelLoaders(trace, { discover: () => p1.promise, timeline: () => p2.promise }),
    });

    await act(async () => mounted?.controller.patch?.({ activePanel: 'timeline' }));
    expect(trace.importerCalls.discover).toBe(1);
    expect(trace.importerCalls.timeline).toBe(1);

    p1.resolve(panelModule('discover', trace));
    await flush();
    expect(mounted.host.querySelector('[data-testid="knowledge-panel"]')).toBeNull();
    expect(trace.panelMounts.discover).toBe(0);
    expect(trace.panelRenders.some(render => render.panel === 'discover')).toBe(false);

    p2.resolve(panelModule('timeline', trace));
    await flush();
    expect(mounted.host.querySelector('[data-testid="knowledge-panel"]')?.getAttribute('data-panel')).toBe('timeline');
    expect(trace.panelRenders.some(render => render.panel === 'discover')).toBe(false);

    await act(async () => mounted?.controller.patch?.({ activePanel: 'discover' }));
    await flush();
    expect(trace.importerCalls.discover).toBe(1);
    expect(mounted.host.querySelector('[data-testid="knowledge-panel"]')?.getAttribute('data-panel')).toBe('discover');
  });

  it('resolves under the current account after an A to B switch without account capture in the importer', async () => {
    const trace = newTrace();
    const pending = deferred<PanelModule>();
    mounted = mountHarness({
      initial: initialState({ accountId: 'account-a', noteId: 'note-a', showRightPanel: true }),
      trace,
      loaders: panelLoaders(trace, { relations: () => pending.promise }),
    });

    await act(async () => mounted?.controller.patch?.({ activePanel: 'relations' }));
    await act(async () => mounted?.controller.patch?.({ accountId: 'account-b', noteId: 'note-b' }));
    pending.resolve(panelModule('relations', trace));
    await flush();

    const panel = mounted.host.querySelector('[data-testid="knowledge-panel"]');
    expect(panel?.getAttribute('data-account-id')).toBe('account-b');
    expect(panel?.getAttribute('data-note-id')).toBe('note-b');
    expect(trace.panelRenders.some(render => render.accountId === 'account-a')).toBe(false);
    expect(trace.importerCalls.relations).toBe(1);
    expect(trace.authorityInitializations).toBe(1);
  });

  it('unmounts a pending panel on Notes route deactivation without changing startup or authority', async () => {
    const trace = newTrace();
    const pending = deferred<PanelModule>();
    mounted = mountHarness({
      initial: initialState({ showRightPanel: true }),
      trace,
      loaders: panelLoaders(trace, { timeline: () => pending.promise }),
    });
    await act(async () => mounted?.controller.patch?.({ activePanel: 'timeline' }));
    expect(trace.importerCalls.timeline).toBe(1);

    await act(async () => mounted?.controller.patch?.({ routeActive: false }));
    pending.resolve(panelModule('timeline', trace));
    await flush();
    expect(mounted.host.querySelector('[data-testid="knowledge-panel"]')).toBeNull();
    expect(trace.panelMounts.timeline).toBe(0);
    expect(trace.startupRuns).toBe(1);
    expect(trace.authorityInitializations).toBe(1);
    expect(trace.authorityDetachments).toBe(0);

    await act(async () => mounted?.controller.patch?.({ routeActive: true, showRightPanel: true }));
    await flush();
    expect(mounted.host.querySelector('[data-testid="knowledge-panel"]')?.getAttribute('data-panel')).toBe('timeline');
    expect(trace.importerCalls.timeline).toBe(1);
  });

  it('keeps MODULE_NOT_READY separate from READY_EMPTY and READY_WITH_RESULTS', async () => {
    const trace = newTrace();
    const pending = deferred<PanelModule>();
    mounted = mountHarness({
      initial: initialState({ showRightPanel: true, resultState: 'empty' }),
      trace,
      loaders: panelLoaders(trace, { discover: () => pending.promise }),
    });

    expect(mounted.host.querySelector('[data-testid="panel-loading"]')).not.toBeNull();
    expect(mounted.host.querySelector('[data-testid="knowledge-panel"]')).toBeNull();

    pending.resolve({
      default: ({ accountId, noteId, resultState }: PanelProps) => createElement(
        'div',
        {
          'data-testid': 'knowledge-panel',
          'data-panel': 'discover',
          'data-account-id': accountId,
          'data-note-id': noteId,
          'data-panel-state': resultState === 'empty' ? 'READY_EMPTY' : 'READY_WITH_RESULTS',
        },
        resultState,
      ),
    });
    await flush();
    expect(mounted.host.querySelector('[data-testid="knowledge-panel"]')?.getAttribute('data-panel-state')).toBe('READY_EMPTY');
    expect(mounted.host.querySelector('[data-testid="panel-loading"]')).toBeNull();

    await act(async () => mounted?.controller.patch?.({ resultState: 'results' }));
    expect(mounted.host.querySelector('[data-testid="knowledge-panel"]')?.getAttribute('data-panel-state')).toBe('READY_WITH_RESULTS');
  });

  it('contains rejection at a panel boundary and proves same-identity rejection caching plus fresh retry recovery', async () => {
    const trace = newTrace();
    let attempts = 0;
    const loader: PanelLoader = async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('ChunkLoadError: context panel unavailable');
      return panelModule('discover', trace);
    };
    mounted = mountHarness({
      initial: initialState({ showRightPanel: true }),
      trace,
      loaders: panelLoaders(trace, { discover: loader }),
    });
    await flush();

    expect(mounted.host.querySelector('[data-testid="panel-error"]')).not.toBeNull();
    expect(mounted.host.querySelector('[data-testid="editor-surface"]')).not.toBeNull();
    expect(trace.boundaryCaught).toBe(1);
    expect(trace.importerCalls.discover).toBe(1);

    await act(async () => mounted?.controller.patch?.({ showRightPanel: false }));
    await act(async () => mounted?.controller.patch?.({ showRightPanel: true }));
    await flush();
    expect(trace.importerCalls.discover).toBe(1);
    expect(mounted.host.querySelector('[data-testid="panel-error"]')).not.toBeNull();

    await act(async () => {
      (mounted?.host.querySelector('[data-testid="panel-retry"]') as HTMLButtonElement)?.click();
    });
    await flush();
    expect(trace.importerCalls.discover).toBe(2);
    expect(trace.moduleFactoryCalls.discover).toBe(1);
    expect(mounted.host.querySelector('[data-testid="knowledge-panel"]')).not.toBeNull();
    expect(trace.authorityInitializations).toBe(1);
    expect(trace.startupRuns).toBe(1);
    expect(trace.authorityDetachments).toBe(0);
  });

  it('keeps note and account switches data-safe after a panel error and resets only the module identity', async () => {
    const trace = newTrace();
    let attempts = 0;
    const loader: PanelLoader = async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('ChunkLoadError: offline panel');
      return panelModule('discover', trace);
    };
    mounted = mountHarness({
      initial: initialState({ accountId: 'account-a', noteId: 'note-a', showRightPanel: true }),
      trace,
      loaders: panelLoaders(trace, { discover: loader }),
    });
    await flush();
    expect(mounted.host.querySelector('[data-testid="panel-error"]')?.getAttribute('data-error-note-id')).toBe('note-a');

    await act(async () => mounted?.controller.patch?.({ noteId: 'note-b' }));
    await flush();
    expect(mounted.host.querySelector('[data-testid="knowledge-panel"]')).toBeNull();
    expect(mounted.host.querySelector('[data-testid="panel-error"]')?.getAttribute('data-error-note-id')).toBe('note-b');

    await act(async () => mounted?.controller.patch?.({ accountId: 'account-b' }));
    await flush();
    expect(mounted.host.querySelector('[data-testid="knowledge-panel"]')).toBeNull();
    expect(mounted.host.querySelector('[data-testid="panel-error"]')?.getAttribute('data-error-account-id')).toBe('account-b');
    expect(trace.panelRenders).toHaveLength(0);

    await act(async () => {
      (mounted?.host.querySelector('[data-testid="panel-retry"]') as HTMLButtonElement)?.click();
    });
    await flush();
    const panel = mounted.host.querySelector('[data-testid="knowledge-panel"]');
    expect(panel?.getAttribute('data-account-id')).toBe('account-b');
    expect(panel?.getAttribute('data-note-id')).toBe('note-b');
    expect(trace.importerCalls.discover).toBe(2);
    expect(trace.panelRenders.every(render => render.accountId === 'account-b' && render.noteId === 'note-b')).toBe(true);
  });

  it('keeps local-only authority and editor usable when an uncached panel chunk rejects offline', async () => {
    const trace = newTrace();
    const loader: PanelLoader = async () => {
      throw new Error('ChunkLoadError: offline uncached panel');
    };
    mounted = mountHarness({
      initial: initialState({ showRightPanel: true }),
      trace,
      loaders: panelLoaders(trace, { relations: loader }),
      localOnly: true,
    });
    await act(async () => mounted?.controller.patch?.({ activePanel: 'relations' }));
    await flush();

    expect(mounted.host.querySelector('[data-testid="panel-error"]')).not.toBeNull();
    expect(mounted.host.querySelector('[data-testid="editor-surface"]')).not.toBeNull();
    expect(mounted.host.querySelector('[data-testid="notes-shell"]')?.getAttribute('data-local-only')).toBe('true');
    expect(mounted.host.querySelector('[data-testid="notes-shell"]')?.getAttribute('data-remote-requests')).toBe('0');
    await act(async () => mounted?.controller.patch?.({ activePanel: 'toc' }));
    expect(mounted.host.querySelector('[data-testid="eager-context-panel"]')).not.toBeNull();
    expect(trace.authorityInitializations).toBe(1);
  });

  it('keeps Search/index authority outside the future panel boundary', () => {
    const noteView = sourceAt('views/NoteView.tsx');
    const panelsHook = sourceAt('views/noteview/useNoteViewPanels.ts');
    const dashboardHook = sourceAt('views/noteview/useNoteViewDashboard.ts');
    expect(noteView).toContain('knowledgeIndexService');
    expect(noteView).toContain('hasKnowledgeQuerySyntax');
    expect(noteView).toContain('registerSearchNoteHandlers');
    expect(panelsHook).toContain("from '../features/knowledge'");
    expect(dashboardHook).toContain("from '../features/knowledge'");
    expect(noteView).not.toContain("import('./features/knowledge/KnowledgeIndexService')");
  });
});
