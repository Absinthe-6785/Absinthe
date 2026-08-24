import { describe, expect, it } from 'vitest';
import type { HealthRecoveryDatasets } from './healthRecoveryExport';
import {
  deriveGlobalHealthExerciseRecentRanks,
  projectLocalHealthDaily,
  projectLocalHealthStatic,
  projectLocalPreviousWorkoutRows,
  projectLocalHealthWorkoutRange,
} from './healthLocalRuntime';

const OWNER = 'account-health-runtime';
const SQUAT_ID = 'block-squat';
const PRESS_ID = 'block-press';
const HISTORICAL_ID = 'block-renamed-exercise';

function datasets(): HealthRecoveryDatasets {
  return {
    exercise_blocks: [
      { id: SQUAT_ID, user_id: OWNER, name: 'Squat', type: 'strength', tags: [], cardio_mode: null },
      { id: PRESS_ID, user_id: OWNER, name: 'Press (current)', type: 'strength', tags: [], cardio_mode: null },
    ],
    workout_logs: [
      {
        id: 'workout-current-month', user_id: OWNER, date: '2026-08-10', block_id: SQUAT_ID,
        sets: [{ type: 'strength', set: 1, kg: 100, reps: 5, done: true }], sort_order: 0,
      },
      {
        id: 'workout-historical-month', user_id: OWNER, date: '2026-07-10', block_id: PRESS_ID,
        sets: [{ type: 'strength', set: 1, kg: 70, reps: 8, done: true }], sort_order: 0,
      },
      {
        id: 'workout-renamed-exercise', user_id: OWNER, date: '2026-06-10', block_id: HISTORICAL_ID,
        exercise_name: 'Press (old name)',
        sets: [{ type: 'strength', set: 1, kg: 60, reps: 10, done: true }], sort_order: 0,
      },
    ],
    inbody_logs: [],
    health_routines: [],
    routines: [],
    routine_logs: [],
    protein_profiles: [],
    protein_sources: [],
    protein_intake_logs: [],
    workout_memos: [],
  };
}

describe('local Health catalog/date projection boundary', () => {
  it('keeps the account-global catalog identical while daily workout projection changes by date', () => {
    const source = datasets();
    const sourceBefore = structuredClone(source);
    const staticBefore = projectLocalHealthStatic(source);

    const currentDay = projectLocalHealthDaily(source, '2026-08-10');
    const historicalDay = projectLocalHealthDaily(source, '2026-07-10');
    const staticAfter = projectLocalHealthStatic(source);

    expect(currentDay.workouts.map(row => row.id)).toEqual(['workout-current-month']);
    expect(historicalDay.workouts.map(row => row.id)).toEqual(['workout-historical-month']);
    expect(staticBefore.healthBlocks.map(block => [block.id, block.recentRank])).toEqual([
      [SQUAT_ID, 0], [PRESS_ID, 1],
    ]);
    expect(staticAfter).toEqual(staticBefore);
    expect(source).toEqual(sourceBefore);
  });

  it('updates global recency only when account history changes, never from date selection', () => {
    const source = datasets();
    const before = deriveGlobalHealthExerciseRecentRanks(source);
    const selectedHistoricalDate = projectLocalHealthStatic(source);
    const afterDateSelection = projectLocalHealthStatic(source);
    const updated = datasets();
    updated.workout_logs.push({
      id: 'workout-newer-press', user_id: OWNER, date: '2026-08-11', block_id: PRESS_ID,
      sets: [{ type: 'strength', set: 1, kg: 80, reps: 6, done: true }], sort_order: 1,
    });
    const afterHistoryChange = deriveGlobalHealthExerciseRecentRanks(updated);

    expect(selectedHistoricalDate).toEqual(afterDateSelection);
    expect(before.get(SQUAT_ID)).toBe(0);
    expect(before.get(PRESS_ID)).toBe(1);
    expect(afterHistoryChange.get(PRESS_ID)).toBe(0);
    expect(afterHistoryChange.get(SQUAT_ID)).toBe(1);
  });

  it('keeps edited historical logs date-scoped and does not rewrite the catalog', () => {
    const source = datasets();
    const catalog = projectLocalHealthStatic(source).healthBlocks;
    source.workout_logs[1].sets = [{ type: 'strength', set: 1, kg: 75, reps: 6, done: true }];

    const editedHistorical = projectLocalHealthDaily(source, '2026-07-10');

    expect(editedHistorical.workouts[0]).toMatchObject({
      id: 'workout-historical-month', block_id: PRESS_ID,
    });
    expect(editedHistorical.workouts[0]?.sets[0]).toMatchObject({ kg: 75, reps: 6 });
    expect(projectLocalHealthStatic(source).healthBlocks).toEqual(catalog);
  });

  it('renders a missing or renamed historical exercise without dropping its log or mutating current blocks', () => {
    const source = datasets();
    const range = projectLocalHealthWorkoutRange(source, '2026-06-01', '2026-06-30');

    expect(range).toHaveLength(1);
    expect(range[0]).toMatchObject({
      date: '2026-06-10',
      block_id: HISTORICAL_ID,
      exercise_blocks: { name: 'Press (old name)' },
    });
    expect(projectLocalHealthStatic(source).healthBlocks.map(block => block.id)).toEqual([
      SQUAT_ID, PRESS_ID,
    ]);
    expect(projectLocalHealthStatic(source).healthBlocks.some(block => block.id === HISTORICAL_ID)).toBe(false);
  });

  it('keeps repeated month-range projections read-only and preserves every historical row', () => {
    const source = datasets();
    const sourceBefore = structuredClone(source);

    const july = projectLocalHealthWorkoutRange(source, '2026-07-01', '2026-07-31');
    const august = projectLocalHealthWorkoutRange(source, '2026-08-01', '2026-08-31');
    const juneAgain = projectLocalHealthWorkoutRange(source, '2026-06-01', '2026-06-30');

    expect(july.map(row => row.block_id)).toEqual([PRESS_ID]);
    expect(august.map(row => row.block_id)).toEqual([SQUAT_ID]);
    expect(juneAgain.map(row => row.block_id)).toEqual([HISTORICAL_ID]);
    expect(source).toEqual(sourceBefore);
  });

  it('preserves source metadata through local Previous and range projections', () => {
    const source = datasets();
    source.workout_logs[0].sets = [{
      type: 'strength', set: 1, kg: 102.37, reps: 5, done: true,
      weight_source_value: 225.68, weight_source_unit: 'lbs',
    }];
    const previous = projectLocalPreviousWorkoutRows(source, '2026-08-10', '2026-08-10');
    const range = projectLocalHealthWorkoutRange(source, '2026-08-10', '2026-08-10');
    expect(previous[0]?.sets[0]).toMatchObject({ weight_source_value: 225.68, weight_source_unit: 'lbs' });
    expect(range[0]?.sets[0]).toMatchObject({ weight_source_value: 225.68, weight_source_unit: 'lbs' });
  });

  it('projects bounded historical rows through the local repository boundary without rewriting recovery data', () => {
    const source = datasets();
    source.workout_logs.push(
      {
        id: 'previous-squat', user_id: OWNER, date: '2026-08-03', block_id: SQUAT_ID,
        sets: [{ type: 'strength', set: 1, kg: 95, reps: 5, done: true }], sort_order: 1,
      },
      {
        id: 'previous-press', user_id: OWNER, date: '2026-08-03', block_id: PRESS_ID,
        sets: [{ type: 'strength', set: 1, kg: 65, reps: 8, done: true }], sort_order: 0,
      },
    );
    const sourceBefore = structuredClone(source);

    const rows = projectLocalPreviousWorkoutRows(source, '2026-08-03', '2026-08-03');

    expect(rows.map(row => [row.date, row.blockId, row.sortOrder])).toEqual([
      ['2026-08-03', SQUAT_ID, 1],
      ['2026-08-03', PRESS_ID, 0],
    ]);
    expect(rows[0]?.exerciseBlock.name).toBe('Squat');
    rows[0]!.sets[0] = { type: 'strength', set: 1, kg: 1, reps: 1, done: false };
    expect(source).toEqual(sourceBefore);
  });
});
