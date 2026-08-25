import {
  DEFAULT_ROUTINE_PRESET_ID,
  ROUTINE_PRESET_STATE_VERSION,
  clampRoutineSplit,
  createRoutinePresetState,
  normalizeRoutinePresetState,
  readRoutinePresetState,
  type RoutinePresetState,
  writeRoutinePresetState,
} from './routinePresets';

export const ROUTINE_PRESET_LEGACY_ADOPTION_STORAGE_PREFIX = 'healthRoutinePresetLegacyAdoption:v1:';

export type LegacyRoutinePresetSource = {
  splitCount: number | null;
  plannedSetsByDay: Record<string, Record<string, number>>;
};

export type RoutinePresetLegacyAdoptionMarker = {
  version: typeof ROUTINE_PRESET_STATE_VERSION;
  fingerprints: string[];
};

export type RoutinePresetLegacyAdoptionResult =
  | { status: 'adopted'; fingerprint: string; state: RoutinePresetState }
  | { status: 'already-adopted'; fingerprint: string; state: RoutinePresetState }
  | { status: 'canonical-exists'; fingerprint: string; state: RoutinePresetState }
  | { status: 'no-source' }
  | { status: 'aborted'; fingerprint: string }
  | { status: 'write-failed'; fingerprint: string };

/** The single validity gate used before any account state can be authoritative. */
export function hasValidRoutinePresetState(value: unknown): value is RoutinePresetState {
  return normalizeRoutinePresetState(value) !== null;
}

function normalizeLegacySplit(value: unknown): number | null {
  const parsed = typeof value === 'number' && Number.isFinite(value)
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : NaN;
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 7 ? parsed : null;
}

function normalizeLegacyPlannedSets(value: unknown): Record<string, Record<string, number>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, Record<string, number>> = {};
  for (const [dayName, rawSets] of Object.entries(value as Record<string, unknown>)) {
    if (!/^Day\s+[1-7]$/.test(dayName) || !rawSets || typeof rawSets !== 'object' || Array.isArray(rawSets)) continue;
    const sets: Record<string, number> = {};
    for (const [blockId, rawCount] of Object.entries(rawSets as Record<string, unknown>)) {
      const count = typeof rawCount === 'number' && Number.isFinite(rawCount)
        ? rawCount
        : typeof rawCount === 'string' && rawCount.trim() !== ''
          ? Number(rawCount)
          : NaN;
      if (blockId && Number.isInteger(count) && count >= 1 && count <= 12) sets[blockId] = count;
    }
    if (Object.keys(sets).length > 0) result[dayName] = sets;
  }
  return result;
}

export function normalizeLegacyRoutinePresetSource(
  splitCount: unknown,
  plannedSetsByDay: unknown,
): LegacyRoutinePresetSource | null {
  const source: LegacyRoutinePresetSource = {
    splitCount: normalizeLegacySplit(splitCount),
    plannedSetsByDay: normalizeLegacyPlannedSets(plannedSetsByDay),
  };
  return source.splitCount !== null || Object.keys(source.plannedSetsByDay).length > 0 ? source : null;
}

export function readLegacyRoutinePresetSource(storage: Storage): LegacyRoutinePresetSource | null {
  let splitRaw: string | null = null;
  let plannedRaw: string | null = null;
  try {
    splitRaw = storage.getItem('healthSplitCount');
    plannedRaw = storage.getItem('healthRoutinePlannedSets');
  } catch {
    return null;
  }
  let planned: unknown = null;
  if (plannedRaw) {
    try {
      planned = JSON.parse(plannedRaw);
    } catch {
      planned = null;
    }
  }
  return normalizeLegacyRoutinePresetSource(splitRaw, planned);
}

function canonicalSourceJson(source: LegacyRoutinePresetSource): string {
  const plannedSetsByDay = Object.fromEntries(
    Object.keys(source.plannedSetsByDay).sort().map(dayName => [
      dayName,
      Object.fromEntries(Object.keys(source.plannedSetsByDay[dayName]).sort().map(blockId => [
        blockId,
        source.plannedSetsByDay[dayName][blockId],
      ])),
    ]),
  );
  return JSON.stringify({ splitCount: source.splitCount, plannedSetsByDay });
}

/** A stable non-cryptographic fingerprint; the marker never stores the source payload. */
export function fingerprintLegacyRoutinePresetSource(source: LegacyRoutinePresetSource): string {
  const input = canonicalSourceJson(source);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `v1-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function routinePresetLegacyAdoptionStorageKey(accountId: string): string {
  return `${ROUTINE_PRESET_LEGACY_ADOPTION_STORAGE_PREFIX}${encodeURIComponent(accountId)}`;
}

export function readRoutinePresetLegacyAdoptionMarker(
  storage: Storage,
  accountId: string,
): RoutinePresetLegacyAdoptionMarker | null {
  try {
    const raw = storage.getItem(routinePresetLegacyAdoptionStorageKey(accountId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RoutinePresetLegacyAdoptionMarker>;
    if (parsed.version !== ROUTINE_PRESET_STATE_VERSION || !Array.isArray(parsed.fingerprints)) return null;
    const fingerprints = [...new Set(parsed.fingerprints.filter((value): value is string => typeof value === 'string' && value.length > 0))];
    return fingerprints.length > 0 ? { version: ROUTINE_PRESET_STATE_VERSION, fingerprints } : null;
  } catch {
    return null;
  }
}

function writeRoutinePresetLegacyAdoptionMarker(
  storage: Storage,
  accountId: string,
  marker: RoutinePresetLegacyAdoptionMarker,
): boolean {
  try {
    storage.setItem(routinePresetLegacyAdoptionStorageKey(accountId), JSON.stringify(marker));
    return true;
  } catch {
    return false;
  }
}

function applyLegacyMetadata(
  state: RoutinePresetState,
  source: LegacyRoutinePresetSource,
): RoutinePresetState {
  const defaultPreset = state.presets.find(preset => preset.id === DEFAULT_ROUTINE_PRESET_ID);
  if (!defaultPreset) return state;
  const highestPlannedDay = Object.keys(source.plannedSetsByDay).reduce((max, dayName) => {
    const match = /^Day\s+(\d+)$/.exec(dayName);
    return Math.max(max, match ? Number(match[1]) : 0);
  }, 0);
  const splitCount = clampRoutineSplit(Math.max(
    source.splitCount ?? defaultPreset.splitCount,
    highestPlannedDay,
  ));
  const days = Array.from({ length: Math.max(splitCount, defaultPreset.days.length) }, (_, index) => {
    const dayName = `Day ${index + 1}`;
    const existing = defaultPreset.days.find(day => day.dayName === dayName) ?? {
      dayName,
      blocks: [],
      plannedSets: {},
    };
    const plannedSets = source.plannedSetsByDay[dayName];
    return plannedSets ? { ...existing, plannedSets: { ...plannedSets } } : { ...existing, plannedSets: { ...existing.plannedSets } };
  });
  const nextDefault = { ...defaultPreset, splitCount, days };
  return {
    ...state,
    presets: state.presets.map(preset => preset.id === DEFAULT_ROUTINE_PRESET_ID ? nextDefault : preset),
  };
}

function hasEstablishedCanonicalContent(state: RoutinePresetState): boolean {
  if (state.legacySyncPending !== true) return true;
  return state.presets.some(preset => preset.id !== DEFAULT_ROUTINE_PRESET_ID)
    || state.presets
      .find(preset => preset.id === DEFAULT_ROUTINE_PRESET_ID)
      ?.days.some(day => day.locallyAuthored === true) === true;
}

/**
 * Explicitly claims unattributable legacy Health metadata for one account.
 * `isCurrentAccount` is checked before the canonical and marker writes so a
 * session transition cannot commit adoption for the initiating account.
 */
export function adoptLegacyRoutinePresetSource(input: {
  storage: Storage;
  accountId: string;
  baseState?: RoutinePresetState;
  source: LegacyRoutinePresetSource | null;
  isCurrentAccount: () => boolean;
}): RoutinePresetLegacyAdoptionResult {
  const { storage, accountId, source, isCurrentAccount } = input;
  if (!source) return { status: 'no-source' };
  const fingerprint = fingerprintLegacyRoutinePresetSource(source);
  const marker = readRoutinePresetLegacyAdoptionMarker(storage, accountId);
  const persisted = readRoutinePresetState(storage, accountId);
  if (marker?.fingerprints.includes(fingerprint)) {
    return {
      status: 'already-adopted',
      fingerprint,
      state: persisted ?? input.baseState ?? createRoutinePresetState({ routines: [], splitCount: 3 }),
    };
  }
  if (persisted && hasEstablishedCanonicalContent(persisted)) {
    return { status: 'canonical-exists', fingerprint, state: persisted };
  }
  if (!isCurrentAccount()) return { status: 'aborted', fingerprint };

  const baseState = persisted ?? input.baseState ?? createRoutinePresetState({ routines: [], splitCount: 3 });
  const nextState = applyLegacyMetadata(baseState, source);
  if (!isCurrentAccount()) return { status: 'aborted', fingerprint };
  if (!writeRoutinePresetState(storage, accountId, nextState)) return { status: 'write-failed', fingerprint };
  if (!isCurrentAccount()) return { status: 'aborted', fingerprint };

  const nextMarker: RoutinePresetLegacyAdoptionMarker = {
    version: ROUTINE_PRESET_STATE_VERSION,
    fingerprints: [...new Set([...(marker?.fingerprints ?? []), fingerprint])],
  };
  if (!writeRoutinePresetLegacyAdoptionMarker(storage, accountId, nextMarker)) {
    // The canonical write is intentionally not rolled back: it remains the
    // authority even if the small idempotence marker cannot be persisted.
    return { status: 'write-failed', fingerprint };
  }
  return { status: 'adopted', fingerprint, state: nextState };
}

/** Explicit Health restore bridge: extension values are already the claimed source. */
export function adoptLegacyRoutinePresetExtension(input: {
  storage: Storage;
  accountId: string;
  splitCount: unknown;
  plannedSetsByDay: unknown;
  isCurrentAccount: () => boolean;
}): RoutinePresetLegacyAdoptionResult {
  const source = normalizeLegacyRoutinePresetSource(input.splitCount, input.plannedSetsByDay);
  return adoptLegacyRoutinePresetSource({ ...input, source });
}
