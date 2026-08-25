// @vitest-environment happy-dom
import { createElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_ROUTINE_PRESET_ID,
  createEmptyRoutinePreset,
  createRoutinePresetState,
  readRoutinePresetState,
  routinePresetById,
  routinePresetStorageKey,
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
  localRepository: {
    saveRoutine: vi.fn(),
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
vi.mock('../../hooks/useConfirm', () => ({
  useConfirm: () => ({
    confirm: null,
    showConfirm: mocks.showConfirm,
    clearConfirm: mocks.clearConfirm,
    handleConfirm: vi.fn(),
  }),
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
  createLocalHealthRepository: vi.fn(async () => mocks.localRepository),
  readLocalHealthWorkoutRange: vi.fn(async () => []),
  readLocalPreviousWorkoutRows: vi.fn(async () => []),
}));
vi.mock('../../lib/healthBackfillUiSafety', () => ({
  isCurrentHealthAccountGeneration: () => true,
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
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' }),
}));
vi.mock('../common/ConfirmModal', () => ({ ConfirmModal: () => null }));
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

async function rerender(props: HealthProps): Promise<void> {
  await act(async () => root?.render(createElement(HealthView, props)));
  await settle();
}

function presetSelect(): HTMLSelectElement {
  return container!.querySelector('select[aria-label="healthPresetLabel"]') as HTMLSelectElement;
}

function actionButton(): HTMLButtonElement {
  return container!.querySelector('button[aria-label="healthPresetActions"]') as HTMLButtonElement;
}

async function click(element: Element): Promise<void> {
  await act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await settle();
}

async function setInputValue(input: HTMLInputElement, value: string, event = 'change'): Promise<void> {
  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event(event, { bubbles: true }));
  });
  await settle();
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
  mocks.localRepository.saveRoutine.mockReset().mockResolvedValue({ id: 'local-routine', version: 1 });
  mocks.notesState.notes = [];
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('HEALTH_10D routine preset characterization', () => {
  it('characterizes account-switch reset timing, account isolation, and global legacy seeds', async () => {
    const accountAInitial = createRoutinePresetState({ routines: [routine('a-day-1', 'Day 1', ['push'])], splitCount: 1 });
    const accountA = {
      ...accountAInitial,
      presets: [...accountAInitial.presets, createEmptyRoutinePreset('account-a-custom', 'A Custom', 1)],
      activePresetId: 'account-a-custom',
    };
    writeRoutinePresetState(localStorage, 'account-a', accountA);
    localStorage.setItem('healthSplitCount', '5');
    localStorage.setItem('healthRoutinePlannedSets', JSON.stringify({ 'Day 1': { push: 7 } }));

    await mount(healthProps({ healthRoutines: [routine('a-day-1', 'Day 1', ['push'])] }));
    expect(presetSelect().value).toBe('account-a-custom');

    const accountBProps = healthProps({
      user: { id: 'account-b', name: 'Account B' },
      healthRoutines: [],
    });
    flushSync(() => root?.render(createElement(HealthView, accountBProps)));
    const synchronousValue = presetSelect().value;
    await settle();
    const stabilized = readRoutinePresetState(localStorage, 'account-b');

    // Characterization only: the current identity reset is effect-driven, so
    // the old account's selected preset is present for the synchronous frame.
    // This test records the existing cross-account exposure; it does not fix it.
    expect(readRoutinePresetState(localStorage, 'account-a')).toEqual(accountA);
    expect(stabilized).toBeNull();
    expect((container!.querySelector('input[type="number"]') as HTMLInputElement).value).toBe('5');
    expect(synchronousValue).toBe('account-a-custom');
    expect(getRoutinePlannedSetsForDay('Day 1').push).toBe(7);
  });

  it('hydrates a fresh account when legacy rows arrive late, including Day 4, without replacing authored or custom data', async () => {
    const initial = createRoutinePresetState({ routines: [], splitCount: 3 });
    const authored = {
      ...initial,
      presets: [
        initial.presets[0],
        { ...createEmptyRoutinePreset('custom', 'Custom', 2), days: [
          { ...createEmptyRoutinePreset('custom', 'Custom', 2).days[0], blocks: ['pull'], plannedSets: { pull: 9 }, locallyAuthored: true },
          ...createEmptyRoutinePreset('custom', 'Custom', 2).days.slice(1),
        ] },
      ],
      activePresetId: 'custom',
    };
    authored.presets[0].days[0] = { ...authored.presets[0].days[0], blocks: ['push'], plannedSets: { push: 6 }, locallyAuthored: true };
    writeRoutinePresetState(localStorage, 'account-a', authored);

    await mount(healthProps({ healthRoutines: [] }));
    await rerender(healthProps({ healthRoutines: [
      routine('remote-day-1', 'Day 1', ['pull']),
      routine('remote-day-4', 'Day 4', ['push']),
    ] }));

    const persisted = readRoutinePresetState(localStorage, 'account-a')!;
    const defaultPreset = routinePresetById(persisted, DEFAULT_ROUTINE_PRESET_ID);
    const custom = routinePresetById(persisted, 'custom');
    expect(defaultPreset.splitCount).toBe(4);
    expect(defaultPreset.days[0].blocks).toEqual(['push']);
    expect(defaultPreset.days[3].blocks).toEqual(['push']);
    expect(custom.name).toBe('Custom');
    expect(custom.splitCount).toBe(2);
    expect(custom.days[0].blocks).toEqual(['pull']);
    expect(custom.days[0].plannedSets).toEqual({ pull: 9 });
    expect(presetSelect().value).toBe('custom');
  });

  it('characterizes switch/create/rename/delete integration and preserves the selected preset projection', async () => {
    await mount(healthProps({ healthRoutines: [routine('default-day-1', 'Day 1', ['push'])] }));
    const defaultId = presetSelect().value;
    const initialWorkout = container!.querySelector('[data-k129c-workout-empty]');
    expect(initialWorkout).not.toBeNull();

    await click(actionButton());
    const newButton = [...container!.querySelectorAll('button')].find(button => button.textContent === 'healthPresetNew')!;
    await click(newButton);
    const createdId = presetSelect().value;
    expect(createdId).not.toBe(defaultId);
    expect(readRoutinePresetState(localStorage, 'account-a')?.activePresetId).toBe(createdId);

    await click(actionButton());
    const renameButton = [...container!.querySelectorAll('button')].find(button => button.textContent === 'healthPresetRename')!;
    await click(renameButton);
    const renameInput = container!.querySelector('input') as HTMLInputElement;
    expect(renameInput).not.toBeNull();
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      valueSetter?.call(renameInput, 'Strength');
      renameInput.dispatchEvent(new Event('input', { bubbles: true }));
      renameInput.dispatchEvent(new Event('change', { bubbles: true }));
      renameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    await settle();
    expect(presetSelect().value).toBe(createdId);
    expect([...presetSelect().options].find(option => option.value === createdId)?.textContent).toBe('Strength');

    const defaultOption = [...presetSelect().options].find(option => option.value === defaultId)!;
    await act(async () => {
      presetSelect().value = defaultOption.value;
      presetSelect().dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
    expect(presetSelect().value).toBe(defaultId);
    expect(readRoutinePresetState(localStorage, 'account-a')?.activePresetId).toBe(defaultId);

    await act(async () => {
      presetSelect().value = createdId;
      presetSelect().dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
    await click(actionButton());
    const deleteButton = [...container!.querySelectorAll('button')].find(button => button.textContent === 'healthPresetDelete')!;
    await click(deleteButton);
    const confirmAction = mocks.showConfirm.mock.calls.at(-1)?.[1] as (() => void) | undefined;
    expect(confirmAction).toBeTypeOf('function');
    await act(async () => confirmAction?.());
    await settle();
    expect(presetSelect().value).toBe(defaultId);
    expect(readRoutinePresetState(localStorage, 'account-a')?.presets).toHaveLength(1);
    expect(container!.querySelector('[data-k129c-workout-empty]')).toBe(initialWorkout);
  });

  it('keeps preset mutations separate from Today workout and applies a routine only through the explicit load action', async () => {
    await mount(healthProps({ healthRoutines: [routine('default-day-1', 'Day 1', ['push'])] }));
    expect(container!.querySelector('[data-k129c-workout-empty]')).not.toBeNull();

    await click(actionButton());
    const createButton = [...container!.querySelectorAll('button')].find(button => button.textContent === 'healthPresetNew')!;
    await click(createButton);
    expect(container!.querySelector('[data-k129c-workout-empty]')).not.toBeNull();

    const presetSelectForLoad = container!.querySelector('select[aria-label="healthPresetLabel"]') as HTMLSelectElement;
    presetSelectForLoad.value = DEFAULT_ROUTINE_PRESET_ID;
    await act(async () => presetSelectForLoad.dispatchEvent(new Event('change', { bubbles: true })));
    await settle();

    const loadSelect = [...container!.querySelectorAll('select')].find(select => [...select.options].some(option => option.value === '__load__')) as HTMLSelectElement;
    expect(loadSelect).not.toBeNull();
    await act(async () => {
      loadSelect.value = 'Day 1';
      loadSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
    expect(container!.querySelector('[data-k129c-workout-empty]')).toBeNull();
    expect(container!.querySelector('[data-workout-index]')).not.toBeNull();
  });

  it('characterizes remote Default save request, success cache refresh, and failure without canonical mutation', async () => {
    await mount(healthProps({ healthRoutines: [] }));
    const assemble = [...container!.querySelectorAll('button')].find(button => button.textContent === 'assembleBtn')!;
    await click(assemble);
    await click([...container!.querySelectorAll('div')].find(element => element.textContent === 'Push')!);
    const save = [...container!.querySelectorAll('button')].find(button => button.textContent === 'saveRoutine')!;
    await click(save);
    expect(mocks.authFetch).toHaveBeenCalledWith('https://example.test/api/health_routines', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(mocks.authFetch.mock.calls[0][1].body)).toEqual({ day_name: 'Day 1', blocks: ['push'] });
    expect(mocks.mutateStatic).toHaveBeenCalled();
    expect(readRoutinePresetState(localStorage, 'account-a')?.presets[0].days[0].blocks).toEqual(['push']);

    const beforeFailure = readRoutinePresetState(localStorage, 'account-a');
    mocks.authFetch.mockReset().mockResolvedValue({ ok: false, status: 503, text: async () => 'offline' });
    await click(assemble);
    await click([...container!.querySelectorAll('div')].find(element => element.textContent === 'Pull')!);
    await click([...container!.querySelectorAll('button')].find(button => button.textContent === 'saveRoutine')!);
    expect(readRoutinePresetState(localStorage, 'account-a')).toEqual(beforeFailure);
    expect(mocks.showToast).toHaveBeenCalledWith(expect.stringContaining('Operation failed'), 'error');
  });

  it('characterizes split-count mirrors and planned-set seeds without changing global legacy policy', async () => {
    localStorage.setItem('healthSplitCount', '4');
    localStorage.setItem('healthRoutinePlannedSets', JSON.stringify({ 'Day 1': { push: 8 } }));
    await mount(healthProps({ healthRoutines: [] }));

    const splitInput = container!.querySelector('input[type="number"]') as HTMLInputElement;
    expect(splitInput.value).toBe('4');
    await click([...container!.querySelectorAll('button')].find(button => button.textContent === 'assembleBtn')!);
    await click([...container!.querySelectorAll('div')].find(element => element.textContent === 'Push')!);
    const plannedInput = [...container!.querySelectorAll('input[type="number"]')].at(-1) as HTMLInputElement;
    expect(plannedInput.value).toBe('8');

    await setInputValue(splitInput, '2', 'input');
    await act(async () => {
      splitInput.focus();
      splitInput.blur();
    });
    await settle();
    expect(localStorage.getItem('healthSplitCount')).toBe('2');
    expect(readRoutinePresetState(localStorage, 'account-a')?.presets[0].splitCount).toBe(2);

    await click(actionButton());
    await click([...container!.querySelectorAll('button')].find(button => button.textContent === 'healthPresetNew')!);
    const customSplitInput = container!.querySelector('input[type="number"]') as HTMLInputElement;
    await setInputValue(customSplitInput, '6', 'input');
    await act(async () => {
      customSplitInput.focus();
      customSplitInput.blur();
    });
    await settle();
    expect(readRoutinePresetState(localStorage, 'account-a')?.presets.find(preset => preset.id !== DEFAULT_ROUTINE_PRESET_ID)?.splitCount).toBe(6);
    expect(localStorage.getItem('healthSplitCount')).toBe('2');
  });

  it('characterizes local Default save success/failure and local cache refresh without remote calls', async () => {
    mocks.remoteMode = false;
    await mount(healthProps({ healthRoutines: [] }));
    await click([...container!.querySelectorAll('button')].find(button => button.textContent === 'assembleBtn')!);
    await click([...container!.querySelectorAll('div')].find(element => element.textContent === 'Push')!);
    await click([...container!.querySelectorAll('button')].find(button => button.textContent === 'saveRoutine')!);
    expect(mocks.localRepository.saveRoutine).toHaveBeenCalledWith(expect.objectContaining({ dayName: 'Day 1', blocks: ['push'] }));
    expect(mocks.authFetch).not.toHaveBeenCalled();
    expect(mocks.mutateStatic).toHaveBeenCalled();

    const beforeFailure = readRoutinePresetState(localStorage, 'account-a');
    mocks.localRepository.saveRoutine.mockRejectedValueOnce(new Error('conflict'));
    await click([...container!.querySelectorAll('button')].find(button => button.textContent === 'assembleBtn')!);
    await click([...container!.querySelectorAll('div')].find(element => element.textContent === 'Pull')!);
    await click([...container!.querySelectorAll('button')].find(button => button.textContent === 'saveRoutine')!);
    expect(readRoutinePresetState(localStorage, 'account-a')).toEqual(beforeFailure);
    expect(mocks.showToast).toHaveBeenCalledWith('routineSaveFailed', 'error');
  });

  it('uses the shared preset authority on mobile and dismisses its actions menu outside without mutation', async () => {
    mocks.mobile = true;
    const mobileState = createRoutinePresetState({ routines: [routine('default-day-1', 'Day 1', ['push'])], splitCount: 1 });
    mobileState.presets.push({ ...createEmptyRoutinePreset('mobile-custom', 'Mobile Custom', 1), days: [
      { ...createEmptyRoutinePreset('mobile-custom', 'Mobile Custom', 1).days[0], blocks: ['pull'], plannedSets: { pull: 4 }, locallyAuthored: true },
    ] });
    writeRoutinePresetState(localStorage, 'account-a', mobileState);
    await mount(healthProps({ healthRoutines: [routine('default-day-1', 'Day 1', ['push'])] }));
    const mobileSelect = [...container!.querySelectorAll('select[aria-label="healthPresetLabel"]')].at(-1) as HTMLSelectElement;
    expect(mobileSelect).not.toBeNull();
    mobileSelect.value = 'mobile-custom';
    await act(async () => mobileSelect.dispatchEvent(new Event('change', { bubbles: true })));
    await settle();
    expect(readRoutinePresetState(localStorage, 'account-a')?.activePresetId).toBe('mobile-custom');
    await click(actionButton());
    expect(container!.querySelector('[role="menu"]')).not.toBeNull();
    const before = readRoutinePresetState(localStorage, 'account-a');
    await act(async () => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await settle();
    expect(container!.querySelector('[role="menu"]')).toBeNull();
    expect(readRoutinePresetState(localStorage, 'account-a')).toEqual(before);
  });
});
