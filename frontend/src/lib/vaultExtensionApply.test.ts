// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./recoverySafetyPolicy', () => ({
  mayRestore: () => true,
  recordRecoveryBlock: vi.fn(),
}));
import { applyVaultExtensionsRestore } from './vaultExtensionApply';
import type { VaultPortableExtensions } from './vaultPortableExtensions';
import { createRoutinePresetState, readRoutinePresetState, writeRoutinePresetState } from '@/components/views/features/health/routinePresets';

function extensions(splitCount: number | null, planned: Record<string, unknown> | null): VaultPortableExtensions {
  return {
    schemaVersion: 1,
    settings: null,
    knowledge: {
      savedViews: [],
      ruleCollections: [],
      databaseViews: [],
      focusPresets: [],
      workspacePreferences: null,
      history: null,
    },
    health: {
      splitCount,
      routinePlannedSets: planned,
      recoveryLog: null,
      proteinRecentSources: null,
      proteinSourceUseCounts: null,
      drafts: {},
      memos: {},
    },
  };
}

beforeEach(() => localStorage.clear());

describe('HEALTH_11 explicit health restore bridge', () => {
  it('binds restored legacy metadata to the initiating account and avoids global runtime seeds', () => {
    const result = applyVaultExtensionsRestore(
      extensions(5, { 'Day 1': { push: 7 } }),
      { accountId: 'account-a', isCurrentAccount: () => true },
    );
    expect(result.sections).toContain('routinePresetState');
    expect(readRoutinePresetState(localStorage, 'account-a')?.presets[0].splitCount).toBe(5);
    expect(localStorage.getItem('healthSplitCount')).toBeNull();
    expect(localStorage.getItem('healthRoutinePlannedSets')).toBeNull();
    expect(readRoutinePresetState(localStorage, 'account-b')).toBeNull();
  });

  it('leaves an established canonical account untouched during restore', () => {
    const state = { ...createRoutinePresetState({ routines: [], splitCount: 2 }), legacySyncPending: false };
    writeRoutinePresetState(localStorage, 'account-a', state);
    const result = applyVaultExtensionsRestore(
      extensions(6, { 'Day 1': { push: 9 } }),
      { accountId: 'account-a', isCurrentAccount: () => true },
    );
    expect(result.sections).not.toContain('routinePresetState');
    expect(readRoutinePresetState(localStorage, 'account-a')).toEqual(state);
  });

  it('aborts account-bound adoption without writing canonical state after a generation switch', () => {
    const result = applyVaultExtensionsRestore(
      extensions(4, { 'Day 1': { push: 5 } }),
      { accountId: 'account-a', isCurrentAccount: () => false },
    );
    expect(result.errors).toContain('routine_preset_adoption_aborted');
    expect(readRoutinePresetState(localStorage, 'account-a')).toBeNull();
  });

  it('keeps the unbound compatibility projection path for legacy callers', () => {
    const result = applyVaultExtensionsRestore(extensions(4, { 'Day 1': { push: 5 } }));
    expect(result.sections).toContain('healthSplitCount');
    expect(result.sections).toContain('routinePlannedSets');
    expect(localStorage.getItem('healthSplitCount')).toBe('4');
    expect(localStorage.getItem('healthRoutinePlannedSets')).toContain('push');
  });
});
