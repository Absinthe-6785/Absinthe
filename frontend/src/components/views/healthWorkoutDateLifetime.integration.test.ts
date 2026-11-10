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
  normalize: vi.fn(),
  onNormalize: null as null | (() => void),
  remoteMode: true,
  realPersistence: false,
  fault: '' as string,
  draft: null as any,
  owner: null as any,
  saving: undefined as boolean | undefined,
  locked: undefined as boolean | undefined,
  saveCallback: null as null | (() => Promise<void>),
  addCallback: null as null | ((block: any) => Promise<void>),
  fetchPrevious: vi.fn(),
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
  previousProjection: null as any,
  previousActionCallback: null as null | (() => void),
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
vi.mock('./features/health/healthWeight', async importOriginal => {
  const real = await importOriginal<typeof import('./features/health/healthWeight')>();
  return { ...real, normalizeStrengthSetForSave: (...args: Parameters<typeof real.normalizeStrengthSetForSave>) => {
    mocks.normalize(...args);
    const value = real.normalizeStrengthSetForSave(...args);
    mocks.onNormalize?.();
    return value;
  } };
});
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
vi.mock('./features/health/prevWorkoutFetch', () => ({
  fetchPrevWorkoutForBlocks: (...args: unknown[]) => mocks.fetchPrevious(...args),
}));
vi.mock('./features/health/previousWorkoutSession', () => ({
  normalizePreviousWorkoutRows: (rows: unknown[]) => rows,
  previousWorkoutRange: () => ({ startDate: '2026-01-01', endDate: '2026-01-10' }),
  defaultPreviousWorkoutDateFromDates: (dates: string[]) => [...dates].sort().at(-1) ?? null,
}));
vi.mock('./features/health/previousWorkoutProjection', () => ({
  buildPreviousWorkoutHistoryProjection: () => mocks.previousProjection
    ?? ({ sessions: [], automaticDate: null, effectiveDate: null, session: null }),
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
  }) => { mocks.addCallback = onAddToToday as (block: any) => Promise<void>; return createElement(
    'section',
    { 'data-health-test-region': 'library' },
    ...blocks.map(block => createElement('button', {
      key: block.id,
      type: 'button',
      onClick: () => onAddToToday(block),
    }, block.name)),
  ); },
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
vi.mock('./features/health/PreviousWorkoutView', () => ({ PreviousWorkoutView: ({ onOpenDay }: { onOpenDay?: () => void }) => {
  mocks.previousActionCallback = onOpenDay ?? null;
  return onOpenDay ? createElement('button', { type: 'button', onClick: onOpenDay, 'data-test-open-history-day': true }, 'open-history-day') : null;
} }));
vi.mock('./features/health/PreviousWorkoutSheet', () => ({ PreviousWorkoutSheet: ({ open, onOpenDay, composite }: {
  open: boolean; onOpenDay?: () => void; composite?: { onOpenDay?: () => void };
}) => {
  const action = composite?.onOpenDay ?? onOpenDay;
  mocks.previousActionCallback = action ?? null;
  return open && action ? createElement('button', { type: 'button', onClick: action, 'data-test-open-history-day': true }, 'open-history-day') : null;
} }));
vi.mock('./features/health/HealthMobileWorkoutActions', () => ({
  HealthMobileWorkoutActions: ({ isWorkoutLocked, onPrevious }: { isWorkoutLocked: boolean; onPrevious: () => void }) => {
    mocks.locked = isWorkoutLocked;
    return createElement('button', { type: 'button', onClick: onPrevious, 'data-test-open-previous': true }, 'open-previous');
  },
}));


import { HealthView } from './HealthView';
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
  await act(async () => { root!.render(createElement(HealthView, props)); });
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
async function startRoutine() {
  const select = [...host.querySelectorAll('select')].find(node => node.querySelector('option[value="__load__"]'))!;
  await act(async () => { select.value = 'Day 1'; select.dispatchEvent(new Event('change', { bubbles: true })); });
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
  mocks.normalize.mockReset(); mocks.onNormalize = null;
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  storage = new ByteStorage(); vi.stubGlobal('localStorage', storage);
  raf = []; vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { raf.push(callback); return raf.length; });
  mocks.remoteMode = true; mocks.mobile = false; mocks.realPersistence = false; mocks.fault = '';
  mocks.draft = null; mocks.owner = null; mocks.saving = undefined; mocks.locked = undefined; mocks.saveCallback = null;
  mocks.addCallback = null; mocks.fetchPrevious.mockReset().mockResolvedValue({});
  mocks.invokeBeforePublication = false; mocks.events.length = 0; mocks.inputs.length = 0;
  mocks.dispatches.length = 0; mocks.commits.length = 0; mocks.factoryGate = null; mocks.commitGate = null;
  mocks.authFetch.mockReset().mockResolvedValue(new Response(null, { status: 201 }));
  mocks.showToast.mockReset(); mocks.mutateDaily.mockReset(); mocks.mutateStatic.mockReset();
  mocks.previousProjection = null; mocks.previousActionCallback = null;
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

describe('editing admission while a local save is pending', () => {
  it('rejects a retained input handler immediately before the saving rerender', async () => {
    seed(); await render(); const gate = deferred<any>(); mocks.saveHealthWorkouts.mockReturnValue(gate.promise);
    const input = host.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;
    const key = Object.getOwnPropertyNames(input).find(key => key.startsWith('__reactProps$'))!;
    const onChange = (input as any)[key].onChange;
    const before = snapshot();
    await invoke(() => { void mocks.saveCallback!(); onChange({ target: { value: '31' } }); });
    expect(snapshot().rows).toEqual(before.rows); expect(snapshot().bytes).toBe(before.bytes);
    expect(input.closest('fieldset')?.disabled).toBe(true);
    expect(input.closest('fieldset')?.getAttribute('aria-busy')).toBe('true');
    await act(async () => gate.release({ status: 'success', total: 1, succeeded: 1, failed: 0 }));
  });
  it('failure preserves draft bytes and releases editing for retry', async () => {
    seed(); await render(); const gate = deferred<any>(); mocks.saveHealthWorkouts.mockReturnValueOnce(gate.promise);
    await invoke(() => mocks.saveCallback!()); const before = snapshot(); await editKg('31');
    expect(snapshot().rows).toEqual(before.rows); expect(snapshot().bytes).toBe(before.bytes);
    await act(async () => gate.reject(new Error('definite failure')));
    expect(snapshot()).toMatchObject({ dirty: true, locked: false, saving: false });
    await editKg('31'); expect(snapshot().rows[0]!.sets[0]!.kg).toBe('31'); await save();
    expect(snapshot()).toMatchObject({ dirty: false, locked: true });
  });
  it.each(['date', 'account'] as const)('new %s roundtrip lifetime admits edits while the old save is unresolved', async transition => {
    seed(); await render(); const gate = deferred<any>(); mocks.saveHealthWorkouts.mockReturnValueOnce(gate.promise);
    await invoke(() => mocks.saveCallback!());
    if (transition === 'date') await navigateABA();
    else { await render({ user: { id: B, name: 'B' }, selectedDate: date(Z) }); await render({ user: { id: A, name: 'A' }, selectedDate: date(X) }); }
    await editKg('31'); expect(snapshot().rows[0]!.sets[0]!.kg).toBe('31');
    const before = snapshot(); await act(async () => gate.release({ status: 'success', total: 1, succeeded: 1, failed: 0 }));
    expect(snapshot()).toEqual(before);
  });
  it('does not admit a pending exercise addition across the save boundary', async () => {
    seed(); await render(); const previous = deferred<any>(), saved = deferred<any>();
    mocks.fetchPrevious.mockImplementation((_ids, _date, source) => source === 'HealthView.fetchPrevForBlock' ? previous.promise : Promise.resolve({}));
    await invoke(() => mocks.addCallback!(blocks[1]!)); mocks.saveHealthWorkouts.mockReturnValue(saved.promise);
    await invoke(() => mocks.saveCallback!()); const before = snapshot();
    await act(async () => previous.release({})); expect(snapshot()).toEqual(before);
    await act(async () => saved.release({ status: 'success', total: 1, succeeded: 1, failed: 0 }));
  });
  it('does not accept a weight edit that the save acknowledgement would discard', async () => {
    seed(); mocks.remoteMode = false; mocks.realPersistence = true; mocks.commitGate = deferred<void>();
    await render(); await invoke(() => mocks.saveCallback!());
    expect(mocks.dispatches).toHaveLength(1);
    await editKg('31'); const pendingKg = snapshot().rows[0]!.sets[0]!.kg;
    await act(async () => mocks.commitGate!.release());
    expect({ pendingKg, acknowledgedKg: snapshot().rows[0]!.sets[0]!.kg }).toEqual({ pendingKg: '20', acknowledgedKg: '20' });
    expect(snapshot()).toMatchObject({ dirty: false, locked: true, bytes: null });
    expect(snapshot().rows[0]!.local_version).toBe('v2');
  });
});

describe('opening a selected Previous workout day', () => {
  const historicalDate = '2025-12-30';
  function publishLegacyHistory(dateKey = historicalDate) {
    const session = { date: dateKey, rows: [], matchStrategy: 'date' as const };
    mocks.previousProjection = { sessions: [session], automaticDate: dateKey, effectiveDate: dateKey, session };
  }
  async function enterDesktopPrevious() {
    await act(async () => button('tabPrevious').click());
    const action = host.querySelector<HTMLButtonElement>('[data-test-open-history-day]');
    if (!action) throw new Error('Verified Previous day action absent');
    return action;
  }

  it('opens the exact local date, aligns its month, and leaves both date drafts untouched', async () => {
    const bytes = seed();
    storage.setItem(localHealthDraftKey(A, historicalDate), JSON.stringify(DRAFT_Z));
    storage.history.length = 0;
    publishLegacyHistory();
    const setDate = vi.fn(), setMonth = vi.fn();
    await render({ setSelectedDate: setDate, setCurrentDate: setMonth });
    const action = await enterDesktopPrevious();
    storage.history.length = 0;
    await act(async () => action.click());

    expect(setDate).toHaveBeenCalledTimes(1);
    const destination = setDate.mock.calls[0]![0] as Date;
    expect([destination.getFullYear(), destination.getMonth(), destination.getDate()]).toEqual([2025, 11, 30]);
    expect(setMonth).toHaveBeenCalledTimes(1);
    const month = setMonth.mock.calls[0]![0] as Date;
    expect([month.getFullYear(), month.getMonth(), month.getDate()]).toEqual([2025, 11, 1]);
    expect(host.textContent).toContain('todayWorkout');
    expect(storage.getItem(localHealthDraftKey(A, historicalDate))).toBe(JSON.stringify(DRAFT_Z));
    expect(storage.history.filter(event => event.op !== 'get')).toEqual([]);
    expect(mocks.inputs).toHaveLength(0);
    assertBytes(bytes);

    await render({ selectedDate: destination, currentDate: month, setSelectedDate: setDate, setCurrentDate: setMonth });
    expect(mocks.draft.localWorkouts).toEqual(DRAFT_Z);
    expect(storage.getItem(localHealthDraftKey(A, historicalDate))).toBe(JSON.stringify(DRAFT_Z));
  });

  it('closes the mobile Previous sheet after accepted navigation', async () => {
    mocks.mobile = true;
    publishLegacyHistory();
    const setDate = vi.fn(), setMonth = vi.fn();
    await render({ setSelectedDate: setDate, setCurrentDate: setMonth });
    await act(async () => host.querySelector<HTMLButtonElement>('[data-test-open-previous]')!.click());
    const action = host.querySelector<HTMLButtonElement>('[data-test-open-history-day]');
    expect(action).not.toBeNull();
    await act(async () => action!.click());
    expect(setDate).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[data-test-open-history-day]')).toBeNull();
    expect(setMonth).toHaveBeenCalledTimes(1);
  });

  it('rejects a retained callback after account A-B-A', async () => {
    publishLegacyHistory();
    const setDate = vi.fn(), setMonth = vi.fn();
    await render({ setSelectedDate: setDate, setCurrentDate: setMonth });
    const oldAccountAction = await enterDesktopPrevious();
    const staleAccountCallback = mocks.previousActionCallback!;
    await render({ user: { id: B, name: 'B' }, setSelectedDate: setDate, setCurrentDate: setMonth });
    await render({ user: { id: A, name: 'A2' }, setSelectedDate: setDate, setCurrentDate: setMonth });
    await act(async () => staleAccountCallback());
    expect(setDate).not.toHaveBeenCalled();
    expect(setMonth).not.toHaveBeenCalled();
    expect(oldAccountAction.isConnected).toBe(false);

  });

  it('rejects a retained callback after Previous source replacement', async () => {
    publishLegacyHistory();
    const setDate = vi.fn(), setMonth = vi.fn();
    await render({ setSelectedDate: setDate, setCurrentDate: setMonth });
    const currentAction = await enterDesktopPrevious();
    const staleSourceCallback = mocks.previousActionCallback!;
    publishLegacyHistory('2025-12-29');
    await render({ selectedDate: date(Y), setSelectedDate: setDate, setCurrentDate: setMonth });
    await act(async () => staleSourceCallback());
    expect(setDate).not.toHaveBeenCalled();
    expect(setMonth).not.toHaveBeenCalled();
    expect(currentAction.isConnected).toBe(false);
  });

  it('does not expose an action for an invalid historical date', async () => {
    publishLegacyHistory('2025-02-29');
    await render();
    await act(async () => button('tabPrevious').click());
    expect(host.querySelector('[data-test-open-history-day]')).toBeNull();
  });
});

describe('async draft additions', () => {
  const routines = [{ id: 'routine', day_name: 'Day 1', blocks: ['pull', 'push'] }];
  const previous = { pull: { prev_sets: [
    { type: 'strength', set: 1, kg: '88', reps: '8' },
    { type: 'strength', set: 2, kg: '88', reps: '8' },
  ] } };
  for (const action of ['manual', 'routine'] as const) {
    it.each(['date', 'date-roundtrip', 'account-roundtrip', 'clean-date', 'unmount'] as const)(
      `does not apply an old ${action} completion after %s`, async transition => {
        const bytes = seed(); await render({ healthRoutines: routines });
        const gate = deferred<any>();
        mocks.fetchPrevious.mockImplementation((_ids, _date, source) => source === 'HealthView.fetchPrevForBlock'
          ? gate.promise : Promise.resolve({}));
        if (action === 'manual') await invoke(() => mocks.addCallback!(blocks[1]!));
        else await startRoutine();
        expect(mocks.fetchPrevious.mock.calls.some(call => call[2] === 'HealthView.fetchPrevForBlock')).toBe(true);
        if (transition === 'account-roundtrip') {
          await render({ user: { id: B, name: 'B' }, selectedDate: date(Z) });
          await render({ user: { id: A, name: 'A2' }, selectedDate: date(X) });
        } else if (transition === 'unmount') {
          await act(async () => root!.unmount()); root = null;
        } else {
          await render({ selectedDate: date(transition === 'clean-date' ? Z : Y) });
          if (transition === 'date-roundtrip') await render({ selectedDate: date(X) });
        }
        const before = snapshot(), frames = raf.length; storage.history.length = 0;
        await act(async () => gate.release(previous));
        expect(snapshot()).toEqual(before);
        expect(raf).toHaveLength(frames);
        expect(storage.history.filter(event => event.op !== 'get')).toEqual([]);
        assertBytes(bytes);
      });
  }
  it('same-lifetime addition keeps edits and initializes the Previous set count without copying historical values', async () => {
    seed(); await render(); const gate = deferred<any>();
    mocks.fetchPrevious.mockImplementation((_ids, _date, source) => source === 'HealthView.fetchPrevForBlock'
      ? gate.promise : Promise.resolve({}));
    await invoke(() => mocks.addCallback!(blocks[1]!)); await editKg('31');
    await act(async () => gate.release(previous));
    expect(snapshot().rows.map(row => row.block_id)).toEqual(['push', 'pull']);
    expect(snapshot().rows[0]!.sets[0]!.kg).toBe('31');
    expect(snapshot().rows[1]!.sets).toHaveLength(2);
    expect(snapshot().rows[1]!.sets.every(set => set.type === 'strength' && set.kg === '' && !set.done)).toBe(true);
    expect(snapshot().dirty).toBe(true);
  });
  it.each([false, true])('concurrent additions preserve rows and reject duplicate block identities (duplicate=%s)', async duplicate => {
    await render(); const gates = [deferred<any>(), deferred<any>()]; let calls = 0;
    mocks.fetchPrevious.mockImplementation((_ids, _date, source) => source === 'HealthView.fetchPrevForBlock'
      ? gates[calls++]!.promise : Promise.resolve({}));
    const add = mocks.addCallback!;
    await invoke(() => { void add(blocks[0]!); void add(blocks[duplicate ? 0 : 1]!); });
    await act(async () => gates[1]!.release({}));
    await act(async () => gates[0]!.release({}));
    expect(snapshot().rows.map(row => row.block_id)).toEqual(duplicate ? ['push'] : ['pull', 'push']);
    expect(new Set(snapshot().rows.map(row => row.id)).size).toBe(snapshot().rows.length);
  });
  it('routine load uses the latest edited rows and retains session separators and additions', async () => {
    seed(); await render({ healthRoutines: routines }); const gate = deferred<any>();
    mocks.fetchPrevious.mockImplementation((_ids, _date, source) => source === 'HealthView.fetchPrevForBlock'
      ? gate.promise : Promise.resolve({}));
    await startRoutine(); await editKg('31');
    const select = [...host.querySelectorAll('select')].find(node => [...node.options].some(option => option.text === 'addSession'))!;
    await act(async () => { select.selectedIndex = 1; select.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => gate.release(previous));
    expect(snapshot().rows.map(row => row.block_id)).toEqual(['pull', 'push', '__session__']);
    expect(snapshot().rows[1]!.sets[0]!.kg).toBe('31');
    expect(mocks.showToast).toHaveBeenCalledWith('loaded');
  });
  it('ignores a retained Add callback from an old committed date lifetime before fetching', async () => {
    await render(); const add = mocks.addCallback!; await navigateABA();
    mocks.fetchPrevious.mockClear(); const before = snapshot();
    await invoke(() => add(blocks[0]!));
    expect(mocks.fetchPrevious).not.toHaveBeenCalled(); expect(snapshot()).toEqual(before);
  });
  it('does not reuse an old-date Previous cache entry for a current-date addition', async () => {
    await render(); const gate = deferred<any>();
    mocks.fetchPrevious.mockImplementation((_ids, _date, source) => source === 'HealthView.fetchPrevForBlock'
      ? gate.promise : Promise.resolve({}));
    await invoke(() => mocks.addCallback!(blocks[1]!)); await render({ selectedDate: date(Y) });
    await act(async () => gate.release(previous));
    mocks.fetchPrevious.mockReset().mockResolvedValue({});
    await invoke(() => mocks.addCallback!(blocks[1]!));
    expect(mocks.fetchPrevious).toHaveBeenCalledWith(['pull'], Y, 'HealthView.fetchPrevForBlock', A);
    expect(snapshot().rows[0]!.sets).toHaveLength(1);
  });
  it('a delayed routine cannot restore a row removed while it was awaiting Previous', async () => {
    seed(); await render({ healthRoutines: routines }); const gate = deferred<any>();
    mocks.fetchPrevious.mockImplementation((_ids, _date, source) => source === 'HealthView.fetchPrevForBlock'
      ? gate.promise : Promise.resolve({}));
    await startRoutine(); await invoke(removeCallback());
    expect(snapshot().rows).toEqual([]);
    await act(async () => gate.release(previous));
    expect(snapshot().rows.map(row => row.block_id)).toEqual(['pull']);
  });
});

describe('shared date lifetime real mounted Save/Delete', () => {
  it('admits only one save before rerender and while that same lifetime is pending', async () => {
    seed(); await render();
    const gate = deferred<any>(); mocks.saveHealthWorkouts.mockReturnValue(gate.promise);
    const callback = mocks.saveCallback!;
    await invoke(() => { void callback(); void callback(); });
    await invoke(() => mocks.saveCallback!());
    expect(mocks.saveHealthWorkouts).toHaveBeenCalledTimes(1);
    expect(mocks.normalize).toHaveBeenCalledTimes(1);
    await act(async () => gate.release({ status: 'success', total: 1, succeeded: 1, failed: 0 }));
    expect(mocks.showToast.mock.calls.filter(call => call[0] === 'workoutSaved')).toHaveLength(1);
  });
  it.each(['date', 'account', 'date-roundtrip', 'account-roundtrip'] as const)(
    'admits a new %s lifetime while the old flight is unresolved; stale finally cannot release it', async transition => {
      seed(); await render();
      const old = deferred<any>(), current = deferred<any>();
      mocks.saveHealthWorkouts.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
      await invoke(() => mocks.saveCallback!());
      if (transition.startsWith('date')) {
        await render({ selectedDate: date(Y) });
        if (transition === 'date-roundtrip') await render({ selectedDate: date(X) });
      } else {
        await render({ user: { id: B, name: 'B' }, selectedDate: date(Z) });
        if (transition === 'account-roundtrip') await render({ user: { id: A, name: 'A2' }, selectedDate: date(X) });
      }
      await invoke(() => mocks.saveCallback!());
      expect(mocks.saveHealthWorkouts).toHaveBeenCalledTimes(2);
      const before = snapshot();
      await act(async () => old.release({ status: 'success', total: 1, succeeded: 1, failed: 0 }));
      expect(snapshot()).toEqual(before);
      await invoke(() => mocks.saveCallback!());
      expect(mocks.saveHealthWorkouts).toHaveBeenCalledTimes(2);
      await act(async () => current.release({ status: 'success', total: 1, succeeded: 1, failed: 0 }));
      expect(snapshot()).toMatchObject({ saving: false, locked: true, dirty: false });
    });
  it('old completion after newer success preserves acknowledgement and permits a subsequent save', async () => {
    seed(); await render();
    const old = deferred<any>(); mocks.saveHealthWorkouts.mockReturnValueOnce(old.promise);
    await invoke(() => mocks.saveCallback!()); await navigateABA(); await save();
    const acknowledged = snapshot();
    await act(async () => old.release({ status: 'success', total: 1, succeeded: 1, failed: 0 }));
    expect(snapshot()).toEqual(acknowledged);
    await save(); expect(mocks.saveHealthWorkouts).toHaveBeenCalledTimes(3);
  });
  it.each(['failure', 'aborted', 'reject'] as const)('releases a current %s flight for retry without losing its draft', async outcome => {
    seed(); await render();
    if (outcome === 'reject') mocks.saveHealthWorkouts.mockRejectedValueOnce(new Error('local write failed'));
    else mocks.saveHealthWorkouts.mockResolvedValueOnce({ status: outcome, total: 1, succeeded: 0, failed: 1 });
    await save();
    expect(snapshot()).toMatchObject({ saving: false, locked: false, dirty: true });
    expect(snapshot().bytes).not.toBeNull();
    await save(); expect(mocks.saveHealthWorkouts).toHaveBeenCalledTimes(2);
    expect(snapshot()).toMatchObject({ saving: false, locked: true, dirty: false });
  });
  it('releases the guard after normalization throws and after empty validation', async () => {
    await render(); await save(); expect(mocks.saveHealthWorkouts).not.toHaveBeenCalled();
    seed(); await navigateABA();
    mocks.onNormalize = () => { mocks.onNormalize = null; throw new Error('invalid set'); };
    await save(); expect(mocks.saveHealthWorkouts).not.toHaveBeenCalled();
    expect(snapshot()).toMatchObject({ saving: false, dirty: true, locked: false });
    await save(); expect(mocks.saveHealthWorkouts).toHaveBeenCalledTimes(1);
  });
  it('S01 valid same-lifetime Save normalizes/reconciles; same-date rerender is admitted', async () => {
    seed(); await render(); await render({ appSettings: { ...props.appSettings, darkMode: true } });
    expect(snapshot().saving).toBe(false); await save();
    expect(mocks.saveHealthWorkouts).toHaveBeenCalledTimes(1);
    expect(mocks.normalize).toHaveBeenCalledTimes(1);
    expect(snapshot()).toMatchObject({ dirty: false, dirtyRef: false, saving: false, locked: true, bytes: null });
    expect(mocks.showToast.mock.calls.map(call => call[0])).toContain('workoutSaved');
    expect(mocks.inputs[0].input.date).toBe(X);
    expect(mocks.inputs[0].input.workouts[0].sets[0].kg).toBeDefined();
  });
  it.each([false, true])('S02/S03 delayed Save date roundtrip=%s preserves real scoped draft', async roundtrip => {
    seed(); await render();
    const gate = deferred<any>(); mocks.saveHealthWorkouts.mockReturnValue(gate.promise);
    await invoke(() => mocks.saveCallback!()); expect(snapshot().saving).toBe(true);
    await render({ selectedDate: date(Y) }); assertRestored(DRAFT_Y);
    if (roundtrip) await render({ selectedDate: date(X) });
    await editKg('37'); const before = snapshot();
    await act(async () => gate.release({ status: 'success', total: 1, succeeded: 1, failed: 0 }));
    expect(snapshot()).toEqual(before); expect(mocks.inputs).toHaveLength(1);
  });
  it('S04 A1/B/A2 keeps independent account generation fencing', async () => {
    seed(); await render(); const gate = deferred<any>(); mocks.saveHealthWorkouts.mockReturnValue(gate.promise);
    await invoke(() => mocks.saveCallback!());
    await render({ user: { id: B, name: 'B' } }); await render({ user: { id: A, name: 'A2' } });
    const before = snapshot(); await act(async () => gate.release({ status: 'success', total: 1, succeeded: 1, failed: 0 }));
    expect(snapshot()).toEqual(before);
  });
  it('S05 completion after unmount makes no UI/storage/cache continuation', async () => {
    const bytes = seed(); await render(); const gate = deferred<any>(); mocks.saveHealthWorkouts.mockReturnValue(gate.promise);
    await invoke(() => mocks.saveCallback!()); act(() => root!.unmount()); root = null;
    const toastCount = mocks.showToast.mock.calls.length;
    await act(async () => gate.release({ status: 'success', total: 1, succeeded: 1, failed: 0 }));
    assertBytes(bytes); expect(mocks.showToast).toHaveBeenCalledTimes(toastCount);
    expect(mocks.mutateDaily).not.toHaveBeenCalled();
  });
  it.each(['failure', 'partial', 'reject'] as const)('S07 stale %s cannot toast/clear/lock/reset X2', async outcome => {
    seed(); await render(); const gate = deferred<any>(); mocks.saveHealthWorkouts.mockReturnValue(gate.promise);
    await invoke(() => mocks.saveCallback!()); await navigateABA(); const before = snapshot();
    await act(async () => {
      if (outcome === 'reject') gate.reject(new Error('version conflict'));
      else gate.release({ status: outcome, total: 2, succeeded: outcome === 'partial' ? 1 : 0, failed: 1 });
    });
    expect(snapshot()).toEqual(before);
  });
  it('S07 same-lifetime partial/error controls retain existing outcomes', async () => {
    seed(); await render(); mocks.saveHealthWorkouts.mockResolvedValue({ status: 'failure', total: 1, succeeded: 0, failed: 1 });
    await save(); expect(snapshot()).toMatchObject({ dirty: true, saving: false, locked: false });
    expect(mocks.showToast.mock.calls.map(call => call[0])).toContain('failedSave');
    mocks.saveHealthWorkouts.mockResolvedValue({ status: 'partial', total: 2, succeeded: 1, failed: 1 });
    await save(); expect(snapshot()).toMatchObject({ dirty: false, saving: false, locked: true, bytes: null });
  });
  it('S08 first-layout null publication and retained empty handler reject before toast/dispatch', async () => {
    mocks.invokeBeforePublication = true; await render();
    expect(mocks.saveHealthWorkouts).not.toHaveBeenCalled(); expect(mocks.showToast).not.toHaveBeenCalled();
    const old = mocks.saveCallback!; await navigateABA();
    await invoke(old); expect(mocks.showToast).not.toHaveBeenCalled();
    await save(); expect(mocks.showToast.mock.calls.map(call => call[0])).toContain('noWorkouts');
  });
  it('S08 retained nonempty Save cannot normalize/dispatch against X2', async () => {
    seed(); await render(); const old = mocks.saveCallback!; await navigateABA(); const before = snapshot();
    await invoke(old); expect(mocks.inputs).toHaveLength(0); expect(snapshot()).toEqual(before);
    expect(mocks.normalize).not.toHaveBeenCalled();
  });
  it('S08 loss of committed scope during real normalization stops persistence dispatch', async () => {
    seed(); await render();
    mocks.onNormalize = () => {
      mocks.onNormalize = null;
      props = { ...props, selectedDate: date(Y) };
      flushSync(() => root!.render(createElement(HealthView, props)));
    };
    await invoke(() => mocks.saveCallback!());
    expect(mocks.normalize).toHaveBeenCalledTimes(1);
    expect(mocks.inputs).toHaveLength(0); assertRestored(DRAFT_Y);
  });
  it.each(['success', 'partial'] as const)('S03/S07 queued %s RAF is fenced inside callback', async status => {
    seed(); mocks.mobile = true; await render();
    const scroll = vi.fn(); vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(scroll);
    mocks.saveHealthWorkouts.mockResolvedValue({ status, total: 2, succeeded: 1, failed: status === 'partial' ? 1 : 0 });
    await save(); expect(raf).toHaveLength(1); await navigateABA();
    await act(async () => raf.forEach(callback => callback(0))); expect(scroll).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
  it('D01 persisted same-lifetime Delete preserves captured ID/version and removes current row', async () => {
    seed(); await render(); await invoke(removeCallback());
    expect(mocks.deleteHealthWorkout).toHaveBeenCalledTimes(1);
    expect(mocks.inputs[0].input).toMatchObject({ accountId: A, workoutId: DRAFT_X[0].id, expectedVersion: 'v1' });
    expect(snapshot().rows).toEqual([]); expect(snapshot().bytes).toBeNull();
  });
  it.each([false, true])('D02/D03 delayed Delete roundtrip=%s cannot filter or clear later draft', async roundtrip => {
    seed(); await render(); const gate = deferred<any>(); mocks.deleteHealthWorkout.mockReturnValue(gate.promise);
    await invoke(removeCallback()); await render({ selectedDate: date(Y) });
    if (roundtrip) await render({ selectedDate: date(X) }); const before = snapshot();
    await act(async () => gate.release({ status: 'success' })); expect(snapshot()).toEqual(before);
  });
  it('D04 A1/B/A2 cannot revive old Delete', async () => {
    seed(); await render(); const gate = deferred<any>(); mocks.deleteHealthWorkout.mockReturnValue(gate.promise);
    await invoke(removeCallback()); await render({ user: { id: B, name: 'B' } }); await render({ user: { id: A, name: 'A2' } });
    const before = snapshot(); await act(async () => gate.release({ status: 'success' })); expect(snapshot()).toEqual(before);
  });
  it('D05 unmounted Delete has no row/storage/error/cache effect', async () => {
    const bytes = seed(); await render(); const gate = deferred<any>(); mocks.deleteHealthWorkout.mockReturnValue(gate.promise);
    await invoke(removeCallback()); act(() => root!.unmount()); root = null;
    const count = mocks.showToast.mock.calls.length; await act(async () => gate.reject(new Error('HTTP 409')));
    assertBytes(bytes); expect(mocks.showToast).toHaveBeenCalledTimes(count); expect(mocks.mutateDaily).not.toHaveBeenCalled();
  });
  it('D07 stale conflict is quiet; current conflict preserves draft and reports error', async () => {
    seed(); await render(); const gate = deferred<any>(); mocks.deleteHealthWorkout.mockReturnValue(gate.promise);
    await invoke(removeCallback()); await navigateABA(); const before = snapshot();
    await act(async () => gate.reject(new Error('expected-version conflict'))); expect(snapshot()).toEqual(before);
    mocks.deleteHealthWorkout.mockRejectedValue(new Error('HTTP 409')); await invoke(removeCallback());
    expect(snapshot().rows).toEqual(before.rows); expect(snapshot().bytes).toBe(before.bytes);
    expect(mocks.showToast.mock.calls.length).toBeGreaterThan(before.toasts.length);
  });
  it('D08 draft-only current removal is local; retained stale removal does nothing', async () => {
    storage.setItem(localHealthDraftKey(A, X), JSON.stringify([row('temp-X')]));
    storage.setItem(localHealthDraftKey(A, Y), JSON.stringify(DRAFT_Y));
    await render(); const stale = removeCallback(); await navigateABA(); const before = snapshot();
    await invoke(stale); expect(snapshot()).toEqual(before); expect(mocks.inputs).toHaveLength(0);
    await invoke(removeCallback()); expect(snapshot().rows).toEqual([]); expect(snapshot().bytes).toBeNull();
    expect(mocks.inputs).toHaveLength(0);
  });
});
