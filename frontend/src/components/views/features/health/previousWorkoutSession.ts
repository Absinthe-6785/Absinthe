import type { ExerciseBlock, WorkoutSet } from '../../../../types';

export const PREVIOUS_WORKOUT_LOOKBACK_YEARS = 1;

export type PreviousWorkoutHistoryRow = Readonly<{
  date: string;
  blockId: string;
  exerciseBlock: ExerciseBlock;
  sets: WorkoutSet[];
  sortOrder: number;
  rowId?: string;
}>;

export type PreviousWorkoutSession = Readonly<{
  date: string;
  rows: readonly PreviousWorkoutHistoryRow[];
  matchStrategy: 'weekday';
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function dateFromKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function dateKey(value: Date): string {
  return [value.getFullYear(), value.getMonth() + 1, value.getDate()]
    .map((part, index) => index === 0 ? String(part).padStart(4, '0') : String(part).padStart(2, '0'))
    .join('-');
}

export function dateKeyDaysBefore(referenceDate: string, days: number): string {
  if (!validDateKey(referenceDate)) throw new Error('invalid_previous_workout_reference_date');
  const date = dateFromKey(referenceDate);
  date.setDate(date.getDate() - Math.max(0, Math.floor(days)));
  return dateKey(date);
}

function dateKeyYearsBefore(referenceDate: string, years: number): string {
  if (!validDateKey(referenceDate)) throw new Error('invalid_previous_workout_reference_date');
  const date = dateFromKey(referenceDate);
  const month = date.getMonth();
  date.setFullYear(date.getFullYear() - Math.max(0, Math.floor(years)));
  if (date.getMonth() !== month) date.setDate(0);
  return dateKey(date);
}

export function previousWorkoutRange(referenceDate: string): { startDate: string; endDate: string } {
  return {
    startDate: dateKeyYearsBefore(referenceDate, PREVIOUS_WORKOUT_LOOKBACK_YEARS),
    endDate: dateKeyDaysBefore(referenceDate, 1),
  };
}

function weekday(value: string): number {
  return dateFromKey(value).getDay();
}

function exerciseBlockFromRemote(row: Record<string, unknown>, blockId: string): ExerciseBlock {
  const nested = isRecord(row.exercise_blocks) ? row.exercise_blocks : undefined;
  const rawType = nested?.type ?? row.exercise_type;
  const rawCardioMode = nested?.cardio_mode;
  return {
    id: blockId,
    name: typeof nested?.name === 'string' && nested.name.trim()
      ? nested.name
      : typeof row.exercise_name === 'string' && row.exercise_name.trim()
        ? row.exercise_name
        : `Historical exercise (${blockId.slice(0, 8)})`,
    type: typeof rawType === 'string' && rawType.trim() ? rawType : 'strength',
    tags: [],
    cardio_mode: rawCardioMode === 'time' || rawCardioMode === 'distance' || rawCardioMode === 'both'
      ? rawCardioMode
      : undefined,
  };
}

/** Normalize the existing /api/workouts/range response without changing its contract. */
export function normalizePreviousWorkoutRows(rows: unknown): PreviousWorkoutHistoryRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((value, index) => {
    if (!isRecord(value) || !validDateKey(value.date) || typeof value.block_id !== 'string' || !value.block_id) return [];
    const sets = Array.isArray(value.sets) ? value.sets as WorkoutSet[] : [];
    return [{
      date: value.date,
      blockId: value.block_id,
      exerciseBlock: exerciseBlockFromRemote(value, value.block_id),
      sets: structuredClone(sets),
      sortOrder: Number.isInteger(value.sort_order) ? value.sort_order as number : Number.MAX_SAFE_INTEGER,
      rowId: typeof value.id === 'string' ? value.id : `remote-${index}`,
    }];
  });
}

/**
 * Resolve one coherent prior session. Historical rows have no session/preset/day
 * identity, so the safe legacy signal is the most recent earlier same weekday.
 */
export function resolvePreviousWorkoutSession(
  rows: readonly PreviousWorkoutHistoryRow[],
  referenceDate: string,
): PreviousWorkoutSession | null {
  if (!validDateKey(referenceDate)) return null;
  const candidates = rows
    .filter(row => validDateKey(row.date) && row.date < referenceDate && weekday(row.date) === weekday(referenceDate) && row.sets.length > 0)
    .sort((left, right) => right.date.localeCompare(left.date));
  const matchedDate = candidates[0]?.date;
  if (!matchedDate) return null;
  const matchedRows = candidates
    .filter(row => row.date === matchedDate)
    .sort((left, right) => left.sortOrder - right.sortOrder || (left.rowId ?? '').localeCompare(right.rowId ?? ''))
    .map(row => ({ ...row, sets: structuredClone(row.sets) }));
  return { date: matchedDate, rows: matchedRows, matchStrategy: 'weekday' };
}
