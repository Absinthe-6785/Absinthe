import { HEALTH_RECOVERY_DATASETS, validateHealthRecoveryDatasets, validateHealthWorkoutRecord, type HealthRecoveryDatasets, type HealthRecoveryRecord } from './healthRecoveryExport';
import { stableRecoveryJson } from './recoveryExportPackage';

/** Lossless supported wire content. Unknown fields are never silently discarded. */
export function supportedWorkoutContent(row: HealthRecoveryRecord, accountId: string): string | null {
  const fields = ['id', 'user_id', 'date', 'block_id', 'sets', 'sort_order'];
  if (Object.keys(row).some(key => !fields.includes(key))) return null;
  if (validateHealthWorkoutRecord(row, accountId).length) return null;
  const setFields = ['type', 'set', 'done', 'kg', 'reps', 'is_dropset', 'assisted_reps', 'weight_source_value', 'weight_source_unit', 'time', 'distance', 'pace'];
  if ((row.sets as HealthRecoveryRecord[]).some(set => Object.keys(set).some(key => !setFields.includes(key))
    || Object.values(set).some(value => value !== null && !['string', 'number', 'boolean'].includes(typeof value)
      || typeof value === 'number' && !Number.isFinite(value))
    || 'is_dropset' in set && typeof set.is_dropset !== 'boolean')) return null;
  return stableRecoveryJson(row);
}

export function supportedExerciseBlockContent(row: HealthRecoveryRecord | null, accountId: string): string | null {
  if (!row || Object.keys(row).some(key => !['id', 'user_id', 'name', 'type', 'tags', 'cardio_mode'].includes(key))
    || !['strength', 'bodyweight', 'cardio'].includes(String(row.type))) return null;
  const datasets = Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(key => [key, key === 'exercise_blocks' ? [row] : []])) as HealthRecoveryDatasets;
  return validateHealthRecoveryDatasets(datasets, accountId).length ? null : stableRecoveryJson(row);
}
