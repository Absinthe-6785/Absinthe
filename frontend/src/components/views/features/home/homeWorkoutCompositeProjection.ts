import type { HealthSelectedDayReadModel } from '../health/useHealthSelectedDayComposite';
import type { CompositeWorkoutRecord } from '../health/compositeWorkoutReadProjection';
import type { HomeWorkoutCounts, HomeWorkoutDraftRead } from './homeWorkoutDraftRead';

export type HomeWorkoutCompositeProjection = Readonly<{
  mode: 'composite';
  accountId: string;
  localDate: string;
  phase: 'loading' | 'complete' | 'partial_data' | 'error';
  persistedPresence: 'present' | 'absent' | 'unknown';
  draft: HomeWorkoutDraftRead;
  records: readonly CompositeWorkoutRecord[];
  legacy: Readonly<{ rowCount: number; counts: HomeWorkoutCounts | null }> | null;
  canonical: Readonly<{ sessionCount: number; entryCount: number; setCount: number; doneCount: number }> | null;
}>;

/** Pure consumption of the existing validated B1 result, not a new V1 validator/reader. */
export function buildHomeWorkoutCompositeProjection(input: Readonly<{
  accountId: string; localDate: string; read: HealthSelectedDayReadModel; draft: HomeWorkoutDraftRead;
}>): HomeWorkoutCompositeProjection {
  const { accountId, localDate, read } = input;
  const draft: HomeWorkoutDraftRead = input.draft.accountId === accountId && input.draft.localDate === localDate
    ? input.draft : { accountId, localDate, status: 'unavailable' };
  const current = read.accountId === accountId && read.localDate === localDate;
  const result = current && !read.isolationError && read.phase === 'settled' ? read.result : null;
  const records = result?.records ?? [];
  const phase = !current || read.phase === 'loading' ? 'loading' : result?.status ?? 'error';
  let legacy: HomeWorkoutCompositeProjection['legacy'] = null;
  let canonical: HomeWorkoutCompositeProjection['canonical'] = null;
  if (result?.legacyStatus === 'success') {
    const rows = records.filter(row => row.source === 'legacy');
    const counts = { exerciseCount: rows.length, setCount: 0, doneCount: 0 };
    let validCounts = true;
    for (const row of rows) for (const set of row.legacy.sets) {
      if (!set || typeof set.done !== 'boolean') { validCounts = false; continue; }
      counts.setCount += 1;
      if (set.done) counts.doneCount += 1;
    }
    legacy = { rowCount: rows.length, counts: validCounts ? counts : null };
  }
  if (result?.canonicalStatus === 'success') {
    const sessions = records.filter(row => row.source === 'canonical');
    const counts = { sessionCount: sessions.length, entryCount: 0, setCount: 0, doneCount: 0 };
    for (const row of sessions) for (const entry of row.canonical.session.entries) {
      counts.entryCount += 1;
      counts.setCount += entry.sets.length;
      counts.doneCount += entry.sets.filter(set => set.done).length;
    }
    canonical = counts;
  }
  return { mode: 'composite', accountId, localDate, phase, draft, records, legacy, canonical,
    persistedPresence: records.length ? 'present' : phase === 'complete' ? 'absent' : 'unknown' };
}
