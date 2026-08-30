import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  authFetch: vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
  })),
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: {
    setState: vi.fn(),
    persist: { rehydrate: vi.fn() },
  },
}));

import type { NoteBase } from '@/components/views/noteUtils';
import {
  buildVaultBackupManifest,
  buildVaultBackupManifestV3,
  normalizeVaultBackupManifest,
  upgradeVaultBackupToV3,
} from './exportVaultBackup';
import { VAULT_BACKUP_SCHEMA_VERSION_V2 } from './vaultBackupConstants';
import { applyVaultRestore, parseVaultBackupJson } from './importVaultBackup';
import { applyVaultExtensionsRestore } from './vaultExtensionApply';
import { applyCloudRestore } from './vaultCloudRestore';
import {
  assessRecoveryProtectionStatus,
  buildFullVaultRestorePreview,
  buildVaultRestoreImpact,
  executeVaultRestorePipeline,
  getLastVaultExportAt,
  manifestFromSnapshot,
  recordLastVaultExport,
  resolveInitialVaultRestoreStrategy,
  LAST_VAULT_EXPORT_KEY,
  type VaultRestorePipelineOptions,
} from './vaultRestorePipeline';
import { buildVaultSnapshot, toRestoreReadyManifest } from './vaultSnapshotBuild';
import { SNAPSHOT_INDEX_KEY } from './vaultSnapshotConstants';
import { clearAllVaultSnapshots, saveVaultSnapshot, type SnapshotStorageAdapter } from './vaultSnapshotStore';
import { simulateVaultRestore } from './vaultExtensionRestoreSim';
import { setRecoveryModeActiveForTest } from './recoverySafetyPolicy';
import { activateRecoveryMode } from './recoverySafetyPolicy';
import { authFetch } from './supabase';

function note(id: string, title = 'Note'): NoteBase {
  return {
    id,
    title,
    body: `# ${title}`,
    folderId: null,
    starred: false,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 1,
    properties: {},
    relations: {},
  };
}

function v2ManifestJson(): string {
  return JSON.stringify({
    schemaVersion: VAULT_BACKUP_SCHEMA_VERSION_V2,
    exportedAt: '2026-01-01T00:00:00.000Z',
    app: 'absinthe',
    appVersion: '1.0.0',
    noteCount: 1,
    folderCount: 0,
    relationCount: 0,
    folders: [],
    notes: [{
      id: 'n1',
      title: 'Legacy',
      folderId: null,
      starred: false,
      updatedAt: 1,
      markdown: '# Legacy\n\nBody',
      properties: {},
      relations: {},
    }],
  });
}

function makeStorage(): SnapshotStorageAdapter {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

describe('vaultRestorePipeline', () => {
  const store = new Map<string, string>();
  const authFetchMock = vi.mocked(authFetch);

  beforeEach(() => {
    setRecoveryModeActiveForTest(false);
    authFetchMock.mockReset();
    authFetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) } as Response);
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      get length() { return store.size; },
      key: (index: number) => [...store.keys()][index] ?? null,
    });
    store.set('planner-storage', JSON.stringify({ darkMode: true, language: 'ko' }));
    store.set('note-saved-views-v1', JSON.stringify([{ id: 'sv1', name: 'All', query: 'tag:math' }]));
    clearAllVaultSnapshots(makeStorage());
  });

  it('selects replace only for a validated zero-conflict preview', () => {
    expect(resolveInitialVaultRestoreStrategy({ valid: true, conflictCount: 0 })).toBe('replace');
    expect(resolveInitialVaultRestoreStrategy({ valid: true, conflictCount: 1 })).toBe('skip');
    expect(resolveInitialVaultRestoreStrategy({ valid: false, conflictCount: 0 })).toBe('skip');
  });

  it('K-319 blocks the pipeline before snapshot, core, extensions, or cloud mutation', async () => {
    setRecoveryModeActiveForTest(true);
    const manifest = buildVaultBackupManifestV3([note('n1')], []);
    const importCore = vi.fn();

    await expect(executeVaultRestorePipeline(manifest, {
      strategy: 'replace',
      selection: { noteIds: new Set(['n1']), folderIds: new Set() },
      backupBeforeRestore: true,
      restoreCore: true,
      restoreExtensions: true,
      restoreCloud: true,
    }, {
      importCore,
      getNotes: () => [],
      getFolders: () => [],
    })).rejects.toMatchObject({ code: 'RECOVERY_MODE_BLOCKED' });

    expect(importCore).not.toHaveBeenCalled();
    expect(store.has('absinthe:last-snapshot:v1')).toBe(false);
  });

  it('allows a local core-only restore during recovery mode with its snapshot boundary intact', async () => {
    setRecoveryModeActiveForTest(true);
    store.set('absinthe-notes-sync-mode', 'local');
    const manifest = buildVaultBackupManifestV3([note('n1')], []);
    const importCore = vi.fn((filtered: typeof manifest, strategy: 'replace' | 'skip' | 'duplicate') =>
      applyVaultRestore(filtered, [], [], strategy).result);

    const result = await executeVaultRestorePipeline(manifest, {
      strategy: 'replace',
      selection: { noteIds: new Set(['n1']), folderIds: new Set() },
      backupBeforeRestore: true,
      restoreCore: true,
      restoreExtensions: false,
      restoreCloud: false,
    }, {
      importCore,
      getNotes: () => [],
      getFolders: () => [],
    });

    expect(result.core?.importedNotes).toBe(1);
    expect(result.backedUp).toBe(true);
    expect(importCore).toHaveBeenCalledTimes(1);
    expect(store.has(SNAPSHOT_INDEX_KEY)).toBe(true);
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['strategy skip', { strategy: 'skip' }],
    ['strategy omitted', { strategy: undefined }],
    ['strategy malformed', { strategy: true }],
    ['snapshot false', { backupBeforeRestore: false }],
    ['snapshot omitted', { backupBeforeRestore: undefined }],
    ['snapshot malformed', { backupBeforeRestore: 'true' }],
    ['extensions true', { restoreExtensions: true }],
    ['extensions omitted', { restoreExtensions: undefined }],
    ['extensions malformed', { restoreExtensions: 0 }],
    ['cloud true', { restoreCloud: true }],
    ['cloud omitted', { restoreCloud: undefined }],
    ['cloud malformed', { restoreCloud: '' }],
  ])('blocks unsafe local-core pipeline option: %s', async (_label, patch) => {
    setRecoveryModeActiveForTest(true);
    store.set('absinthe-notes-sync-mode', 'local');
    const manifest = buildVaultBackupManifestV3([note('n1')], []);
    const importCore = vi.fn();
    const options = {
      strategy: 'replace',
      selection: { noteIds: new Set(['n1']), folderIds: new Set<string>() },
      backupBeforeRestore: true,
      restoreCore: true,
      restoreExtensions: false,
      restoreCloud: false,
      ...patch,
    } as unknown as VaultRestorePipelineOptions;

    await expect(executeVaultRestorePipeline(manifest, options, {
      importCore,
      getNotes: () => [],
      getFolders: () => [],
    })).rejects.toMatchObject({ code: 'RECOVERY_MODE_BLOCKED' });
    expect(importCore).not.toHaveBeenCalled();
    expect(store.has(SNAPSHOT_INDEX_KEY)).toBe(false);
  });

  it.each(['remote', 'hybrid'] as const)('blocks the local-core exception in %s mode', async mode => {
    setRecoveryModeActiveForTest(true);
    store.set('absinthe-notes-sync-mode', mode);
    const manifest = buildVaultBackupManifestV3([note('n1')], []);
    const importCore = vi.fn();

    await expect(executeVaultRestorePipeline(manifest, {
      strategy: 'replace',
      selection: { noteIds: new Set(['n1']), folderIds: new Set() },
      backupBeforeRestore: true,
      restoreCore: true,
      restoreExtensions: false,
      restoreCloud: false,
    }, {
      importCore,
      getNotes: () => [],
      getFolders: () => [],
    })).rejects.toMatchObject({ code: 'RECOVERY_MODE_BLOCKED' });
    expect(importCore).not.toHaveBeenCalled();
  });

  it('blocks a semantically invalid manifest before snapshot or core mutation', async () => {
    setRecoveryModeActiveForTest(true);
    store.set('absinthe-notes-sync-mode', 'local');
    const manifest = { ...buildVaultBackupManifestV3([note('n1')], []), app: 'other' as 'absinthe' };
    const importCore = vi.fn();

    await expect(executeVaultRestorePipeline(manifest, {
      strategy: 'replace',
      selection: { noteIds: new Set(['n1']), folderIds: new Set() },
      backupBeforeRestore: true,
      restoreCore: true,
      restoreExtensions: false,
      restoreCloud: false,
    }, {
      importCore,
      getNotes: () => [],
      getFolders: () => [],
    })).rejects.toMatchObject({ code: 'RECOVERY_MODE_BLOCKED' });
    expect(importCore).not.toHaveBeenCalled();
    expect(store.has(SNAPSHOT_INDEX_KEY)).toBe(false);
  });

  it('K-319A blocks direct extension restore without changing storage', () => {
    const manifest = buildVaultBackupManifest([note('n1')], []);
    const before = JSON.stringify([...store.entries()]);
    setRecoveryModeActiveForTest(true);

    const result = applyVaultExtensionsRestore(manifest.extensions!);

    expect(result).toMatchObject({ applied: false, blocked: true });
    expect(JSON.stringify([...store.entries()])).toBe(before);
  });

  it('K-319A blocks direct cloud restore without sending a request', async () => {
    setRecoveryModeActiveForTest(true);
    const cloud = {
      schemaVersion: 1 as const,
      fetchedAt: '2026-06-01T00:00:00Z',
      completeness: 'full' as const,
      errors: [] as string[],
      planner: { schedules: [], todos: [], routines: [], routineLogs: [], weeklySchedules: [], recipes: [], ddays: [], routineExceptions: [] },
      health: { exerciseBlocks: [], workoutLogs: [], inbodyLogs: [], healthRoutines: [], proteinSources: [], proteinProfile: null },
    };

    await expect(applyCloudRestore(cloud)).resolves.toMatchObject({ applied: false, blocked: true });
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('K-319A does not report stale cloud restore completion as success', async () => {
    let resolve!: (value: Response) => void;
    authFetchMock.mockReturnValueOnce(new Promise<Response>(res => { resolve = res; }));
    const cloud = {
      schemaVersion: 1 as const,
      fetchedAt: '2026-06-01T00:00:00Z',
      completeness: 'full' as const,
      errors: [] as string[],
      planner: { schedules: [], todos: [], routines: [], routineLogs: [], weeklySchedules: [], recipes: [], ddays: [], routineExceptions: [] },
      health: { exerciseBlocks: [], workoutLogs: [], inbodyLogs: [], healthRoutines: [], proteinSources: [], proteinProfile: null },
    };

    const restore = applyCloudRestore(cloud);
    await vi.waitFor(() => expect(authFetchMock).toHaveBeenCalledTimes(1));
    activateRecoveryMode();
    resolve({ ok: true, status: 200 } as Response);

    await expect(restore).resolves.toMatchObject({ applied: false, blocked: true });
  });

  it('scenario A: empty vault imports v3 export with full recovery', async () => {
    const manifest = buildVaultBackupManifestV3(
      [note('n1', 'Alpha')],
      [{ id: 'f1', name: 'Work', createdAt: 1 }],
      null,
    );
    const preview = buildFullVaultRestorePreview(manifest, [], [], 'export');
    expect(preview.core.valid).toBe(true);
    expect(preview.impact.noteCount).toBe(1);
    expect(preview.exportValidation.valid).toBe(true);

    const sim = simulateVaultRestore(manifest, [], []);
    expect(sim.notes).toHaveLength(1);
    expect(sim.extensionSections).toContain('settings');

    const result = await executeVaultRestorePipeline(
      manifest,
      {
        strategy: 'replace',
        selection: { noteIds: new Set(['n1']), folderIds: new Set(['f1']) },
        restoreCore: true,
        restoreExtensions: true,
        restoreCloud: false,
        backupBeforeRestore: false,
      },
      {
        importCore: (m, s) => applyVaultRestore(m, [], [], s).result,
        getNotes: () => [],
        getFolders: () => [],
      },
    );
    expect(result.core?.importedNotes).toBe(1);
    expect(result.extensions?.sections).toContain('savedViews');
  });

  it('scenario B: snapshot restores to equivalent state', () => {
    const snapshot = buildVaultSnapshot(
      [note('n1', 'Snap')],
      [{ id: 'f1', name: 'F', createdAt: 1 }],
      'last',
      'last',
    );
    const storage = makeStorage();
    saveVaultSnapshot(snapshot, storage);

    const manifest = manifestFromSnapshot(snapshot);
    expect(manifest.schemaVersion).toBe(3);
    expect(manifest.extensions).toBeTruthy();

    const preview = buildFullVaultRestorePreview(manifest, [], [], 'snapshot');
    expect(preview.core.valid).toBe(true);
    expect(preview.impact.source).toBe('snapshot');

    const ready = toRestoreReadyManifest(snapshot);
    const sim = simulateVaultRestore(ready, [], []);
    expect(sim.notes.find(n => n.id === 'n1')?.title).toBe('Snap');
  });

  it('scenario C: v2 export upgrades and restores', () => {
    const v2 = normalizeVaultBackupManifest(JSON.parse(v2ManifestJson()))!;
    const v3 = upgradeVaultBackupToV3(v2);
    expect(v3.schemaVersion).toBe(3);

    const preview = buildFullVaultRestorePreview(v3, [], [], 'export');
    expect(preview.core.valid).toBe(true);
    expect(preview.impact.schemaVersion).toBe(3);

    const parsed = parseVaultBackupJson(v2ManifestJson());
    expect(parsed?.schemaVersion).toBe(VAULT_BACKUP_SCHEMA_VERSION_V2);
    const upgraded = upgradeVaultBackupToV3(parsed!);
    const { notes } = applyVaultRestore(upgraded, [], [], 'replace');
    expect(notes[0]?.title).toBe('Legacy');
  });

  it('builds impact summary for extensions and cloud', () => {
    const cloud = {
      schemaVersion: 1 as const,
      fetchedAt: '2026-06-01T00:00:00Z',
      completeness: 'partial' as const,
      errors: [],
      planner: { schedules: [{ id: 's1' }], todos: [], routines: [], routineLogs: [], weeklySchedules: [], recipes: [{ id: 'r1' }], ddays: [], routineExceptions: [] },
      health: { exerciseBlocks: [], workoutLogs: [{ id: 'w1' }], inbodyLogs: [], healthRoutines: [], proteinSources: [], proteinProfile: null },
    };
    const manifest = buildVaultBackupManifestV3([note('n1')], [{ id: 'f1', name: 'F', createdAt: 1 }], cloud);
    const impact = buildVaultRestoreImpact(manifest, 'export');
    expect(impact.savedViewCount).toBeGreaterThanOrEqual(0);
    expect(impact.cloudScheduleCount).toBe(1);
    expect(impact.cloudWorkoutCount).toBe(1);
    expect(impact.cloudRecipeCount).toBe(1);
  });

  it('records and reads last export timestamp', () => {
    recordLastVaultExport('2026-06-14T12:00:00.000Z');
    expect(getLastVaultExportAt()).toBe('2026-06-14T12:00:00.000Z');
    expect(store.get(LAST_VAULT_EXPORT_KEY)).toBeTruthy();
  });

  it('assesses recovery protection status', () => {
    const recent = new Date().toISOString();
    expect(assessRecoveryProtectionStatus(recent, recent, true)).toBe('protected');
    expect(assessRecoveryProtectionStatus(recent, null, false)).toBe('partial');
    expect(assessRecoveryProtectionStatus(null, null, false)).toBe('none');
  });

  it('applyVaultExtensionsRestore writes settings and views', () => {
    const manifest = buildVaultBackupManifest([note('n1')], []);
    const result = applyVaultExtensionsRestore(manifest.extensions!);
    expect(result.applied).toBe(true);
    expect(result.sections).toContain('settings');
  });

  it('applyCloudRestore posts to restore API', async () => {
    const cloud = {
      schemaVersion: 1 as const,
      fetchedAt: '2026-06-01T00:00:00Z',
      completeness: 'full' as const,
      errors: [] as string[],
      planner: { schedules: [], todos: [], routines: [], routineLogs: [], weeklySchedules: [], recipes: [], ddays: [], routineExceptions: [] },
      health: { exerciseBlocks: [], workoutLogs: [], inbodyLogs: [], healthRoutines: [], proteinSources: [], proteinProfile: null },
    };
    const result = await applyCloudRestore(cloud);
    expect(result.applied).toBe(true);
    expect(authFetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/restore'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Absinthe-Recovery-Intent': 'restore-confirmed',
        }),
      }),
    );
  });

  it('carries weekly schedules from a parsed v3 package into the restore payload', async () => {
    const weekly = {
      id: 'weekly-1',
      user_id: 'backup-user',
      day: 2,
      title: 'Weekly study',
      start_time: '09:00',
      end_time: '10:00',
      color: 'blue',
    };
    const cloud = {
      schemaVersion: 1 as const,
      fetchedAt: '2026-06-01T00:00:00Z',
      completeness: 'full' as const,
      errors: [] as string[],
      planner: { schedules: [], todos: [], routines: [], routineLogs: [], weeklySchedules: [weekly], recipes: [], ddays: [], routineExceptions: [] },
      health: { exerciseBlocks: [], workoutLogs: [], inbodyLogs: [], healthRoutines: [], proteinSources: [], proteinProfile: null },
    };
    const packageManifest = buildVaultBackupManifestV3([note('n1')], [], cloud);
    const parsed = parseVaultBackupJson(JSON.stringify(packageManifest));

    expect(parsed?.cloud?.planner.weeklySchedules).toEqual([weekly]);
    await applyCloudRestore(parsed?.cloud);

    const [, request] = authFetchMock.mock.calls.at(-1)!;
    expect(JSON.parse(String(request?.body))).toMatchObject({ weekly_schedules: [weekly] });
  });

  it('keeps a v3 package without weekly schedules non-destructive', async () => {
    const cloud = {
      schemaVersion: 1 as const,
      fetchedAt: '2026-06-01T00:00:00Z',
      completeness: 'full' as const,
      errors: [] as string[],
      planner: { schedules: [], todos: [], routines: [], routineLogs: [], weeklySchedules: [], recipes: [], ddays: [], routineExceptions: [] },
      health: { exerciseBlocks: [], workoutLogs: [], inbodyLogs: [], healthRoutines: [], proteinSources: [], proteinProfile: null },
    };
    const packageManifest = buildVaultBackupManifestV3([note('n1')], [], cloud);
    const legacyManifest = JSON.parse(JSON.stringify(packageManifest)) as Record<string, unknown>;
    const legacyCloud = legacyManifest.cloud as Record<string, unknown>;
    const legacyPlanner = legacyCloud.planner as Record<string, unknown>;
    delete legacyPlanner.weeklySchedules;
    const parsed = parseVaultBackupJson(JSON.stringify(legacyManifest));

    expect(parsed?.cloud?.planner.weeklySchedules).toBeUndefined();
    await applyCloudRestore(parsed?.cloud);

    const [, request] = authFetchMock.mock.calls.at(-1)!;
    expect(JSON.parse(String(request?.body))).toMatchObject({ weekly_schedules: [] });
  });

  it('applyCloudRestore skips when cloud block missing', async () => {
    const result = await applyCloudRestore(null);
    expect(result.applied).toBe(false);
    expect(result.errors).toContain('cloud_skipped');
  });

  it('detects fingerprint mismatch in export validation', () => {
    const manifest = buildVaultBackupManifest([note('n1')], []);
    manifest.contentFingerprint = 'bad-fingerprint';
    const preview = buildFullVaultRestorePreview(manifest, [], [], 'export');
    expect(preview.exportValidation.fingerprintMatch).toBe(false);
    expect(preview.exportValidation.warnings).toContain('fingerprint_mismatch');
  });
});
