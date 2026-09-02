import { describe, expect, it } from 'vitest';

import type { NoteBase } from '@/components/views/noteUtils';
import { buildVaultBackupManifestV3 } from './exportVaultBackup';
import type { VaultBackupCloudBlock } from './vaultCloudExport';
import {
  classifyVaultBackupCoverage,
  protectionForVaultBackupCoverage,
} from './vaultBackupCoverage';

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

describe('vault backup coverage', () => {
  it('classifies full cloud backup as complete and protected', () => {
    const manifest = buildVaultBackupManifestV3([note()], [], cloud('full', [], [{ id: 'recipe-1' }]));
    const impact = classifyVaultBackupCoverage(manifest);
    expect(impact).toMatchObject({ coverage: 'complete', recipeUnavailable: false });
    expect(protectionForVaultBackupCoverage(impact.coverage)).toBe('protected');
    expect(manifest.cloud?.planner.recipes).toEqual([{ id: 'recipe-1' }]);
  });

  it('classifies absent cloud as local-only and limited', () => {
    const impact = classifyVaultBackupCoverage(buildVaultBackupManifestV3([note()], [], null));
    expect(impact).toMatchObject({ coverage: 'local-only', recipeUnavailable: true });
    expect(protectionForVaultBackupCoverage(impact.coverage)).toBe('partial');
  });

  it('classifies skipped cloud as unavailable Recipe coverage', () => {
    expect(classifyVaultBackupCoverage(
      buildVaultBackupManifestV3([note()], [], cloud('skipped', ['/api/backup:401'])),
    )).toMatchObject({ coverage: 'cloud-skipped', recipeUnavailable: true });
  });

  it('does not treat recipes: [] as authoritative when primary backup failed', () => {
    expect(classifyVaultBackupCoverage(
      buildVaultBackupManifestV3([note()], [], cloud('partial', ['/api/backup:503'], [])),
    )).toMatchObject({ coverage: 'cloud-partial', recipeUnavailable: true });
  });

  it('does not claim Recipe omission for an auxiliary-only partial failure', () => {
    expect(classifyVaultBackupCoverage(
      buildVaultBackupManifestV3([note()], [], cloud('partial', ['/api/weekly_schedules:503'], [])),
    )).toMatchObject({ coverage: 'cloud-partial', recipeUnavailable: false });
  });
});
