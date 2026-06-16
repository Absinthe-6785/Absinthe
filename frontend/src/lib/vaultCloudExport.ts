import { authFetch } from './supabase';
import { API_URL } from './config';
import { VAULT_CLOUD_SCHEMA_VERSION } from './vaultBackupConstants';

export type VaultCloudCompleteness = 'full' | 'partial' | 'skipped';

export interface VaultBackupCloudPlanner {
  schedules: unknown[];
  todos: unknown[];
  routines: unknown[];
  routineLogs: unknown[];
  weeklySchedules: unknown[];
  recipes: unknown[];
  ddays: unknown[];
  routineExceptions: unknown[];
}

export interface VaultBackupCloudHealth {
  exerciseBlocks: unknown[];
  workoutLogs: unknown[];
  inbodyLogs: unknown[];
  healthRoutines: unknown[];
  proteinSources: unknown[];
  proteinProfile: unknown | null;
}

export interface VaultBackupCloudBlock {
  schemaVersion: typeof VAULT_CLOUD_SCHEMA_VERSION;
  fetchedAt: string;
  completeness: VaultCloudCompleteness;
  errors: string[];
  planner: VaultBackupCloudPlanner;
  health: VaultBackupCloudHealth;
}

interface ApiBackupPayload {
  schedules?: unknown[];
  todos?: unknown[];
  routines?: unknown[];
  routine_logs?: unknown[];
  exercise_blocks?: unknown[];
  workout_logs?: unknown[];
  inbody_logs?: unknown[];
  ddays?: unknown[];
  recipes?: unknown[];
  routine_exceptions?: unknown[];
}

async function fetchJsonSafe<T>(path: string): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await authFetch(`${API_URL}${path}`);
    if (!res.ok) return { data: null, error: `${path}:${res.status}` };
    return { data: (await res.json()) as T, error: null };
  } catch (err) {
    return { data: null, error: `${path}:${err instanceof Error ? err.message : 'fetch_failed'}` };
  }
}

function emptyCloudBlock(completeness: VaultCloudCompleteness, errors: string[]): VaultBackupCloudBlock {
  return {
    schemaVersion: VAULT_CLOUD_SCHEMA_VERSION,
    fetchedAt: new Date().toISOString(),
    completeness,
    errors,
    planner: {
      schedules: [],
      todos: [],
      routines: [],
      routineLogs: [],
      weeklySchedules: [],
      recipes: [],
      ddays: [],
      routineExceptions: [],
    },
    health: {
      exerciseBlocks: [],
      workoutLogs: [],
      inbodyLogs: [],
      healthRoutines: [],
      proteinSources: [],
      proteinProfile: null,
    },
  };
}

/** Fetch optional cloud block for v3 export. Never throws — returns skipped/partial on failure. */
export async function fetchVaultCloudBlock(): Promise<VaultBackupCloudBlock> {
  const errors: string[] = [];

  const backupResult = await fetchJsonSafe<ApiBackupPayload>('/api/backup');
  if (!backupResult.data) {
    const skipped = backupResult.error?.includes('401') ?? false;
    return emptyCloudBlock(skipped ? 'skipped' : 'partial', [
      backupResult.error ?? 'backup_fetch_failed',
    ]);
  }

  const backup = backupResult.data;
  const block = emptyCloudBlock('full', []);

  block.planner.schedules = backup.schedules ?? [];
  block.planner.todos = backup.todos ?? [];
  block.planner.routines = backup.routines ?? [];
  block.planner.routineLogs = backup.routine_logs ?? [];
  block.planner.recipes = backup.recipes ?? [];
  block.planner.ddays = backup.ddays ?? [];
  block.planner.routineExceptions = backup.routine_exceptions ?? [];
  block.health.exerciseBlocks = backup.exercise_blocks ?? [];
  block.health.workoutLogs = backup.workout_logs ?? [];
  block.health.inbodyLogs = backup.inbody_logs ?? [];

  const extras = await Promise.all([
    fetchJsonSafe<unknown[]>('/api/weekly_schedules'),
    fetchJsonSafe<unknown[]>('/api/health_routines'),
    fetchJsonSafe<unknown[]>('/api/protein_sources'),
    fetchJsonSafe<unknown>('/api/protein_profile'),
  ]);

  const [weekly, healthRoutines, proteinSources, proteinProfile] = extras;
  if (weekly.data) block.planner.weeklySchedules = weekly.data;
  else if (weekly.error) errors.push(weekly.error);

  if (healthRoutines.data) block.health.healthRoutines = healthRoutines.data;
  else if (healthRoutines.error) errors.push(healthRoutines.error);

  if (proteinSources.data) block.health.proteinSources = proteinSources.data;
  else if (proteinSources.error) errors.push(proteinSources.error);

  if (proteinProfile.data != null) block.health.proteinProfile = proteinProfile.data;
  else if (proteinProfile.error) errors.push(proteinProfile.error);

  if (errors.length > 0) {
    block.completeness = 'partial';
    block.errors = errors;
  }

  return block;
}
