import type {
  ExerciseBlock,
  HealthRoutine,
  Inbody,
  ProteinIntakeLog,
  ProteinProfile,
  ProteinSource,
  Routine,
  Workout,
  WorkoutSet,
} from '../types';
import type { RangeWorkoutRow } from '../components/views/features/health/workout/workoutMetrics';
import {
  computeLocalHealthLogicalVersion,
  createLocalHealthDriver,
  HealthRepository,
  type LocalHealthDriver,
} from './healthLocalRepository';
import type { HealthRecoveryDatasets, HealthRecoveryRecord } from './healthRecoveryExport';

let sharedDriverPromise: Promise<LocalHealthDriver> | null = null;

function sharedDriver(): Promise<LocalHealthDriver> {
  sharedDriverPromise ??= createLocalHealthDriver();
  return sharedDriverPromise;
}
export async function createLocalHealthRepository(accountId: string): Promise<HealthRepository> {
  return new HealthRepository(await sharedDriver(), accountId);
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumberValue(value: unknown): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function blocksById(datasets: HealthRecoveryDatasets): Map<string, ExerciseBlock> {
  return new Map(datasets.exercise_blocks.map(row => [String(row.id), {
    id: String(row.id),
    name: stringValue(row.name),
    type: stringValue(row.type),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    cardio_mode: row.cardio_mode === 'time' || row.cardio_mode === 'distance' || row.cardio_mode === 'both'
      ? row.cardio_mode
      : undefined,
  }]));
}

function workoutRow(row: HealthRecoveryRecord, blocks: Map<string, ExerciseBlock>): Workout | null {
  const blockId = stringValue(row.block_id);
  const block = blocks.get(blockId);
  if (!block) return null;
  return {
    id: String(row.id),
    block_id: blockId,
    exercise_blocks: block,
    sets: structuredClone(row.sets as WorkoutSet[]),
    sort_order: Number.isInteger(row.sort_order) ? row.sort_order as number : undefined,
    local_version: computeLocalHealthLogicalVersion([row]),
  };
}

export type LocalHealthDailyProjection = {
  workouts: Workout[];
  inbody: Inbody;
  routines: Routine[];
};

export function projectLocalHealthDaily(
  datasets: HealthRecoveryDatasets,
  date: string,
): LocalHealthDailyProjection {
  const blocks = blocksById(datasets);
  const workouts = datasets.workout_logs
    .filter(row => row.date === date)
    .map(row => workoutRow(row, blocks))
    .filter((row): row is Workout => row !== null)
    .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0));
  const inbodyRow = datasets.inbody_logs.find(row => row.date === date);
  const inbody = inbodyRow
    ? {
        weight: nullableNumberValue(inbodyRow.weight),
        smm: nullableNumberValue(inbodyRow.smm),
        pbf: nullableNumberValue(inbodyRow.pbf),
        local_version: computeLocalHealthLogicalVersion([inbodyRow]),
      }
    : { weight: null, smm: null, pbf: null, local_version: null };
  const logByRoutine = new Map(
    datasets.routine_logs
      .filter(row => row.date === date && typeof row.routine_id === 'string')
      .map(row => [String(row.routine_id), row]),
  );
  const routines = datasets.routines
    .filter(row => row.deleted_at === null && row.is_active === true)
    .map(row => {
      const log = logByRoutine.get(String(row.id));
      return {
        id: String(row.id),
        text: stringValue(row.text),
        done: Boolean(log?.done ?? log?.is_completed ?? false),
        is_active: true,
      };
    });
  return { workouts, inbody, routines };
}

export async function readLocalHealthDaily(accountId: string, date: string): Promise<LocalHealthDailyProjection> {
  const datasets = await (await createLocalHealthRepository(accountId)).readAll();
  return projectLocalHealthDaily(datasets, date);
}

export type LocalHealthStaticProjection = {
  healthBlocks: ExerciseBlock[];
  healthRoutines: HealthRoutine[];
};

export async function readLocalHealthStatic(accountId: string): Promise<LocalHealthStaticProjection> {
  const datasets = await (await createLocalHealthRepository(accountId)).readAll();
  return {
    healthBlocks: [...blocksById(datasets).values()],
    healthRoutines: datasets.health_routines.map(row => ({
      id: String(row.id),
      day_name: stringValue(row.day_name),
      blocks: Array.isArray(row.blocks) ? row.blocks.map(String) : [],
    })),
  };
}

export async function readLocalHealthWorkoutRange(
  accountId: string,
  startDate: string,
  endDate: string,
): Promise<RangeWorkoutRow[]> {
  const datasets = await (await createLocalHealthRepository(accountId)).readAll();
  const blocks = blocksById(datasets);
  return datasets.workout_logs
    .filter(row => typeof row.date === 'string' && row.date >= startDate && row.date <= endDate)
    .reduce<RangeWorkoutRow[]>((rows, row) => {
      const blockId = stringValue(row.block_id);
      const block = blocks.get(blockId);
      if (!block) return rows;
      rows.push({
        date: String(row.date),
        block_id: blockId,
        exercise_blocks: { name: block.name },
        sets: structuredClone(row.sets as WorkoutSet[]),
      });
      return rows;
    }, []);
}

export async function readLocalPreviousWorkout(
  accountId: string,
  blockIds: readonly string[],
  beforeDate: string,
): Promise<Record<string, { prev_sets: WorkoutSet[]; prev_date: string | null; pr_kg: number | null }>> {
  const datasets = await (await createLocalHealthRepository(accountId)).readAll();
  const wanted = new Set(blockIds);
  const out: Record<string, { prev_sets: WorkoutSet[]; prev_date: string | null; pr_kg: number | null }> = {};
  for (const blockId of wanted) {
    const rows = datasets.workout_logs
      .filter(row => row.block_id === blockId && typeof row.date === 'string' && row.date < beforeDate)
      .sort((left, right) => String(right.date).localeCompare(String(left.date)));
    const previous = rows[0];
    if (!previous) continue;
    let prKg: number | null = null;
    for (const row of rows) {
      for (const set of Array.isArray(row.sets) ? row.sets : []) {
        if (!set || typeof set !== 'object' || !('kg' in set)) continue;
        const kg = Number((set as { kg?: unknown }).kg);
        if (Number.isFinite(kg)) prKg = Math.max(prKg ?? kg, kg);
      }
    }
    out[blockId] = {
      prev_sets: structuredClone(previous.sets as WorkoutSet[]),
      prev_date: String(previous.date),
      pr_kg: prKg,
    };
  }
  return out;
}

export type LocalHealthProteinProjection = {
  profile: ProteinProfile | null;
  sources: ProteinSource[];
  intakeLogs: ProteinIntakeLog[];
  rangeLogs: Array<{ date: string; protein_g: number }>;
};

export async function readLocalHealthProtein(
  accountId: string,
  date: string,
  rangeStart: string,
  rangeEnd: string,
): Promise<LocalHealthProteinProjection> {
  const datasets = await (await createLocalHealthRepository(accountId)).readAll();
  const sourceById = new Map(datasets.protein_sources.map(row => [String(row.id), row]));
  const profileRow = datasets.protein_profiles[0];
  const profile = profileRow ? {
    daily_target_g: numberValue(profileRow.daily_target_g),
    weight: numberValue(profileRow.weight),
    goal: stringValue(profileRow.goal),
    activity: stringValue(profileRow.activity),
  } : null;
  const sources: ProteinSource[] = datasets.protein_sources.map(row => ({
    id: String(row.id),
    name: stringValue(row.name),
    category: stringValue(row.category),
    source_type: row.source_type === 'per100g' ? 'per100g' : 'fixed',
    protein_per_serving: row.protein_per_serving === null ? null : numberValue(row.protein_per_serving),
    protein_per_100g: row.protein_per_100g === null ? null : numberValue(row.protein_per_100g),
  }));
  const intakeLogs: ProteinIntakeLog[] = datasets.protein_intake_logs
    .filter(row => row.date === date)
    .map(row => {
      const source = typeof row.source_id === 'string' ? sourceById.get(row.source_id) : undefined;
      return {
        id: String(row.id),
        protein_g: numberValue(row.protein_g),
        amount_g: numberValue(row.amount_g),
        note: typeof row.note === 'string' ? row.note : undefined,
        created_at: typeof row.created_at === 'string' ? row.created_at : undefined,
        protein_sources: source ? {
          name: stringValue(source.name),
          source_type: stringValue(source.source_type),
          category: stringValue(source.category),
        } : null,
      };
    });
  const rangeLogs = datasets.protein_intake_logs
    .filter(row => typeof row.date === 'string' && row.date >= rangeStart && row.date <= rangeEnd)
    .map(row => ({ date: String(row.date), protein_g: numberValue(row.protein_g) }));
  return { profile, sources, intakeLogs, rangeLogs };
}

export function resetLocalHealthRuntimeForTests(): void {
  sharedDriverPromise?.then(driver => driver.close()).catch(() => undefined);
  sharedDriverPromise = null;
}
