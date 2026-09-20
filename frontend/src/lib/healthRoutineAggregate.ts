import {
  DEFAULT_HEALTH_ROUTINE_PRESET_ID,
  HEALTH_ROUTINE_PROFILE_ID,
  isHealthRoutineUuid,
  stableHealthRoutinePresetId,
} from './healthRoutineIdentity';
import type {
  RoutinePreset,
  RoutinePresetDay,
  RoutinePresetState,
} from '../components/views/features/health/routinePresets';

export const HEALTH_ROUTINE_PRESET_DOMAIN = 'health_routine_preset' as const;
export const HEALTH_ROUTINE_PROFILE_DOMAIN = 'health_routine_profile' as const;
export const HEALTH_ROUTINE_DOMAINS = [
  HEALTH_ROUTINE_PRESET_DOMAIN,
  HEALTH_ROUTINE_PROFILE_DOMAIN,
] as const;

export { DEFAULT_HEALTH_ROUTINE_PRESET_ID, HEALTH_ROUTINE_PROFILE_ID } from './healthRoutineIdentity';
export const HEALTH_ROUTINE_MAX_NAME_LENGTH = 48;
export const HEALTH_ROUTINE_MIN_SPLIT = 1;
export const HEALTH_ROUTINE_MAX_SPLIT = 7;
export const HEALTH_ROUTINE_MAX_EXERCISES_PER_DAY = 100;
export const HEALTH_ROUTINE_MAX_PLANNED_SETS = 12;

export type HealthRoutineAggregateDay = Readonly<{
  dayName: string;
  blocks: string[];
  plannedSets: Record<string, number>;
}>;

export type HealthRoutinePresetAggregate = Readonly<{
  id: string;
  name: string;
  splitCount: number;
  days: HealthRoutineAggregateDay[];
  isDefault: boolean;
}>;

export type HealthRoutineProfileAggregate = Readonly<{
  id: typeof HEALTH_ROUTINE_PROFILE_ID;
  activePresetId: string | null;
}>;

export type HealthRoutineAggregateRecord = HealthRoutinePresetAggregate | HealthRoutineProfileAggregate;

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return Object.keys(value).sort().join('\0') === [...expected].sort().join('\0');
}

export { isHealthRoutineUuid, stableHealthRoutinePresetId } from './healthRoutineIdentity';

function validateDay(value: unknown, index: number): HealthRoutineAggregateDay {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('health_routine_day_object_required');
  const day = value as Record<string, unknown>;
  if (!exactKeys(day, ['dayName', 'blocks', 'plannedSets'])) throw new Error('health_routine_day_closed_shape');
  if (day.dayName !== `Day ${index + 1}`) throw new Error('health_routine_day_order');
  if (!Array.isArray(day.blocks) || day.blocks.length > HEALTH_ROUTINE_MAX_EXERCISES_PER_DAY
    || !day.blocks.every(isHealthRoutineUuid) || new Set(day.blocks).size !== day.blocks.length) {
    throw new Error('health_routine_blocks');
  }
  if (!day.plannedSets || typeof day.plannedSets !== 'object' || Array.isArray(day.plannedSets)) {
    throw new Error('health_routine_planned_sets');
  }
  const plannedSets = day.plannedSets as Record<string, unknown>;
  const blockSet = new Set(day.blocks);
  for (const [blockId, count] of Object.entries(plannedSets)) {
    if (!isHealthRoutineUuid(blockId) || !blockSet.has(blockId)
      || !Number.isInteger(count) || (count as number) < 1 || (count as number) > HEALTH_ROUTINE_MAX_PLANNED_SETS) {
      throw new Error('health_routine_planned_set_value');
    }
  }
  return {
    dayName: day.dayName,
    blocks: [...day.blocks],
    plannedSets: Object.fromEntries(Object.entries(plannedSets).map(([id, count]) => [id, count as number])),
  };
}

export function validateHealthRoutinePresetAggregate(value: unknown): HealthRoutinePresetAggregate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('health_routine_preset_object_required');
  const preset = value as Record<string, unknown>;
  if (!exactKeys(preset, ['id', 'name', 'splitCount', 'days', 'isDefault'])) {
    throw new Error('health_routine_preset_closed_shape');
  }
  if (!isHealthRoutineUuid(preset.id)) throw new Error('health_routine_preset_id');
  if (typeof preset.name !== 'string' || preset.name.trim() !== preset.name || preset.name.length < 1
    || preset.name.length > HEALTH_ROUTINE_MAX_NAME_LENGTH) throw new Error('health_routine_preset_name');
  if (!Number.isInteger(preset.splitCount) || (preset.splitCount as number) < HEALTH_ROUTINE_MIN_SPLIT
    || (preset.splitCount as number) > HEALTH_ROUTINE_MAX_SPLIT) throw new Error('health_routine_split_count');
  if (!Array.isArray(preset.days) || preset.days.length !== preset.splitCount) throw new Error('health_routine_days_length');
  if (typeof preset.isDefault !== 'boolean'
    || preset.isDefault !== (preset.id === DEFAULT_HEALTH_ROUTINE_PRESET_ID)) {
    throw new Error('health_routine_default_identity');
  }
  return {
    id: preset.id.toLowerCase(),
    name: preset.name,
    splitCount: preset.splitCount,
    days: preset.days.map(validateDay),
    isDefault: preset.isDefault,
  };
}

export function validateHealthRoutineProfileAggregate(value: unknown): HealthRoutineProfileAggregate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('health_routine_profile_object_required');
  const profile = value as Record<string, unknown>;
  if (!exactKeys(profile, ['id', 'activePresetId']) || profile.id !== HEALTH_ROUTINE_PROFILE_ID
    || profile.activePresetId !== null && !isHealthRoutineUuid(profile.activePresetId)) {
    throw new Error('health_routine_profile');
  }
  return {
    id: HEALTH_ROUTINE_PROFILE_ID,
    activePresetId: profile.activePresetId === null ? null : profile.activePresetId.toLowerCase(),
  };
}

export function routinePresetToAggregate(preset: RoutinePreset): HealthRoutinePresetAggregate {
  return validateHealthRoutinePresetAggregate({
    id: preset.id,
    name: preset.name,
    splitCount: preset.splitCount,
    days: preset.days.slice(0, preset.splitCount).map(day => ({
      dayName: day.dayName,
      blocks: [...day.blocks],
      plannedSets: Object.fromEntries(day.blocks
        .filter(blockId => day.plannedSets[blockId] !== undefined)
        .map(blockId => [blockId, day.plannedSets[blockId]])),
    })),
    isDefault: preset.id === DEFAULT_HEALTH_ROUTINE_PRESET_ID,
  });
}

export function routinePresetStateToAggregates(state: RoutinePresetState): {
  presets: HealthRoutinePresetAggregate[];
  profile: HealthRoutineProfileAggregate;
} {
  const presets = state.presets.map(routinePresetToAggregate);
  const activePresetId = presets.some(preset => preset.id === state.activePresetId)
    ? state.activePresetId
    : presets.find(preset => preset.isDefault)?.id ?? presets[0]?.id ?? null;
  return {
    presets,
    profile: validateHealthRoutineProfileAggregate({ id: HEALTH_ROUTINE_PROFILE_ID, activePresetId }),
  };
}

function aggregateDayToPresetDay(day: HealthRoutineAggregateDay): RoutinePresetDay {
  return { dayName: day.dayName, blocks: [...day.blocks], plannedSets: { ...day.plannedSets }, locallyAuthored: true };
}

export function aggregatesToRoutinePresetState(
  presetsInput: readonly HealthRoutinePresetAggregate[],
  profileInput: HealthRoutineProfileAggregate | null,
): RoutinePresetState {
  const presets = presetsInput.map(validateHealthRoutinePresetAggregate)
    .sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.id.localeCompare(right.id))
    .map<RoutinePreset>(preset => ({
      id: preset.id,
      name: preset.name,
      splitCount: preset.splitCount,
      days: preset.days.map(aggregateDayToPresetDay),
    }));
  if (presets.length === 0) throw new Error('health_routine_at_least_one_preset_required');
  const profile = profileInput ? validateHealthRoutineProfileAggregate(profileInput) : null;
  const fallback = presets.find(preset => preset.id === DEFAULT_HEALTH_ROUTINE_PRESET_ID)?.id ?? presets[0].id;
  return {
    version: 1,
    activePresetId: profile?.activePresetId && presets.some(preset => preset.id === profile.activePresetId)
      ? profile.activePresetId
      : fallback,
    presets,
    legacySyncPending: false,
  };
}

export function migrateRoutinePresetStateIdentity(accountId: string, state: RoutinePresetState): RoutinePresetState {
  const seen = new Set<string>();
  const idMap = new Map<string, string>();
  const presets = state.presets.map((preset, index) => {
    let id = stableHealthRoutinePresetId(accountId, preset.id, index);
    let collision = 1;
    while (seen.has(id)) {
      id = stableHealthRoutinePresetId(accountId, `${preset.id}:${collision}`, index);
      collision += 1;
    }
    seen.add(id);
    idMap.set(preset.id, id);
    const splitCount = Math.min(HEALTH_ROUTINE_MAX_SPLIT, Math.max(HEALTH_ROUTINE_MIN_SPLIT, preset.splitCount));
    return {
      ...preset,
      id,
      splitCount,
      days: preset.days.slice(0, splitCount).map((day, dayIndex) => ({
        ...day,
        dayName: `Day ${dayIndex + 1}`,
        blocks: [...day.blocks],
        plannedSets: { ...day.plannedSets },
      })),
    };
  });
  const fallback = presets.find(preset => preset.id === DEFAULT_HEALTH_ROUTINE_PRESET_ID)?.id ?? presets[0]?.id;
  if (!fallback) throw new Error('health_routine_at_least_one_preset_required');
  return {
    ...state,
    presets,
    activePresetId: idMap.get(state.activePresetId) ?? fallback,
  };
}
