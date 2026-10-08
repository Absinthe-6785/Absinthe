import { memo, useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from '../../../../lib/i18n';
import type { ExerciseComparisonSourceResult } from '../../../../lib/workoutExerciseComparisonProjection';
import type {
  HealthExerciseComparisonEvidence, HealthExerciseComparisonPublication, HealthExerciseComparisonRead,
} from './healthExerciseComparisonBorrower';

type Published = Readonly<{
  evidence: HealthExerciseComparisonEvidence;
  publication: HealthExerciseComparisonPublication;
  port: HealthExerciseComparisonRead['port'];
  revision: number;
  key: string;
}>;

function SourceEvidence({ source }: { source: ExerciseComparisonSourceResult }) {
  const { t } = useTranslation();
  return <section data-excomp-source={source.source} className="rounded-lg border border-border p-2">
    <h5 className="font-semibold">{t(source.source === 'legacy' ? 'exerciseComparisonLegacy' : 'exerciseComparisonCanonical')}</h5>
    {source.status === 'unavailable' ? <p role="status">{t('exerciseComparisonSourceUnavailable')}</p> : <>
      {source.latestEligibleDate !== null ? <p>{t('exerciseComparisonPriorDate')} <time dateTime={source.latestEligibleDate}>{source.latestEligibleDate}</time></p> : null}
      {source.evidence === 'no_eligible_evidence' ? <p data-excomp-no-match>{t('exerciseComparisonNoMatch')}</p> : <ul>
        {source.observations.map(observation => <li key={observation.origin.source === 'legacy'
          ? JSON.stringify([observation.origin.readId, observation.origin.setIndex])
          : JSON.stringify([observation.origin.readId, observation.origin.entryId, observation.origin.setId])}>
          {observation.weight.status === 'trusted' ? <span>{observation.weight.weightKg} kg
            {observation.weight.sourceValue !== null ? ` (${observation.weight.sourceValue} ${observation.weight.sourceUnit})` : ''}</span>
            : <span>{t('exerciseComparisonWeightWithheld')}</span>}
          {' · '}{observation.repetitions.status === 'trusted' ? <span>{observation.repetitions.total} {t('workoutCompositeReps')}
            {observation.repetitions.assisted !== null ? ` (${t('exerciseComparisonAssisted')} ${observation.repetitions.assisted}; ${t('exerciseComparisonUnassisted')} ${observation.repetitions.unassisted})` : ''}</span>
            : <span>{t('exerciseComparisonRepsWithheld')}</span>}
        </li>)}
      </ul>}
      {source.withheldWeightClaims > 0 || source.withheldRepetitionClaims > 0
        ? <p>{t('exerciseComparisonWithheld')}</p> : null}
    </>}
  </section>;
}

/** DEFAULT_OFF_PREVIEW_COPY. Read-only evidence: no editing/copy-to-plan callbacks. */
export const HealthExerciseComparisonPreview = memo(function HealthExerciseComparisonPreview({
  read, exerciseId, exerciseName, exerciseType,
}: {
  read: HealthExerciseComparisonRead;
  exerciseId: string;
  exerciseName: string | null;
  exerciseType: string | null;
}) {
  const { t } = useTranslation();
  const { port, phase } = read;
  const revision = useSyncExternalStore(port.subscribe, port.getRevision, port.getRevision);
  const [published, setPublished] = useState<Published | null>(null);
  const [attempt, setAttempt] = useState<'loading' | 'stale' | 'unavailable'>('loading');
  const key = JSON.stringify([exerciseId, exerciseName, exerciseType]);
  useEffect(() => () => port.release(), [port, exerciseId, exerciseName, exerciseType]);
  useEffect(() => {
    let mounted = true;
    setAttempt('loading');
    if (phase !== 'ready' || !port.isCurrent()) return () => { mounted = false; };
    void port.derive({ id: exerciseId, name: exerciseName, type: exerciseType }).then(async publication => {
      if (!mounted) return;
      if (!publication) { setAttempt('stale'); return; }
      const consumed = await publication.publish(evidence => {
        if (!mounted) return;
        // This is the ONLY evidence state write, inside the final durable scope fence.
        setPublished({ evidence, publication, port, revision, key });
      });
      if (mounted && !consumed) setAttempt('stale');
    }).catch(() => { if (mounted) setAttempt('unavailable'); });
    return () => { mounted = false; };
  }, [port, phase, revision, exerciseId, exerciseName, exerciseType, key]);

  const current = phase === 'ready' && published?.port === port && published.key === key
    && published.revision === revision && published.publication.isCurrent() ? published.evidence : null;
  const comparison = current?.comparison;
  const settled = comparison && 'scope' in comparison ? comparison : null;
  const status = phase === 'isolation_error' ? 'isolation_error'
    : phase === 'unavailable' ? 'unavailable' : phase === 'loading' ? 'loading' : settled?.status ?? attempt;
  return <section aria-label={t('exerciseComparisonPreview')} data-health-exercise-comparison
    data-excomp-status={status} className="mb-3 space-y-2 rounded-xl border border-border bg-surface-alt p-3 text-xs text-muted-foreground">
    <h4 className="font-semibold">{t('exerciseComparisonPreview')}</h4>
    <p>{t('exerciseComparisonScope')}</p>
    <p>{t('exerciseComparisonCompatibility')}</p>
    {status === 'loading' ? <p role="status">{t('exerciseComparisonLoading')}</p> : null}
    {status === 'stale' ? <p role="status">{t('exerciseComparisonStale')}</p> : null}
    {status === 'isolation_error' ? <p role="alert">{t('exerciseComparisonIsolation')}</p> : null}
    {status === 'unavailable' ? <p role="alert">{t('exerciseComparisonUnavailable')}</p> : null}
    {settled ? <>
      {settled.status === 'partial_data' ? <p role="status" data-excomp-partial>{t('exerciseComparisonPartial')}</p> : null}
      {current?.verifiedBothSourcesEmpty ? <p data-excomp-verified-empty>{t('exerciseComparisonVerifiedEmpty')}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <SourceEvidence source={settled.legacy} />
        <SourceEvidence source={settled.canonical} />
      </div>
    </> : null}
    <button type="button" onClick={read.retry} className="min-h-11 rounded-lg border border-border px-3">{t('exerciseComparisonRetry')}</button>
  </section>;
});
