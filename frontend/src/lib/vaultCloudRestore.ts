/**
 * K-88C — Restore cloud block via authenticated /api/restore.
 */
import { authFetch } from './supabase';
import { API_URL } from './config';
import type { VaultBackupCloudBlock } from './vaultCloudExport';
import {
  captureOperationEpoch,
  isOperationEpochCurrent,
  mayRestore,
  recordRecoveryBlock,
} from './recoverySafetyPolicy';

export interface VaultCloudRestoreResult {
  applied: boolean;
  completeness: VaultBackupCloudBlock['completeness'];
  errors: string[];
  blocked?: true;
}

function blockedResult(
  completeness: VaultBackupCloudBlock['completeness'],
): VaultCloudRestoreResult {
  recordRecoveryBlock('restore');
  return { applied: false, completeness, errors: ['recovery_mode_active'], blocked: true };
}

export async function applyCloudRestore(
  cloud: VaultBackupCloudBlock | null | undefined,
): Promise<VaultCloudRestoreResult> {
  if (!cloud || cloud.completeness === 'skipped') {
    return { applied: false, completeness: 'skipped', errors: ['cloud_skipped'] };
  }
  if (!mayRestore()) return blockedResult(cloud.completeness);
  const operationEpoch = captureOperationEpoch();

  const payload = {
    notes: [],
    note_folders: [],
    schedules: cloud.planner.schedules ?? [],
    todos: cloud.planner.todos ?? [],
    routines: cloud.planner.routines ?? [],
    routine_logs: cloud.planner.routineLogs ?? [],
    exercise_blocks: cloud.health.exerciseBlocks ?? [],
    workout_logs: cloud.health.workoutLogs ?? [],
    inbody_logs: cloud.health.inbodyLogs ?? [],
    ddays: cloud.planner.ddays ?? [],
    recipes: cloud.planner.recipes ?? [],
    routine_exceptions: cloud.planner.routineExceptions ?? [],
  };

  try {
    const res = await authFetch(`${API_URL}/api/restore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Absinthe-Recovery-Intent': 'restore-confirmed',
      },
      body: JSON.stringify(payload),
    });
    if (!isOperationEpochCurrent(operationEpoch) || !mayRestore()) {
      return blockedResult(cloud.completeness);
    }
    if (!res.ok) {
      return {
        applied: false,
        completeness: cloud.completeness,
        errors: [`restore_api:${res.status}`, ...cloud.errors],
      };
    }
    return { applied: true, completeness: cloud.completeness, errors: cloud.errors };
  } catch (err) {
    return {
      applied: false,
      completeness: cloud.completeness,
      errors: [err instanceof Error ? err.message : 'cloud_restore_failed', ...cloud.errors],
    };
  }
}
