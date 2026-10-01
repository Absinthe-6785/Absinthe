import type { CompositeWorkoutRecord } from './compositeWorkoutReadProjection';
import type { WorkoutRangeView } from './verifiedWorkoutRangeSnapshot';
import { defaultPreviousWorkoutDateFromDates } from './previousWorkoutSession';

export type CompositeLegacyPreviousGroup = Readonly<{
  source: 'legacy';
  presentationKey: string;
  rows: readonly Extract<CompositeWorkoutRecord, { source: 'legacy' }>[];
}>;

export type CompositePreviousDateBucket = Readonly<{
  localDate: string;
  legacyGroup: CompositeLegacyPreviousGroup | null;
  canonicalSessions: readonly Extract<CompositeWorkoutRecord, { source: 'canonical' }>[];
}>;

export type CompositePreviousWorkoutProjection = Readonly<{
  phase: 'loading' | 'settled';
  status: 'loading' | 'complete' | 'partial_data' | 'error' | 'isolation_error';
  legacyStatus: 'success' | 'error' | null;
  canonicalStatus: 'success' | 'error' | null;
  dateBuckets: readonly CompositePreviousDateBucket[];
  automaticDate: string | null;
  effectiveDate: string | null;
  selectedBucket: CompositePreviousDateBucket | null;
}>;

export function legacyPreviousPresentationKey(accountId: string, localDate: string): string {
  return JSON.stringify(['presentation-only', 'legacy-date-group', accountId, localDate]);
}

export function buildCompositePreviousWorkoutProjection({
  phase,
  view,
  referenceDate,
  selectedDate,
  isolationError = false,
}: Readonly<{
  phase: 'loading' | 'settled';
  view: WorkoutRangeView | null;
  referenceDate: string;
  selectedDate: string | null;
  isolationError?: boolean;
}>): CompositePreviousWorkoutProjection {
  if (phase === 'loading') {
    return { phase, status: 'loading', legacyStatus: null, canonicalStatus: null,
      dateBuckets: [], automaticDate: null, effectiveDate: selectedDate, selectedBucket: null };
  }
  if (isolationError) {
    return { phase, status: 'isolation_error', legacyStatus: null, canonicalStatus: null,
      dateBuckets: [], automaticDate: null, effectiveDate: null, selectedBucket: null };
  }
  if (!view) {
    return { phase, status: 'error', legacyStatus: 'error', canonicalStatus: 'error',
      dateBuckets: [], automaticDate: null, effectiveDate: null, selectedBucket: null };
  }

  const dateBuckets = view.dates.flatMap(date => {
    if (date.localDate < view.startDate || date.localDate > view.endDate
      || date.localDate >= referenceDate) return [];
    const rows = date.legacyRows.filter(record => record.legacy.sets.length > 0);
    const canonicalSessions = [...date.canonicalSessions];
    if (rows.length === 0 && canonicalSessions.length === 0) return [];
    return [{
      localDate: date.localDate,
      legacyGroup: rows.length > 0 ? {
        source: 'legacy' as const,
        presentationKey: legacyPreviousPresentationKey(view.accountId, date.localDate),
        rows,
      } : null,
      canonicalSessions,
    }];
  }).sort((left, right) => right.localDate.localeCompare(left.localDate));
  const automaticDate = defaultPreviousWorkoutDateFromDates(
    dateBuckets.map(bucket => bucket.localDate), referenceDate,
  );
  const effectiveDate = selectedDate && dateBuckets.some(bucket => bucket.localDate === selectedDate)
    ? selectedDate
    : automaticDate;
  return {
    phase,
    status: view.result.status,
    legacyStatus: view.result.legacyStatus,
    canonicalStatus: view.result.canonicalStatus,
    dateBuckets,
    automaticDate,
    effectiveDate,
    selectedBucket: dateBuckets.find(bucket => bucket.localDate === effectiveDate) ?? null,
  };
}
