import type { HealthRoutine, WorkoutSet } from '@/types';

export const ROUTINE_PRESET_STATE_VERSION = 1 as const;
export const DEFAULT_ROUTINE_PRESET_ID = 'health-default';
export const ROUTINE_PRESET_MAX_NAME_LENGTH = 48;
export const ROUTINE_PRESET_MIN_SPLIT = 1;
export const ROUTINE_PRESET_MAX_SPLIT = 7;
export const ROUTINE_PRESET_STORAGE_PREFIX = 'healthRoutinePresets:v1:';

export type RoutinePresetDay = {
  dayName: string;
  blocks: string[];
  plannedSets: Record<string, number>;
  legacyRoutineId?: string;
  /** Marks a day that the user has explicitly edited, including clearing it. */
  locallyAuthored?: boolean;
};

export type RoutinePreset = {
  id: string;
  name: string;
  splitCount: number;
  days: RoutinePresetDay[];
};

export type RoutinePresetState = {
  version: typeof ROUTINE_PRESET_STATE_VERSION;
  activePresetId: string;
  presets: RoutinePreset[];
  /** True only until the first account-scoped state observes legacy remote rows. */
  legacySyncPending?: boolean;
  /** Highest account routine day observed, used to distinguish new data from an intentional split reduction. */
  legacyObservedSplitCount?: number;
};

export type RoutinePresetStateOptions = {
  routines: readonly HealthRoutine[];
  splitCount: number;
  plannedSetsByDay?: Readonly<Record<string, Readonly<Record<string, number>>>>;
};

export type RoutinePresetAction =
  | { type: 'switch'; presetId: string }
  | { type: 'create'; preset: RoutinePreset }
  | { type: 'rename'; presetId: string; name: string }
  | { type: 'duplicate'; sourcePresetId: string; preset: RoutinePreset }
  | { type: 'delete'; presetId: string }
  | { type: 'set-split'; presetId: string; splitCount: number }
  | { type: 'set-day'; presetId: string; dayName: string; blocks: string[]; plannedSets: Record<string, number> };

export function clampRoutineSplit(value: number): number {
  if (!Number.isFinite(value)) return 3;
  return Math.min(ROUTINE_PRESET_MAX_SPLIT, Math.max(ROUTINE_PRESET_MIN_SPLIT, Math.round(value)));
}

export function sanitizeRoutinePresetName(value: string, fallback = 'New preset'): string {
  const trimmed = value.trim().slice(0, ROUTINE_PRESET_MAX_NAME_LENGTH);
  return trimmed || fallback;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function dayNameFor(index: number): string {
  return `Day ${index + 1}`;
}

function emptyDay(dayName: string): RoutinePresetDay {
  return { dayName, blocks: [], plannedSets: {} };
}

function normalizeDay(value: unknown, fallbackDayName: string): RoutinePresetDay {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const dayName = typeof raw.dayName === 'string' && raw.dayName.trim()
    ? raw.dayName.trim()
    : fallbackDayName;
  const blocks = Array.isArray(raw.blocks)
    ? [...new Set(raw.blocks.filter((id): id is string => typeof id === 'string' && id.length > 0))]
    : [];
  const plannedSets: Record<string, number> = {};
  if (raw.plannedSets && typeof raw.plannedSets === 'object') {
    for (const [id, count] of Object.entries(raw.plannedSets as Record<string, unknown>)) {
      const normalized = Number(count);
      if (id && Number.isFinite(normalized) && normalized >= 1) {
        plannedSets[id] = Math.min(12, Math.max(1, Math.round(normalized)));
      }
    }
  }
  const legacyRoutineId = typeof raw.legacyRoutineId === 'string' && raw.legacyRoutineId.length > 0
    ? raw.legacyRoutineId
    : undefined;
  const locallyAuthored = raw.locallyAuthored === true;
  return {
    dayName,
    blocks,
    plannedSets,
    ...(legacyRoutineId ? { legacyRoutineId } : {}),
    ...(locallyAuthored ? { locallyAuthored: true } : {}),
  };
}

function dayNumber(dayName: string): number {
  const match = /^Day\s+(\d+)$/.exec(dayName);
  return match ? Number(match[1]) : 0;
}

function highestDayNumber(days: readonly { dayName: string }[]): number {
  return days.reduce((max, day) => Math.max(max, dayNumber(day.dayName)), 0);
}

export function observedRoutineSplitCount(routines: readonly HealthRoutine[]): number {
  return routines.reduce((max, routine) => Math.max(max, dayNumber(routine.day_name)), 0);
}

function normalizePreset(value: unknown, index: number): RoutinePreset | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `preset-${index + 1}`;
  const splitCount = clampRoutineSplit(Number(raw.splitCount));
  const rawDays = Array.isArray(raw.days) ? raw.days : [];
  const dayCount = clampRoutineSplit(Math.max(splitCount, highestDayNumber(rawDays
    .filter((day): day is Record<string, unknown> => !!day && typeof day === 'object')
    .map(day => ({ dayName: typeof day.dayName === 'string' ? day.dayName : '' })))));
  const days = Array.from({ length: dayCount }, (_, dayIndex) => {
    const candidate = rawDays.find(day => (
      day && typeof day === 'object' && (day as Record<string, unknown>).dayName === dayNameFor(dayIndex)
    ));
    return normalizeDay(candidate, dayNameFor(dayIndex));
  });
  return {
    id,
    name: sanitizeRoutinePresetName(typeof raw.name === 'string' ? raw.name : '', index === 0 ? 'Default' : 'New preset'),
    splitCount,
    days,
  };
}

function ensureUniquePresetIds(presets: RoutinePreset[]): RoutinePreset[] {
  const used = new Set<string>();
  return presets.map((preset, index) => {
    let id = preset.id || `preset-${index + 1}`;
    while (used.has(id)) id = `${id}-${index + 1}`;
    used.add(id);
    return id === preset.id ? preset : { ...preset, id };
  });
}

export function normalizeRoutinePresetState(value: unknown): RoutinePresetState | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (raw.version !== ROUTINE_PRESET_STATE_VERSION) return null;
  const normalized = Array.isArray(raw.presets)
    ? raw.presets.map(normalizePreset).filter((preset): preset is RoutinePreset => preset !== null)
    : [];
  const presets = ensureUniquePresetIds(normalized);
  if (presets.length === 0 || !presets.some(preset => preset.id === DEFAULT_ROUTINE_PRESET_ID)) return null;
  const requestedActive = typeof raw.activePresetId === 'string' ? raw.activePresetId : '';
  return {
    version: ROUTINE_PRESET_STATE_VERSION,
    activePresetId: presets.some(preset => preset.id === requestedActive) ? requestedActive : presets[0].id,
    presets,
    legacySyncPending: raw.legacySyncPending === true,
    legacyObservedSplitCount: typeof raw.legacyObservedSplitCount === 'number'
      ? clampRoutineSplit(raw.legacyObservedSplitCount)
      : undefined,
  };
}

export function routinePresetStorageKey(accountId: string): string {
  return `${ROUTINE_PRESET_STORAGE_PREFIX}${encodeURIComponent(accountId)}`;
}

export function readRoutinePresetState(storage: Storage, accountId: string): RoutinePresetState | null {
  try {
    const raw = storage.getItem(routinePresetStorageKey(accountId));
    return raw ? normalizeRoutinePresetState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeRoutinePresetState(storage: Storage, accountId: string, state: RoutinePresetState): boolean {
  try {
    storage.setItem(routinePresetStorageKey(accountId), JSON.stringify(state));
    return true;
  } catch {
    // Browser storage can be unavailable in privacy-restricted contexts. The
    // in-memory React state remains usable for the current session.
    return false;
  }
}

function dayFromLegacy(
  dayName: string,
  routines: readonly HealthRoutine[],
  plannedSetsByDay: Readonly<Record<string, Readonly<Record<string, number>>>>,
): RoutinePresetDay {
  const routine = routines.find(candidate => candidate.day_name === dayName);
  return {
    dayName,
    blocks: routine ? [...routine.blocks] : [],
    plannedSets: { ...(plannedSetsByDay[dayName] ?? {}) },
    ...(routine?.id ? { legacyRoutineId: routine.id } : {}),
  };
}

export function createLegacyRoutinePreset({ routines, splitCount, plannedSetsByDay = {} }: RoutinePresetStateOptions): RoutinePreset {
  const normalizedSplit = clampRoutineSplit(Math.max(splitCount, observedRoutineSplitCount(routines)));
  return {
    id: DEFAULT_ROUTINE_PRESET_ID,
    name: 'Default',
    splitCount: normalizedSplit,
    days: Array.from({ length: normalizedSplit }, (_, index) => dayFromLegacy(dayNameFor(index), routines, plannedSetsByDay)),
  };
}

export function createRoutinePresetState(options: RoutinePresetStateOptions): RoutinePresetState {
  const preset = createLegacyRoutinePreset(options);
  const observedSplit = observedRoutineSplitCount(options.routines);
  return {
    version: ROUTINE_PRESET_STATE_VERSION,
    activePresetId: preset.id,
    presets: [preset],
    legacySyncPending: options.routines.length === 0,
    ...(observedSplit > 0 ? { legacyObservedSplitCount: observedSplit } : {}),
  };
}

export function syncLegacyDefaultRoutinePreset(
  state: RoutinePresetState,
  options: RoutinePresetStateOptions,
): RoutinePresetState {
  if (options.routines.length === 0) return state;
  const defaultPreset = state.presets.find(preset => preset.id === DEFAULT_ROUTINE_PRESET_ID);
  if (!defaultPreset) return { ...state, legacySyncPending: false };
  const observedSplit = observedRoutineSplitCount(options.routines);
  const previousObservedSplit = state.legacyObservedSplitCount ?? 0;
  const newlyObservedHigherDay = observedSplit > previousObservedSplit;
  const knownObservedSplit = Math.max(previousObservedSplit, observedSplit);
  const splitCount = clampRoutineSplit(Math.max(defaultPreset.splitCount, newlyObservedHigherDay ? observedSplit : 0));
  const synced = createLegacyRoutinePreset({ ...options, splitCount });
  const days = Array.from({ length: Math.max(splitCount, highestDayNumber(defaultPreset.days)) }, (_, index) => {
    const dayName = dayNameFor(index);
    const existing = defaultPreset.days.find(day => day.dayName === dayName);
    const legacy = synced.days.find(day => day.dayName === dayName) ?? emptyDay(dayName);
    const hasExistingContent = !!existing && (
      existing.blocks.length > 0
      || Object.keys(existing.plannedSets).length > 0
      || !!existing.legacyRoutineId
      || existing.locallyAuthored === true
    );
    return hasExistingContent
      ? { ...existing, legacyRoutineId: existing.legacyRoutineId ?? legacy.legacyRoutineId }
      : legacy;
  });
  const mergedDefault = { ...defaultPreset, splitCount, days };
  const pendingChanged = state.legacySyncPending !== false;
  if (!pendingChanged
    && state.legacyObservedSplitCount === knownObservedSplit
    && JSON.stringify(mergedDefault) === JSON.stringify(defaultPreset)) return state;
  return {
    ...state,
    presets: state.presets.map(preset => preset.id === DEFAULT_ROUTINE_PRESET_ID ? mergedDefault : preset),
    legacySyncPending: false,
    ...(knownObservedSplit > 0 ? { legacyObservedSplitCount: knownObservedSplit } : {}),
  };
}

export function createEmptyRoutinePreset(id: string, name = 'New preset', splitCount = 3): RoutinePreset {
  const normalizedSplit = clampRoutineSplit(splitCount);
  return {
    id,
    name: sanitizeRoutinePresetName(name),
    splitCount: normalizedSplit,
    days: Array.from({ length: normalizedSplit }, (_, index) => emptyDay(dayNameFor(index))),
  };
}

export function createRoutinePresetId(): string {
  const randomUuid = globalThis.crypto?.randomUUID;
  if (typeof randomUuid === 'function') return randomUuid.call(globalThis.crypto);
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function routinePresetById(state: RoutinePresetState, presetId = state.activePresetId): RoutinePreset {
  return state.presets.find(preset => preset.id === presetId) ?? state.presets[0];
}

export function routinePresetToHealthRoutines(preset: RoutinePreset): HealthRoutine[] {
  return preset.days.slice(0, preset.splitCount).map(day => ({
    id: day.legacyRoutineId ?? `${preset.id}:${day.dayName}`,
    day_name: day.dayName,
    blocks: [...day.blocks],
  }));
}

export function routinePresetPlannedSetCount(
  preset: RoutinePreset,
  dayName: string,
  blockId: string,
  blockType: string,
  prevSets?: readonly WorkoutSet[],
): number {
  if (blockType === 'cardio') return 1;
  const stored = preset.days.find(day => day.dayName === dayName)?.plannedSets[blockId];
  if (stored && stored >= 1) return Math.min(12, stored);
  if (prevSets && prevSets.length > 0) return prevSets.length;
  return 3;
}

export function updateRoutinePresetState(state: RoutinePresetState, action: RoutinePresetAction): RoutinePresetState {
  if (action.type === 'switch') {
    return state.presets.some(preset => preset.id === action.presetId)
      ? { ...state, activePresetId: action.presetId }
      : state;
  }
  if (action.type === 'create') {
    return { ...state, presets: [...state.presets, clone(action.preset)], activePresetId: action.preset.id };
  }
  if (action.type === 'rename') {
    return {
      ...state,
      presets: state.presets.map(preset => preset.id === action.presetId
        ? { ...preset, name: sanitizeRoutinePresetName(action.name, preset.name) }
        : preset),
    };
  }
  if (action.type === 'duplicate') {
    const source = state.presets.find(preset => preset.id === action.sourcePresetId);
    if (!source) return state;
    const sourceIndex = state.presets.findIndex(preset => preset.id === source.id);
    const presets = [...state.presets];
    presets.splice(sourceIndex + 1, 0, clone(action.preset));
    return { ...state, presets, activePresetId: action.preset.id };
  }
  if (action.type === 'delete') {
    if (state.presets.length <= 1 || action.presetId === DEFAULT_ROUTINE_PRESET_ID || !state.presets.some(preset => preset.id === action.presetId)) return state;
    const presets = state.presets.filter(preset => preset.id !== action.presetId);
    const activePresetId = state.activePresetId === action.presetId ? presets[0].id : state.activePresetId;
    return { ...state, presets, activePresetId };
  }
  const target = state.presets.find(preset => preset.id === action.presetId);
  if (!target) return state;
  if (action.type === 'set-split') {
    const splitCount = clampRoutineSplit(action.splitCount);
    const dayCount = Math.max(splitCount, highestDayNumber(target.days));
    const days = Array.from({ length: dayCount }, (_, index) => (
      target.days.find(day => day.dayName === dayNameFor(index)) ?? emptyDay(dayNameFor(index))
    ));
    return {
      ...state,
      presets: state.presets.map(preset => preset.id === target.id ? { ...preset, splitCount, days } : preset),
    };
  }
  if (action.type === 'set-day') {
    const dayName = action.dayName;
    const existing = target.days.some(day => day.dayName === dayName);
    const days = target.days.map(day => day.dayName === dayName
      ? { ...day, blocks: [...action.blocks], plannedSets: { ...action.plannedSets }, locallyAuthored: true }
      : day);
    if (!existing) days.push({ ...emptyDay(dayName), blocks: [...action.blocks], plannedSets: { ...action.plannedSets }, locallyAuthored: true });
    return {
      ...state,
      presets: state.presets.map(preset => preset.id === target.id ? { ...preset, days } : preset),
    };
  }
  return state;
}
