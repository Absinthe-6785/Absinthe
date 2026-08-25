// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_ROUTINE_PRESET_ID,
  createEmptyRoutinePreset,
  createRoutinePresetState,
  readRoutinePresetState,
  routinePresetById,
  updateRoutinePresetState,
  writeRoutinePresetState,
} from './routinePresets';
import {
  adoptLegacyRoutinePresetSource,
  fingerprintLegacyRoutinePresetSource,
  hasValidRoutinePresetState,
  normalizeLegacyRoutinePresetSource,
  readLegacyRoutinePresetSource,
  readRoutinePresetLegacyAdoptionMarker,
  routinePresetLegacyAdoptionStorageKey,
} from './routinePresetAuthority';

const source = {
  splitCount: 5,
  plannedSetsByDay: { 'Day 1': { push: 7 }, 'Day 4': { pull: 4 } },
};

beforeEach(() => localStorage.clear());

describe('HEALTH_11 routine preset authority', () => {
  it('reads and fingerprints only the two explicit legacy source fields deterministically', () => {
    localStorage.setItem('healthSplitCount', '5');
    localStorage.setItem('healthRoutinePlannedSets', JSON.stringify({ 'Day 4': { pull: 4 }, 'Day 1': { push: 7 } }));
    const first = readLegacyRoutinePresetSource(localStorage);
    const second = normalizeLegacyRoutinePresetSource(5, { 'Day 1': { push: 7 }, 'Day 4': { pull: 4 } });
    expect(first).toEqual(source);
    expect(fingerprintLegacyRoutinePresetSource(first!)).toBe(fingerprintLegacyRoutinePresetSource(second!));
    expect(fingerprintLegacyRoutinePresetSource(first!)).toMatch(/^v1-[0-9a-f]{8}$/);
  });

  it('rejects malformed or unsupported account state without turning globals into an automatic fallback', () => {
    const key = 'healthRoutinePresets:v1:account-b';
    localStorage.setItem(key, JSON.stringify({ version: 0, activePresetId: DEFAULT_ROUTINE_PRESET_ID, presets: [] }));
    localStorage.setItem('healthSplitCount', '7');
    localStorage.setItem('healthRoutinePlannedSets', JSON.stringify({ 'Day 1': { push: 12 } }));
    expect(readRoutinePresetState(localStorage, 'account-b')).toBeNull();
    expect(normalizeLegacyRoutinePresetSource('bad', '{bad')).toBeNull();
    expect(hasValidRoutinePresetState({ version: 1, activePresetId: 'missing', presets: [] })).toBe(false);
  });

  it('explicitly adopts split and planned-set metadata for the current account only', () => {
    const base = createRoutinePresetState({ routines: [], splitCount: 3 });
    base.presets.push(createEmptyRoutinePreset('custom', 'Custom', 2));
    const result = adoptLegacyRoutinePresetSource({
      storage: localStorage,
      accountId: 'account-a',
      baseState: base,
      source,
      isCurrentAccount: () => true,
    });
    expect(result.status).toBe('adopted');
    const adopted = readRoutinePresetState(localStorage, 'account-a')!;
    expect(routinePresetById(adopted).splitCount).toBe(5);
    expect(routinePresetById(adopted).days[0].plannedSets).toEqual({ push: 7 });
    expect(routinePresetById(adopted).days[3].plannedSets).toEqual({ pull: 4 });
    expect(adopted.presets.some(preset => preset.id === 'custom')).toBe(true);
    expect(readRoutinePresetState(localStorage, 'account-b')).toBeNull();
    expect(localStorage.getItem('healthSplitCount')).toBeNull();
  });

  it('does not adopt globals when a valid established canonical state already exists', () => {
    const state = { ...createRoutinePresetState({ routines: [], splitCount: 2 }), legacySyncPending: false };
    writeRoutinePresetState(localStorage, 'account-a', state);
    const before = JSON.stringify(state);
    const result = adoptLegacyRoutinePresetSource({
      storage: localStorage,
      accountId: 'account-a',
      baseState: state,
      source,
      isCurrentAccount: () => true,
    });
    expect(result.status).toBe('canonical-exists');
    expect(JSON.stringify(readRoutinePresetState(localStorage, 'account-a'))).toBe(before);
  });

  it('permits explicit adoption for a fresh pending account and keeps it idempotent', () => {
    const state = createRoutinePresetState({ routines: [], splitCount: 3 });
    writeRoutinePresetState(localStorage, 'account-a', state);
    const first = adoptLegacyRoutinePresetSource({
      storage: localStorage,
      accountId: 'account-a',
      baseState: state,
      source,
      isCurrentAccount: () => true,
    });
    const afterFirst = JSON.stringify(readRoutinePresetState(localStorage, 'account-a'));
    const second = adoptLegacyRoutinePresetSource({
      storage: localStorage,
      accountId: 'account-a',
      baseState: state,
      source,
      isCurrentAccount: () => true,
    });
    expect(first.status).toBe('adopted');
    expect(second.status).toBe('already-adopted');
    expect(JSON.stringify(readRoutinePresetState(localStorage, 'account-a'))).toBe(afterFirst);
    expect(readRoutinePresetLegacyAdoptionMarker(localStorage, 'account-a')?.fingerprints).toEqual([
      fingerprintLegacyRoutinePresetSource(source),
    ]);
    expect(localStorage.getItem(routinePresetLegacyAdoptionStorageKey('account-b'))).toBeNull();
  });

  it('keeps the account-scoped marker independent when another account explicitly claims the same source', () => {
    const first = adoptLegacyRoutinePresetSource({
      storage: localStorage,
      accountId: 'account-a',
      source,
      isCurrentAccount: () => true,
    });
    const second = adoptLegacyRoutinePresetSource({
      storage: localStorage,
      accountId: 'account-b',
      source,
      isCurrentAccount: () => true,
    });
    expect(first.status).toBe('adopted');
    expect(second.status).toBe('adopted');
    expect(readRoutinePresetLegacyAdoptionMarker(localStorage, 'account-a')?.fingerprints).toEqual([
      fingerprintLegacyRoutinePresetSource(source),
    ]);
    expect(readRoutinePresetLegacyAdoptionMarker(localStorage, 'account-b')?.fingerprints).toEqual([
      fingerprintLegacyRoutinePresetSource(source),
    ]);
    expect(readRoutinePresetState(localStorage, 'account-a')).not.toBeNull();
    expect(readRoutinePresetState(localStorage, 'account-b')).not.toBeNull();
  });

  it('aborts before any canonical or marker write when the account generation is stale', () => {
    const state = createRoutinePresetState({ routines: [], splitCount: 3 });
    const result = adoptLegacyRoutinePresetSource({
      storage: localStorage,
      accountId: 'account-a',
      baseState: state,
      source,
      isCurrentAccount: () => false,
    });
    expect(result.status).toBe('aborted');
    expect(readRoutinePresetState(localStorage, 'account-a')).toBeNull();
    expect(readRoutinePresetLegacyAdoptionMarker(localStorage, 'account-a')).toBeNull();
  });

  it('does not manufacture custom presets or touch Today while applying legacy metadata', () => {
    const base = createRoutinePresetState({ routines: [{ id: 'row-1', day_name: 'Day 1', blocks: ['push'] }], splitCount: 1 });
    const custom = createEmptyRoutinePreset('custom', 'Custom', 1);
    const withCustom = updateRoutinePresetState(base, { type: 'create', preset: custom });
    const result = adoptLegacyRoutinePresetSource({
      storage: localStorage,
      accountId: 'account-a',
      baseState: withCustom,
      source: { splitCount: 2, plannedSetsByDay: { 'Day 1': { push: 6 } } },
      isCurrentAccount: () => true,
    });
    expect(result.status).toBe('adopted');
    const adopted = readRoutinePresetState(localStorage, 'account-a')!;
    expect(adopted.presets).toHaveLength(2);
    expect(routinePresetById(adopted, DEFAULT_ROUTINE_PRESET_ID).days[0].blocks).toEqual(['push']);
    expect(routinePresetById(adopted, 'custom').days[0].blocks).toEqual([]);
  });
});
