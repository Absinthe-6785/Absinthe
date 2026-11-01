import { useId, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../../lib/i18n';
import { createWorkoutCloudComparison, WORKOUT_COMPARISON_CATEGORIES, type WorkoutCloudComparison, type WorkoutComparisonReport } from '../../../../lib/healthWorkoutCloudComparison';
import { createWorkoutCloudSingleCreate, type WorkoutCloudSingleCreate, type WorkoutCreateStatus } from '../../../../lib/healthWorkoutCloudSingleCreate';
import type { HealthRecoveryRecord } from '../../../../lib/healthRecoveryExport';
import { createWorkoutCloudSingleReceive, type WorkoutCloudSingleReceive, type WorkoutReceiveStatus } from '../../../../lib/healthWorkoutCloudSingleReceive';
import { HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT } from '../../../../lib/healthSupabaseBootstrap';
import { useSWRConfig } from 'swr';
import { createExerciseBlockCloudSingleReceive, type ExerciseBlockCloudSingleReceive } from '../../../../lib/healthExerciseBlockCloudSingleReceive';

const labels = { localOnly: 'healthCloudLocalOnly', remoteOnly: 'healthCloudRemoteOnly', matching: 'healthCloudMatching', divergent: 'healthCloudDivergent', unverifiable: 'healthCloudUnverifiable' } as const;

export function HealthWorkoutCloudComparisonPanel({ accountId }: { accountId: string }) {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const heading = useId();
  const account = useRef({ id: accountId });
  if (account.current.id !== accountId) account.current = { id: accountId };
  const active = useRef<WorkoutCloudComparison | null>(null);
  const pending = useRef(false);
  const write = useRef<WorkoutCloudSingleCreate | WorkoutCloudSingleReceive | ExerciseBlockCloudSingleReceive | null>(null);
  const [confirmation, setConfirmation] = useState<{ owner: WorkoutCloudComparison; record: HealthRecoveryRecord; receive?: boolean; block?: HealthRecoveryRecord; blockOwner?: ExerciseBlockCloudSingleReceive } | null>(null);
  const [outcome, setOutcome] = useState<WorkoutCreateStatus | null>(null);
  const [receiveOutcome, setReceiveOutcome] = useState<WorkoutReceiveStatus | null>(null);
  const [blockOutcome, setBlockOutcome] = useState<WorkoutReceiveStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [result, setResult] = useState<{ owner: WorkoutCloudComparison; report: WorkoutComparisonReport } | null>(null);
  useLayoutEffect(() => {
    setResult(null); setBusy(false); setFailed(false); setConfirmation(null); setOutcome(null); pending.current = false;
    setReceiveOutcome(null);
    setBlockOutcome(null);
    setRefreshFailed(false);
    return () => { active.current?.cancel(); write.current?.cancel(); active.current = null; pending.current = false; };
  }, [accountId]);
  const check = async (preserveOutcome = false) => {
    if (pending.current) return;
    pending.current = true;
    setRefreshFailed(false);
    active.current?.cancel(); write.current?.cancel(); write.current = null; setResult(null); setFailed(false); setConfirmation(null);
    if (!preserveOutcome) { setOutcome(null); setReceiveOutcome(null); setBlockOutcome(null); }
    const context = account.current;
    let owner: WorkoutCloudComparison | null = null;
    let invalidated = false;
    setBusy(true);
    try {
      owner = createWorkoutCloudComparison(accountId, () => account.current === context, () => {
        if (invalidated) return;
        invalidated = true;
        if (owner && active.current === owner && account.current === context) {
          const currentWrite = write.current;
          currentWrite?.cancel();
          // An in-flight INSERT may have committed. Await its actual verdict;
          // never reuse the read-only "nothing changed" error for that case.
          setResult(null); setConfirmation(null);
          if (!preserveOutcome) { setOutcome(null); setReceiveOutcome(null); setBlockOutcome(null); }
          setBusy(false); setFailed(!currentWrite && !preserveOutcome); pending.current = false;
          if (!currentWrite && preserveOutcome) setRefreshFailed(true);
        }
      });
      active.current = owner;
      const report = await owner.compare();
      if (active.current === owner && owner.isCurrent()) setResult({ owner, report });
    } catch {
      if ((!owner || active.current === owner) && account.current === context) {
        if (preserveOutcome) setRefreshFailed(true);
        else setFailed(true);
      }
    } finally { if ((!owner || active.current === owner) && account.current === context) { setBusy(false); pending.current = false; } }
  };
  const inspectBlock = async (record: HealthRecoveryRecord, origin: WorkoutCloudComparison) => {
    if (pending.current || origin !== active.current || !origin.isCurrent()) return;
    pending.current = true; setBusy(true); setConfirmation(null); setOutcome(null); setReceiveOutcome(null); setBlockOutcome(null);
    const context = account.current;
    write.current?.cancel();
    const owner = createExerciseBlockCloudSingleReceive(accountId, record, () => account.current === context && origin.isCurrent());
    write.current = owner;
    const block = await owner.inspect();
    if (account.current !== context || active.current !== origin || write.current !== owner) return;
    setBusy(false); pending.current = false;
    if (block && origin.isCurrent()) setConfirmation({ owner: origin, record, block, blockOwner: owner });
    else { owner.cancel(); write.current = null; setBlockOutcome('DENIED'); }
  };
  const confirmCreate = async () => {
    if (pending.current || !confirmation || confirmation.owner !== active.current || !confirmation.owner.isCurrent()) return;
    pending.current = true; setBusy(true); setOutcome(null); setReceiveOutcome(null); setBlockOutcome(null);
    const context = account.current;
    const origin = confirmation.owner;
    const receiving = confirmation.receive === true;
    const current = () => account.current === context && origin.isCurrent();
    const blockReceiving = !!confirmation.blockOwner;
    const owner = confirmation.blockOwner ?? (receiving ? createWorkoutCloudSingleReceive(accountId, confirmation.record, current)
      : createWorkoutCloudSingleCreate(accountId, confirmation.record, current));
    write.current = owner; setConfirmation(null);
    const status = await ('receive' in owner ? owner.receive() : owner.transfer());
    if (account.current !== context || write.current !== owner || active.current !== origin) return;
    const confirmed = status === 'REMOTE_INSERT_CONFIRMED' || status === 'LOCAL_CREATE_CONFIRMED';
    if (confirmed && !origin.isCurrent()) return;
    write.current = null;
    if (blockReceiving) setBlockOutcome(status as WorkoutReceiveStatus);
    else if (receiving) setReceiveOutcome(status as WorkoutReceiveStatus);
    else setOutcome(status as WorkoutCreateStatus);
    setResult(null); setBusy(false); pending.current = false;
    if (status === 'LOCAL_CREATE_CONFIRMED') {
      // Existing refresh paths re-read persisted projections; draft ownership is unchanged.
      window.dispatchEvent(new Event(HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT));
      void mutate(key => Array.isArray(key) && key[1] === accountId
        && (key[0] === 'local-health-workout-range' || key[0] === 'local' && key.length === 4));
    }
    if (confirmed) await check(true);
  };
  const report = result?.owner === active.current && result?.owner.isCurrent() ? result.report : null;
  return <section aria-labelledby={heading} className="rounded-xl border border-border bg-surface p-3 text-foreground space-y-2" data-health-cloud-comparison>
    <h3 id={heading} className="text-sm font-bold">{t('healthCloudTitle')}</h3>
    <p className="text-xs text-muted-foreground">{t('healthCloudScope')}</p>
    <p className="text-xs text-muted-foreground">{t('healthCloudCreateScope')}</p>
    <p className="text-xs text-muted-foreground">{t('healthCloudReceiveScope')}</p>
    <p className="text-xs text-muted-foreground">{t('healthCloudBlockScope')}</p>
    <button type="button" disabled={!accountId || busy} onClick={() => { void check(); }} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">{t(busy ? 'healthCloudChecking' : 'healthCloudCheck')}</button>
    {failed ? <p role="alert" className="text-sm">{t('healthCloudUnavailable')}</p> : null}
    {refreshFailed ? <p role="alert" className="text-sm">{t('healthCloudRefreshUnavailable')}</p> : null}
    {outcome ? <p role="status">{t(({ DENIED: 'healthCloudCreateDenied', CONFLICT: 'healthCloudCreateConflict', INDETERMINATE: 'healthCloudCreateIndeterminate', REMOTE_INSERT_CONFIRMED: 'healthCloudCreateConfirmed' } as const)[outcome])}</p> : null}
    {receiveOutcome ? <p role="status">{t(({ DENIED: 'healthCloudReceiveDenied', CONFLICT: 'healthCloudReceiveConflict', INDETERMINATE: 'healthCloudReceiveIndeterminate', LOCAL_CREATE_CONFIRMED: 'healthCloudReceiveConfirmed' } as const)[receiveOutcome])}</p> : null}
    {blockOutcome ? <p role="status">{t(({ DENIED: 'healthCloudBlockDenied', CONFLICT: 'healthCloudBlockConflict', INDETERMINATE: 'healthCloudBlockIndeterminate', LOCAL_CREATE_CONFIRMED: 'healthCloudBlockConfirmed' } as const)[blockOutcome])}</p> : null}
    {confirmation?.owner.isCurrent() ? <div className="space-y-2 rounded border border-border p-2" role="group" aria-label={t(confirmation.block ? 'healthCloudBlockConfirm' : confirmation.receive ? 'healthCloudReceiveConfirm' : 'healthCloudCreateConfirm')}>
      <p>{t(confirmation.block ? 'healthCloudBlockConfirm' : confirmation.receive ? 'healthCloudReceiveConfirm' : 'healthCloudCreateConfirm')}</p><code className="break-all">{String(confirmation.block?.id ?? confirmation.record.id)}</code>
      {confirmation.block ? <p className="break-all">{String(confirmation.block.name)}</p> : null}
      <button type="button" disabled={busy} onClick={() => { void confirmCreate(); }} className="rounded border border-border p-2 focus-visible:outline">{t(confirmation.block ? 'healthCloudBlockConfirmAction' : confirmation.receive ? 'healthCloudReceiveConfirmAction' : 'healthCloudCreateConfirmAction')}</button>
      <button type="button" disabled={busy} onClick={() => { confirmation.blockOwner?.cancel(); write.current = null; setConfirmation(null); }} className="rounded border border-border p-2 focus-visible:outline">{t('healthCloudCreateCancel')}</button>
    </div> : null}
    {report ? <div className="space-y-2 text-xs">
      <p role="status">{t('healthCloudObserved')}</p>
      <dl className="flex flex-wrap gap-3">{WORKOUT_COMPARISON_CATEGORIES.map(key => <div key={key}><dt>{t(labels[key])}</dt><dd className="font-semibold">{report.counts[key]}</dd></div>)}</dl>
      {WORKOUT_COMPARISON_CATEGORIES.filter(key => key !== 'matching' && report.details[key].length > 0).map(key => <details key={key} className="rounded border border-border p-2">
        <summary className="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{t(labels[key])} ({report.counts[key]})</summary>
        <ul className="mt-2 max-h-60 overflow-y-auto space-y-2">{report.details[key].slice(0, 30).map(row => <li key={row.id}>
          <code className="break-all">{row.id}</code>
          {row.localDate ? <p>{t('healthCloudLocalDate')}: {row.localDate}</p> : null}
          {row.remoteDate ? <p>{t('healthCloudRemoteDate')}: {row.remoteDate}</p> : null}
          {key === 'localOnly' ? <button type="button" disabled={busy} onClick={() => {
            if (!result?.owner.isCurrent() || pending.current) return;
            const record = result.owner.localOnlyRecord(row.id);
            if (record) { write.current?.cancel(); write.current = null; setOutcome(null); setBlockOutcome(null); setConfirmation({ owner: result.owner, record }); }
          }} className="mt-1 rounded border border-border p-2 focus-visible:outline">{t('healthCloudCreate')}</button> : null}
          {key === 'remoteOnly' ? <button type="button" disabled={busy} onClick={() => {
            if (!result?.owner.isCurrent() || pending.current) return;
            const record = result.owner.remoteOnlyRecord(row.id);
            if (record) { write.current?.cancel(); write.current = null; setOutcome(null); setReceiveOutcome(null); setBlockOutcome(null); setConfirmation({ owner: result.owner, record, receive: true }); }
          }} className="mt-1 rounded border border-border p-2 focus-visible:outline">{t('healthCloudReceive')}</button> : null}
          {key === 'remoteOnly' ? <button type="button" disabled={busy} onClick={() => {
            if (!result?.owner.isCurrent() || pending.current) return;
            const record = result.owner.remoteOnlyRecord(row.id);
            if (record) void inspectBlock(record, result.owner);
          }} className="mt-1 ml-2 rounded border border-border p-2 focus-visible:outline">{t('healthCloudBlockCheck')}</button> : null}
        </li>)}</ul>
        {report.details[key].length > 30 ? <p>{t('healthCloudPreviewLimit')}</p> : null}
      </details>)}
    </div> : null}
  </section>;
}
