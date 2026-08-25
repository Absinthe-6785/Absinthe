// @vitest-environment happy-dom
import { createElement, useEffect } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEmptyRoutinePreset,
  createRoutinePresetState,
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
  deleteHealthWorkout: vi.fn(),
  saveHealthWorkouts: vi.fn(),
}));
vi.mock('../../lib/healthLocalRuntime', () => ({
  createLocalHealthRepository: vi.fn(async () => ({ saveRoutine: vi.fn() })),
  readLocalHealthWorkoutRange: vi.fn(async () => []),
  readLocalPreviousWorkoutRows: vi.fn(async () => []),
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
  formatAbsoluteDateKey: (value: Date) => value.toISOString().slice(0, 10),
  formatLongDate: (value: Date) => value.toISOString().slice(0, 10),
}));
vi.mock('./features/health/buildHealthProjection', () => ({ buildHealthProjection: () => ({ workoutDates: [] }) }));
vi.mock('./features/health/computeWorkoutPrBadge', () => ({ computeWorkoutPrBadgeMap: () => ({}) }));
vi.mock('./features/health/prevWorkoutFetch', () => ({ fetchPrevWorkoutForBlocks: vi.fn(async () => ({})) }));
vi.mock('./features/health/previousWorkoutSession', () => ({
  normalizePreviousWorkoutRows: (rows: unknown[]) => rows,
  previousWorkoutRange: () => ({ startDate: '2026-01-01', endDate: '2026-01-10' }),
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
  WorkspaceToolbar: () => null,
  WorkspaceToolbarPrimary: () => null,
}));
vi.mock('./features/health/HealthWorkspaceNav', () => ({
  HEALTH_WORKSPACE_SECTIONS: [{ id: 'workout' }],
  HealthWorkspaceNav: () => null,
}));
vi.mock('./features/health/nutrition', () => ({ ProteinTracker: () => null }));
vi.mock('./features/health/HealthBlockLibrary', () => ({ HealthBlockLibrary: () => null }));
vi.mock('./features/health/HealthSupportingPanels', () => ({ HealthSupportingPanels: () => null }));
vi.mock('./features/health/WorkoutPrBadge', () => ({ WorkoutPrBadge: () => null }));
vi.mock('./features/health/PreviousWorkoutView', () => ({ PreviousWorkoutView: () => null }));
vi.mock('./features/health/PreviousWorkoutSheet', () => ({ PreviousWorkoutSheet: () => null }));
vi.mock('./features/health/HealthMobileWorkoutActions', () => ({ HealthMobileWorkoutActions: () => null }));

import { HealthView } from './HealthView';
import type { HealthProps, HealthRoutine, ExerciseBlock } from '../../types';

const theme = {
  card: 'card', input: 'input', border: 'border', text: 'text', textMuted: 'muted', hoverBg: 'hover',
};
const date = new Date('2026-01-10T00:00:00.000Z');
const blocks: ExerciseBlock[] = [
  { id: 'push', name: 'Push', type: 'strength', tags: ['UPPER'], cardio_mode: 'both' },
  { id: 'pull', name: 'Pull', type: 'strength', tags: ['UPPER'], cardio_mode: 'both' },
];
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

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  mocks.remoteMode = true;
  mocks.mobile = false;
  mocks.authFetch.mockReset().mockResolvedValue({ ok: true, text: async () => '' });
  mocks.showToast.mockReset();
  mocks.mutateDaily.mockReset();
  mocks.mutateStatic.mockReset();
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

describe('HEALTH_10D account transition isolation', () => {
  it('does not expose A during the synchronous A -> B frame and immediately uses B state', async () => {
    const accountA = createRoutinePresetState({ routines: [routine('a-day-1', 'Day 1', ['push'])], splitCount: 1 });
    accountA.presets.push(createEmptyRoutinePreset('account-a-custom', 'A Custom', 1));
    accountA.activePresetId = 'account-a-custom';
    const accountB = createRoutinePresetState({ routines: [routine('b-day-1', 'Day 1', ['pull'])], splitCount: 1 });
    accountB.presets.push(createEmptyRoutinePreset('account-b-custom', 'B Custom', 1));
    accountB.activePresetId = 'account-b-custom';
    writeRoutinePresetState(localStorage, 'account-a', accountA);
    writeRoutinePresetState(localStorage, 'account-b', accountB);

    await mount(healthProps({ healthRoutines: [routine('a-day-1', 'Day 1', ['push'])] }));
    expect(presetSelect().value).toBe('account-a-custom');

    flushSync(() => root?.render(createElement(HealthView, healthProps({
      user: { id: 'account-b', name: 'Account B' },
      healthRoutines: [routine('b-day-1', 'Day 1', ['pull'])],
    }))));

    expect(presetSelect().value).toBe('account-b-custom');
    expect(presetSelect().value).not.toBe('account-a-custom');
    await settle();
    expect(readRoutinePresetState(localStorage, 'account-a')?.activePresetId).toBe('account-a-custom');
    expect(readRoutinePresetState(localStorage, 'account-b')?.activePresetId).toBe('account-b-custom');
  });

  it('uses B initialization semantics without reusing A when B has no scoped state', async () => {
    const accountA = createRoutinePresetState({ routines: [routine('a-day-1', 'Day 1', ['push'])], splitCount: 1 });
    accountA.presets.push(createEmptyRoutinePreset('account-a-custom', 'A Custom', 1));
    accountA.activePresetId = 'account-a-custom';
    writeRoutinePresetState(localStorage, 'account-a', accountA);
    localStorage.setItem('healthSplitCount', '5');
    localStorage.setItem('healthRoutinePlannedSets', JSON.stringify({ 'Day 1': { push: 7 } }));

    await mount(healthProps({ healthRoutines: [routine('a-day-1', 'Day 1', ['push'])] }));
    expect(presetSelect().value).toBe('account-a-custom');
    flushSync(() => root?.render(createElement(HealthView, healthProps({
      user: { id: 'account-b', name: 'Account B' },
      healthRoutines: [],
    }))));

    expect(presetSelect().value).toBe('health-default');
    expect(presetSelect().value).not.toBe('account-a-custom');
    expect((container!.querySelector('input[type="number"]') as HTMLInputElement).value).toBe('5');
    await settle();
    expect(readRoutinePresetState(localStorage, 'account-a')?.activePresetId).toBe('account-a-custom');
    expect(readRoutinePresetState(localStorage, 'account-b')).toBeNull();
    expect(localStorage.getItem('healthSplitCount')).toBe('5');
    expect(getRoutinePlannedSetsForDay('Day 1').push).toBe(7);
    expect(localStorage.getItem('healthRoutinePlannedSets')).toContain('push');
  });

  it('restores each account on A -> B -> A without cross-account storage writes', async () => {
    const accountA = createRoutinePresetState({ routines: [], splitCount: 1 });
    accountA.presets.push(createEmptyRoutinePreset('account-a-custom', 'A Custom', 1));
    accountA.activePresetId = 'account-a-custom';
    const accountB = createRoutinePresetState({ routines: [], splitCount: 1 });
    accountB.presets.push(createEmptyRoutinePreset('account-b-custom', 'B Custom', 1));
    accountB.activePresetId = 'account-b-custom';
    writeRoutinePresetState(localStorage, 'account-a', accountA);
    writeRoutinePresetState(localStorage, 'account-b', accountB);
    const accountABefore = JSON.stringify(accountA);

    await mount(healthProps());
    flushSync(() => root?.render(createElement(HealthView, healthProps({ user: { id: 'account-b', name: 'Account B' } }))));
    expect(presetSelect().value).toBe('account-b-custom');
    await settle();
    expect(JSON.stringify(readRoutinePresetState(localStorage, 'account-a'))).toBe(accountABefore);

    flushSync(() => root?.render(createElement(HealthView, healthProps())));
    expect(presetSelect().value).toBe('account-a-custom');
    await settle();
    expect(readRoutinePresetState(localStorage, 'account-a')?.activePresetId).toBe('account-a-custom');
    expect(readRoutinePresetState(localStorage, 'account-b')?.activePresetId).toBe('account-b-custom');
  });

  it('hides an A preset deletion confirmation during the synchronous A -> B render', async () => {
    writeCustomPreset('account-a', 'account-a-custom', 'A Custom');
    writeCustomPreset('account-b', 'account-b-custom', 'B Custom');

    await mount(healthProps());
    const confirmation = await openPresetDeleteConfirmation();
    expect(confirmation.message).toContain('A Custom');

    flushSync(() => root?.render(createElement(HealthView, healthProps({
      user: { id: 'account-b', name: 'Account B' },
    }))));

    expect(container!.querySelector('[role="dialog"]')).toBeNull();
    expect(presetSelect().value).toBe('account-b-custom');
  });

  it('clears the stale confirmation after stabilization and keeps a new B confirmation', async () => {
    writeCustomPreset('account-a', 'account-a-custom', 'A Custom');
    writeCustomPreset('account-b', 'account-b-custom', 'B Custom');

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
    const accountA = writeCustomPreset('account-a', 'account-a-custom', 'A Custom');
    const accountB = writeCustomPreset('account-b', 'account-b-custom', 'B Custom');
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
    expect(presetSelect().value).toBe('account-b-custom');
  });

  it('still deletes a custom preset when the initiating account remains current', async () => {
    writeCustomPreset('account-a', 'account-a-custom', 'A Custom');

    await mount(healthProps());
    const confirmation = await openPresetDeleteConfirmation();
    await act(async () => {
      await confirmation.onConfirm();
    });
    await settle();

    const state = readRoutinePresetState(localStorage, 'account-a');
    expect(state?.presets.some(preset => preset.id === 'account-a-custom')).toBe(false);
    expect(state?.activePresetId).toBe('health-default');
    expect(presetSelect().value).toBe('health-default');
  });
});
