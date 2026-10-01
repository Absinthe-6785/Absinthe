import type { TranslationKey } from '../../../../lib/i18n';
import type { Theme, WorkoutSet } from '../../../../types';
import type {
  CompositePreviousWorkoutProjection,
} from './compositePreviousWorkoutProjection';

export interface CompositePreviousWorkoutViewProps {
  projection: CompositePreviousWorkoutProjection;
  theme: Theme;
  darkMode: boolean;
  t: (key: TranslationKey) => string;
  formatDate: (date: string) => string;
  formatCompactDate: (date: string) => string;
  onRetry: () => void;
  onSelectDate: (date: string) => void;
  scrollMode?: 'contained' | 'inherited';
}

function displayValue(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

function booleanValue(value: boolean, t: (key: TranslationKey) => string): string {
  return t(value ? 'workoutCompositeDone' : 'workoutCompositeNotDone');
}

function legacySetSummary(set: WorkoutSet, t: (key: TranslationKey) => string): string {
  const values = [`${t('workoutCompositeType')}: ${set.type}`];
  if (set.type === 'cardio') {
    values.push(
      `${t('workoutCompositeDuration')}: ${displayValue(set.time)}`,
      `${t('workoutCompositeDistance')}: ${displayValue(set.distance)}`,
      `${t('workoutCompositePace')}: ${displayValue(set.pace)}`,
    );
  } else {
    if (set.type === 'strength') {
      values.push(`${t('workoutCompositeWeightKg')}: ${displayValue(set.kg)}`);
      values.push(`${t('workoutCompositeWeightSource')}: ${set.weight_source_value == null
        ? '—'
        : `${set.weight_source_value}${set.weight_source_unit ? ` ${set.weight_source_unit}` : ''}`}`);
    }
    values.push(
      `${t('workoutCompositeReps')}: ${displayValue(set.reps)}`,
      `${t('workoutCompositeAssisted')}: ${displayValue(set.assisted_reps)}`,
      `${t('workoutCompositeDropset')}: ${String(Boolean(set.is_dropset))}`,
    );
  }
  values.push(`${t('workoutCompositeDone')}: ${booleanValue(set.done, t)}`);
  return values.join(' · ');
}

function canonicalSetSummary(set: {
  ordinal: number;
  kind: string;
  sourceValue?: string | number | null;
  sourceUnit?: string | null;
  weightKg?: string | number | null;
  reps?: number | null;
  assistedReps?: number | null;
  durationSeconds?: number | null;
  distanceMeters?: string | number | null;
  dropset?: boolean;
  done: boolean;
}, t: (key: TranslationKey) => string): string {
  const values = [`${t('workoutCompositeType')}: ${set.kind}`];
  if (set.kind === 'strength') {
    values.push(
      `${t('workoutCompositeWeightSource')}: ${set.sourceValue == null
        ? '—'
        : `${set.sourceValue}${set.sourceUnit ? ` ${set.sourceUnit}` : ''}`}`,
      `${t('workoutCompositeWeightKg')}: ${displayValue(set.weightKg)}`,
      `${t('workoutCompositeReps')}: ${displayValue(set.reps)}`,
      `${t('workoutCompositeAssisted')}: ${displayValue(set.assistedReps)}`,
      `${t('workoutCompositeDropset')}: ${String(Boolean(set.dropset))}`,
    );
  } else if (set.kind === 'bodyweight') {
    values.push(
      `${t('workoutCompositeReps')}: ${displayValue(set.reps)}`,
      `${t('workoutCompositeAssisted')}: ${displayValue(set.assistedReps)}`,
      `${t('workoutCompositeDropset')}: ${String(Boolean(set.dropset))}`,
    );
  } else {
    values.push(
      `${t('workoutCompositeDuration')}: ${displayValue(set.durationSeconds)} ${t('workoutCompositeSeconds')}`,
      `${t('workoutCompositeDistance')}: ${displayValue(set.distanceMeters)} ${t('workoutCompositeMeters')}`,
    );
  }
  values.push(`${t('workoutCompositeDone')}: ${booleanValue(set.done, t)}`);
  return values.join(' · ');
}

export function CompositePreviousWorkoutView({
  projection,
  theme,
  darkMode,
  t,
  formatDate,
  formatCompactDate,
  onRetry,
  onSelectDate,
  scrollMode = 'contained',
}: CompositePreviousWorkoutViewProps) {
  if (projection.phase === 'loading') {
    return <div role="status" className={`flex flex-1 items-center justify-center rounded-2xl border px-4 py-12 text-sm ${theme.border} ${theme.textMuted}`} data-health-composite-previous-loading>{t('previousWorkoutLoading')}</div>;
  }
  if (projection.status === 'error' || projection.status === 'isolation_error') {
    return <div role="alert" className={`flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border px-4 py-12 text-center ${theme.border}`} data-health-composite-previous-error>
      <p className="text-sm font-semibold">{t('workoutCompositeSourcesError')}</p>
      <button type="button" onClick={onRetry} className={`min-h-[44px] rounded-xl border px-4 py-2 text-sm font-bold ${theme.border}`}>{t('previousWorkoutRetry')}</button>
    </div>;
  }

  const browser = projection.dateBuckets.length > 0 ? <section className={`shrink-0 rounded-2xl border px-3 py-3 ${theme.border} ${theme.input}`} data-health-composite-previous-date-browser>
    <p className={`mb-2 text-xs font-bold ${theme.textMuted}`}>{t('previousWorkoutDates')}</p>
    <div className="flex max-w-full gap-2 overflow-x-auto pb-1" role="group" aria-label={t('previousWorkoutDates')}>
      {projection.dateBuckets.map(bucket => <button key={bucket.localDate} type="button"
        aria-pressed={bucket.localDate === projection.effectiveDate}
        onClick={() => onSelectDate(bucket.localDate)}
        className={`min-h-[42px] shrink-0 rounded-xl border px-3 py-2 text-xs font-bold ${bucket.localDate === projection.effectiveDate ? 'border-primary bg-primary text-primary-foreground' : `${theme.border} ${theme.card} ${theme.textMuted}`}`}>
        {formatCompactDate(bucket.localDate)}
      </button>)}
    </div>
  </section> : null;

  const warning = projection.status === 'partial_data' ? <div role="status" className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-xs ${theme.border}`} data-health-composite-previous-incomplete>
    <span>{projection.legacyStatus === 'error' ? t('workoutCompositeLegacyUnavailable') : t('workoutCompositeCanonicalUnavailable')}</span>
    <button type="button" onClick={onRetry} className={`min-h-[44px] shrink-0 rounded-xl border px-3 py-2 text-xs font-bold ${theme.border}`}>{t('previousWorkoutRetry')}</button>
  </div> : null;

  if (!projection.selectedBucket) {
    const emptyMessage = projection.status === 'partial_data'
      ? t('workoutCompositePartialNoRecords')
      : t('previousWorkoutEmpty');
    return <div className="flex min-h-0 flex-1 flex-col gap-3" data-health-composite-previous-content>{browser}{warning}<div className={`flex flex-1 items-center justify-center rounded-2xl border border-dashed px-4 py-12 text-center text-sm ${theme.border} ${theme.textMuted}`}>{emptyMessage}</div></div>;
  }
  const bucket = projection.selectedBucket;
  return <div className={`min-h-0 flex-1 space-y-3 ${scrollMode === 'contained' ? 'overflow-y-auto pr-1' : ''}`} data-health-composite-previous>
    {browser}{warning}
    <div className={`rounded-2xl border px-4 py-3 ${theme.border} ${darkMode ? 'bg-surface/40' : 'bg-gray-50/70'}`}>
      <p className="font-heading text-lg font-bold">{t('previousWorkout')}</p>
      <p className={`mt-1 text-xs font-medium ${theme.textMuted}`}>{formatDate(bucket.localDate)}</p>
      <p className={`mt-1 text-[11px] ${theme.textMuted}`}>{t('workoutCompositeLegacyComparisonScope')}</p>
    </div>
    {bucket.legacyGroup && <section className="space-y-2" data-composite-legacy-group={bucket.legacyGroup.presentationKey}>
      <h3 className="text-sm font-bold">{t('workoutCompositeLegacyGroup')}</h3>
      {bucket.legacyGroup.rows.map(record => <article key={record.readId} className={`rounded-2xl border p-3 ${theme.border} ${theme.card}`} data-legacy-read-id={record.readId}>
        <div className="flex items-center justify-between gap-2"><p className="font-semibold">{record.legacy.exerciseDisplay.kind === 'current_catalog' ? record.legacy.exerciseDisplay.block.name : record.legacy.exerciseDisplay.name}</p><span className={`text-[11px] ${theme.textMuted}`}>{t('previousReadOnly')}</span></div>
        <p className={`mt-1 text-xs ${theme.textMuted}`}>{t('workoutCompositeSetCount').replace('{count}', String(record.legacy.sets.length))}</p>
        <ul className="mt-2 space-y-1 text-xs">{record.legacy.sets.map((set, index) => <li key={`${record.readId}:${set.set}:${index}`}>
          {t('workoutCompositeSetLabel').replace('{set}', String(set.set))}: {legacySetSummary(set, t)}
        </li>)}</ul>
      </article>)}
    </section>}
    {bucket.canonicalSessions.map(record => <article key={record.readId} className={`rounded-2xl border p-3 ${theme.border} ${theme.card}`} data-canonical-read-id={record.readId}>
      <div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">{t('workoutCompositeCanonicalSession')}</h3><p className={`text-[11px] break-all ${theme.textMuted}`}>{record.canonical.session.id}</p></div><span className={`text-[11px] ${theme.textMuted}`}>{t('previousReadOnly')}</span></div>
      {record.canonical.session.entries.length === 0 ? <p className={`mt-2 text-xs ${theme.textMuted}`}>{t('workoutCompositeEmptySession')}</p> : <div className="mt-3 space-y-2">
        {record.canonical.session.entries.map(entry => <section key={entry.id} className={`rounded-xl border p-2 ${theme.border}`}>
          <p className="font-semibold">{entry.exercise.name}</p>
          <p className={`text-xs ${theme.textMuted}`}>{entry.exercise.type}{entry.exercise.tags.length ? ` · ${entry.exercise.tags.join(', ')}` : ''}</p>
          <p className={`text-[11px] break-all ${theme.textMuted}`}>{t('workoutCompositeEntryId')}: {entry.id}</p>
          {entry.exercise.cardioMode != null && <p className={`text-[11px] ${theme.textMuted}`}>{t('workoutCompositeCardioMode')}: {entry.exercise.cardioMode}</p>}
          <ul className="mt-2 space-y-1 text-xs">{entry.sets.map(set => <li key={set.id}>
            <span>{t('workoutCompositeSetLabel').replace('{set}', String(set.ordinal))}: {canonicalSetSummary(set, t)}</span>
            <span className={`ml-2 break-all text-[11px] ${theme.textMuted}`}>{t('workoutCompositeSetId')}: {set.id}</span>
          </li>)}</ul>
        </section>)}
      </div>}
    </article>)}
  </div>;
}
