import type { HealthSelectedDayReadModel } from './useHealthSelectedDayComposite';
import type { CompositeWorkoutRecord } from './compositeWorkoutReadProjection';
import { useTranslation } from '../../../../lib/i18n';

/** A separate, read-only source surface. No canonical record enters Health's draft. */
export function HealthSelectedDayCompositePanel({
  model, draftDirty, onPreviousDay, onNextDay,
}: {
  model: HealthSelectedDayReadModel;
  draftDirty: boolean;
  onPreviousDay: () => void;
  onNextDay: () => void;
}) {
  const { t } = useTranslation();
  const result = model.result;
  const canonical: readonly Extract<CompositeWorkoutRecord, { source: 'canonical' }>[] =
    (result?.records ?? []).filter(record => record.source === 'canonical') as Extract<CompositeWorkoutRecord, { source: 'canonical' }>[];
  const incomplete = result?.status === 'partial_data';
  const failed = model.phase === 'settled' && (!result || result.status === 'error');
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 space-y-3" data-health-selected-day-composite
      data-composite-phase={model.phase} data-composite-status={result?.status ?? (model.isolationError ? 'isolation_error' : 'loading')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-base font-bold">Selected-day workout sources</h2>
          <p className="text-xs text-muted-foreground">{t('workoutSelectedDayCompositeScope')}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onPreviousDay} aria-label="Previous workout day" className="rounded-lg border px-2 py-1">‹</button>
          <span className="self-center text-xs" data-composite-date>{model.localDate}</span>
          <button type="button" onClick={onNextDay} aria-label="Next workout day" className="rounded-lg border px-2 py-1">›</button>
          <button type="button" onClick={model.retry} className="rounded-lg border px-2 py-1 text-xs">Refresh</button>
        </div>
      </div>
      {model.phase === 'loading' && <p role="status">Reading local workout sources…</p>}
      {model.isolationError && <p role="alert">Workout source identity changed. No records are shown; retry this scoped read.</p>}
      {incomplete && <p role="status" data-composite-incomplete>
        Incomplete workout coverage: {result.legacyStatus === 'error' ? 'verified legacy local data unavailable' : 'canonical local data unavailable'}.
      </p>}
      {failed && !model.isolationError && <p role="alert">Local workout sources are unavailable. Retry the selected-day read.</p>}
      {result?.legacyStatus === 'error' && <p data-legacy-source-unavailable>Legacy editor is unavailable until a verified local snapshot can be read.</p>}
      {result?.canonicalStatus === 'error' && <p data-canonical-source-unavailable>Canonical sessions could not be read; the legacy editor remains independent.</p>}
      {result?.status === 'complete' && result.records.length === 0 && !draftDirty && <p data-composite-empty>No persisted workouts in either verified source for this day.</p>}
      {canonical.length > 0 && <div className="space-y-3" data-canonical-read-only>
        <h3 className="text-sm font-bold">Canonical sessions · read only</h3>
        {canonical.map(record => {
          const session = record.canonical.session;
          return <article key={record.readId} className="rounded-xl border border-border p-3 space-y-2" data-canonical-session={record.readId}>
            <p className="text-xs">Session {session.id} · {session.localDate}</p>
            {session.entries.map(entry => <div key={entry.id} className="rounded-lg border border-border/70 p-2" data-canonical-entry={entry.id}>
              <p className="font-semibold">{entry.exercise.name} · {entry.exercise.type}</p>
              <p className="text-xs">Exercise ID: {entry.exercise.id ?? 'none'} · Tags: {entry.exercise.tags.join(', ') || 'none'} · Cardio mode: {entry.exercise.cardioMode ?? 'none'}</p>
              <ul className="mt-1 space-y-1 text-xs">
                {entry.sets.map(set => <li key={set.id} data-canonical-set={set.id}>
                  Set {set.ordinal} · {set.kind} · {set.done ? 'done' : 'not done'}
                  {set.kind === 'strength' && ` · ${set.weightKg ?? '—'} kg · ${set.reps ?? '—'} reps · ${set.assistedReps ?? '—'} assisted · dropset ${set.dropset ? 'yes' : 'no'}`}
                  {set.kind === 'bodyweight' && ` · ${set.reps ?? '—'} reps · ${set.assistedReps ?? '—'} assisted · dropset ${set.dropset ? 'yes' : 'no'}`}
                  {set.kind === 'cardio' && ` · ${set.durationSeconds ?? '—'} sec · ${set.distanceMeters ?? '—'} m`}
                </li>)}
              </ul>
            </div>)}
          </article>;
        })}
      </div>}
    </section>
  );
}
