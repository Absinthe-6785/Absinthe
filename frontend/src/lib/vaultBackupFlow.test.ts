import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NoteBase } from '@/components/views/noteUtils';
import type { VaultBackupCloudBlock } from './vaultCloudExport';
import {
  downloadPendingReducedVaultBackup,
  runVaultBackupAttempt,
  type VaultBackupAttemptInput,
  type VaultBackupFlowDeps,
} from './vaultBackupFlow';
import { assertExportReady } from './vaultExportValidate';

function note(): NoteBase {
  return {
    id: 'n1', title: 'Note', body: 'Body', folderId: null, starred: false,
    deletedAt: null, createdAt: 1, updatedAt: 1, properties: {}, relations: {},
  };
}

function cloud(
  completeness: VaultBackupCloudBlock['completeness'],
  errors: string[] = [],
  recipes: unknown[] = [],
): VaultBackupCloudBlock {
  return {
    schemaVersion: 1,
    fetchedAt: '2026-09-02T00:00:00.000Z',
    completeness,
    errors,
    planner: {
      schedules: [], todos: [], routines: [], routineLogs: [], weeklySchedules: [],
      recipes, ddays: [], routineExceptions: [],
    },
    health: {
      exerciseBlocks: [], workoutLogs: [], inbodyLogs: [], healthRoutines: [],
      proteinSources: [], proteinProfile: null,
    },
  };
}

function input(cloudExpected = true): VaultBackupAttemptInput {
  return { notes: [note()], folders: [], cloudExpected, accountId: cloudExpected ? 'account-a' : null };
}

describe('vault backup production flow', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      get length() { return store.size; },
      key: (index: number) => [...store.keys()][index] ?? null,
    });
  });

  it('downloads a complete backup before recording success and preserves Recipe rows', async () => {
    const events: string[] = [];
    const deps: VaultBackupFlowDeps = {
      fetchCloud: vi.fn(async () => cloud('full', [], [{ id: 'recipe-1' }])),
      download: vi.fn(async () => { events.push('download'); }),
      recordSuccess: vi.fn(() => { events.push('record'); }),
    };

    const result = await runVaultBackupAttempt(input(), deps);

    expect(result.kind).toBe('downloaded');
    if (result.kind !== 'downloaded') return;
    expect(result.coverage).toBe('complete');
    expect(result.manifest.cloud?.planner.recipes).toEqual([{ id: 'recipe-1' }]);
    expect(events).toEqual(['download', 'record']);
  });

  it('keeps an authenticated partial result pending without download or success record', async () => {
    const deps: VaultBackupFlowDeps = {
      fetchCloud: vi.fn(async () => cloud('partial', ['/api/backup:503'])),
      download: vi.fn(),
      recordSuccess: vi.fn(),
    };

    const result = await runVaultBackupAttempt(input(), deps);

    expect(result.kind).toBe('pending');
    expect(result.kind === 'pending' && result.pending).toMatchObject({
      coverage: 'cloud-partial', accountId: 'account-a', recipeUnavailable: true,
    });
    expect(deps.download).not.toHaveBeenCalled();
    expect(deps.recordSuccess).not.toHaveBeenCalled();
  });

  it('retries with a fresh cloud fetch and produces complete coverage after recovery', async () => {
    const fetchCloud = vi.fn()
      .mockResolvedValueOnce(cloud('partial', ['/api/backup:503']))
      .mockResolvedValueOnce(cloud('full', [], [{ id: 'recipe-1' }]));
    const deps: VaultBackupFlowDeps = {
      fetchCloud,
      download: vi.fn(async () => undefined),
      recordSuccess: vi.fn(),
    };

    const first = await runVaultBackupAttempt(input(), deps);
    const second = await runVaultBackupAttempt(input(), deps);

    expect(first.kind).toBe('pending');
    expect(second.kind).toBe('downloaded');
    expect(second.kind === 'downloaded' && second.coverage).toBe('complete');
    expect(fetchCloud).toHaveBeenCalledTimes(2);
    expect(deps.download).toHaveBeenCalledTimes(1);
  });

  it('downloads a valid pending artifact only after explicit limited action', async () => {
    const attemptDeps: VaultBackupFlowDeps = {
      fetchCloud: vi.fn(async () => cloud('partial', ['/api/backup:503'])),
      download: vi.fn(),
      recordSuccess: vi.fn(),
    };
    const attempt = await runVaultBackupAttempt(input(), attemptDeps);
    expect(attempt.kind).toBe('pending');
    if (attempt.kind !== 'pending') return;

    const download = vi.fn(async () => undefined);
    const recordSuccess = vi.fn();
    await expect(downloadPendingReducedVaultBackup(
      attempt.pending, 'account-a', true, { download, recordSuccess },
    )).resolves.toBe('downloaded');

    expect(assertExportReady(attempt.pending.manifest).valid).toBe(true);
    expect(attempt.pending.manifest.schemaVersion).toBe(3);
    expect(download).toHaveBeenCalledWith(attempt.pending.manifest);
    expect(recordSuccess).toHaveBeenCalledWith(
      attempt.pending.manifest.exportedAt,
      'cloud-partial',
    );
  });

  it.each([
    ['account switch', 'account-b', true],
    ['logout', null, false],
    ['session unavailable', 'account-a', false],
  ] as const)('blocks stale pending download after %s', async (_label, accountId, cloudExpected) => {
    const deps: VaultBackupFlowDeps = {
      fetchCloud: vi.fn(async () => cloud('skipped', ['/api/backup:401'])),
      download: vi.fn(),
      recordSuccess: vi.fn(),
    };
    const attempt = await runVaultBackupAttempt(input(), deps);
    expect(attempt.kind).toBe('pending');
    if (attempt.kind !== 'pending') return;

    await expect(downloadPendingReducedVaultBackup(
      attempt.pending, accountId, cloudExpected, deps,
    )).resolves.toBe('stale-account');
    expect(deps.download).not.toHaveBeenCalled();
    expect(deps.recordSuccess).not.toHaveBeenCalled();
  });

  it('downloads intentional local-only backup immediately and ignores untrusted cached Recipe input', async () => {
    const deps: VaultBackupFlowDeps = {
      fetchCloud: vi.fn(),
      download: vi.fn(async () => undefined),
      recordSuccess: vi.fn(),
    };
    const localInput = {
      ...input(false),
      cachedRecipes: [{ id: 'must-not-export' }],
    } as VaultBackupAttemptInput & { cachedRecipes: unknown[] };

    const result = await runVaultBackupAttempt(localInput, deps);

    expect(result.kind).toBe('downloaded');
    if (result.kind !== 'downloaded') return;
    expect(result.coverage).toBe('local-only');
    expect(result.manifest.cloud).toBeUndefined();
    expect(JSON.stringify(result.manifest)).not.toContain('must-not-export');
    expect(deps.fetchCloud).not.toHaveBeenCalled();
    expect(deps.recordSuccess).toHaveBeenCalledWith(result.manifest.exportedAt, 'local-only');
  });

  it('does not record success when download fails', async () => {
    const deps: VaultBackupFlowDeps = {
      fetchCloud: vi.fn(async () => cloud('full')),
      download: vi.fn(async () => { throw new Error('download_failed'); }),
      recordSuccess: vi.fn(),
    };

    await expect(runVaultBackupAttempt(input(), deps)).rejects.toThrow('download_failed');
    expect(deps.recordSuccess).not.toHaveBeenCalled();
  });

  it('discards an authenticated result if the account changes while cloud fetch is in flight', async () => {
    const deps: VaultBackupFlowDeps = {
      fetchCloud: vi.fn(async () => cloud('full', [], [{ id: 'account-b-recipe' }])),
      download: vi.fn(),
      recordSuccess: vi.fn(),
      isAccountCurrent: vi.fn(() => false),
    };

    await expect(runVaultBackupAttempt(input(), deps)).rejects.toThrow('backup_account_changed');
    expect(deps.download).not.toHaveBeenCalled();
    expect(deps.recordSuccess).not.toHaveBeenCalled();
  });
});
