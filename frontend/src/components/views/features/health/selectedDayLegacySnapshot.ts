import type { WorkoutSet } from '../../../../types';
import {
  createLocalHealthRepository, projectLocalHealthDaily,
  type LocalHealthDailyProjection,
} from '../../../../lib/healthLocalRuntime';
import type { HealthRecoveryDatasets } from '../../../../lib/healthRecoveryExport';
import { CompositeWorkoutReadIsolationError, type LegacyWorkoutReadInput } from './compositeWorkoutReadProjection';

export type VerifiedSelectedDayLegacySnapshot = Readonly<{
  daily: LocalHealthDailyProjection;
  persistedRows: readonly LegacyWorkoutReadInput[];
}>;

/** Both representations are derived from one verified IndexedDB snapshot. */
export function projectVerifiedSelectedDayLegacySnapshot(
  datasets: HealthRecoveryDatasets, accountId: string, localDate: string,
): VerifiedSelectedDayLegacySnapshot {
  const selected = datasets.workout_logs.filter(row => row.date === localDate);
  const rowIds = new Set<string>();
  for (const row of selected) {
    if (row.user_id !== accountId) throw new CompositeWorkoutReadIsolationError('ACCOUNT_MISMATCH');
    if (typeof row.id !== 'string' || !row.id.trim() || rowIds.has(row.id)
      || typeof row.block_id !== 'string'
      || !row.block_id.trim() || row.block_id === '__session__'
      || !Number.isSafeInteger(row.sort_order) || (row.sort_order as number) < 0
      || !Array.isArray(row.sets)
      || row.sets.some(set => !set || typeof set !== 'object' || Array.isArray(set))) {
      throw new Error('health_selected_day_legacy_row_invalid');
    }
    rowIds.add(row.id);
  }
  const daily = projectLocalHealthDaily(datasets, localDate);
  const projected = new Map(daily.workouts.map(row => [row.id, row]));
  if (projected.size !== selected.length) throw new Error('health_selected_day_legacy_projection_mismatch');
  const catalogIds = new Set(datasets.exercise_blocks.map(row => row.id));
  const persistedRows: LegacyWorkoutReadInput[] = selected.map(row => {
    const workout = projected.get(row.id as string);
    if (!workout || workout.block_id !== row.block_id) {
      throw new Error('health_selected_day_legacy_projection_mismatch');
    }
    const block = structuredClone(workout.exercise_blocks);
    return {
      accountId,
      rowId: row.id as string,
      localDate,
      blockId: row.block_id as string,
      sortOrder: row.sort_order as number,
      exerciseDisplay: catalogIds.has(row.block_id)
        ? { kind: 'current_catalog' as const, block }
        : { kind: 'historical_fallback' as const, name: block.name },
      sets: structuredClone(row.sets) as WorkoutSet[],
    };
  });
  return { daily, persistedRows };
}

export async function loadVerifiedSelectedDayLegacySnapshot(
  accountId: string, localDate: string,
): Promise<VerifiedSelectedDayLegacySnapshot> {
  const datasets = await (await createLocalHealthRepository(accountId)).readAll();
  return projectVerifiedSelectedDayLegacySnapshot(datasets, accountId, localDate);
}
