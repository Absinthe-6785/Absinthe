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
  type RoutinePresetController,
  type RoutinePresetControllerInput,
} from './useRoutinePresetController';

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

function input(accountId: string, generation: number, healthRoutines = []): RoutinePresetControllerInput {
  return {
    accountId,
    healthRoutines,
    accountOperation: { accountId, generation },
    isCurrentAccountOperation: token => (
      token.accountId === accountState.accountId && token.generation === accountState.generation
    ),
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
  it('keeps account A -> B -> A synchronously isolated and preserves B state', async () => {
    const accountA = createRoutinePresetState({ routines: [], splitCount: 1 });
    accountA.presets.push(createEmptyRoutinePreset('account-a-custom', 'A Custom', 1));
    accountA.activePresetId = 'account-a-custom';
    const accountB = createRoutinePresetState({ routines: [], splitCount: 1 });
    accountB.presets.push(createEmptyRoutinePreset('account-b-custom', 'B Custom', 1));
    accountB.activePresetId = 'account-b-custom';
    writeRoutinePresetState(localStorage, 'account-a', accountA);
    writeRoutinePresetState(localStorage, 'account-b', accountB);

    await mount(input('account-a', 0));
    expect(latest.activePreset.id).toBe('account-a-custom');

    accountState.accountId = 'account-b';
    accountState.generation = 1;
    flushSync(() => root?.render(createElement(Harness, input('account-b', 1))));
    expect(latest.activePreset.id).toBe('account-b-custom');
    expect(latest.activePreset.id).not.toBe('account-a-custom');
    await settle();
    expect(latest.accountReady).toBe(true);

    accountState.accountId = 'account-a';
    accountState.generation = 2;
    await rerender(input('account-a', 2));
    expect(latest.activePreset.id).toBe('account-a-custom');
    expect(readRoutinePresetState(localStorage, 'account-a')?.activePresetId).toBe('account-a-custom');
    expect(readRoutinePresetState(localStorage, 'account-b')?.activePresetId).toBe('account-b-custom');
  });

  it('guards stale preset confirmation cleanup and mutation after an account switch', async () => {
    const accountA = createRoutinePresetState({ routines: [], splitCount: 1 });
    accountA.presets.push(createEmptyRoutinePreset('account-a-custom', 'A Custom', 1));
    accountA.activePresetId = 'account-a-custom';
    const accountB = createRoutinePresetState({ routines: [], splitCount: 1 });
    accountB.presets.push(createEmptyRoutinePreset('account-b-custom', 'B Custom', 1));
    accountB.activePresetId = 'account-b-custom';
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
    const staleResult = await mutate(() => staleDelete('account-a-custom'));
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

  it('returns a typed Default projection intent only after canonical persistence', async () => {
    await mount(input('account-a', 0));
    const result = await mutate(() => latest.setPresetDay({
      presetId: DEFAULT_ROUTINE_PRESET_ID,
      dayName: 'Day 1',
      blocks: ['push'],
      plannedSets: { push: 5 },
    }));
    expect(result.ok).toBe(true);
    expect(result.projection).toEqual(expect.objectContaining({
      accountId: 'account-a',
      dayName: 'Day 1',
      blocks: ['push'],
    }));

    const canonicalAfterMutation = readRoutinePresetState(localStorage, 'account-a');
    expect(canonicalAfterMutation?.presets[0].days[0].blocks).toEqual(['push']);

    for (const mode of ['remote', 'local'] as const) {
      const failProjection = async (intent: NonNullable<typeof result.projection>) => {
        expect(intent.accountId).toBe('account-a');
        expect(intent.dayName).toBe('Day 1');
        expect(intent.blocks).toEqual(['push']);
        throw new Error(`${mode}-projection-failed`);
      };
      await expect(failProjection(result.projection!)).rejects.toThrow(`${mode}-projection-failed`);
      expect(readRoutinePresetState(localStorage, 'account-a')?.presets[0].days[0].blocks).toEqual(['push']);
    }
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
    expect(result.projection).toBeUndefined();
    expect(readRoutinePresetState(localStorage, 'account-a')?.presets[0].days[0].blocks).toEqual([]);
  });
});
