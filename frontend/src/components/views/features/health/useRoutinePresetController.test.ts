// @vitest-environment happy-dom
import { createElement } from 'react';
import { act } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_ROUTINE_PRESET_ID,
  createEmptyRoutinePreset,
  createRoutinePresetState,
  readRoutinePresetState,
  writeRoutinePresetState,
} from './routinePresets';
import {
  useRoutinePresetController,
  type RoutinePresetMutationResult,
  type RoutinePresetController,
  type RoutinePresetControllerInput,
} from './useRoutinePresetController';
import type { HealthRoutinePersistence } from '../../../../lib/healthRoutineSync';
import type { HealthRoutine } from '../../../../types';

const ACCOUNT_A_CUSTOM_ID = '00000000-0000-5000-8000-00000000000a';
const ACCOUNT_B_CUSTOM_ID = '00000000-0000-5000-8000-00000000000b';

const accountState = {
  accountId: 'account-a',
  generation: 0,
};

let latest: RoutinePresetController;
let root: Root | null = null;
let container: HTMLDivElement | null = null;

function Harness(input: RoutinePresetControllerInput) {
  latest = useRoutinePresetController(input);
  return null;
}

function input(accountId: string, generation: number, healthRoutines: readonly HealthRoutine[] = [], sourceReady = true): RoutinePresetControllerInput {
  return {
    accountId,
    healthRoutines,
    sourceReady,
    accountOperation: { accountId, generation },
    isCurrentAccountOperation: token => (
      token.accountId === accountState.accountId && token.generation === accountState.generation
    ),
  };
}

function persistenceProbe(bootstrap: HealthRoutinePersistence['bootstrap']): HealthRoutinePersistence {
  return {
    bootstrap,
    commitState: async (_accountId, _previous, next) => next,
    sync: async () => null,
    snapshot: async () => null,
    reset: async () => createRoutinePresetState({ routines: [], splitCount: 3 }),
    recover: async (_accountId, recovered) => recovered,
  };
}

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function mount(props: RoutinePresetControllerInput): Promise<void> {
  container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    root = createRoot(container!);
    root.render(createElement(Harness, props));
  });
  await settle();
}

async function rerender(props: RoutinePresetControllerInput): Promise<void> {
  await act(async () => root?.render(createElement(Harness, props)));
  await settle();
}

async function mutate<T>(callback: () => T): Promise<T> {
  let result!: T;
  await act(async () => {
    result = callback();
  });
  await settle();
  return result;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  accountState.accountId = 'account-a';
  accountState.generation = 0;
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.restoreAllMocks();
});

describe('HEALTH_10D routine preset controller', () => {
  it('does not adopt pending or errored empty routines, but accepts verified empty once ready', async () => {
    const bootstrap = vi.fn<HealthRoutinePersistence['bootstrap']>(async ({ legacyState }) => legacyState);
    const persistence = persistenceProbe(bootstrap);
    await mount({ ...input('account-a', 0, [], false), persistence });
    expect(latest.accountReady).toBe(false);
    expect(bootstrap).not.toHaveBeenCalled();
    expect(readRoutinePresetState(localStorage, 'account-a')).toBeNull();
    expect((await mutate(() => latest.createPreset('not ready'))).ok).toBe(false);

    // An unavailable source remains non-authoritative, unlike verified empty.
    await rerender({ ...input('account-a', 0, [], false), persistence });
    expect(bootstrap).not.toHaveBeenCalled();
    await rerender({ ...input('account-a', 0, [], true), persistence });
    expect(bootstrap).toHaveBeenCalledOnce();
    expect(latest.accountReady).toBe(true);
    expect(bootstrap.mock.calls[0]?.[0].legacyState.legacySyncPending).toBe(true);
  });

  it('adopts verified nonempty routines without a preceding empty bootstrap', async () => {
    const bootstrap = vi.fn<HealthRoutinePersistence['bootstrap']>(async ({ legacyState }) => legacyState);
    const persistence = persistenceProbe(bootstrap);
    await mount({ ...input('account-a', 0, [], false), persistence });
    const routines: HealthRoutine[] = [{ id: 'routine-a', day_name: 'Day 1', blocks: ['push'] }];
    await rerender({ ...input('account-a', 0, routines, true), persistence });
    expect(bootstrap).toHaveBeenCalledOnce();
    expect(bootstrap.mock.calls[0]?.[0].legacyState.presets[0]?.days[0]?.blocks).toEqual(['push']);
    expect(latest.accountReady).toBe(true);
    expect(latest.selectedHealthRoutines[0]?.blocks).toEqual(['push']);
  });

  it('keeps a persisted account preset visible but defers its bootstrap while the source is pending', async () => {
    const persisted = createRoutinePresetState({ routines: [
      { id: 'saved-routine', day_name: 'Day 1', blocks: ['saved-block'] },
    ], splitCount: 3 });
    expect(writeRoutinePresetState(localStorage, 'account-a', persisted)).toBe(true);
    const bootstrap = vi.fn<HealthRoutinePersistence['bootstrap']>(async ({ legacyState }) => legacyState);
    const persistence = persistenceProbe(bootstrap);
    await mount({ ...input('account-a', 0, [], false), persistence });
    expect(latest.accountReady).toBe(false);
    expect(latest.selectedHealthRoutines[0]?.blocks).toEqual(['saved-block']);
    expect(bootstrap).not.toHaveBeenCalled();
    expect(readRoutinePresetState(localStorage, 'account-a')?.presets[0]?.days[0]?.blocks).toEqual(['saved-block']);

    await rerender({ ...input('account-a', 0, [], true), persistence });
    expect(bootstrap).toHaveBeenCalledOnce();
    expect(bootstrap.mock.calls[0]?.[0].hasAccountScopedState).toBe(true);
    expect(latest.selectedHealthRoutines[0]?.blocks).toEqual(['saved-block']);
  });

  it('does not use account A routine truth while B is pending', async () => {
    const bootstrap = vi.fn<HealthRoutinePersistence['bootstrap']>(async ({ legacyState }) => legacyState);
    const persistence = persistenceProbe(bootstrap);
    await mount({ ...input('account-a', 0,
      [{ id: 'routine-a', day_name: 'Day 1', blocks: ['a-block'] }], true), persistence });
    expect(latest.selectedHealthRoutines[0]?.blocks).toEqual(['a-block']);
    accountState.accountId = 'account-b'; accountState.generation = 1;
    await rerender({ ...input('account-b', 1, [], false), persistence });
    expect(latest.accountReady).toBe(false);
    expect(latest.selectedHealthRoutines[0]?.blocks).toEqual([]);
    expect(bootstrap).toHaveBeenCalledTimes(1);
    expect(readRoutinePresetState(localStorage, 'account-b')).toBeNull();
    await rerender({ ...input('account-b', 1,
      [{ id: 'routine-b', day_name: 'Day 1', blocks: ['b-block'] }], true), persistence });
    expect(bootstrap).toHaveBeenCalledTimes(2);
    expect(latest.accountReady).toBe(true);
    expect(latest.selectedHealthRoutines[0]?.blocks).toEqual(['b-block']);
  });

  it('keeps account A -> B -> A synchronously isolated and preserves B state', async () => {
    const accountA = createRoutinePresetState({ routines: [], splitCount: 1 });
    accountA.presets.push(createEmptyRoutinePreset(ACCOUNT_A_CUSTOM_ID, 'A Custom', 1));
    accountA.activePresetId = ACCOUNT_A_CUSTOM_ID;
    const accountB = createRoutinePresetState({ routines: [], splitCount: 1 });
    accountB.presets.push(createEmptyRoutinePreset(ACCOUNT_B_CUSTOM_ID, 'B Custom', 1));
    accountB.activePresetId = ACCOUNT_B_CUSTOM_ID;
    writeRoutinePresetState(localStorage, 'account-a', accountA);
    writeRoutinePresetState(localStorage, 'account-b', accountB);

    await mount(input('account-a', 0));
    expect(latest.activePreset.id).toBe(ACCOUNT_A_CUSTOM_ID);

    accountState.accountId = 'account-b';
    accountState.generation = 1;
    flushSync(() => root?.render(createElement(Harness, input('account-b', 1))));
    expect(latest.activePreset.id).toBe(ACCOUNT_B_CUSTOM_ID);
    expect(latest.activePreset.id).not.toBe(ACCOUNT_A_CUSTOM_ID);
    await settle();
    expect(latest.accountReady).toBe(true);

    accountState.accountId = 'account-a';
    accountState.generation = 2;
    await rerender(input('account-a', 2));
    expect(latest.activePreset.id).toBe(ACCOUNT_A_CUSTOM_ID);
    expect(readRoutinePresetState(localStorage, 'account-a')?.activePresetId).toBe(ACCOUNT_A_CUSTOM_ID);
    expect(readRoutinePresetState(localStorage, 'account-b')?.activePresetId).toBe(ACCOUNT_B_CUSTOM_ID);
  });

  it('guards stale preset confirmation cleanup and mutation after an account switch', async () => {
    const accountA = createRoutinePresetState({ routines: [], splitCount: 1 });
    accountA.presets.push(createEmptyRoutinePreset(ACCOUNT_A_CUSTOM_ID, 'A Custom', 1));
    accountA.activePresetId = ACCOUNT_A_CUSTOM_ID;
    const accountB = createRoutinePresetState({ routines: [], splitCount: 1 });
    accountB.presets.push(createEmptyRoutinePreset(ACCOUNT_B_CUSTOM_ID, 'B Custom', 1));
    accountB.activePresetId = ACCOUNT_B_CUSTOM_ID;
    writeRoutinePresetState(localStorage, 'account-a', accountA);
    writeRoutinePresetState(localStorage, 'account-b', accountB);

    await mount(input('account-a', 0));
    const staleDelete = latest.deletePreset;
    const staleRehydrate = latest.rehydrateForAccount;
    const staleConfirmation = await mutate(() => latest.beginPresetConfirmation());
    expect(staleConfirmation).not.toBeNull();

    accountState.accountId = 'account-b';
    accountState.generation = 1;
    await rerender(input('account-b', 1));
    expect(await mutate(() => staleRehydrate())).toBeNull();
    const bConfirmation = await mutate(() => latest.beginPresetConfirmation());
    expect(bConfirmation).not.toBeNull();
    await mutate(() => staleConfirmation?.clear());
    expect(latest.presetConfirmAccountId).toBe('account-b');

    const beforeA = JSON.stringify(readRoutinePresetState(localStorage, 'account-a'));
    const beforeB = JSON.stringify(readRoutinePresetState(localStorage, 'account-b'));
    const staleResult = await mutate(() => staleDelete(ACCOUNT_A_CUSTOM_ID));
    expect(staleResult.ok).toBe(false);
    expect(JSON.stringify(readRoutinePresetState(localStorage, 'account-a'))).toBe(beforeA);
    expect(JSON.stringify(readRoutinePresetState(localStorage, 'account-b'))).toBe(beforeB);
  });

  it('owns CRUD, per-preset canonical mutations, and excludes global legacy seeds', async () => {
    localStorage.setItem('healthSplitCount', '7');
    localStorage.setItem('healthRoutinePlannedSets', JSON.stringify({ 'Day 1': { push: 8 } }));
    await mount(input('account-a', 0));
    expect(latest.activePreset.id).toBe(DEFAULT_ROUTINE_PRESET_ID);
    expect(latest.splitCount).toBe(3);

    const created = await mutate(() => latest.createPreset('Custom'));
    expect(created.ok).toBe(true);
    const customId = latest.activePreset.id;
    expect(customId).not.toBe(DEFAULT_ROUTINE_PRESET_ID);
    expect((await mutate(() => latest.renamePreset(customId, 'Strength'))).ok).toBe(true);
    expect((await mutate(() => latest.setPresetSplit(customId, 4))).ok).toBe(true);
    expect((await mutate(() => latest.setPresetDay({
      presetId: customId,
      dayName: 'Day 1',
      blocks: ['push'],
      plannedSets: { push: 6 },
    }))).ok).toBe(true);
    expect((await mutate(() => latest.duplicatePreset('Strength copy'))).ok).toBe(true);
    expect((await mutate(() => latest.deletePreset(latest.activePreset.id))).ok).toBe(true);

    const persisted = readRoutinePresetState(localStorage, 'account-a');
    expect(persisted?.presets).toHaveLength(2);
    expect(persisted?.presets.some(preset => preset.name === 'Strength')).toBe(true);
    expect(persisted?.presets.some(preset => preset.id === DEFAULT_ROUTINE_PRESET_ID)).toBe(true);
  });

  it('commits the aggregate through durable persistence without a client legacy projection', async () => {
    const commitState = vi.fn<HealthRoutinePersistence['commitState']>(async (_accountId, _previous, next) => next);
    const persistence: HealthRoutinePersistence = {
      bootstrap: async ({ legacyState }) => legacyState,
      commitState,
      sync: async () => null,
      snapshot: async () => null,
      reset: async () => createRoutinePresetState({ routines: [], splitCount: 3 }),
      recover: async (_accountId, recovered) => recovered,
    };
    await mount({ ...input('account-a', 0), persistence });
    const result = await mutate(() => latest.setPresetDay({
      presetId: DEFAULT_ROUTINE_PRESET_ID,
      dayName: 'Day 1',
      blocks: ['push'],
      plannedSets: { push: 5 },
    }));
    expect(result.ok).toBe(true);
    expect(commitState).toHaveBeenCalledOnce();
    expect((result as RoutinePresetMutationResult & { projection?: unknown }).projection).toBeUndefined();

    const canonicalAfterMutation = readRoutinePresetState(localStorage, 'account-a');
    expect(canonicalAfterMutation?.presets[0].days[0].blocks).toEqual(['push']);
  });

  it('does not emit a projection intent when canonical persistence fails', async () => {
    await mount(input('account-a', 0));
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    const result = await mutate(() => latest.setPresetDay({
      presetId: DEFAULT_ROUTINE_PRESET_ID,
      dayName: 'Day 1',
      blocks: ['push'],
      plannedSets: { push: 5 },
    }));
    expect(setItem).toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(readRoutinePresetState(localStorage, 'account-a')?.presets[0].days[0].blocks).toEqual([]);
  });

  it('reports durable local success without waiting for a hung remote sync', async () => {
    const never = new Promise<null>(() => undefined);
    const commitState = vi.fn<HealthRoutinePersistence['commitState']>(async (_accountId, _previous, next) => next);
    const persistence: HealthRoutinePersistence = {
      bootstrap: async ({ legacyState }) => legacyState,
      commitState,
      sync: vi.fn(() => never),
      snapshot: async () => null,
      reset: async () => createRoutinePresetState({ routines: [], splitCount: 3 }),
      recover: async (_accountId, recovered) => recovered,
    };
    await mount({ ...input('account-a', 0), persistence });

    const result = await mutate(() => latest.setPresetSplit(DEFAULT_ROUTINE_PRESET_ID, 4));

    expect(result.ok).toBe(true);
    expect(latest.splitCount).toBe(4);
    expect(commitState).toHaveBeenCalledOnce();
    expect(persistence.sync).toHaveBeenCalledOnce();
  });

  it('does not claim success for a failed durable commit and continues after background sync failure', async () => {
    const commitState = vi.fn<HealthRoutinePersistence['commitState']>()
      .mockRejectedValueOnce(new Error('indexeddb_failed'))
      .mockImplementation(async (_accountId, _previous, next) => next);
    const persistence: HealthRoutinePersistence = {
      bootstrap: async ({ legacyState }) => legacyState,
      commitState,
      sync: vi.fn(async () => { throw new Error('network_failed'); }),
      snapshot: async () => null,
      reset: async () => createRoutinePresetState({ routines: [], splitCount: 3 }),
      recover: async (_accountId, recovered) => recovered,
    };
    await mount({ ...input('account-a', 0), persistence });

    expect((await mutate(() => latest.setPresetSplit(DEFAULT_ROUTINE_PRESET_ID, 4))).ok).toBe(false);
    expect(latest.splitCount).toBe(3);
    expect((await mutate(() => latest.setPresetSplit(DEFAULT_ROUTINE_PRESET_ID, 5))).ok).toBe(true);
    expect(latest.splitCount).toBe(5);
  });
});
