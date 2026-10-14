// @vitest-environment happy-dom
import { createElement, useEffect, useLayoutEffect } from 'react';
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
  default: () => ({ data: [], mutate: vi.fn(), isLoading: false, error: undefined }),
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
  await act(async () => { root!.render(createElement(subject, props)); });
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
    cacheCalls: [mocks.mutateDaily.mock.calls.length, mocks.mutateStatic.mock.calls.length] };
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
beforeEach(() => {
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
});
afterEach(() => { if (root) act(() => root!.unmount()); host.remove(); vi.unstubAllGlobals(); });

/**
 * Gate-OFF differential oracle executes the exact main HealthView, not a fake
 * lifetime hook. Reverse only this correction's frozen source hunks in memory,
 * then verify the original Git blob hash. Works with shallow hosted checkouts.
 * No production files/Git objects are written by this fixture.
 */
const BASELINE_REVERSE_HUNKS = [
  {
    "candidate": "import { buildPreviousWorkoutHistoryProjection } from './features/health/previousWorkoutProjection';\nimport { useHealthWorkoutDraft } from './features/health/useHealthWorkoutDraft';\nimport {\n  captureHealthWorkoutOperationScope,\n  isCurrentHealthWorkoutOperationScope,\n  type HealthWorkoutOperationScope,\n} from './features/health/healthWorkoutOperationScope';\nimport { useHealthWorkoutOperationLifetime } from './features/health/useHealthWorkoutOperationLifetime';\nimport { readHealthSectionPrefs } from './features/health/healthSectionPrefs';\nimport { buildSetsFromPlannedCount, buildSetsFromPrevCount } from './features/health/workoutSetCount';\nimport { fetchPrevWorkoutForBlocks } from './features/health/prevWorkoutFetch';",
    "baseline": "import { buildPreviousWorkoutHistoryProjection } from './features/health/previousWorkoutProjection';\nimport { useHealthWorkoutDraft } from './features/health/useHealthWorkoutDraft';\nimport {\n  isCurrentHealthWorkoutOperationScope,\n  type HealthWorkoutOperationScope,\n} from './features/health/healthWorkoutOperationScope';\nimport { readHealthSectionPrefs } from './features/health/healthSectionPrefs';\nimport { buildSetsFromPlannedCount, buildSetsFromPrevCount } from './features/health/workoutSetCount';\nimport { fetchPrevWorkoutForBlocks } from './features/health/prevWorkoutFetch';"
  },
  {
    "candidate": "    : legacyPrevData;\n  const previousState = (id: string) => previousCurrentness.current\n    ? previousOwner.evidence(id).state : 'STALE_OR_SUPPRESSED' as const;\n  const workoutAccountOperation = Object.freeze({ accountId: user.id, generation: accountGenerationRef.current });\n  const workoutLifetime = useHealthWorkoutOperationLifetime(\n    workoutAccountOperation.accountId, workoutAccountOperation.generation, selectedDateDraftKey,\n  );\n  const captureWorkoutOperation = () => captureHealthWorkoutOperationScope(\n    workoutLifetime.publication, workoutAccountOperation, selectedDateDraftKey,\n    workoutLifetime.getCurrent(), currentAccountOperation,\n  );\n  const currentWorkoutOperation = (scope: HealthWorkoutOperationScope): boolean =>\n    isCurrentHealthWorkoutOperationScope(\n      scope,\n      workoutLifetime.getCurrent(),\n      currentAccountOperation,\n    );\n  const memoKey = localHealthMemoKey(user.id, selectedDateDraftKey);",
    "baseline": "    : legacyPrevData;\n  const previousState = (id: string) => previousCurrentness.current\n    ? previousOwner.evidence(id).state : 'STALE_OR_SUPPRESSED' as const;\n  const activeWorkoutDateKeyRef = useRef(selectedDateDraftKey);\n  activeWorkoutDateKeyRef.current = selectedDateDraftKey;\n  const currentWorkoutOperation = (scope: HealthWorkoutOperationScope): boolean =>\n    isCurrentHealthWorkoutOperationScope(\n      scope,\n      activeWorkoutDateKeyRef.current,\n      currentAccountOperation,\n    );\n  const memoKey = localHealthMemoKey(user.id, selectedDateDraftKey);"
  },
  {
    "candidate": "  };\n\n  const handleRemoveWorkout = async (index: number, dbId: string) => {\n    const operationScope = captureWorkoutOperation();\n    if (!operationScope) return;\n    if (previousEnabled) {\n      const blockId = localWorkouts[index]?.block_id;\n      if (blockId) routineLoadIntentRef.current?.removed.add(blockId);\n    }\n    try {\n      // 세션 구분선은 DB에 없으므로 API 호출 없이 바로 제거\n      if (dbId !== 'session' && !dbId.startsWith('session-') && !dbId.startsWith('temp')) {\n        const expectedVersion = localWorkouts[index]?.local_version;\n        if (localMode && !expectedVersion) throw new Error('health_local_workout_expected_version_missing');\n        if (!currentWorkoutOperation(operationScope)) return;\n        const result = await deleteHealthWorkout({\n          mode: localMode ? 'local' : 'remote',\n          accountId: operationScope.accountOperation.accountId,",
    "baseline": "  };\n\n  const handleRemoveWorkout = async (index: number, dbId: string) => {\n    if (previousEnabled) {\n      const blockId = localWorkouts[index]?.block_id;\n      if (blockId) routineLoadIntentRef.current?.removed.add(blockId);\n    }\n    const operationScope: HealthWorkoutOperationScope = {\n      accountOperation: {\n        accountId: user.id,\n        generation: accountGenerationRef.current,\n      },\n      dateKey: selectedDateDraftKey,\n    };\n    try {\n      // 세션 구분선은 DB에 없으므로 API 호출 없이 바로 제거\n      if (dbId !== 'session' && !dbId.startsWith('session-') && !dbId.startsWith('temp')) {\n        const expectedVersion = localWorkouts[index]?.local_version;\n        if (localMode && !expectedVersion) throw new Error('health_local_workout_expected_version_missing');\n        const result = await deleteHealthWorkout({\n          mode: localMode ? 'local' : 'remote',\n          accountId: operationScope.accountOperation.accountId,"
  },
  {
    "candidate": "    toggleWeightUnit(blockId);\n  };\n  const handleSaveWorkouts = async () => {\n    const operationScope = captureWorkoutOperation();\n    if (!operationScope) return;\n    if (localWorkouts.filter(w => w.block_id !== '__session__').length === 0)\n      return showToast(t('noWorkouts'), 'error');\n    setIsSaving(true);\n\n    try {",
    "baseline": "    toggleWeightUnit(blockId);\n  };\n  const handleSaveWorkouts = async () => {\n    if (localWorkouts.filter(w => w.block_id !== '__session__').length === 0)\n      return showToast(t('noWorkouts'), 'error');\n    const operationScope: HealthWorkoutOperationScope = {\n      accountOperation: {\n        accountId: user.id,\n        generation: accountGenerationRef.current,\n      },\n      dateKey: selectedDateDraftKey,\n    };\n    setIsSaving(true);\n\n    try {"
  },
  {
    "candidate": "          return normalizeStrengthSetForSave(set, getUnit(workout.block_id));\n        }),\n      }));\n      if (!currentWorkoutOperation(operationScope)) return;\n      const persistence = await saveHealthWorkouts({\n        mode: localMode ? 'local' : 'remote',\n        accountId: operationScope.accountOperation.accountId,",
    "baseline": "          return normalizeStrengthSetForSave(set, getUnit(workout.block_id));\n        }),\n      }));\n      const persistence = await saveHealthWorkouts({\n        mode: localMode ? 'local' : 'remote',\n        accountId: operationScope.accountOperation.accountId,"
  },
  {
    "candidate": "        if (localMode) mutateStatic();\n        if (isMobile) {\n          requestAnimationFrame(() => {\n            if (!currentWorkoutOperation(operationScope)) return;\n            inbodyQuickRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });\n          });\n        }",
    "baseline": "        if (localMode) mutateStatic();\n        if (isMobile) {\n          requestAnimationFrame(() => {\n            inbodyQuickRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });\n          });\n        }"
  },
  {
    "candidate": "        if (localMode) mutateStatic();\n        if (isMobile) {\n          requestAnimationFrame(() => {\n            if (!currentWorkoutOperation(operationScope)) return;\n            inbodyQuickRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });\n          });\n        }",
    "baseline": "        if (localMode) mutateStatic();\n        if (isMobile) {\n          requestAnimationFrame(() => {\n            inbodyQuickRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });\n          });\n        }"
  }
];
const BASELINE_SCOPE_SOURCE = "import type { HealthAccountGenerationToken } from '../../../../lib/healthBackfillUiSafety';\n\nexport interface HealthWorkoutOperationScope {\n  accountOperation: HealthAccountGenerationToken;\n  dateKey: string;\n}\n\nexport function isCurrentHealthWorkoutOperationScope(\n  scope: HealthWorkoutOperationScope,\n  currentDateKey: string,\n  isCurrentAccountOperation: (token: HealthAccountGenerationToken) => boolean,\n): boolean {\n  return scope.dateKey === currentDateKey && isCurrentAccountOperation(scope.accountOperation);\n}\n";
async function baselineSubject() {
  const fs = await import('node:fs');
  const { createHash } = await import('node:crypto');
  const ts = await import('typescript');
  const blob = (source: string) => createHash('sha1').update('blob ' + Buffer.byteLength(source) + '\0').update(source).digest('hex');
  let source = fs.readFileSync('src/components/views/HealthView.tsx', 'utf8').replace(/\r\n/g, '\n');
  for (const hunk of BASELINE_REVERSE_HUNKS) {
    expect(source.includes(hunk.candidate), 'frozen baseline hunk is present; final blob hash proves exactness').toBe(true);
    source = source.replace(hunk.candidate, hunk.baseline);
  }
  expect(blob(source)).toBe('4e7bdd8b5d0808f02e9f9bc5c3c580ae7f0c8b97');
  expect(blob(BASELINE_SCOPE_SOURCE)).toBe('b8ca520297a6b8ecb6543222969e4da5bf4c2f29');
  const compile = (text: string) => ts.transpileModule(text, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const code = compile(source);
  const baselineScope: any = {};
  new Function('exports', compile(BASELINE_SCOPE_SOURCE))(baselineScope);
  const modules = new Map<string, unknown>();
  for (const match of code.matchAll(/require\("([^"]+)"\)/g)) {
    const specifier = match[1];
    modules.set(specifier, specifier === './features/health/healthWorkoutOperationScope'
      ? baselineScope : await import(/* @vite-ignore */ specifier));
  }
  const lines = code.split('\n');
  // Function constructor contributes two wrapper lines to the runtime stack.
  mocks.baselineSavingLine = lines.findIndex(line => line.includes('const [isSaving, setIsSaving]')) + 3;
  mocks.baselineLockedLine = lines.findIndex(line => line.includes('const [isWorkoutLocked, setIsWorkoutLocked]')) + 3;
  const exports: any = {};
  new Function('require', 'exports', code + '\n//# sourceURL=HealthViewBaseline.js')((specifier: string) => modules.get(specifier), exports);
  return exports.HealthView as typeof HealthView;
}

describe('gate-OFF exact-main differential draft/hydration oracle', () => {
  it('preserves baseline H01-H07 outcomes and differs only for the stale date-ABA continuation', async () => {
    const baseline = await baselineSubject();
    const execute = async (component: typeof HealthView) => {
      subject = component; props = undefined as unknown as HealthProps;
      storage = new ByteStorage(); vi.stubGlobal('localStorage', storage);
      mocks.showToast.mockReset(); mocks.mutateDaily.mockReset(); mocks.mutateStatic.mockReset();
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
    await render({ selectedDayComposite: undefined, workouts: [...HYDRATED] });
    expect(snapshot()).toMatchObject({ rows: HYDRATED, dirty: false, bytes: null });
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
