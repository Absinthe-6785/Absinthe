// @vitest-environment happy-dom
import { createElement, StrictMode, useEffect, useLayoutEffect } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEmptyRoutinePreset,
  createRoutinePresetState,
  DEFAULT_ROUTINE_PRESET_ID,
  readRoutinePresetState,
  writeRoutinePresetState,
} from './features/health/routinePresets';
import { getRoutinePlannedSetsForDay } from './features/health/routinePlannedSets';


// Read actual named React state and effect boundaries; never replace state results/setters.
vi.mock('react', async importOriginal => {
  const real = await importOriginal<typeof import('react')>();
  const fs = await import('node:fs');
  const source = fs.readFileSync('src/components/views/HealthView.tsx', 'utf8').split(/\r?\n/);
  const savingLine = source.findIndex(line => line.includes('const [isSaving, setIsSaving] = useState')) + 1;
  const lockedLine = source.findIndex(line => line.includes('const [isWorkoutLocked, setIsWorkoutLocked] = useState')) + 1;
  return { ...real,
    useState: ((...args: any[]) => {
      const value = (real.useState as any)(...args);
      const line = new Error().stack?.match(/HealthView\.tsx:(\d+):/)?.[1];
      if (Number(line) === savingLine) mocks.saving = value[0];
      if (Number(line) === lockedLine) mocks.locked = value[0];
      const baselineLine = Number(new Error().stack?.match(/HealthViewBaseline\.js:(\d+):/)?.[1]);
      if (baselineLine === mocks.baselineSavingLine) mocks.saving = value[0];
      if (baselineLine === mocks.baselineLockedLine) mocks.locked = value[0];
      return value;
    }) as typeof real.useState,
    useLayoutEffect: ((effect: () => void | (() => void), deps?: readonly unknown[]) => {
      const owned = new Error().stack?.includes('useHealthWorkoutOperationLifetime.ts:');
      return real.useLayoutEffect(() => {
        if (owned) {
          mocks.events.push({ phase: 'owner-setup-begin', deps });
          if (mocks.invokeBeforePublication) { mocks.invokeBeforePublication = false; void mocks.saveCallback?.(); }
        }
        const cleanup = effect();
        if (owned) mocks.events.push({ phase: 'owner-setup-end', authority: mocks.owner?.getCurrent() });
        return () => {
          cleanup?.();
          if (owned) mocks.events.push({ phase: 'owner-cleanup-end', authority: mocks.owner?.getCurrent() });
        };
      }, deps);
    }) as typeof real.useLayoutEffect,
    useEffect: ((effect: () => void | (() => void), deps?: readonly unknown[]) => {
      const draft = new Error().stack?.includes('useHealthWorkoutDraft.ts:');
      return real.useEffect(() => {
        if (draft) mocks.events.push({ phase: 'draft-passive-start', deps });
        const cleanup = effect();
        if (draft) mocks.events.push({ phase: 'draft-passive-end', deps });
        return cleanup;
      }, deps);
    }) as typeof real.useEffect,
  };
});

const mocks = vi.hoisted(() => ({
  remoteMode: true,
  baselineSavingLine: -1,
  baselineLockedLine: -1,
  realPersistence: false,
  fault: '' as string,
  draft: null as any,
  owner: null as any,
  saving: undefined as boolean | undefined,
  locked: undefined as boolean | undefined,
  saveCallback: null as null | (() => Promise<void>),
  invokeBeforePublication: false,
  events: [] as any[],
  inputs: [] as any[],
  dispatches: [] as any[],
  commits: [] as any[],
  factoryGate: null as null | { promise: Promise<void>; release: () => void },
  commitGate: null as null | { promise: Promise<void>; release: () => void },
  repositoryFactory: vi.fn(),
  mobile: false,
  authFetch: vi.fn(),
  showToast: vi.fn(),
  mutateDaily: vi.fn(),
  mutateStatic: vi.fn(),
  // One stable bound mutate per actual SWR key, not one fabricated per render.
  swrMutators: new Map<string, (...args: unknown[]) => Promise<undefined>>(),
  cacheEffects: [] as Array<{ sequence: number; target: string; key: unknown; args: unknown[] }>,
  deleteHealthWorkout: vi.fn(),
  saveHealthWorkouts: vi.fn(),
  showConfirm: vi.fn(),
  clearConfirm: vi.fn(),
  confirmModal: {
    current: null as {
      message: string;
      onConfirm: () => void | Promise<void>;
      onCancel: () => void;
    } | null,
  },
  notesState: {
    notes: [],
    createNote: vi.fn(),
    updateNote: vi.fn(),
  },
}));

vi.mock('../../lib/config', () => ({ API_URL: 'https://example.test' }));
vi.mock('../../lib/supabase', () => ({
  authFetch: (...args: unknown[]) => mocks.authFetch(...args),
}));
vi.mock('../../lib/remoteBoundary', () => ({
  shouldUseRemoteData: () => mocks.remoteMode,
  remoteSWRKey: (url: string) => url,
}));
vi.mock('../../lib/fetcher', () => ({ fetcher: vi.fn(async () => []) }));
vi.mock('swr', () => ({
  default: (key: unknown) => {
    const identity = JSON.stringify(key);
    if (!mocks.swrMutators.has(identity)) {
      const boundKey = structuredClone(key);
      mocks.swrMutators.set(identity, async (...args: unknown[]) => {
        mocks.cacheEffects.push({ sequence: mocks.cacheEffects.length + 1,
          target: 'swr-bound-mutate', key: boundKey, args: structuredClone(args) });
        return undefined;
      });
    }
    return { data: [], mutate: mocks.swrMutators.get(identity), isLoading: false, error: undefined };
  },
}));
vi.mock('../../hooks/useEscapeKey', () => ({ useEscapeKey: vi.fn() }));
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => mocks.mobile }));
vi.mock('../../hooks/useSwipeNavigation', () => ({ useSwipeNavigation: () => vi.fn() }));
vi.mock('../../store/useAppStore', () => ({
  useAppStore: () => ({ weightUnits: {}, toggleWeightUnit: vi.fn() }),
}));
vi.mock('../../store/useNotesStore', () => ({
  useNotesStore: (selector: (state: typeof mocks.notesState) => unknown) => selector(mocks.notesState),
}));
vi.mock('../../lib/noteNavigation', () => ({
  openHealthDayNote: vi.fn(),
  openNote: vi.fn(),
  openWorkspaceSearch: vi.fn(),
  switchToTab: vi.fn(),
}));
vi.mock('./features/search/searchDomainNavigation', () => ({ registerSearchDomainHandlers: vi.fn() }));
vi.mock('./features/health/healthWorkoutPersistence', async importOriginal => {
  const real = await importOriginal<typeof import('./features/health/healthWorkoutPersistence')>();
  return { ...real,
    saveHealthWorkouts: (input: Parameters<typeof real.saveHealthWorkouts>[0]) => {
      mocks.inputs.push({ kind: 'save', input });
      return mocks.realPersistence ? real.saveHealthWorkouts({ ...input,
        dependencies: { createLocalHealthRepository: mocks.repositoryFactory, authFetch: mocks.authFetch } })
        : mocks.saveHealthWorkouts(input);
    },
    deleteHealthWorkout: (input: Parameters<typeof real.deleteHealthWorkout>[0]) => {
      mocks.inputs.push({ kind: 'delete', input });
      return mocks.realPersistence ? real.deleteHealthWorkout({ ...input,
        dependencies: { createLocalHealthRepository: mocks.repositoryFactory, authFetch: mocks.authFetch } })
        : mocks.deleteHealthWorkout(input);
    },
  };
});
vi.mock('../../lib/syncAuthority', () => ({ domainUsesLocalWorkingCopy: () => !mocks.remoteMode }));
vi.mock('../../lib/healthLocalRuntime', () => ({
  createLocalHealthRepository: vi.fn(async () => ({ saveRoutine: vi.fn() })),
  readLocalHealthWorkoutRange: vi.fn(async () => []),
  readLocalPreviousWorkoutRows: vi.fn(async () => []),
}));
vi.mock('../../lib/healthRoutineSync', () => ({
  productionHealthRoutinePersistence: {
    bootstrap: async ({ legacyState }: { legacyState: unknown }) => legacyState,
    commitState: async (_accountId: string, _previous: unknown, next: unknown) => next,
    sync: async () => null,
    snapshot: async () => null,
    reset: async () => createRoutinePresetState({ routines: [], splitCount: 3 }),
    recover: async (_accountId: string, recovered: unknown) => recovered,
  },
}));
vi.mock('../../lib/healthBackfillUiSafety', async importOriginal => {
  const real = await importOriginal<typeof import('../../lib/healthBackfillUiSafety')>();
  return { ...real, readLocalHealthWorkoutDraft: (...args: Parameters<typeof real.readLocalHealthWorkoutDraft>) => {
    const value = real.readLocalHealthWorkoutDraft(...args);
    mocks.events.push({ phase: 'real-read', account: args[1], date: args[2], value });
    return mocks.fault === 'restore' && value?.length ? null : value;
  } };
});
vi.mock('./features/health/useHealthWorkoutDraft', async importOriginal => {
  const real = await importOriginal<typeof import('./features/health/useHealthWorkoutDraft')>();
  return { ...real, useHealthWorkoutDraft: (options: Parameters<typeof real.useHealthWorkoutDraft>[0]) => {
    const value = real.useHealthWorkoutDraft({ ...options, onDraftRestored: () => {
      mocks.events.push({ phase: 'restored', date: options.dateKey }); options.onDraftRestored?.();
    } });
    mocks.draft = value;
    useLayoutEffect(() => {
      if (mocks.fault === 'dirty-guard') value.isDirtyRef.current = false;
      mocks.events.push({ phase: 'draft-commit', date: options.dateKey, rows: structuredClone(value.localWorkouts),
        dirty: value.isDirty, dirtyRef: value.isDirtyRef.current });
    });
    return value;
  } };
});
vi.mock('./features/health/useHealthWorkoutOperationLifetime', async importOriginal => {
  const real = await importOriginal<typeof import('./features/health/useHealthWorkoutOperationLifetime')>();
  return { ...real, useHealthWorkoutOperationLifetime: (...args: Parameters<typeof real.useHealthWorkoutOperationLifetime>) => {
    const value = real.useHealthWorkoutOperationLifetime(...args);
    mocks.owner = value;
    useLayoutEffect(() => {
      mocks.events.push({ phase: 'binding-commit', date: args[2], publication: value.publication, current: value.getCurrent() });
    });
    return value;
  } };
});
vi.mock('./features/health/recovery/recoveryNotes', () => ({ getRecoveryEntry: () => null }));
vi.mock('./k102DateFormat', () => ({
  formatAbsoluteDateKey: (value: Date | string) => value instanceof Date ? value.toISOString().slice(0, 10) : value,
  formatLongDate: (value: Date) => value.toISOString().slice(0, 10),
}));
vi.mock('./features/health/buildHealthProjection', () => ({ buildHealthProjection: () => ({ workoutDates: [] }) }));
vi.mock('./features/health/computeWorkoutPrBadge', () => ({ computeWorkoutPrBadgeMap: () => ({}) }));
vi.mock('./features/health/prevWorkoutFetch', () => ({ fetchPrevWorkoutForBlocks: vi.fn(async () => ({})) }));
vi.mock('./features/health/previousWorkoutSession', () => ({
  normalizePreviousWorkoutRows: (rows: unknown[]) => rows,
  previousWorkoutRange: () => ({ startDate: '2026-01-01', endDate: '2026-01-10' }),
  defaultPreviousWorkoutDateFromDates: (dates: string[]) => [...dates].sort().at(-1) ?? null,
}));
vi.mock('./features/health/previousWorkoutProjection', () => ({
  buildPreviousWorkoutHistoryProjection: () => ({ sessions: [], automaticDate: null, effectiveDate: null, session: null }),
}));
vi.mock('./features/health/previousMicroCue', () => ({
  formatPreviousBestCue: () => '',
  formatPreviousSetReference: () => '',
  matchPreviousSetReference: () => null,
}));
vi.mock('./features/health/healthSectionPrefs', () => ({ readHealthSectionPrefs: () => ({}) }));
vi.mock('../../lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key === 'healthPresetDeleteConfirm' ? 'Delete {name}' : key,
    lang: 'en',
  }),
}));
vi.mock('../common/ConfirmModal', () => ({
  ConfirmModal: ({
    message,
    onConfirm,
    onCancel,
    confirmLabel,
  }: {
    message: string;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
    confirmLabel?: string;
  }) => {
    mocks.confirmModal.current = { message, onConfirm, onCancel };
    useEffect(() => () => {
      if (mocks.confirmModal.current?.onConfirm === onConfirm) {
        mocks.confirmModal.current = null;
      }
    }, [onConfirm]);
    return createElement(
      'div',
      { role: 'dialog', 'data-testid': 'health-confirm-modal' },
      createElement('p', {}, message),
      createElement('button', { type: 'button', 'data-testid': 'health-confirm-cancel', onClick: onCancel }, 'Cancel'),
      createElement('button', { type: 'button', 'data-testid': 'health-confirm-accept', onClick: onConfirm }, confirmLabel ?? 'Confirm'),
    );
  },
}));
vi.mock('../common/WorkspaceCardSkeleton', () => ({ WorkspaceCardSkeleton: () => null }));
vi.mock('../common/WorkspaceErrorBoundary', () => ({
  WorkspaceErrorBoundary: ({ children }: { children: unknown }) => children,
}));
vi.mock('../common/WorkspacePageHeader', () => ({ WorkspacePageHeader: () => null }));
vi.mock('../common/WorkspaceToolbar', () => ({
  WorkspaceToolbar: ({ children }: { children: unknown }) => createElement('div', {}, children),
  WorkspaceToolbarPrimary: ({ label, onClick, disabled }: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  }) => {
    mocks.saveCallback = onClick as () => Promise<void>;
    return createElement('button', {
    type: 'button',
    disabled,
    onClick,
    'data-testid': 'health-save-workout',
  }, label);
  },
}));
vi.mock('./features/health/HealthWorkspaceNav', () => ({
  HEALTH_WORKSPACE_SECTIONS: [{ id: 'workout' }],
  HealthWorkspaceNav: () => null,
}));
vi.mock('./features/health/nutrition', () => ({ ProteinTracker: () => null }));
vi.mock('./features/health/HealthBlockLibrary', () => ({
  HealthBlockLibrary: ({ blocks, onAddToToday }: {
    blocks: Array<{ id: string; name: string }>;
    onAddToToday: (block: { id: string; name: string }) => void;
  }) => createElement(
    'section',
    { 'data-health-test-region': 'library' },
    ...blocks.map(block => createElement('button', {
      key: block.id,
      type: 'button',
      onClick: () => onAddToToday(block),
    }, block.name)),
  ),
}));
vi.mock('./features/health/HealthSupportingPanels', () => ({
  HealthSupportingPanels: () => createElement(
    'div',
    { 'data-health-test-region': 'support-panels' },
    createElement('section', {}, 'Calendar'),
    createElement('section', {}, 'InBody'),
    createElement('section', {}, 'Protein'),
  ),
}));
vi.mock('./features/health/WorkoutPrBadge', () => ({ WorkoutPrBadge: () => null }));
vi.mock('./features/health/PreviousWorkoutView', () => ({ PreviousWorkoutView: () => null }));
vi.mock('./features/health/PreviousWorkoutSheet', () => ({ PreviousWorkoutSheet: () => null }));
vi.mock('./features/health/HealthMobileWorkoutActions', () => ({
  HealthMobileWorkoutActions: ({ isWorkoutLocked }: { isWorkoutLocked: boolean }) => {
    mocks.locked = isWorkoutLocked;
    return null;
  },
}));


import { HealthView } from './HealthView';
let subject = HealthView;
import type { HealthProps, Workout, ExerciseBlock } from '../../types';
import { localHealthDraftKey } from '../../lib/healthBackfillUiSafety';

const A = 'account-a', B = 'account-b', X = '2026-01-10', Y = '2026-01-11', Z = '2026-01-12';
const date = (key: string) => new Date(key + 'T00:00:00Z');
const blocks: ExerciseBlock[] = [
  { id: 'push', name: 'Push', type: 'strength', tags: [], cardio_mode: 'both' },
  { id: 'pull', name: 'Pull', type: 'strength', tags: [], cardio_mode: 'both' },
];
function row(id = '11111111-1111-4111-8111-111111111111', kg = '20', block = blocks[0]!): Workout {
  return { id, block_id: block.id, exercise_blocks: { ...block }, local_version: 'v1',
    sets: [{ type: 'strength', set: 1, kg, reps: '5', done: true }] };
}
const DRAFT_X = [row()], DRAFT_Y = [row('22222222-2222-4222-8222-222222222222', '45', blocks[1]!)];
const DRAFT_Z = [row('33333333-3333-4333-8333-333333333333', '70')];
const HYDRATED = [row('44444444-4444-4444-8444-444444444444', '99')];
const FRESH_HYDRATED = [row('44444444-4444-4444-8444-444444444444', '101')];
class ByteStorage implements Storage {
  private bytes = new Map<string, string>();
  history: Array<{ op: string; key: string; value?: string }> = [];
  wrongKeyFault = false;
  get length() { return this.bytes.size; }
  key(index: number) { return [...this.bytes.keys()][index] ?? null; }
  clear() { this.bytes.clear(); }
  getItem(key: string) {
    if (this.wrongKeyFault && key === localHealthDraftKey(A, Y)) {
      this.wrongKeyFault = false;
      this.setItem(key, JSON.stringify(DRAFT_X));
    }
    this.history.push({ op: 'get', key });
    return this.bytes.get(key) ?? null;
  }
  setItem(key: string, value: string) { this.bytes.set(key, String(value)); this.history.push({ op: 'set', key, value: String(value) }); }
  removeItem(key: string) { this.bytes.delete(key); this.history.push({ op: 'remove', key }); }
}
function deferred<T = void>() {
  let release!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, fail) => { release = resolve; reject = fail; });
  return { promise, release, reject };
}
let storage: ByteStorage, root: Root | null, host: HTMLDivElement, props: HealthProps;
let raf: Array<FrameRequestCallback>;
let strictMode = false;
function healthProps(overrides: Partial<HealthProps> = {}): HealthProps {
  return { now: {} as HealthProps['now'], currentDate: date(X), selectedDate: date(X),
    setCurrentDate: vi.fn(), setSelectedDate: vi.fn(),
    formatDate: (value: Date | HealthProps['now']) => value instanceof Date ? value.toISOString().slice(0, 10) : X,
    isToday: () => true, showToast: mocks.showToast, appSettings: { darkMode: false } as HealthProps['appSettings'],
    updateSetting: vi.fn(), theme: { card: 'card', input: 'input', border: 'border', text: 'text', textMuted: 'muted', hoverBg: 'hover' },
    THEME_COLORS: [], mutateDaily: mocks.mutateDaily, mutateStatic: mocks.mutateStatic,
    user: { id: A, name: 'A' }, schedules: [], weeklySchedules: [], workouts: [], healthBlocks: blocks,
    healthRoutines: [], inbody: {} as HealthProps['inbody'], isDailyLoading: false, ...overrides };
}
async function render(overrides: Partial<HealthProps> = {}) {
  props = props ? { ...props, ...overrides } : healthProps(overrides);
  if (!root) root = createRoot(host);
  await act(async () => {
    const tree = createElement(subject, props);
    root!.render(strictMode ? createElement(StrictMode, null, tree) : tree);
  });
}
function seed() {
  for (const [key, value] of [[localHealthDraftKey(A, X), DRAFT_X], [localHealthDraftKey(A, Y), DRAFT_Y], [localHealthDraftKey(B, Z), DRAFT_Z]] as const)
    storage.setItem(key, JSON.stringify(value));
  return Object.fromEntries([localHealthDraftKey(A, X), localHealthDraftKey(A, Y), localHealthDraftKey(B, Z)]
    .map(key => [key, storage.getItem(key)!]));
}
function assertBytes(before: Record<string, string>) {
  for (const [key, value] of Object.entries(before)) {
    if (storage.getItem(key) !== value) throw new Error('preservation: stored draft bytes under ' + key);
    for (const event of storage.history.filter(event => event.key === key && event.op !== 'get')) {
      if (event.op !== 'set' || event.value !== value) throw new Error('preservation: intermediate stored draft write under ' + key);
    }
  }
}
function snapshot() {
  if (!mocks.draft || mocks.saving === undefined || mocks.locked === undefined) throw new Error('real state observer not attached');
  return { rows: structuredClone(mocks.draft.localWorkouts) as Workout[], dirty: mocks.draft.isDirty as boolean,
    dirtyRef: mocks.draft.isDirtyRef.current as boolean, saving: mocks.saving, locked: mocks.locked,
    bytes: storage.getItem(localHealthDraftKey(props.user.id, props.formatDate(props.selectedDate))), toasts: [...mocks.showToast.mock.calls],
    cacheCalls: [mocks.mutateDaily.mock.calls.length, mocks.mutateStatic.mock.calls.length],
    cacheEffects: structuredClone(mocks.cacheEffects) };
}
// Assert the contract independently on BOTH subjects as well as comparing logs.
// The test's date formatter is UTC; JS constructs month endpoints in local time,
// exactly as the existing UI contract does (including on Windows in Asia/Seoul).
function expectedCacheEffects(count: number) {
  const start = new Date(2026, 0, 1).toISOString().slice(0, 10);
  const end = new Date(2026, 1, 0).toISOString().slice(0, 10);
  return Array.from({ length: count }, (_, index) => [
    { sequence: index * 3 + 1, target: 'daily', key: [A, X], args: [] },
    { sequence: index * 3 + 2, target: 'swr-bound-mutate',
      key: ['local-health-workout-range', A, start, end], args: [] },
    { sequence: index * 3 + 3, target: 'static', key: [A], args: [] },
  ]).flat();
}
function assertFreshHydration(expected: Workout[]) {
  expect(snapshot(), 'R02_FRESH_HYDRATION_ORACLE:actual rows/dirty/storage').toMatchObject({
    rows: expected, dirty: false, dirtyRef: false, saving: false, locked: true, bytes: null,
  });
  // Rendered output, not only delivered props or the transparent hook observer.
  const input = host.querySelector<HTMLInputElement>('[data-k126-workout-exercise-card] input[inputmode="decimal"]');
  const set = expected[0].sets[0];
  expect(input?.value, 'R02_FRESH_HYDRATION_ORACLE:rendered kg').toBe('kg' in set ? String(set.kg) : undefined);
  expect(props.user.id).toBe(A); expect(props.formatDate(props.selectedDate)).toBe(X);
  expect(storage.history.filter(event => event.op !== 'get' && event.key === localHealthDraftKey(A, X))).toEqual([]);
}
function assertRestored(expected: Workout[]) {
  const state = snapshot();
  if (JSON.stringify(state.rows) !== JSON.stringify(expected) || !state.dirty || !state.dirtyRef)
    throw new Error('preservation: restored dirty rows');
  expect(state.saving).toBe(false); expect(state.locked).toBe(false);
}
function button(text: string) {
  const value = [...host.querySelectorAll('button')].find(node => node.textContent?.trim() === text);
  if (!value) throw new Error('Missing button: ' + text);
  return value;
}
async function editKg(value = '31') {
  const input = host.querySelector<HTMLInputElement>('[data-k126-workout-exercise-card] input[inputmode="decimal"]');
  if (!input) throw new Error('Real weight input absent');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
function removeCallback() {
  const node = host.querySelector<HTMLButtonElement>('[data-k126-workout-exercise-card] button.absolute');
  if (!node) throw new Error('Real Delete button absent');
  const key = Object.keys(node).find(key => key.startsWith('__reactProps$'));
  const callback = key && (node as unknown as Record<string, { onClick: (event: unknown) => void }>)[key].onClick;
  if (!callback) throw new Error('Retained real Delete event props absent');
  return () => callback({ stopPropagation: vi.fn() });
}
async function save() { const callback = mocks.saveCallback; if (!callback) throw new Error('Save absent'); await act(async () => callback()); }
async function invoke(callback: () => unknown) { await act(async () => { void callback(); await Promise.resolve(); }); }
async function navigateABA() {
  await render({ selectedDate: date(Y) }); await render({ selectedDate: date(X) });
}
function resetFixture() {
  strictMode = false;
  subject = HealthView;
  mocks.baselineSavingLine = -1; mocks.baselineLockedLine = -1;
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  storage = new ByteStorage(); vi.stubGlobal('localStorage', storage);
  raf = []; vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { raf.push(callback); return raf.length; });
  mocks.remoteMode = true; mocks.mobile = false; mocks.realPersistence = false; mocks.fault = '';
  mocks.draft = null; mocks.owner = null; mocks.saving = undefined; mocks.locked = undefined; mocks.saveCallback = null;
  mocks.invokeBeforePublication = false; mocks.events.length = 0; mocks.inputs.length = 0;
  mocks.dispatches.length = 0; mocks.commits.length = 0; mocks.factoryGate = null; mocks.commitGate = null;
  mocks.authFetch.mockReset().mockResolvedValue(new Response(null, { status: 201 }));
  mocks.showToast.mockReset(); mocks.mutateDaily.mockReset(); mocks.mutateStatic.mockReset();
  mocks.swrMutators.clear(); mocks.cacheEffects.length = 0;
  mocks.mutateDaily.mockImplementation((...args: unknown[]) => {
    mocks.cacheEffects.push({ sequence: mocks.cacheEffects.length + 1,
      target: 'daily', key: [props.user.id, props.formatDate(props.selectedDate)], args: structuredClone(args) });
  });
  mocks.mutateStatic.mockImplementation((...args: unknown[]) => {
    mocks.cacheEffects.push({ sequence: mocks.cacheEffects.length + 1,
      target: 'static', key: [props.user.id], args: structuredClone(args) });
  });
  mocks.saveHealthWorkouts.mockReset().mockResolvedValue({ status: 'success', total: 1, succeeded: 1, failed: 0 });
  mocks.deleteHealthWorkout.mockReset().mockResolvedValue({ status: 'success' });
  mocks.repositoryFactory.mockReset().mockImplementation(async (accountId: string) => {
    await mocks.factoryGate?.promise;
    return {
      saveWorkouts: async (rows: any[]) => {
        mocks.dispatches.push({ kind: 'save', accountId, rows: structuredClone(rows) });
        await mocks.commitGate?.promise;
        mocks.commits.push({ kind: 'save', accountId });
        return rows.map((input, i) => ({ id: input.id ?? '11111111-1111-4111-8111-' + String(i + 1).padStart(12, '0'), version: 'v2', date: input.date }));
      },
      deleteWorkout: async (id: string, version: string) => {
        mocks.dispatches.push({ kind: 'delete', accountId, id, version });
        await mocks.commitGate?.promise; mocks.commits.push({ kind: 'delete', accountId });
      },
    };
  });
  mocks.showConfirm.mockReset(); mocks.clearConfirm.mockReset(); mocks.confirmModal.current = null;
  host = document.createElement('div'); document.body.appendChild(host); root = null; props = undefined as unknown as HealthProps;
}
beforeEach(resetFixture);
afterEach(() => { if (root) act(() => root!.unmount()); host.remove(); vi.unstubAllGlobals(); });

/**
 * Gate-OFF differential oracle executes the exact main HealthView, not a fake
 * lifetime hook. Reverse only this correction's frozen source hunks in memory,
 * then verify the original Git blob hash. Works with shallow hosted checkouts.
 * No production files/Git objects are written by this fixture.
 */
async function baselineSubject() {
  const { loadExactMainHealthView } = await import('../../../test-support/healthWorkoutExactMain');
  const result = await loadExactMainHealthView(specifier => import(/* @vite-ignore */ specifier));
  mocks.baselineSavingLine = result.savingLine; mocks.baselineLockedLine = result.lockedLine;
  return result.HealthView as typeof HealthView;
}

describe('gate-OFF exact-main differential draft/hydration oracle', () => {
  it('preserves baseline H01-H07 outcomes and differs only for the stale date-ABA continuation', async () => {
    const baseline = await baselineSubject();
    const execute = async (component: typeof HealthView) => {
      subject = component; props = undefined as unknown as HealthProps;
      storage = new ByteStorage(); vi.stubGlobal('localStorage', storage);
      mocks.showToast.mockReset(); mocks.mutateDaily.mockReset(); mocks.mutateStatic.mockReset();
      mocks.swrMutators.clear(); mocks.cacheEffects.length = 0;
      mocks.saveHealthWorkouts.mockReset().mockResolvedValue({ status: 'success', total: 1, succeeded: 1, failed: 0 });
      const observations: any[] = [];
      await render({ workouts: HYDRATED }); observations.push(snapshot());
      await invoke(() => button('editBtn').click()); await editKg('33');
      await render({ workouts: [...DRAFT_Y] }); observations.push(snapshot()); // dirty rejects source
      act(() => root!.unmount()); root = null; props = undefined as unknown as HealthProps;
      storage = new ByteStorage(); vi.stubGlobal('localStorage', storage);
      const bytes = seed(); await render(); assertRestored(DRAFT_X); assertBytes(bytes); observations.push(snapshot());
      const gate = deferred<any>(); mocks.saveHealthWorkouts.mockReturnValue(gate.promise);
      await invoke(() => mocks.saveCallback!()); observations.push(snapshot());
      await render({ appSettings: { ...props.appSettings, darkMode: true } }); observations.push(snapshot());
      await render({ selectedDate: date(Y) }); assertRestored(DRAFT_Y); assertBytes(bytes); observations.push(snapshot());
      await render({ selectedDate: date(X) }); assertRestored(DRAFT_X); assertBytes(bytes); observations.push(snapshot());
      const historyBefore = structuredClone(storage.history);
      await act(async () => gate.release({ status: 'success', total: 1, succeeded: 1, failed: 0 }));
      const completion = snapshot(), writes = storage.history.filter(e => e.op !== 'get');
      act(() => root!.unmount()); root = null;
      return { observations, completion, writes, historyBefore: historyBefore.filter(e => e.op !== 'get') };
    };
    const old = await execute(baseline), corrected = await execute(HealthView);
    expect(corrected.observations).toEqual(old.observations);
    expect(corrected.historyBefore).toEqual(old.historyBefore);
    expect(old.completion).toMatchObject({ dirty: false, saving: false, locked: true, bytes: null });
    expect(corrected.completion).toEqual(corrected.observations.at(-1));
    expect(corrected.writes).toEqual(corrected.historyBefore);
    expect(old.writes.some(e => e.op === 'remove' && e.key === localHealthDraftKey(A, X))).toBe(true);
  }, 30_000); // Two real mounted subjects plus an in-memory TypeScript baseline compilation.
});


type PairScenario = 'hydration' | 'restoration' | 'strict-restore' | 'save-ack' | 'delete-ack' | 'draft-delete' | 'durable-save' | 'durable-delete' | 'preservation-faults';

// Every side has a new root/storage/module registry/source owners/action queues.
// Only frozen INPUT constants are shared. No candidate observation seeds baseline.
async function directExperiment(side: 'baseline' | 'candidate', scenario: PairScenario) {
  if (root) { act(() => root!.unmount()); root = null; }
  host.remove(); vi.resetModules(); resetFixture();
  // resetModules does not invalidate Vitest's cached mock factory exports.
  // Re-evaluate the transparent owner wrapper too, so the private lifetime
  // WeakSet and HealthView's fresh scope module belong to ONE module registry.
  vi.doMock('./features/health/useHealthWorkoutOperationLifetime', async () => {
    const real = await vi.importActual<typeof import('./features/health/useHealthWorkoutOperationLifetime')>(
      './features/health/useHealthWorkoutOperationLifetime');
    return { ...real, useHealthWorkoutOperationLifetime: (...args: Parameters<typeof real.useHealthWorkoutOperationLifetime>) => {
      const value = real.useHealthWorkoutOperationLifetime(...args); mocks.owner = value;
      useLayoutEffect(() => { mocks.events.push({ phase: 'binding-commit', publication: value.publication, current: value.getCurrent() }); });
      return value;
    } };
  });
  mocks.remoteMode = false; mocks.realPersistence = true;
  const baseline = side === 'baseline' ? await baselineSubject() : null;
  subject = baseline ?? (await import('./HealthView')).HealthView;
  strictMode = scenario === 'strict-restore';
  const notifications: string[] = [], checkpoints: any[] = [];
  const notify = (account: string) => {
    expect(mocks.commits.length).toBeGreaterThan(0);
    notifications.push(account);
  };
  const input = { account: A, dates: [X, Y, Z], scenario, strictMode,
    source: JSON.stringify([HYDRATED, FRESH_HYDRATED]), initial: JSON.stringify([DRAFT_X, DRAFT_Y, DRAFT_Z]),
    mode: 'local', gates: 'all-five-literal-false', raf: 'controlled', swr: 'fresh-module/no-remote-key' };
  const observe = (label: string) => checkpoints.push({ label, ...snapshot() });
  const settleInitial = async (withDraft = true) => {
    if (withDraft) seed();
    await render({ onLocalWorkoutCommitted: notify });
    if (withDraft) assertRestored(DRAFT_X);
    expect(snapshot()).toMatchObject({ saving: false, locked: false });
    observe('initial');
  };
  try {
    if (scenario === 'hydration') {
      storage.setItem(localHealthDraftKey(B, Z), JSON.stringify(DRAFT_Z));
      await settleInitial(false);
      await render({ workouts: HYDRATED }); observe('clean-hydration');
      assertFreshHydration(HYDRATED);
      const sameArray = mocks.draft.localWorkouts;
      await render({ workouts: HYDRATED }); expect(mocks.draft.localWorkouts).toBe(sameArray); observe('same-array');
      await render({ selectedDayComposite: { accountId: A, localDate: X, phase: 'loading', result: null,
        legacyDaily: null, isolationError: false, cacheKey: null, retry: vi.fn() } as any, workouts: DRAFT_Y });
      expect(mocks.draft.localWorkouts).toBe(sameArray); observe('ineligible-source');
      await render({ selectedDayComposite: undefined, workouts: [...FRESH_HYDRATED] });
      assertFreshHydration(FRESH_HYDRATED); observe('fresh-eligible-source');
      expect(storage.getItem(localHealthDraftKey(A, Y))).toBeNull();
      expect(storage.getItem(localHealthDraftKey(B, Z))).toBe(JSON.stringify(DRAFT_Z));
      expect(mocks.inputs).toEqual([]); expect(notifications).toEqual([]);
      expect(mocks.showToast).not.toHaveBeenCalled();
      await invoke(() => button('editBtn').click()); await editKg('42'); observe('user-edit');
      const owned = snapshot();
      await render({ workouts: [...DRAFT_Y] }); expect(snapshot()).toEqual(owned);
      await render({ appSettings: { ...props.appSettings, darkMode: true }, workouts: [...HYDRATED] });
      expect(snapshot()).toEqual(owned); observe('dirty-source-denied');
    } else if (scenario === 'restoration' || scenario === 'strict-restore') {
      const bytes = seed(); await render({ workouts: HYDRATED, onLocalWorkoutCommitted: notify });
      assertRestored(DRAFT_X); assertBytes(bytes); observe('restored-with-immediate-source');
      const current = mocks.owner?.getCurrent();
      await render({ appSettings: { ...props.appSettings, darkMode: true }, workouts: [...HYDRATED] });
      if (side === 'candidate') expect(mocks.owner.getCurrent()).toBe(current);
      assertRestored(DRAFT_X); assertBytes(bytes); observe('same-date');
      for (const [key, rows] of [[Y, DRAFT_Y], [X, DRAFT_X]] as const) {
        await render({ selectedDate: date(key), workouts: [...HYDRATED] });
        assertRestored(rows); assertBytes(bytes); observe('transition-' + key);
      }
      await render({ user: { id: B, name: 'B' }, selectedDate: date(Z), workouts: [...HYDRATED] });
      assertRestored(DRAFT_Z); assertBytes(bytes); observe('other-account');
      await render({ user: { id: A, name: 'A' }, selectedDate: date(X), workouts: [...HYDRATED] });
      assertRestored(DRAFT_X); assertBytes(bytes); observe('return-account');
      if (side === 'candidate') {
        expect(mocks.owner.publication).toBe(mocks.owner.getCurrent());
        expect(mocks.owner.getCurrent().dateLifetime).not.toBe(current.dateLifetime);
      } else expect(mocks.owner).toBeNull(); // no counterfeit owner on main
    } else if (scenario === 'save-ack' || scenario === 'delete-ack') {
      await settleInitial(); const gate = deferred(); mocks.commitGate = gate;
      if (scenario === 'save-ack') await editKg('33');
      await invoke(scenario === 'save-ack' ? () => mocks.saveCallback!() : removeCallback());
      expect(mocks.dispatches).toHaveLength(1); expect(mocks.commits).toHaveLength(0);
      expect(snapshot().saving).toBe(scenario === 'save-ack'); observe('pending');
      await render({ appSettings: { ...props.appSettings, darkMode: true } }); observe('pending-rerender');
      await act(async () => gate.release()); observe('acknowledged');
      expect(snapshot()).toMatchObject({ saving: false, dirty: false, dirtyRef: false, bytes: null, locked: scenario === 'save-ack' });
      expect(mocks.commits).toHaveLength(1); expect(notifications).toEqual([A]);
      expect(snapshot().cacheEffects, 'R02_MONTH_CACHE_ORACLE:' + scenario).toEqual(expectedCacheEffects(1));
      expect(mocks.dispatches[0]).toMatchObject(scenario === 'save-ack'
        ? { kind: 'save', accountId: A, rows: [expect.objectContaining({ id: DRAFT_X[0].id, date: X, expectedVersion: 'v1' })] }
        : { kind: 'delete', accountId: A, id: DRAFT_X[0].id, version: 'v1' });
      if (scenario === 'save-ack') expect(snapshot().rows[0]).toMatchObject({ id: DRAFT_X[0].id, local_version: 'v2' });
      else expect(snapshot().rows).toEqual([]);
      await render({ selectedDate: date(Y) }); assertRestored(DRAFT_Y); observe('Y-reset');
      await render({ selectedDate: date(X) }); observe('X2-return');
      expect(snapshot()).toMatchObject({ rows: [], dirty: false, saving: false, locked: false, bytes: null });
      await render({ workouts: HYDRATED }); await invoke(() => button('editBtn').click()); await editKg('44');
      mocks.commitGate = null; await save(); observe('normal-X2-completion');
      expect(snapshot()).toMatchObject({ dirty: false, dirtyRef: false, saving: false, locked: true, bytes: null });
      expect(notifications).toEqual([A, A]);
      expect(snapshot().cacheEffects, 'R02_MONTH_CACHE_ORACLE:second valid completion').toEqual(expectedCacheEffects(2));
    } else if (scenario === 'draft-delete') {
      seed(); storage.setItem(localHealthDraftKey(A, X), JSON.stringify([row('temp-owned', '23')]));
      await render({ onLocalWorkoutCommitted: notify }); observe('draft-only-before');
      expect(snapshot()).toMatchObject({ saving: false, locked: false, dirty: true });
      await invoke(removeCallback()); observe('draft-only-after');
      expect(snapshot()).toMatchObject({ rows: [], dirty: false, dirtyRef: false, saving: false, locked: false, bytes: null });
      expect(mocks.inputs).toEqual([]); expect(mocks.dispatches).toEqual([]); expect(notifications).toEqual([]);
      expect(snapshot().cacheCalls).toEqual([0, 0]);
      expect(snapshot().cacheEffects).toEqual([]);
    } else if (scenario.startsWith('durable-')) {
      const operation = scenario === 'durable-save' ? 'save' : 'delete';
      await settleInitial(); const gate = deferred(); mocks.commitGate = gate;
      await invoke(operation === 'save' ? () => mocks.saveCallback!() : removeCallback());
      observe('X1-dispatched'); expect(mocks.dispatches).toHaveLength(1);
      const bytes = Object.fromEntries([localHealthDraftKey(A, X), localHealthDraftKey(A, Y), localHealthDraftKey(B, Z)]
        .map(key => [key, storage.getItem(key)!]));
      await render({ selectedDate: date(Y) }); assertRestored(DRAFT_Y); assertBytes(bytes); observe('Y');
      await render({ selectedDate: date(X) }); assertRestored(DRAFT_X); assertBytes(bytes); observe('X2-restored');
      await editKg('47'); observe('X2-user-owned'); const before = snapshot();
      await act(async () => gate.release()); observe('X1-durable-return');
      expect(mocks.commits).toEqual([{ kind: operation, accountId: A }]); expect(notifications).toEqual([A]);
      if (side === 'candidate') {
        expect(snapshot()).toEqual(before);
        expect(snapshot().cacheEffects).toEqual([]);
        await render({ workouts: [...HYDRATED] }); expect(snapshot()).toEqual(before);
      } else {
        expect(snapshot().cacheEffects, 'R02_MONTH_CACHE_ORACLE:baseline stale ACK').toEqual(expectedCacheEffects(1));
        expect(snapshot()).toMatchObject({ dirty: false, dirtyRef: false, bytes: null, saving: false });
        if (operation === 'save') expect(snapshot()).toMatchObject({ locked: true, rows: [expect.objectContaining({ local_version: 'v2' })] });
        else expect(snapshot().rows).toEqual([]);
      }
      for (const key of [localHealthDraftKey(A, Y), localHealthDraftKey(B, Z)]) expect(storage.getItem(key)).toBe(bytes[key]);
    } else {
      const before = seed(); mocks.fault = 'restore'; await render();
      expect(() => assertRestored(DRAFT_X)).toThrow(/restored dirty rows/); observe('withheld-restore-detected');
      mocks.fault = ''; await navigateABA(); assertRestored(DRAFT_X); observe('normal-restore');
      storage.wrongKeyFault = true; await render({ selectedDate: date(Y) });
      storage.setItem(localHealthDraftKey(A, Y), before[localHealthDraftKey(A, Y)]);
      expect(() => assertBytes(before)).toThrow(/intermediate stored draft write/); observe('wrong-key-history-detected');
      await render({ selectedDate: date(X) }); assertRestored(DRAFT_X);
      mocks.fault = 'dirty-guard'; await render({ workouts: [...HYDRATED] });
      expect(() => assertRestored(DRAFT_X)).toThrow(/restored dirty rows/); observe('dirty-guard-detected');
      if (side === 'candidate') expect(mocks.owner.publication).toBe(mocks.owner.getCurrent());
    }
    const report = { input, checkpoints,
      history: storage.history.filter(event => event.op !== 'get'),
      restored: mocks.events.filter(event => event.phase === 'restored').map(event => event.date),
      dispatches: structuredClone(mocks.dispatches), commits: structuredClone(mocks.commits), notifications };
    return report;
  } catch (error) {
    throw new Error('R02_PAIR_ORACLE:' + side + ':' + scenario + ': ' + String(error), { cause: error });
  } finally { act(() => root!.unmount()); root = null; }
}

// These children execute the SAME R02_PAIR tests. Only the candidate Vite
// module is perturbed; exact-main reconstruction reads/hash-checks raw bytes.
// A targeted candidate assertion (not a fault-call counter/setup error) must fail.
async function runR02EvidenceFault(fault: string, pattern: string, marker: string, failures: number) {
  const { execFile } = await import('node:child_process');
  const program = `
    import { startVitest } from 'vitest/node'; import react from '@vitejs/plugin-react';
    import os from 'node:os'; import path from 'node:path';
    const fault = ${JSON.stringify(fault)};
    const plugin = { name: 'bounded-r02-evidence-fault', enforce: 'pre', transform(source, id) {
      if (!id.replaceAll('\\\\', '/').endsWith('/views/HealthView.tsx')) return;
      source = source.replace(/\\r\\n/g, '\\n');
      const replace = (from, to) => {
        if (source.split(from).length !== 2) throw new Error('R02_FAULT_ANCHOR_MISSING_OR_AMBIGUOUS');
        source = source.replace(from, to);
      };
      if (fault === 'missing-save-month') replace(
        '        mutateDaily();\\n        mutateMonthWorkoutRows();\\n        mutateStatic();\\n        return;',
        '        mutateDaily();\\n        mutateStatic();\\n        return;');
      else if (fault === 'missing-delete-month') replace(
        '          mutateDaily();\\n          mutateMonthWorkoutRows();\\n          mutateStatic();',
        '          mutateDaily();\\n          mutateStatic();');
      else if (fault === 'wrong-account') replace(
        "['local-health-workout-range', user.id, monthStart, monthEnd]",
        "['local-health-workout-range', 'account-b', monthStart, monthEnd]");
      else if (fault === 'wrong-month') replace(
        "['local-health-workout-range', user.id, monthStart, monthEnd]",
        "['local-health-workout-range', user.id, '2025-12-01', '2025-12-31']");
      else if (fault === 'suppress-fresh-hydration') {
        replace('const lastHydratedWorkoutsRef = useRef<Workout[] | null>(null);',
          'const lastHydratedWorkoutsRef = useRef<Workout[] | null>(null);\\n' +
          '  const auditLastNonemptyScope = useRef<string | null>(null);');
        replace('&& lastHydratedWorkoutsRef.current !== workouts',
          "&& auditLastNonemptyScope.current !== user.id + ':' + selectedDateDraftKey\\n" +
          '      && lastHydratedWorkoutsRef.current !== workouts');
        replace('lastHydratedWorkoutsRef.current = workouts;',
          "lastHydratedWorkoutsRef.current = workouts;\\n" +
          "      if (sorted.length > 0) auditLastNonemptyScope.current = user.id + ':' + selectedDateDraftKey;");
      } else throw new Error('UNKNOWN_R02_EVIDENCE_FAULT');
      return source;
    } };
    const ctx = await startVitest('test', ['src/components/views/healthWorkoutDateLifetimeDraftHydration.integration.test.ts'],
      { config: false, watch: false, cache: false, maxWorkers: 1, testNamePattern: ${JSON.stringify(pattern)} },
      { plugins: [plugin, react()], cacheDir: path.join(os.tmpdir(), 'absinthe-r02-' + process.pid),
        resolve: { alias: { '@': process.cwd() + '/src' } },
        test: { environment: 'node', setupFiles: ['./src/test/setup.ts'] } });
    await ctx.close();
  `;
  const output = await new Promise<string>((resolve, reject) => {
    execFile(process.execPath, ['--input-type=module', '-e', program],
      { cwd: process.cwd(), timeout: 60_000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
        const text = stdout + stderr;
        if (!error || error.killed || !text.includes(marker) || text.includes('R02_PAIR_ORACLE:baseline:')
          || text.includes('R02_FAULT_ANCHOR_')) {
          reject(new Error('R02 evidence fault did not fail the targeted candidate oracle: ' + text)); return;
        }
        resolve(text);
      });
  });
  expect(output).toContain(failures + ' failed');
  expect(output).toContain('R02_PAIR_ORACLE:candidate:');
  return output;
}

describe('R02 expanded isolated exact-main MD differential pairs', () => {
  it.each([
    ['missing-save-month', 'R02_PAIR save-ack', 'R02_MONTH_CACHE_ORACLE:save-ack', 1],
    ['missing-delete-month', 'R02_PAIR delete-ack', 'R02_MONTH_CACHE_ORACLE:delete-ack', 1],
    ['wrong-account', 'R02_PAIR (save-ack|delete-ack)', 'R02_MONTH_CACHE_ORACLE:', 2],
    ['wrong-month', 'R02_PAIR (save-ack|delete-ack)', 'R02_MONTH_CACHE_ORACLE:', 2],
    ['suppress-fresh-hydration', 'R02_PAIR hydration', 'R02_FRESH_HYDRATION_ORACLE:actual rows/dirty/storage', 1],
  ] as const)('R02 evidence sensitivity %s fails the same candidate paired oracle', async (fault, pattern, marker, failures) => {
    const output = await runR02EvidenceFault(fault, pattern, marker, failures);
    if (fault.startsWith('wrong-')) {
      expect(output).toContain('R02_PAIR_ORACLE:candidate:save-ack');
      expect(output).toContain('R02_PAIR_ORACLE:candidate:delete-ack');
    }
    if (fault === 'suppress-fresh-hydration') {
      // Initial 99 assertion passed; failure is the distinct second 101 adoption.
      expect(output).toContain('101'); expect(output).toContain('99');
    }
  }, 90_000);
  it('R02 differential sensitivity: EVERY MD, real-parent and ID pair rejects an actual candidate saving-state regression', async () => {
    const { runCandidateStateFault } = await import('../../../test-support/healthWorkoutExactMain');
    const direct = await runCandidateStateFault(
      'src/components/views/healthWorkoutDateLifetimeDraftHydration.integration.test.ts',
      'R02_PAIR', 'reset-saving', 'R02_PAIR_ORACLE:candidate:');
    expect(direct).toContain('9 failed');
    for (const scenario of ['hydration', 'restoration', 'strict-restore', 'save-ack', 'delete-ack',
      'draft-delete', 'preservation-faults', 'durable-save', 'durable-delete'])
      expect(direct).toContain('R02_PAIR_ORACLE:candidate:' + scenario);
    const parent = await runCandidateStateFault(
      'src/components/healthWorkoutDateLifetimeLegacyParent.integration.test.ts',
      'R02_PARENT_PAIR', 'reset-saving', 'R02_PARENT_ORACLE:candidate:');
    expect(parent).toContain('3 failed');
    expect(parent).toContain('dirty=false StrictMode=false');
    expect(parent).toContain('dirty=true StrictMode=false');
    expect(parent).toContain('dirty=true StrictMode=true');
    const integrated = await runCandidateStateFault(
      'src/components/healthWorkoutFullMountedRace.integration.test.ts',
      'R02_ID_PAIR', 'reset-saving', 'R02_ID_ORACLE:candidate:');
    expect(integrated).toContain('2 failed');
    expect(integrated).toContain('R02_ID_PAIR save');
    expect(integrated).toContain('R02_ID_PAIR delete');
  }, 180_000);
  it.each(['hydration', 'restoration', 'strict-restore', 'save-ack', 'delete-ack', 'draft-delete', 'preservation-faults'] as PairScenario[])(
    'R02_PAIR %s: identical inputs, production-derived outcomes, no unintended delta', async scenario => {
      const baseline = await directExperiment('baseline', scenario);
      const candidate = await directExperiment('candidate', scenario);
      expect(candidate.input).toEqual(baseline.input);
      expect(candidate, 'allowed delta NONE; includes named state, notifications, complete write history and requests').toEqual(baseline);
    }, 30_000);
  it.each(['durable-save', 'durable-delete'] as PairScenario[])(
    'R02_PAIR %s: equal durable boundary/fanout; ONLY documented stale X1 UI delta', async scenario => {
      const baseline = await directExperiment('baseline', scenario);
      const candidate = await directExperiment('candidate', scenario);
      expect(candidate.input).toEqual(baseline.input);
      expect(candidate.dispatches).toEqual(baseline.dispatches);
      expect(candidate.commits).toEqual(baseline.commits);
      expect(candidate.notifications).toEqual(baseline.notifications);
      expect(candidate.restored).toEqual(baseline.restored);
      expect(candidate.checkpoints.slice(0, -1)).toEqual(baseline.checkpoints.slice(0, -1));
      // Explicit allowed delta: the final old UI ACK/row filter/storage removal.
      // Both sides assert their exact expected branch INSIDE the real experiment.
      expect(candidate.checkpoints.at(-1)).toEqual({ ...candidate.checkpoints.at(-2), label: 'X1-durable-return' });
      expect(candidate.history.some(event => event.op === 'remove')).toBe(false);
      expect(baseline.history.some(event => event.op === 'remove' && event.key === localHealthDraftKey(A, X))).toBe(true);
    }, 30_000);
});

describe('mandatory real draft/hydration H-series', () => {
  it('H01 clean qualified hydration adopts rows without dirty or persisted draft creation', async () => {
    const sentinel = JSON.stringify(DRAFT_Z); storage.setItem(localHealthDraftKey(B, Z), sentinel);
    await render(); expect(snapshot()).toMatchObject({ rows: [], dirty: false, dirtyRef: false, saving: false, locked: false });
    await render({ workouts: HYDRATED }); expect(snapshot()).toMatchObject({ rows: HYDRATED, dirty: false, dirtyRef: false, saving: false, locked: true, bytes: null });
    const rows = mocks.draft.localWorkouts;
    await render({ workouts: HYDRATED }); expect(mocks.draft.localWorkouts).toBe(rows);
    const pending = { accountId: A, localDate: X, phase: 'loading', result: null, legacyDaily: null,
      isolationError: false, cacheKey: null, retry: vi.fn() } as unknown as HealthProps['selectedDayComposite'];
    await render({ selectedDayComposite: pending, workouts: DRAFT_Y });
    expect(mocks.draft.localWorkouts).toBe(rows);
    await render({ selectedDayComposite: undefined, workouts: [...FRESH_HYDRATED] });
    assertFreshHydration(FRESH_HYDRATED);
    expect(storage.getItem(localHealthDraftKey(A, Y))).toBeNull();
    expect(storage.getItem(localHealthDraftKey(B, Z))).toBe(sentinel);
    expect(mocks.inputs).toHaveLength(0); expect(mocks.showToast).not.toHaveBeenCalled();
  });
  it('H02 user-owned dirty rows and exact bytes survive independently qualified hydration', async () => {
    await render({ workouts: HYDRATED }); await invoke(() => button('editBtn').click()); await editKg('42');
    const before = snapshot(); expect(before.dirty).toBe(true); expect(before.locked).toBe(false);
    await render({ workouts: [...DRAFT_Y] }); expect(snapshot()).toEqual(before);
    await render({ appSettings: { ...props.appSettings, darkMode: true }, workouts: [...HYDRATED] });
    expect(snapshot()).toEqual(before); expect(mocks.inputs).toHaveLength(0);
  });
  it('H03 actual preseeded restore is dirty and resists hydration during and after publication', async () => {
    const before = seed(); await render({ workouts: HYDRATED });
    assertRestored(DRAFT_X); assertBytes(before);
    await render({ workouts: [...HYDRATED] }); assertRestored(DRAFT_X); assertBytes(before);
    await render({ selectedDate: date(Y), workouts: [...HYDRATED] });
    assertRestored(DRAFT_Y); assertBytes(before);
    expect(mocks.events.filter(event => event.phase === 'real-read' && event.date === X).length).toBeGreaterThan(0);
    expect(mocks.events.filter(event => event.phase === 'restored').map(event => event.date)).toEqual([X, Y]);
    expect(mocks.showToast.mock.calls.map(call => call[0])).toEqual(['draftRestored', 'draftRestored']);
  });
  it('H04 dirty Y and X2 cannot be overwritten by a held X source; current clean hydration remains independent', async () => {
    const before = seed(); await render(); const heldX = deferred<Workout[]>();
    const pending = heldX.promise.then(workouts => { if (props.formatDate(props.selectedDate) === X) return render({ workouts }); });
    await render({ selectedDate: date(Y) }); assertRestored(DRAFT_Y); assertBytes(before);
    await act(async () => heldX.release(HYDRATED)); await pending;
    assertRestored(DRAFT_Y); assertBytes(before);
    await render({ selectedDate: date(X), workouts: [...HYDRATED] }); assertRestored(DRAFT_X); assertBytes(before);
    // The source-owner account/date guard is also exercised through real AppContent/SWR in the legacy-parent suite.
    expect(mocks.inputs).toHaveLength(0);
  });
  it('H05 observes actual setup/cleanup/publication/passive work without fixed render counts', async () => {
    const before = seed(); await render({ workouts: HYDRATED });
    const x1 = mocks.owner.getCurrent(); assertRestored(DRAFT_X); assertBytes(before);
    const firstSetup = mocks.events.findIndex(event => event.phase === 'owner-setup-end');
    const firstBinding = mocks.events.findIndex(event => event.phase === 'binding-commit' && event.publication === x1);
    expect(firstSetup).toBeGreaterThanOrEqual(0); expect(firstBinding).toBeGreaterThan(firstSetup);
    expect(mocks.events.some(event => event.phase === 'draft-passive-start')).toBe(true);
    await render({ appSettings: { ...props.appSettings, darkMode: true } }); expect(mocks.owner.getCurrent()).toBe(x1);
    await render({ selectedDate: date(Y), workouts: [...HYDRATED] }); assertRestored(DRAFT_Y); assertBytes(before);
    await render({ selectedDate: date(X), workouts: [...HYDRATED] }); assertRestored(DRAFT_X); assertBytes(before);
    expect(mocks.owner.getCurrent().dateLifetime).not.toBe(x1.dateLifetime);
    expect(mocks.events.filter(event => event.phase === 'owner-cleanup-end').every(event => event.authority === null)).toBe(true);
    expect(mocks.inputs).toHaveLength(0);
  });
  it('H06 preexisting X/Y/Z byte and intermediate-write oracle precedes any X2 reseed', async () => {
    const before = seed(); await render(); assertRestored(DRAFT_X); assertBytes(before);
    await render({ selectedDate: date(Y) }); assertRestored(DRAFT_Y); assertBytes(before);
    await render({ selectedDate: date(X) }); assertRestored(DRAFT_X); assertBytes(before);
    await render({ workouts: [...HYDRATED] }); assertRestored(DRAFT_X); assertBytes(before);
    expect(storage.history.filter(event => event.op === 'remove' && Object.keys(before).includes(event.key))).toEqual([]);
  });
  it('H07 current saving/lock reset, X2 pending Save and valid acknowledgement remain separate', async () => {
    const bytes = seed(); await render(); assertRestored(DRAFT_X);
    const first = deferred<any>(), second = deferred<any>();
    mocks.saveHealthWorkouts.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await invoke(() => mocks.saveCallback!()); expect(snapshot()).toMatchObject({ saving: true, locked: false, dirty: true });
    await render({ appSettings: { ...props.appSettings, darkMode: true } }); expect(snapshot().saving).toBe(true);
    await render({ selectedDate: date(Y) }); assertRestored(DRAFT_Y); assertBytes(bytes);
    await render({ selectedDate: date(X) }); assertRestored(DRAFT_X); assertBytes(bytes);
    await editKg('33'); await invoke(() => mocks.saveCallback!());
    const x2 = snapshot(); expect(x2).toMatchObject({ saving: true, locked: false, dirty: true, dirtyRef: true });
    await act(async () => first.release({ status: 'success', total: 1, succeeded: 1, failed: 0 })); expect(snapshot()).toEqual(x2);
    await act(async () => second.release({ status: 'success', total: 1, succeeded: 1, failed: 0 }));
    expect(snapshot()).toMatchObject({ saving: false, locked: true, dirty: false, dirtyRef: false, bytes: null });
    expect(storage.getItem(localHealthDraftKey(A, Y))).toBe(bytes[localHealthDraftKey(A, Y)]);
  });
  it('H07 stale completion cannot unlock a later acknowledged X2', async () => {
    seed(); await render(); const first = deferred<any>();
    mocks.saveHealthWorkouts.mockReturnValueOnce(first.promise);
    await invoke(() => mocks.saveCallback!()); await navigateABA(); await save();
    const before = snapshot(); expect(before).toMatchObject({ saving: false, locked: true, dirty: false, bytes: null });
    await act(async () => first.release({ status: 'success', total: 1, succeeded: 1, failed: 0 })); expect(snapshot()).toEqual(before);
  });
  it.each(['save', 'delete'] as const)('H08 real persistence %s commits and notifies original account before stale UI denial', async operation => {
    const bytes = seed(); mocks.realPersistence = true; mocks.remoteMode = false; mocks.commitGate = deferred();
    const notified = vi.fn((account: string) => {
      expect(mocks.commits).toHaveLength(1); mocks.events.push({ phase: 'fanout', account });
    });
    await render({ onLocalWorkoutCommitted: notified });
    await invoke(operation === 'save' ? () => mocks.saveCallback!() : removeCallback());
    expect(mocks.dispatches).toHaveLength(1); expect(mocks.commits).toHaveLength(0);
    await render({ selectedDate: date(Y) }); assertRestored(DRAFT_Y); assertBytes(bytes);
    await render({ selectedDate: date(X) }); assertRestored(DRAFT_X); assertBytes(bytes);
    await editKg('47'); const before = snapshot();
    await act(async () => mocks.commitGate!.release());
    expect(mocks.commits).toEqual([{ kind: operation, accountId: A }]); expect(notified).toHaveBeenCalledExactlyOnceWith(A);
    expect(snapshot()).toEqual(before);
    expect(mocks.dispatches[0]).toMatchObject(operation === 'save'
      ? { accountId: A, rows: [expect.objectContaining({ date: X, expectedVersion: 'v1', id: DRAFT_X[0].id })] }
      : { accountId: A, id: DRAFT_X[0].id, version: 'v1' });
    await render({ workouts: [...HYDRATED] }); expect(snapshot()).toEqual(before);
  });
  it('H09 withheld real restore trips the same rows/dirty oracle without token rejection', async () => {
    seed(); mocks.fault = 'restore'; await render();
    expect(mocks.owner.publication).toBe(mocks.owner.getCurrent());
    expect(() => assertRestored(DRAFT_X)).toThrow(/restored dirty rows/);
    mocks.fault = ''; await render({ selectedDate: date(Y) }); await render({ selectedDate: date(X) });
    expect(() => assertRestored(DRAFT_X)).not.toThrow();
  });
  it('H09 wrong-key write is detected even after byte repair; token authority remains current', async () => {
    const before = seed(); await render(); assertBytes(before);
    storage.wrongKeyFault = true; await render({ selectedDate: date(Y) });
    storage.setItem(localHealthDraftKey(A, Y), before[localHealthDraftKey(A, Y)]);
    expect(storage.getItem(localHealthDraftKey(A, Y))).toBe(before[localHealthDraftKey(A, Y)]);
    expect(mocks.owner.publication).toBe(mocks.owner.getCurrent());
    expect(() => assertBytes(before)).toThrow(/intermediate stored draft write/);
  });
  it('H09 dirty-guard fault makes qualified hydration overwrite restored rows and is caught', async () => {
    seed(); await render(); assertRestored(DRAFT_X);
    mocks.fault = 'dirty-guard'; await render({ workouts: [...HYDRATED] });
    expect(mocks.owner.publication).toBe(mocks.owner.getCurrent());
    expect(() => assertRestored(DRAFT_X)).toThrow(/restored dirty rows/);
  });
});
