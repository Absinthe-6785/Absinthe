import { supabase } from './supabase';
import { createLocalHealthDriver, type HealthWorkoutAdoptionCapture } from './healthLocalRepository';
import { validateHealthWorkoutRecord, type HealthRecoveryRecord } from './healthRecoveryExport';
import { stableRecoveryJson } from './recoveryExportPackage';

// One remote statement only: never assemble a supposedly complete snapshot from changing pages.
export const WORKOUT_COMPARISON_LIMIT = 500;
const MAX_SNAPSHOT_BYTES = 4 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const WORKOUT_COMPARISON_CATEGORIES = ['localOnly', 'remoteOnly', 'matching', 'divergent', 'unverifiable'] as const;
export type WorkoutComparisonCategory = typeof WORKOUT_COMPARISON_CATEGORIES[number];
export type WorkoutComparisonDetail = Readonly<{ id: string; localDate?: string; remoteDate?: string }>;
export type WorkoutComparisonReport = Readonly<{
  counts: Readonly<Record<WorkoutComparisonCategory, number>>;
  details: Readonly<Record<WorkoutComparisonCategory, readonly WorkoutComparisonDetail[]>>;
}>;

function indexRows(accountId: string, rows: readonly HealthRecoveryRecord[]) {
  if (rows.length > WORKOUT_COMPARISON_LIMIT) throw new Error('workout_comparison_limit');
  const result = new Map<string, HealthRecoveryRecord>();
  for (const row of rows) {
    if (!row || row.user_id !== accountId || typeof row.id !== 'string' || !UUID.test(row.id)
      || result.has(row.id)) throw new Error('workout_comparison_identity');
    result.set(row.id, row);
  }
  if (new TextEncoder().encode(JSON.stringify(rows)).byteLength > MAX_SNAPSHOT_BYTES) throw new Error('workout_comparison_limit');
  return result;
}

export function supportedWorkoutContent(row: HealthRecoveryRecord, accountId: string): string | null {
  const fields = ['id', 'user_id', 'date', 'block_id', 'sets', 'sort_order'];
  // Unknown metadata is not silently dropped or declared equivalent.
  if (Object.keys(row).some(key => !fields.includes(key))) return null;
  if (validateHealthWorkoutRecord(row, accountId).length) return null;
  const setFields = ['type', 'set', 'done', 'kg', 'reps', 'is_dropset', 'assisted_reps', 'weight_source_value', 'weight_source_unit', 'time', 'distance', 'pace'];
  if ((row.sets as HealthRecoveryRecord[]).some(set => Object.keys(set).some(key => !setFields.includes(key))
    || Object.values(set).some(value => value !== null && !['string', 'number', 'boolean'].includes(typeof value)
      || typeof value === 'number' && !Number.isFinite(value))
    || 'is_dropset' in set && typeof set.is_dropset !== 'boolean')) return null;
  return stableRecoveryJson(row);
}

/** Exact IDs and lossless supported content only; absence is never a deletion verdict. */
export function compareWorkoutSnapshots(accountId: string, localRows: readonly HealthRecoveryRecord[], remoteRows: readonly HealthRecoveryRecord[]): WorkoutComparisonReport {
  const local = indexRows(accountId, localRows), remote = indexRows(accountId, remoteRows);
  const details: Record<WorkoutComparisonCategory, WorkoutComparisonDetail[]> = {
    localOnly: [], remoteOnly: [], matching: [], divergent: [], unverifiable: [],
  };
  for (const id of [...new Set([...local.keys(), ...remote.keys()])].sort()) {
    const left = local.get(id), right = remote.get(id);
    const a = left ? supportedWorkoutContent(left, accountId) : null, b = right ? supportedWorkoutContent(right, accountId) : null;
    const category: WorkoutComparisonCategory = (left && a === null) || (right && b === null) ? 'unverifiable'
      : !left ? 'remoteOnly' : !right ? 'localOnly' : a === b ? 'matching' : 'divergent';
    details[category].push(Object.freeze({ id,
      ...(left && typeof left.date === 'string' ? { localDate: left.date } : {}),
      ...(right && typeof right.date === 'string' ? { remoteDate: right.date } : {}),
    }));
  }
  return Object.freeze({ counts: Object.freeze(Object.fromEntries(WORKOUT_COMPARISON_CATEGORIES.map(key => [key, details[key].length])) as Record<WorkoutComparisonCategory, number>),
    details: Object.freeze(Object.fromEntries(WORKOUT_COMPARISON_CATEGORIES.map(key => [key, Object.freeze(details[key])])) as Record<WorkoutComparisonCategory, readonly WorkoutComparisonDetail[]>) });
}

export function workoutRowsFromCapture(accountId: string, capture: HealthWorkoutAdoptionCapture): HealthRecoveryRecord[] {
  if (capture.accountId !== accountId || capture.importState.accountId !== accountId
    || capture.importState.status !== 'VERIFIED_IMPORT_COMPLETE'
    || capture.importState.datasetCounts.workout_logs !== capture.workouts.length
    || capture.workouts.some(item => item.accountId !== accountId || item.record.user_id !== accountId
      || item.storageKey !== `${accountId}:workout_logs:${item.record.id}`)) throw new Error('workout_comparison_local_unavailable');
  const rows = capture.workouts.map(item => structuredClone(item.record));
  indexRows(accountId, rows);
  return rows;
}

async function readLocalRows(accountId: string, assertCurrent: () => void) {
  const driver = await createLocalHealthDriver({ existingOnly: true });
  try {
    assertCurrent();
    const capture = await driver.captureWorkoutAdoptionSource(accountId);
    assertCurrent();
    return workoutRowsFromCapture(accountId, capture);
  }
  finally { driver.close(); }
}

/** Owns only a manual observation, never a Health bootstrap or write permit. */
export function createWorkoutCloudComparison(accountId: string, accountCurrent: () => boolean, onInvalidated: () => void) {
  let live = true, started = false;
  let localOnlyRecords = new Map<string, HealthRecoveryRecord>();
  const cancel = () => { live = false; subscription.unsubscribe(); };
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (!live) return;
    if (event === 'INITIAL_SESSION' && session?.user.id === accountId) return;
    live = false;
    onInvalidated();
  });
  const isCurrent = () => live && accountCurrent();
  const assertCurrent = () => { if (!isCurrent()) throw new Error('workout_comparison_stale'); };
  const compare = async () => {
    if (started) throw new Error('workout_comparison_started');
    started = true; assertCurrent();
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('workout_comparison_offline');
    const first = await supabase.auth.getSession();
    assertCurrent();
    const session = first.data.session;
    if (first.error || !session?.access_token || session.user.id !== accountId
      || !session.expires_at || session.expires_at * 1000 <= Date.now()) throw new Error('workout_comparison_auth');
    const local = await readLocalRows(accountId, assertCurrent);
    assertCurrent();
    const response = await supabase.from('workout_logs').select('*', { count: 'exact' })
      .eq('user_id', accountId).order('id').limit(WORKOUT_COMPARISON_LIMIT);
    assertCurrent();
    if (response.error || !Array.isArray(response.data) || !Number.isSafeInteger(response.count)
      || response.count! < 0 || response.count! > WORKOUT_COMPARISON_LIMIT
      || response.data.length !== response.count) throw new Error('workout_comparison_incomplete');
    const last = await supabase.auth.getSession();
    assertCurrent();
    if (last.error || last.data.session?.user.id !== accountId || last.data.session.access_token !== session.access_token
      || !last.data.session.expires_at || last.data.session.expires_at * 1000 <= Date.now()) throw new Error('workout_comparison_auth');
    const report = compareWorkoutSnapshots(accountId, local, response.data);
    localOnlyRecords = new Map(report.details.localOnly.map(({ id }) => [id, local.find(row => row.id === id)!]));
    return report;
  };
  const localOnlyRecord = (id: string) => {
    assertCurrent();
    const row = localOnlyRecords.get(id);
    return row ? structuredClone(row) : null;
  };
  return { compare, cancel, isCurrent, localOnlyRecord };
}
export type WorkoutCloudComparison = ReturnType<typeof createWorkoutCloudComparison>;
