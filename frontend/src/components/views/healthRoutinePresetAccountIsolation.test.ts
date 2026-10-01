// @vitest-environment happy-dom
import { createElement, useEffect } from 'react';
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

const mocks = vi.hoisted(() => ({
  remoteMode: true,
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
vi.mock('./features/health/healthWorkoutPersistence', () => ({
  deleteHealthWorkout: (...args: unknown[]) => mocks.deleteHealthWorkout(...args),
  saveHealthWorkouts: (...args: unknown[]) => mocks.saveHealthWorkouts(...args),
}));
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
vi.mock('../../lib/healthBackfillUiSafety', () => ({
  isCurrentHealthAccountGeneration: (
    token: { accountId: string; generation: number },
    accountId: string,
    generation: number,
  ) => token.accountId === accountId && token.generation === generation,
  localHealthDraftKey: (accountId: string, dateKey: string) => `healthDraft:${accountId}:${dateKey}`,
  readLocalHealthWorkoutDraft: () => null,
  localHealthMemoKey: (accountId: string, dateKey: string) => `healthMemo:${accountId}:${dateKey}`,
  localHealthWriteFailureDisposition: () => ({ kind: 'unknown' }),
}));
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
  }) => createElement('button', {
    type: 'button',
    disabled,
    onClick,
    'data-testid': 'health-save-workout',
  }, label),
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
vi.mock('./features/health/HealthMobileWorkoutActions', () => ({ HealthMobileWorkoutActions: () => null }));

import { HealthView } from './HealthView';
import type { HealthProps, HealthRoutine, ExerciseBlock, Workout } from '../../types';

const theme = {
  card: 'card', input: 'input', border: 'border', text: 'text', textMuted: 'muted', hoverBg: 'hover',
};
const date = new Date('2026-01-10T00:00:00.000Z');
const blocks: ExerciseBlock[] = [
  { id: 'push', name: 'Push', type: 'strength', tags: ['UPPER'], cardio_mode: 'both' },
  { id: 'pull', name: 'Pull', type: 'strength', tags: ['UPPER'], cardio_mode: 'both' },
];
const persistedWorkout: Workout = {
  id: 'persisted-workout',
  block_id: 'push',
  exercise_blocks: blocks[0]!,
  local_version: 'version-1',
  sets: [{ type: 'strength', set: 1, kg: '20', reps: '5', done: true }],
};
const ACCOUNT_A_CUSTOM_ID = '00000000-0000-5000-8000-00000000000a';
const ACCOUNT_B_CUSTOM_ID = '00000000-0000-5000-8000-00000000000b';
const routine = (id: string, dayName: string, blockIds: string[]): HealthRoutine => ({ id, day_name: dayName, blocks: blockIds });

function healthProps(overrides: Partial<HealthProps> = {}): HealthProps {
  return {
    now: {} as HealthProps['now'],
    currentDate: date,
    setCurrentDate: vi.fn(),
    selectedDate: date,
    setSelectedDate: vi.fn(),
    formatDate: (value: Date | HealthProps['now']) => (value instanceof Date ? value.toISOString().slice(0, 10) : '2026-01-10'),
    isToday: () => true,
    showToast: mocks.showToast,
    appSettings: { darkMode: false } as HealthProps['appSettings'],
    updateSetting: vi.fn(),
    theme,
    THEME_COLORS: [],
    mutateDaily: mocks.mutateDaily,
    mutateStatic: mocks.mutateStatic,
    user: { id: 'account-a', name: 'Account A' },
    schedules: [],
    weeklySchedules: [],
    workouts: [],
    healthBlocks: blocks,
    healthRoutines: [],
    inbody: {} as HealthProps['inbody'],
    isDailyLoading: false,
    ...overrides,
  };
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function mount(props: HealthProps): Promise<void> {
  container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    root = createRoot(container!);
    root.render(createElement(HealthView, props));
  });
  await settle();
}

function presetSelect(): HTMLSelectElement {
  return container!.querySelector('select[aria-label="healthPresetLabel"]') as HTMLSelectElement;
}

async function openPresetDeleteConfirmation(): Promise<NonNullable<typeof mocks.confirmModal.current>> {
  const actionsButton = container!.querySelector('button[aria-label="healthPresetActions"]') as HTMLButtonElement;
  await act(async () => actionsButton.click());
  const deleteButton = Array.from(container!.querySelectorAll('button'))
    .find(button => button.textContent?.trim() === 'healthPresetDelete') as HTMLButtonElement | undefined;
  if (!deleteButton) throw new Error('preset delete action was not rendered');
  await act(async () => deleteButton.click());
  await settle();
  const confirmation = mocks.confirmModal.current;
  if (!confirmation) throw new Error('preset delete confirmation was not rendered');
  return confirmation;
}

function writeCustomPreset(accountId: string, presetId: string, name: string) {
  const state = createRoutinePresetState({ routines: [], splitCount: 1 });
  state.presets.push(createEmptyRoutinePreset(presetId, name, 1));
  state.activePresetId = presetId;
  writeRoutinePresetState(localStorage, accountId, state);
  return state;
}

function buttonWithText(text: string): HTMLButtonElement {
  const button = Array.from(container!.querySelectorAll('button'))
    .find(candidate => candidate.textContent?.trim() === text);
  if (!button) throw new Error(`Button not rendered: ${text}`);
  return button;
}

function workoutDeleteButton(): HTMLButtonElement {
  const button = container!.querySelector<HTMLButtonElement>(
    '[data-k126-workout-exercise-card] button.absolute',
  );
  if (!button) throw new Error('Workout delete button not rendered');
  return button;
}

function deferredCommit() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  mocks.remoteMode = true;
  mocks.mobile = false;
  mocks.authFetch.mockReset().mockResolvedValue({ ok: true, text: async () => '' });
  mocks.showToast.mockReset();
  mocks.mutateDaily.mockReset();
  mocks.mutateStatic.mockReset();
  mocks.deleteHealthWorkout.mockReset();
  mocks.saveHealthWorkouts.mockReset();
  mocks.showConfirm.mockReset();
  mocks.clearConfirm.mockReset();
  mocks.confirmModal.current = null;
  mocks.notesState.notes = [];
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('UI-06 production Health composition hierarchy', () => {
  it.each([1024, 1279, 1280])(
    'renders Today before populated setup and support at the %ipx boundary',
    async width => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });

      const populatedBlocks: ExerciseBlock[] = Array.from({ length: 12 }, (_, index) => ({
        id: `block-${index + 1}`,
        name: `Exercise ${index + 1}`,
        type: 'strength',
        tags: ['UPPER'],
        cardio_mode: 'both',
      }));
      const populatedWorkouts: Workout[] = populatedBlocks.slice(0, 4).map((block, index) => ({
        id: `workout-${index + 1}`,
        block_id: block.id,
        exercise_blocks: block,
        sets: Array.from({ length: 4 }, (_, setIndex) => ({
          type: 'strength' as const,
          set: setIndex + 1,
          kg: '40',
          reps: '8',
          done: false,
        })),
      }));
      const populatedRoutines = Array.from({ length: 7 }, (_, index) => routine(
        `routine-${index + 1}`,
        `Day ${index + 1}`,
        populatedBlocks.slice(index, index + 4).map(block => block.id),
      ));

      await mount(healthProps({
        healthBlocks: populatedBlocks,
        healthRoutines: populatedRoutines,
        workouts: populatedWorkouts,
      }));

      const composition = container!.querySelector('[data-health-composition="workout-first"]') as HTMLElement;
      const execution = container!.querySelector('[data-health-composition-role="execution"]') as HTMLElement;
      const active = container!.querySelector('[data-health-composition-role="active-workout"]') as HTMLElement;
      const setup = container!.querySelector('[data-health-composition-role="setup"]') as HTMLElement;
      const support = container!.querySelector('[data-health-composition-role="support"]') as HTMLElement;

      expect(execution.parentElement).toBe(composition);
      expect(setup.parentElement).toBe(composition);
      expect(support.parentElement).toBe(composition);
      expect(active.compareDocumentPosition(setup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(setup.compareDocumentPosition(support) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(active.getAttribute('data-health-hierarchy-level')).toBe('primary');
      expect(setup.getAttribute('data-health-hierarchy-level')).toBe('secondary');
      expect(support.getAttribute('data-health-hierarchy-level')).toBe('tertiary');
      expect(container!.querySelectorAll('[data-health-test-region="library"] button')).toHaveLength(12);
      expect(container!.querySelector('[data-health-test-region="support-panels"]')?.textContent).toContain('Calendar');

      expect(composition.className).toContain('xl:grid-cols-[minmax(300px,0.34fr)_minmax(0,1fr)]');
      expect(composition.className).toContain('xl:grid-rows-[minmax(360px,68fr)_minmax(200px,32fr)]');
    },
  );
});

describe('HEALTH_10D account transition isolation', () => {
  it('does not expose A during the synchronous A -> B frame and immediately uses B state', async () => {
    const accountA = createRoutinePresetState({ routines: [routine('a-day-1', 'Day 1', ['push'])], splitCount: 1 });
    accountA.presets.push(createEmptyRoutinePreset(ACCOUNT_A_CUSTOM_ID, 'A Custom', 1));
    accountA.activePresetId = ACCOUNT_A_CUSTOM_ID;
    const accountB = createRoutinePresetState({ routines: [routine('b-day-1', 'Day 1', ['pull'])], splitCount: 1 });
    accountB.presets.push(createEmptyRoutinePreset(ACCOUNT_B_CUSTOM_ID, 'B Custom', 1));
    accountB.activePresetId = ACCOUNT_B_CUSTOM_ID;
    writeRoutinePresetState(localStorage, 'account-a', accountA);
    writeRoutinePresetState(localStorage, 'account-b', accountB);

    await mount(healthProps({ healthRoutines: [routine('a-day-1', 'Day 1', ['push'])] }));
    expect(presetSelect().value).toBe(ACCOUNT_A_CUSTOM_ID);

    flushSync(() => root?.render(createElement(HealthView, healthProps({
      user: { id: 'account-b', name: 'Account B' },
      healthRoutines: [routine('b-day-1', 'Day 1', ['pull'])],
    }))));

    expect(presetSelect().value).toBe(ACCOUNT_B_CUSTOM_ID);
    expect(presetSelect().value).not.toBe(ACCOUNT_A_CUSTOM_ID);
    await settle();
    expect(readRoutinePresetState(localStorage, 'account-a')?.activePresetId).toBe(ACCOUNT_A_CUSTOM_ID);
    expect(readRoutinePresetState(localStorage, 'account-b')?.activePresetId).toBe(ACCOUNT_B_CUSTOM_ID);
  });

  it('uses B initialization semantics without reusing A when B has no scoped state', async () => {
    const accountA = createRoutinePresetState({ routines: [routine('a-day-1', 'Day 1', ['push'])], splitCount: 1 });
    accountA.presets.push(createEmptyRoutinePreset(ACCOUNT_A_CUSTOM_ID, 'A Custom', 1));
    accountA.activePresetId = ACCOUNT_A_CUSTOM_ID;
    writeRoutinePresetState(localStorage, 'account-a', accountA);
    localStorage.setItem('healthSplitCount', '5');
    localStorage.setItem('healthRoutinePlannedSets', JSON.stringify({ 'Day 1': { push: 7 } }));

    await mount(healthProps({ healthRoutines: [routine('a-day-1', 'Day 1', ['push'])] }));
    expect(presetSelect().value).toBe(ACCOUNT_A_CUSTOM_ID);
    flushSync(() => root?.render(createElement(HealthView, healthProps({
      user: { id: 'account-b', name: 'Account B' },
      healthRoutines: [],
    }))));

    expect(presetSelect().value).toBe(DEFAULT_ROUTINE_PRESET_ID);
    expect(presetSelect().value).not.toBe(ACCOUNT_A_CUSTOM_ID);
    expect((container!.querySelector('input[type="number"]') as HTMLInputElement).value).toBe('3');
    await settle();
    expect(readRoutinePresetState(localStorage, 'account-a')?.activePresetId).toBe(ACCOUNT_A_CUSTOM_ID);
    expect(readRoutinePresetState(localStorage, 'account-b')?.presets[0].splitCount).toBe(3);
    expect(readRoutinePresetState(localStorage, 'account-b')?.presets[0].days[0].plannedSets).toEqual({});
    expect(localStorage.getItem('healthSplitCount')).toBe('5');
    expect(getRoutinePlannedSetsForDay('Day 1').push).toBe(7);
    expect(localStorage.getItem('healthRoutinePlannedSets')).toContain('push');
  });

  it('restores each account on A -> B -> A without cross-account storage writes', async () => {
    const accountA = createRoutinePresetState({ routines: [], splitCount: 1 });
    accountA.presets.push(createEmptyRoutinePreset(ACCOUNT_A_CUSTOM_ID, 'A Custom', 1));
    accountA.activePresetId = ACCOUNT_A_CUSTOM_ID;
    const accountB = createRoutinePresetState({ routines: [], splitCount: 1 });
    accountB.presets.push(createEmptyRoutinePreset(ACCOUNT_B_CUSTOM_ID, 'B Custom', 1));
    accountB.activePresetId = ACCOUNT_B_CUSTOM_ID;
    writeRoutinePresetState(localStorage, 'account-a', accountA);
    writeRoutinePresetState(localStorage, 'account-b', accountB);
    const accountABefore = JSON.stringify(accountA);

    await mount(healthProps());
    flushSync(() => root?.render(createElement(HealthView, healthProps({ user: { id: 'account-b', name: 'Account B' } }))));
    expect(presetSelect().value).toBe(ACCOUNT_B_CUSTOM_ID);
    await settle();
    expect(JSON.stringify(readRoutinePresetState(localStorage, 'account-a'))).toBe(accountABefore);

    flushSync(() => root?.render(createElement(HealthView, healthProps())));
    expect(presetSelect().value).toBe(ACCOUNT_A_CUSTOM_ID);
    await settle();
    expect(readRoutinePresetState(localStorage, 'account-a')?.activePresetId).toBe(ACCOUNT_A_CUSTOM_ID);
    expect(readRoutinePresetState(localStorage, 'account-b')?.activePresetId).toBe(ACCOUNT_B_CUSTOM_ID);
  });

  it('hides an A preset deletion confirmation during the synchronous A -> B render', async () => {
    writeCustomPreset('account-a', ACCOUNT_A_CUSTOM_ID, 'A Custom');
    writeCustomPreset('account-b', ACCOUNT_B_CUSTOM_ID, 'B Custom');

    await mount(healthProps());
    const confirmation = await openPresetDeleteConfirmation();
    expect(confirmation.message).toContain('A Custom');

    flushSync(() => root?.render(createElement(HealthView, healthProps({
      user: { id: 'account-b', name: 'Account B' },
    }))));

    expect(container!.querySelector('[role="dialog"]')).toBeNull();
    expect(presetSelect().value).toBe(ACCOUNT_B_CUSTOM_ID);
  });

  it('clears the stale confirmation after stabilization and keeps a new B confirmation', async () => {
    writeCustomPreset('account-a', ACCOUNT_A_CUSTOM_ID, 'A Custom');
    writeCustomPreset('account-b', ACCOUNT_B_CUSTOM_ID, 'B Custom');

    await mount(healthProps());
    await openPresetDeleteConfirmation();
    flushSync(() => root?.render(createElement(HealthView, healthProps({
      user: { id: 'account-b', name: 'Account B' },
    }))));
    await settle();

    expect(mocks.confirmModal.current).toBeNull();
    const bConfirmation = await openPresetDeleteConfirmation();
    expect(bConfirmation.message).toContain('B Custom');
    await settle();
    expect(mocks.confirmModal.current?.message).toContain('B Custom');
  });

  it('makes a stale A confirmation callback a no-op while B is current', async () => {
    const accountA = writeCustomPreset('account-a', ACCOUNT_A_CUSTOM_ID, 'A Custom');
    const accountB = writeCustomPreset('account-b', ACCOUNT_B_CUSTOM_ID, 'B Custom');
    const accountABefore = JSON.stringify(accountA);
    const accountBBefore = JSON.stringify(accountB);

    await mount(healthProps());
    const staleConfirmation = await openPresetDeleteConfirmation();
    flushSync(() => root?.render(createElement(HealthView, healthProps({
      user: { id: 'account-b', name: 'Account B' },
    }))));

    await act(async () => {
      await staleConfirmation.onConfirm();
    });
    await settle();

    expect(JSON.stringify(readRoutinePresetState(localStorage, 'account-a'))).toBe(accountABefore);
    expect(JSON.stringify(readRoutinePresetState(localStorage, 'account-b'))).toBe(accountBBefore);
    expect(presetSelect().value).toBe(ACCOUNT_B_CUSTOM_ID);
  });

  it('still deletes a custom preset when the initiating account remains current', async () => {
    writeCustomPreset('account-a', ACCOUNT_A_CUSTOM_ID, 'A Custom');

    await mount(healthProps());
    const confirmation = await openPresetDeleteConfirmation();
    await act(async () => {
      await confirmation.onConfirm();
    });
    await settle();

    const state = readRoutinePresetState(localStorage, 'account-a');
    expect(state?.presets.some(preset => preset.id === ACCOUNT_A_CUSTOM_ID)).toBe(false);
    expect(state?.activePresetId).toBe(DEFAULT_ROUTINE_PRESET_ID);
    expect(presetSelect().value).toBe(DEFAULT_ROUTINE_PRESET_ID);
  });
});

describe('REL-05G5B2B2B HealthView durable Workout notification wiring', () => {
  it('emits payload-free original-account notifications from actual save and delete paths', async () => {
    const onLocalWorkoutCommitted = vi.fn();
    mocks.saveHealthWorkouts.mockImplementation(async (input: {
      onLocalCommit?: () => void;
    }) => {
      input.onLocalCommit?.();
      return { status: 'success', localResults: [{ id: persistedWorkout.id, version: 'version-2' }] };
    });
    mocks.deleteHealthWorkout.mockImplementation(async (input: {
      onLocalCommit?: () => void;
    }) => {
      input.onLocalCommit?.();
      return { status: 'success' };
    });

    await mount(healthProps({ workouts: [persistedWorkout], onLocalWorkoutCommitted }));
    await act(async () => buttonWithText('editBtn').click());
    await act(async () => container!.querySelector<HTMLButtonElement>('[data-testid="health-save-workout"]')!.click());
    await settle();
    await act(async () => buttonWithText('editBtn').click());
    await act(async () => workoutDeleteButton().click());
    await settle();

    expect(onLocalWorkoutCommitted.mock.calls).toEqual([['account-a'], ['account-a']]);
    expect(mocks.saveHealthWorkouts.mock.calls[0]?.[0]).toMatchObject({ accountId: 'account-a' });
    expect(mocks.deleteHealthWorkout.mock.calls[0]?.[0]).toMatchObject({ accountId: 'account-a' });
  });

  it.each(['save', 'delete'] as const)(
    'preserves an A1 %s durable notification after A -> B -> A2 while fencing old UI continuation',
    async operation => {
      const gate = deferredCommit();
      const onLocalWorkoutCommitted = vi.fn();
      const complete = async (input: {
        onLocalCommit?: () => void;
        shouldContinue?: () => boolean;
      }) => {
        await gate.promise;
        input.onLocalCommit?.();
        return input.shouldContinue?.() === false
          ? { status: 'aborted' }
          : { status: 'success', localResults: [{ id: persistedWorkout.id, version: 'version-2' }] };
      };
      if (operation === 'save') mocks.saveHealthWorkouts.mockImplementation(complete);
      else mocks.deleteHealthWorkout.mockImplementation(complete);

      const propsA = healthProps({ workouts: [persistedWorkout], onLocalWorkoutCommitted });
      await mount(propsA);
      await act(async () => buttonWithText('editBtn').click());
      await act(async () => {
        if (operation === 'save') {
          container!.querySelector<HTMLButtonElement>('[data-testid="health-save-workout"]')!.click();
        } else {
          workoutDeleteButton().click();
        }
        await Promise.resolve();
      });

      flushSync(() => root?.render(createElement(HealthView, healthProps({
        user: { id: 'account-b', name: 'Account B' },
        workouts: [persistedWorkout],
        onLocalWorkoutCommitted,
      }))));
      await settle();
      flushSync(() => root?.render(createElement(HealthView, propsA)));
      await settle();
      mocks.showToast.mockClear();

      await act(async () => {
        gate.release();
        await gate.promise;
        await Promise.resolve();
      });
      await settle();

      expect(onLocalWorkoutCommitted).toHaveBeenCalledTimes(1);
      expect(onLocalWorkoutCommitted).toHaveBeenCalledWith('account-a');
      expect(mocks.showToast.mock.calls.map(call => call[0])).not.toContain('workoutSaved');
      if (operation === 'delete') {
        expect(container!.querySelectorAll('[data-k126-workout-exercise-card]')).toHaveLength(1);
      }
    },
  );
});

describe('REL-05G5B2B2B composite Previous selection reconciliation', () => {
  const legacyRecord = (localDate: string, rowId: string) => ({
    source: 'legacy' as const,
    readId: JSON.stringify(['legacy', 'account-a', rowId]),
    localDate,
    capability: 'read_only' as const,
    legacy: {
      accountId: 'account-a', rowId, localDate, blockId: 'push', sortOrder: 0,
      exerciseDisplay: { kind: 'historical_fallback' as const, name: `Workout ${localDate}` },
      sets: [{ type: 'strength' as const, set: 1, kg: 20, reps: 5, done: true }],
    },
  });
  const rangeView = (dates: string[]) => ({
    accountId: 'account-a', scope: null, startDate: '2025-01-10', endDate: '2026-01-09',
    result: { status: 'complete' as const, legacyStatus: 'success' as const, canonicalStatus: 'success' as const,
      records: dates.map((value, index) => legacyRecord(value, `row-${index}`)) },
    dates: dates.map((value, index) => ({ localDate: value, legacyRows: [legacyRecord(value, `row-${index}`)], canonicalSessions: [] })),
  });
  const rangeModel = (phase: 'loading' | 'settled', dates: string[]) => ({
    phase,
    accountId: 'account-a',
    previousBounds: { startDate: '2025-01-10', endDate: '2026-01-09' },
    monthBounds: { startDate: '2026-01-01', endDate: '2026-01-31' },
    previousView: phase === 'settled' ? rangeView(dates) : null,
    monthView: phase === 'settled' ? rangeView([]) : null,
    isolationError: false,
    retry: vi.fn(),
    invalidateAndReload: vi.fn(),
  });

  it('preserves an eligible selection through loading and reconciles only after settled evidence', async () => {
    const settledBoth = healthProps({ workoutRangeComposite: rangeModel('settled', ['2026-01-02', '2026-01-03']) as never });
    await mount(settledBoth);
    await act(async () => buttonWithText('tabPrevious').click());
    await settle();
    await act(async () => buttonWithText('2026-01-02').click());
    expect(buttonWithText('2026-01-02').getAttribute('aria-pressed')).toBe('true');

    flushSync(() => root!.render(createElement(HealthView, healthProps({
      workoutRangeComposite: rangeModel('loading', []) as never,
    }))));
    expect(container!.querySelector('[data-health-composite-previous-loading]')).not.toBeNull();

    flushSync(() => root!.render(createElement(HealthView, settledBoth)));
    await settle();
    expect(buttonWithText('2026-01-02').getAttribute('aria-pressed')).toBe('true');

    flushSync(() => root!.render(createElement(HealthView, healthProps({
      workoutRangeComposite: rangeModel('loading', []) as never,
    }))));
    await settle();
    flushSync(() => root!.render(createElement(HealthView, healthProps({
      workoutRangeComposite: rangeModel('settled', ['2026-01-03']) as never,
    }))));
    await settle();
    expect(buttonWithText('2026-01-03').getAttribute('aria-pressed')).toBe('true');
  });
});
