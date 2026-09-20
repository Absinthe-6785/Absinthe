import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HEALTH_ROUTINE_PRESET_ID,
  HEALTH_ROUTINE_PROFILE_ID,
  aggregatesToRoutinePresetState,
  migrateRoutinePresetStateIdentity,
  routinePresetStateToAggregates,
  validateHealthRoutinePresetAggregate,
  validateHealthRoutineProfileAggregate,
} from './healthRoutineAggregate';
import {
  createEmptyRoutinePreset,
  createRoutinePresetState,
  updateRoutinePresetState,
} from '../components/views/features/health/routinePresets';

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const BLOCK_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BLOCK_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('REL-05F Health routine aggregate contract', () => {
  it('round-trips one complete preset aggregate including order and planned sets', () => {
    let state = createRoutinePresetState({ routines: [], splitCount: 2 });
    state = updateRoutinePresetState(state, {
      type: 'set-day', presetId: DEFAULT_HEALTH_ROUTINE_PRESET_ID, dayName: 'Day 1',
      blocks: [BLOCK_B, BLOCK_A], plannedSets: { [BLOCK_A]: 3, [BLOCK_B]: 5 },
    });
    const aggregate = routinePresetStateToAggregates(state);
    expect(aggregate.presets[0]).toMatchObject({
      id: DEFAULT_HEALTH_ROUTINE_PRESET_ID,
      splitCount: 2,
    });
    expect(aggregate.presets[0].days[0]).toEqual({
      dayName: 'Day 1', blocks: [BLOCK_B, BLOCK_A], plannedSets: { [BLOCK_A]: 3, [BLOCK_B]: 5 },
    });
    expect(aggregate.profile).toEqual({ id: HEALTH_ROUTINE_PROFILE_ID, activePresetId: DEFAULT_HEALTH_ROUTINE_PRESET_ID });
    expect(aggregatesToRoutinePresetState(aggregate.presets, aggregate.profile).presets[0].days[0])
      .toMatchObject({ blocks: [BLOCK_B, BLOCK_A], plannedSets: { [BLOCK_A]: 3, [BLOCK_B]: 5 } });
  });

  it('makes four-to-three one aggregate replacement with no hidden Day 4', () => {
    const four = createRoutinePresetState({ routines: [
      { id: 'day-1', day_name: 'Day 1', blocks: [BLOCK_A] },
      { id: 'day-2', day_name: 'Day 2', blocks: [BLOCK_B] },
      { id: 'day-3', day_name: 'Day 3', blocks: [] },
      { id: 'day-4', day_name: 'Day 4', blocks: [BLOCK_A, BLOCK_B] },
    ], splitCount: 4 });
    const three = updateRoutinePresetState(four, {
      type: 'set-split', presetId: DEFAULT_HEALTH_ROUTINE_PRESET_ID, splitCount: 3,
    });
    const aggregate = routinePresetStateToAggregates(three).presets[0];
    expect(aggregate.splitCount).toBe(3);
    expect(aggregate.days.map(day => day.dayName)).toEqual(['Day 1', 'Day 2', 'Day 3']);
    expect(JSON.stringify(aggregate)).not.toContain('Day 4');
  });

  it('migrates legacy IDs deterministically without collapsing same-name presets', () => {
    const state = createRoutinePresetState({ routines: [], splitCount: 1 });
    state.presets.push(
      createEmptyRoutinePreset('legacy-a', 'Same name', 1),
      createEmptyRoutinePreset('legacy-b', 'Same name', 1),
    );
    state.activePresetId = 'legacy-b';
    const first = migrateRoutinePresetStateIdentity(ACCOUNT, state);
    const second = migrateRoutinePresetStateIdentity(ACCOUNT, state);
    expect(first).toEqual(second);
    expect(new Set(first.presets.map(preset => preset.id)).size).toBe(3);
    expect(first.presets[1].name).toBe(first.presets[2].name);
    expect(first.activePresetId).toBe(first.presets[2].id);
    expect(first.presets.every(preset => /^[0-9a-f-]{36}$/.test(preset.id))).toBe(true);
  });

  it('rejects malformed closed shapes, duplicate exercises, invalid planned sets, and dangling profiles', () => {
    const valid = {
      id: DEFAULT_HEALTH_ROUTINE_PRESET_ID,
      name: 'Default',
      splitCount: 1,
      days: [{ dayName: 'Day 1', blocks: [BLOCK_A], plannedSets: { [BLOCK_A]: 3 } }],
      isDefault: true,
    };
    expect(validateHealthRoutinePresetAggregate(valid)).toEqual(valid);
    expect(() => validateHealthRoutinePresetAggregate({ ...valid, unknown: true })).toThrow('closed_shape');
    expect(() => validateHealthRoutinePresetAggregate({
      ...valid, days: [{ dayName: 'Day 1', blocks: [BLOCK_A, BLOCK_A], plannedSets: {} }],
    })).toThrow('blocks');
    expect(() => validateHealthRoutinePresetAggregate({
      ...valid, days: [{ dayName: 'Day 1', blocks: [BLOCK_A], plannedSets: { [BLOCK_B]: 3 } }],
    })).toThrow('planned_set');
    expect(() => validateHealthRoutineProfileAggregate({
      id: HEALTH_ROUTINE_PROFILE_ID, activePresetId: 'not-a-uuid',
    })).toThrow('health_routine_profile');
  });
});
