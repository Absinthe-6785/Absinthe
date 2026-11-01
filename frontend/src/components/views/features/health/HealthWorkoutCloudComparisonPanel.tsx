import { useId, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../../lib/i18n';
import { createWorkoutCloudComparison, WORKOUT_COMPARISON_CATEGORIES, type WorkoutCloudComparison, type WorkoutComparisonReport } from '../../../../lib/healthWorkoutCloudComparison';

const labels = { localOnly: 'healthCloudLocalOnly', remoteOnly: 'healthCloudRemoteOnly', matching: 'healthCloudMatching', divergent: 'healthCloudDivergent', unverifiable: 'healthCloudUnverifiable' } as const;

export function HealthWorkoutCloudComparisonPanel({ accountId }: { accountId: string }) {
  const { t } = useTranslation();
  const heading = useId();
  const account = useRef({ id: accountId });
  if (account.current.id !== accountId) account.current = { id: accountId };
  const active = useRef<WorkoutCloudComparison | null>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [result, setResult] = useState<{ owner: WorkoutCloudComparison; report: WorkoutComparisonReport } | null>(null);
  useLayoutEffect(() => {
    setResult(null); setBusy(false); setFailed(false); pending.current = false;
    return () => { active.current?.cancel(); active.current = null; pending.current = false; };
  }, [accountId]);
  const check = async () => {
    if (pending.current) return;
    pending.current = true;
    active.current?.cancel(); setResult(null); setFailed(false);
    const context = account.current;
    let owner: WorkoutCloudComparison | null = null;
    setBusy(true);
    try {
      owner = createWorkoutCloudComparison(accountId, () => account.current === context, () => {
        if (owner && active.current === owner && account.current === context) {
          setResult(null); setBusy(false); setFailed(true); pending.current = false;
        }
      });
      active.current = owner;
      const report = await owner.compare();
      if (active.current === owner && owner.isCurrent()) setResult({ owner, report });
    } catch {
      if ((!owner || active.current === owner) && account.current === context) setFailed(true);
    } finally { if ((!owner || active.current === owner) && account.current === context) { setBusy(false); pending.current = false; } }
  };
  const report = result?.owner === active.current && result?.owner.isCurrent() ? result.report : null;
  return <section aria-labelledby={heading} className="rounded-xl border border-border bg-surface p-3 text-foreground space-y-2" data-health-cloud-comparison>
    <h3 id={heading} className="text-sm font-bold">{t('healthCloudTitle')}</h3>
    <p className="text-xs text-muted-foreground">{t('healthCloudScope')}</p>
    <button type="button" disabled={!accountId || busy} onClick={() => { void check(); }} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">{t(busy ? 'healthCloudChecking' : 'healthCloudCheck')}</button>
    {failed ? <p role="alert" className="text-sm">{t('healthCloudUnavailable')}</p> : null}
    {report ? <div className="space-y-2 text-xs">
      <p role="status">{t('healthCloudObserved')}</p>
      <dl className="flex flex-wrap gap-3">{WORKOUT_COMPARISON_CATEGORIES.map(key => <div key={key}><dt>{t(labels[key])}</dt><dd className="font-semibold">{report.counts[key]}</dd></div>)}</dl>
      {WORKOUT_COMPARISON_CATEGORIES.filter(key => key !== 'matching' && report.details[key].length > 0).map(key => <details key={key} className="rounded border border-border p-2">
        <summary className="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{t(labels[key])} ({report.counts[key]})</summary>
        <ul className="mt-2 max-h-60 overflow-y-auto space-y-2">{report.details[key].slice(0, 30).map(row => <li key={row.id}>
          <code className="break-all">{row.id}</code>
          {row.localDate ? <p>{t('healthCloudLocalDate')}: {row.localDate}</p> : null}
          {row.remoteDate ? <p>{t('healthCloudRemoteDate')}: {row.remoteDate}</p> : null}
        </li>)}</ul>
        {report.details[key].length > 30 ? <p>{t('healthCloudPreviewLimit')}</p> : null}
      </details>)}
    </div> : null}
  </section>;
}
