import {
  defaultPreviousWorkoutDate,
  listPreviousWorkoutSessions,
  resolvePreviousWorkoutSessionByDate,
  type PreviousWorkoutHistoryRow,
  type PreviousWorkoutSession,
} from './previousWorkoutSession';

export type PreviousWorkoutHistoryProjection = Readonly<{
  sessions: readonly PreviousWorkoutSession[];
  automaticDate: string | null;
  effectiveDate: string | null;
  session: PreviousWorkoutSession | null;
}>;

export type PreviousWorkoutHistoryProjectionInput = Readonly<{
  rows: readonly PreviousWorkoutHistoryRow[];
  referenceDate: string;
  selectedDate: string | null;
}>;

/**
 * Derive the complete, date-scoped Previous history model from already fetched
 * rows. Query ownership, SWR lifecycle, and selected-date state remain with
 * HealthView; this boundary only composes the existing pure history helpers.
 */
export function buildPreviousWorkoutHistoryProjection({
  rows,
  referenceDate,
  selectedDate,
}: PreviousWorkoutHistoryProjectionInput): PreviousWorkoutHistoryProjection {
  const sessions = listPreviousWorkoutSessions(rows, referenceDate);
  const automaticDate = defaultPreviousWorkoutDate(sessions, referenceDate);
  const effectiveDate = selectedDate && sessions.some(session => session.date === selectedDate)
    ? selectedDate
    : automaticDate;
  const session = effectiveDate
    ? resolvePreviousWorkoutSessionByDate(rows, effectiveDate, referenceDate)
    : null;

  return { sessions, automaticDate, effectiveDate, session };
}
