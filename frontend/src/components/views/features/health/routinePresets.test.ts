// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_ROUTINE_PRESET_ID,
  createEmptyRoutinePreset,
  createLegacyRoutinePreset,
  createRoutinePresetState,
  normalizeRoutinePresetState,
  readRoutinePresetState,
  routinePresetById,
  routinePresetPlannedSetCount,
  routinePresetStorageKey,
  routinePresetToHealthRoutines,
  syncLegacyDefaultRoutinePreset,
  updateRoutinePresetState,
  writeRoutinePresetState,
} from './routinePresets';

const routines = [
  { id: 'legacy-day-1', day_name: 'Day 1', blocks: ['push', 'row'] },
  { id: 'legacy-day-2', day_name: 'Day 2', blocks: ['squat'] },
] as const;

describe('routine preset foundation', () => {
  beforeEach(() => localStorage.clear());

  it('projects legacy routines into a usable Default without changing row ids or order', () => {
    const preset = createLegacyRoutinePreset({
      routines,
      splitCount: 2,
      plannedSetsByDay: { 'Day 1': { push: 5 } },
    });
    expect(preset.id).toBe(DEFAULT_ROUTINE_PRESET_ID);
    expect(preset.name).toBe('Default');
    expect(preset.days.map(day => day.blocks)).toEqual([['push', 'row'], ['squat']]);
    expect(preset.days[0].legacyRoutineId).toBe('legacy-day-1');
    expect(preset.days[0].plannedSets).toEqual({ push: 5 });
    expect(routinePresetToHealthRoutines(preset)).toEqual(routines);
  });

  it('keeps switching and day edits isolated to the selected preset', () => {
    const state = createRoutinePresetState({ routines, splitCount: 2 });
    const custom = createEmptyRoutinePreset('custom', 'Strength', 2);
    const withCustom = updateRoutinePresetState(state, { type: 'create', preset: custom });
    const edited = updateRoutinePresetState(withCustom, {
      type: 'set-day', presetId: 'custom', dayName: 'Day 1', blocks: ['deadlift'], plannedSets: { deadlift: 4 },
    });
    expect(routinePresetById(edited, DEFAULT_ROUTINE_PRESET_ID).days[0].blocks).toEqual(['push', 'row']);
    expect(routinePresetById(edited, 'custom').days[0].blocks).toEqual(['deadlift']);
    expect(edited.activePresetId).toBe('custom');
  });

  it('duplicates a deep independent copy and preserves the source id on rename', () => {
    const state = createRoutinePresetState({ routines, splitCount: 2 });
    const duplicate = createEmptyRoutinePreset('copy', 'Default copy', 2);
    duplicate.days[0] = { ...duplicate.days[0], blocks: ['push'], plannedSets: { push: 6 } };
    const duplicated = updateRoutinePresetState(state, { type: 'duplicate', sourcePresetId: DEFAULT_ROUTINE_PRESET_ID, preset: duplicate });
    const renamed = updateRoutinePresetState(duplicated, { type: 'rename', presetId: 'copy', name: ' Push Day ' });
    expect(renamed.presets[1].id).toBe('copy');
    expect(renamed.presets[1].name).toBe('Push Day');
    expect(renamed.presets[1].days[0].plannedSets).toEqual({ push: 6 });
    const source = routinePresetById(renamed, DEFAULT_ROUTINE_PRESET_ID);
    expect(source.days[0].blocks).toEqual(['push', 'row']);
    expect(source.name).toBe('Default');
  });

  it('prevents deleting the final preset and keeps delete history-free', () => {
    const state = createRoutinePresetState({ routines, splitCount: 2 });
    expect(updateRoutinePresetState(state, { type: 'delete', presetId: DEFAULT_ROUTINE_PRESET_ID })).toEqual(state);
    const withCopy = updateRoutinePresetState(state, { type: 'create', preset: createEmptyRoutinePreset('copy') });
    expect(updateRoutinePresetState(withCopy, { type: 'delete', presetId: DEFAULT_ROUTINE_PRESET_ID })).toEqual(withCopy);
    const deleted = updateRoutinePresetState(withCopy, { type: 'delete', presetId: 'copy' });
    expect(deleted.presets).toHaveLength(1);
    expect(deleted.activePresetId).toBe(DEFAULT_ROUTINE_PRESET_ID);
  });

  it('isolates planned sets per preset and preserves previous-set fallback and cardio rules', () => {
    const state = createRoutinePresetState({ routines, splitCount: 2 });
    const custom = createEmptyRoutinePreset('custom', 'Custom', 2);
    let next = updateRoutinePresetState(state, { type: 'create', preset: custom });
    next = updateRoutinePresetState(next, { type: 'set-day', presetId: 'custom', dayName: 'Day 1', blocks: ['push'], plannedSets: { push: 8 } });
    expect(routinePresetPlannedSetCount(routinePresetById(next, 'custom'), 'Day 1', 'push', 'strength', [{ set: 1 } as never])).toBe(8);
    expect(routinePresetPlannedSetCount(routinePresetById(next, DEFAULT_ROUTINE_PRESET_ID), 'Day 1', 'push', 'strength', [{ set: 1 }, { set: 2 }] as never)).toBe(2);
    expect(routinePresetPlannedSetCount(routinePresetById(next, 'custom'), 'Day 1', 'push', 'cardio')).toBe(1);
  });

  it('stores only account-scoped preference state and tolerates malformed data', () => {
    const accountA = createRoutinePresetState({ routines, splitCount: 2 });
    writeRoutinePresetState(localStorage, 'account-a', accountA);
    expect(localStorage.getItem(routinePresetStorageKey('account-a'))).not.toBeNull();
    expect(readRoutinePresetState(localStorage, 'account-a')?.activePresetId).toBe(DEFAULT_ROUTINE_PRESET_ID);
    expect(readRoutinePresetState(localStorage, 'account-b')).toBeNull();
    localStorage.setItem(routinePresetStorageKey('account-b'), '{bad');
    expect(readRoutinePresetState(localStorage, 'account-b')).toBeNull();
    expect(normalizeRoutinePresetState({ version: 1, activePresetId: 'x', presets: [] })).toBeNull();
  });

  it('merges late legacy rows into an initially empty Default without replacing user-entered blocks', () => {
    const initial = createRoutinePresetState({ routines: [], splitCount: 3 });
    const edited = updateRoutinePresetState(initial, {
      type: 'set-day', presetId: DEFAULT_ROUTINE_PRESET_ID, dayName: 'Day 1', blocks: ['user-block'], plannedSets: { 'user-block': 4 },
    });
    const synced = syncLegacyDefaultRoutinePreset(edited, { routines, splitCount: 2 });
    const preset = routinePresetById(synced);
    expect(preset.days[0].blocks).toEqual(['user-block']);
    expect(preset.days[1].blocks).toEqual(['squat']);
    expect(synced.legacySyncPending).toBe(false);
  });

  it('keeps account transition state pending until the new account rows arrive', () => {
    const accountARoutines = [{ id: 'account-a-routine', day_name: 'Day 1', blocks: ['account-a-block'] }] as const;
    const accountBRoutines = [{ id: 'account-b-routine', day_name: 'Day 1', blocks: ['account-b-block'] }] as const;
    const accountAState = createRoutinePresetState({ routines: accountARoutines, splitCount: 1 });
    writeRoutinePresetState(localStorage, 'account-a', accountAState);

    const accountBInitial = createRoutinePresetState({ routines: [], splitCount: 3 });
    expect(accountBInitial.legacySyncPending).toBe(true);
    expect(routinePresetById(accountBInitial).days[0].blocks).toEqual([]);
    expect(readRoutinePresetState(localStorage, 'account-b')).toBeNull();

    const accountBSynced = syncLegacyDefaultRoutinePreset(accountBInitial, {
      routines: accountBRoutines,
      splitCount: 1,
    });
    expect(routinePresetById(accountBSynced).days[0].blocks).toEqual(['account-b-block']);
    expect(routinePresetById(accountBSynced).days[0].blocks).not.toContain('account-a-block');
    writeRoutinePresetState(localStorage, 'account-b', accountBSynced);

    expect(readRoutinePresetState(localStorage, 'account-a')).toEqual(accountAState);
    expect(readRoutinePresetState(localStorage, 'account-b')).toEqual(accountBSynced);
  });
});
