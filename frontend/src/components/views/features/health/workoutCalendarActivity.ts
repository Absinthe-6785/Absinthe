import type { WorkoutRangeView } from './verifiedWorkoutRangeSnapshot';

export type WorkoutCalendarCellState = 'present' | 'absent' | 'unknown';

export type CompositeWorkoutCalendarActivity = Readonly<{
  mode: 'composite';
  phase: 'loading' | 'settled';
  status: 'loading' | 'complete' | 'partial_data' | 'error' | 'isolation_error';
  legacyStatus: 'success' | 'error' | null;
  canonicalStatus: 'success' | 'error' | null;
  monthStart: string;
  monthEnd: string;
  knownPresentDates: ReadonlySet<string>;
  stateForDate: (date: string) => WorkoutCalendarCellState;
  onRetry: () => void;
}>;

export function buildWorkoutCalendarActivity({
  phase,
  view,
  monthStart,
  monthEnd,
  isolationError = false,
  onRetry,
}: Readonly<{
  phase: 'loading' | 'settled';
  view: WorkoutRangeView | null;
  monthStart: string;
  monthEnd: string;
  isolationError?: boolean;
  onRetry: () => void;
}>): CompositeWorkoutCalendarActivity {
  const knownPresentDates = new Set<string>();
  if (view) {
    for (const bucket of view.dates) {
      if (bucket.legacyRows.length > 0 || bucket.canonicalSessions.length > 0) {
        knownPresentDates.add(bucket.localDate);
      }
    }
  }
  const status: CompositeWorkoutCalendarActivity['status'] = phase === 'loading'
    ? 'loading'
    : isolationError ? 'isolation_error'
      : view?.result.status ?? 'error';
  const complete = status === 'complete';
  return Object.freeze({
    mode: 'composite' as const,
    phase,
    status,
    legacyStatus: view?.result.legacyStatus ?? null,
    canonicalStatus: view?.result.canonicalStatus ?? null,
    monthStart,
    monthEnd,
    knownPresentDates,
    stateForDate: (date: string): WorkoutCalendarCellState => {
      if (date < monthStart || date > monthEnd) return 'unknown';
      if (knownPresentDates.has(date)) return 'present';
      const coveredByDerivedView = !!view && date >= view.startDate && date <= view.endDate;
      return complete && coveredByDerivedView ? 'absent' : 'unknown';
    },
    onRetry,
  });
}
