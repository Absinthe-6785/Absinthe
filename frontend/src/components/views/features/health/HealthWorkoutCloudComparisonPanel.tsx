import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../../../lib/i18n';
import { createWorkoutCloudComparison, supportedWorkoutContent, WORKOUT_COMPARISON_CATEGORIES, type WorkoutCloudComparison, type WorkoutComparisonReport } from '../../../../lib/healthWorkoutCloudComparison';
import { createWorkoutCloudSingleCreate, type WorkoutCloudSingleCreate, type WorkoutCreateStatus } from '../../../../lib/healthWorkoutCloudSingleCreate';
import type { HealthRecoveryRecord } from '../../../../lib/healthRecoveryExport';
import { createWorkoutCloudSingleReceive, type WorkoutCloudSingleReceive, type WorkoutReceiveStatus } from '../../../../lib/healthWorkoutCloudSingleReceive';
import { HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT } from '../../../../lib/healthSupabaseBootstrap';
import { useSWRConfig } from 'swr';
import { createExerciseBlockCloudSingleReceive, type ExerciseBlockCloudSingleReceive } from '../../../../lib/healthExerciseBlockCloudSingleReceive';

const labels = { localOnly: 'healthCloudLocalOnly', remoteOnly: 'healthCloudRemoteOnly', matching: 'healthCloudMatching', divergent: 'healthCloudDivergent', unverifiable: 'healthCloudUnverifiable' } as const;
const MAX_WORKOUT_PREVIEW_SETS = 20;
const MAX_WORKOUT_PREVIEW_FIELD_CHARS = 500;
const WORKOUT_PREVIEW_SET_FIELDS = ['set', 'type', 'done', 'kg', 'reps', 'assisted_reps', 'is_dropset', 'weight_source_value', 'weight_source_unit', 'time', 'distance', 'pace'] as const;

type WorkoutPreviewSelection = { owner: WorkoutCloudComparison; id: string };
type WorkoutPreviewField = { key: typeof WORKOUT_PREVIEW_SET_FIELDS[number]; value: string; truncated: boolean };

export type HealthWorkoutCloudComparisonRequest = Readonly<{
  requestId: number;
  accountId: string;
  accountGeneration: number;
}>;

export type HealthWorkoutCloudComparisonPanelProps = {
  accountId: string;
  comparisonActive: boolean;
  comparisonRequest: HealthWorkoutCloudComparisonRequest | null;
  isComparisonRequestCurrent: (request: HealthWorkoutCloudComparisonRequest) => boolean;
  onComparisonRequestSettled: (requestId: number) => void;
};

function currentRemoteOnlyRecord(owner: WorkoutCloudComparison, id: string, report: WorkoutComparisonReport, accountId: string): HealthRecoveryRecord | null {
  if (!owner.isCurrent() || !report.details.remoteOnly.some(row => row.id === id)) return null;
  try {
    const record = owner.remoteOnlyRecord(id);
    return record && record.id === id && record.user_id === accountId && supportedWorkoutContent(record, accountId) !== null
      ? record : null;
  } catch { return null; }
}

function workoutPreviewFields(value: unknown): WorkoutPreviewField[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const set = value as Record<string, unknown>;
  return WORKOUT_PREVIEW_SET_FIELDS.flatMap(key => {
    if (!Object.prototype.hasOwnProperty.call(set, key)) return [];
    const raw = set[key];
    if (raw !== null && !['string', 'number', 'boolean'].includes(typeof raw)) return [];
    const text = raw === null ? 'null' : String(raw);
    return [{ key, value: text.slice(0, MAX_WORKOUT_PREVIEW_FIELD_CHARS), truncated: text.length > MAX_WORKOUT_PREVIEW_FIELD_CHARS }];
  });
}

function isExactCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
  return day >= 1 && day <= daysInMonth;
}

function filterComparisonDetails(report: WorkoutComparisonReport, rawQuery: string) {
  const query = rawQuery.trim();
  if (!query) return report.details;
  const dateQuery = isExactCalendarDate(query);
  const matches = (row: WorkoutComparisonReport['details'][keyof WorkoutComparisonReport['details']][number]) => dateQuery
    ? row.localDate === query || row.remoteDate === query
    : row.id === query;
  return {
    localOnly: report.details.localOnly.filter(matches),
    remoteOnly: report.details.remoteOnly.filter(matches),
    matching: report.details.matching.filter(matches),
    divergent: report.details.divergent.filter(matches),
    unverifiable: report.details.unverifiable.filter(matches),
  };
}

export function HealthWorkoutCloudComparisonPanel({
  accountId,
  comparisonActive,
  comparisonRequest,
  isComparisonRequestCurrent,
  onComparisonRequestSettled,
}: HealthWorkoutCloudComparisonPanelProps) {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const heading = useId();
  const filterInput = useId();
  const filterHelp = useId();
  const previewHeading = useId();
  const previewRegion = useId();
  const account = useRef({ id: accountId });
  if (account.current.id !== accountId) account.current = { id: accountId };
  const active = useRef<WorkoutCloudComparison | null>(null);
  const comparisonFlight = useRef<Promise<void> | null>(null);
  const comparisonRequestRef = useRef(comparisonRequest);
  comparisonRequestRef.current = comparisonRequest;
  const comparisonRequestCurrentRef = useRef(isComparisonRequestCurrent);
  comparisonRequestCurrentRef.current = isComparisonRequestCurrent;
  const comparisonRequestSettledRef = useRef(onComparisonRequestSettled);
  comparisonRequestSettledRef.current = onComparisonRequestSettled;
  const shortcutRequestId = useRef<number | null>(null);
  const handledRequestId = useRef<number | null>(null);
  const checkRef = useRef<((preserveOutcome?: boolean) => Promise<void>) | null>(null);
  const previewTrigger = useRef<HTMLButtonElement | null>(null);
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
  const [filterQuery, setFilterQuery] = useState('');
  const [preview, setPreview] = useState<WorkoutPreviewSelection | null>(null);
  useLayoutEffect(() => {
    setResult(null); setFilterQuery(''); setPreview(null); setBusy(false); setFailed(false); setConfirmation(null); setOutcome(null); pending.current = false;
    setReceiveOutcome(null);
    setBlockOutcome(null);
    setRefreshFailed(false);
    return () => { active.current?.cancel(); write.current?.cancel(); active.current = null; pending.current = false; };
  }, [accountId]);
  const check = (preserveOutcome = false): Promise<void> => {
    if (pending.current) return comparisonFlight.current ?? Promise.resolve();
    pending.current = true;
    setRefreshFailed(false);
    active.current?.cancel(); write.current?.cancel(); write.current = null; setResult(null); setFilterQuery(''); setPreview(null); setFailed(false); setConfirmation(null);
    if (!preserveOutcome) { setOutcome(null); setReceiveOutcome(null); setBlockOutcome(null); }
    const context = account.current;
    const expectedShortcutRequestId = shortcutRequestId.current;
    const operationCurrent = () => {
      if (account.current !== context) return false;
      const requestId = expectedShortcutRequestId;
      if (requestId === null) return true;
      const request = comparisonRequestRef.current;
      return !!request && request.requestId === requestId && comparisonRequestCurrentRef.current(request);
    };
    let owner: WorkoutCloudComparison | null = null;
    let invalidated = false;
    setBusy(true);
    const flight = Promise.resolve().then(async () => {
      try {
        owner = createWorkoutCloudComparison(accountId, operationCurrent, () => {
          if (invalidated) return;
          invalidated = true;
          if (owner && active.current === owner && operationCurrent()) {
            const currentWrite = write.current;
            currentWrite?.cancel();
            // An in-flight INSERT may have committed. Await its actual verdict;
            // never reuse the read-only "nothing changed" error for that case.
            setResult(null); setFilterQuery(''); setPreview(null); setConfirmation(null);
            if (!preserveOutcome) { setOutcome(null); setReceiveOutcome(null); setBlockOutcome(null); }
            setBusy(false); setFailed(!currentWrite && !preserveOutcome); pending.current = false;
            if (!currentWrite && preserveOutcome) setRefreshFailed(true);
          }
        });
        active.current = owner;
        const report = await owner.compare();
        if (active.current === owner && owner.isCurrent() && operationCurrent()) setResult({ owner, report });
      } catch {
        if ((!owner || active.current === owner) && operationCurrent()) {
          if (preserveOutcome) setRefreshFailed(true);
          else setFailed(true);
        }
      } finally {
        if ((!owner || active.current === owner) && operationCurrent()) { setBusy(false); pending.current = false; }
      }
    });
    comparisonFlight.current = flight;
    const clearFlight = () => { if (comparisonFlight.current === flight) comparisonFlight.current = null; };
    void flight.then(clearFlight, clearFlight);
    return flight;
  };
  checkRef.current = check;
  useEffect(() => {
    const request = comparisonRequest;
    if (!request || !comparisonActive || request.accountId !== accountId
      || !comparisonRequestCurrentRef.current(request) || handledRequestId.current === request.requestId) return;
    let effectActive = true;
    // Defer consuming the request until the effect survives React StrictMode's
    // setup/cleanup replay. The replayed first setup is cancelled before this
    // microtask; the second setup performs the one real comparison.
    void Promise.resolve().then(() => {
      if (!effectActive || !comparisonRequestCurrentRef.current(request)
        || handledRequestId.current === request.requestId) return;
      handledRequestId.current = request.requestId;
      shortcutRequestId.current = request.requestId;
      const flight = checkRef.current?.() ?? Promise.resolve();
      void flight.then(() => {
        if (shortcutRequestId.current !== request.requestId) return;
        shortcutRequestId.current = null;
        if (comparisonRequestCurrentRef.current(request)) comparisonRequestSettledRef.current(request.requestId);
      });
    });
    return () => {
      effectActive = false;
      if (shortcutRequestId.current !== request.requestId || comparisonRequestCurrentRef.current(request)) return;
      shortcutRequestId.current = null;
      active.current?.cancel(); active.current = null;
      comparisonFlight.current = null;
      pending.current = false;
      setResult(null); setFilterQuery(''); setPreview(null); setConfirmation(null);
      setOutcome(null); setReceiveOutcome(null); setBlockOutcome(null); setRefreshFailed(false); setFailed(false); setBusy(false);
    };
  }, [accountId, comparisonActive, comparisonRequest?.accountId, comparisonRequest?.requestId]);
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
    setResult(null); setPreview(null); setBusy(false); pending.current = false;
    if (status === 'LOCAL_CREATE_CONFIRMED') {
      // Existing refresh paths re-read persisted projections; draft ownership is unchanged.
      window.dispatchEvent(new Event(HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT));
      void mutate(key => Array.isArray(key) && key[1] === accountId
        && (key[0] === 'local-health-workout-range' || key[0] === 'local' && key.length === 4));
    }
    if (confirmed) await check(true);
  };
  const report = result?.owner === active.current && result?.owner.isCurrent() ? result.report : null;
  const filteredDetails = useMemo(() => report ? filterComparisonDetails(report, filterQuery) : null, [report, filterQuery]);
  const previewRecord = useMemo(() => preview && result?.owner === preview.owner && report
    ? currentRemoteOnlyRecord(preview.owner, preview.id, report, accountId) : null, [preview, result, report, accountId]);
  const previewSets = useMemo(() => previewRecord && Array.isArray(previewRecord.sets)
    ? previewRecord.sets.slice(0, MAX_WORKOUT_PREVIEW_SETS).map(workoutPreviewFields) : [], [previewRecord]);
  const previewTotalSets = previewRecord && Array.isArray(previewRecord.sets) ? previewRecord.sets.length : 0;
  const previewHasTruncatedValues = previewSets.some(set => set.some(field => field.truncated));
  const filterActive = filterQuery.trim().length > 0;
  const filteredMatchCount = filteredDetails
    ? WORKOUT_COMPARISON_CATEGORIES.reduce((total, category) => total + filteredDetails[category].length, 0)
    : 0;
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
      <div className="space-y-1 rounded border border-border p-2">
        <label htmlFor={filterInput} className="font-semibold">{t('healthCloudFilterLabel')}</label>
        <input id={filterInput} type="search" maxLength={64} value={filterQuery} aria-describedby={filterHelp}
          onChange={event => { setPreview(null); setFilterQuery(event.currentTarget.value); }}
          className="block w-full rounded border border-border bg-surface px-2 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" />
        <p id={filterHelp} className="text-muted-foreground">{t('healthCloudFilterHelp')}</p>
        {filterActive ? <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => { setPreview(null); setFilterQuery(''); }} className="rounded border border-border px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{t('healthCloudClearFilter')}</button>
          {filteredMatchCount === 0
            ? <p role="status">{t('healthCloudFilterNoMatches')}</p>
            : <p role="status">{t('healthCloudFilterMatchCount')} <strong>{filteredMatchCount}</strong></p>}
        </div> : null}
      </div>
      <dl className="flex flex-wrap gap-3">{WORKOUT_COMPARISON_CATEGORIES.map(key => <div key={key}><dt>{t(labels[key])}</dt><dd className="font-semibold">{report.counts[key]}</dd></div>)}</dl>
      {WORKOUT_COMPARISON_CATEGORIES.filter(key => (filterActive || key !== 'matching') && (filteredDetails?.[key].length ?? 0) > 0).map(key => <details key={key} className="rounded border border-border p-2">
        <summary className="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{t(labels[key])} ({report.counts[key]})</summary>
        <ul className="mt-2 max-h-60 overflow-y-auto space-y-2">{filteredDetails![key].slice(0, 30).map(row => <li key={row.id}>
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
          {key === 'remoteOnly' ? <button type="button" disabled={busy}
            aria-expanded={!!result && preview?.owner === result.owner && preview.id === row.id && previewRecord !== null}
            aria-controls={result && preview?.owner === result.owner && preview.id === row.id && previewRecord !== null ? previewRegion : undefined}
            onClick={event => {
            const current = result;
            if (!current || current.owner !== active.current || pending.current) return;
            if (currentRemoteOnlyRecord(current.owner, row.id, current.report, accountId)) {
              previewTrigger.current = event.currentTarget;
              setPreview({ owner: current.owner, id: row.id });
            }
          }} className="mt-1 ml-2 rounded border border-border p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{t('healthCloudWorkoutPreviewAction')}</button> : null}
          {key === 'remoteOnly' ? <button type="button" disabled={busy} onClick={() => {
            if (!result?.owner.isCurrent() || pending.current) return;
            const record = result.owner.remoteOnlyRecord(row.id);
            if (record) void inspectBlock(record, result.owner);
          }} className="mt-1 ml-2 rounded border border-border p-2 focus-visible:outline">{t('healthCloudBlockCheck')}</button> : null}
        </li>)}</ul>
        {filteredDetails![key].length > 30 ? <p>{t('healthCloudPreviewLimit')}</p> : null}
      </details>)}
      {preview && previewRecord ? <section id={previewRegion} role="region" aria-labelledby={previewHeading} data-health-cloud-workout-preview className="space-y-2 rounded border border-border p-3">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h4 id={previewHeading} className="font-semibold">{t('healthCloudWorkoutPreviewTitle')}</h4>
          <button type="button" onClick={() => {
            setPreview(null);
            if (previewTrigger.current?.isConnected) previewTrigger.current.focus();
          }} className="rounded border border-border px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{t('healthCloudWorkoutPreviewClose')}</button>
        </header>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div><dt className="font-semibold">{t('healthCloudWorkoutPreviewDate')}</dt><dd><code className="break-all">{String(previewRecord.date)}</code></dd></div>
          <div><dt className="font-semibold">{t('healthCloudWorkoutPreviewId')}</dt><dd><code className="break-all">{String(previewRecord.id)}</code></dd></div>
          {typeof previewRecord.block_id === 'string' ? <div><dt className="font-semibold">{t('healthCloudWorkoutPreviewBlockId')}</dt><dd><code className="break-all">{previewRecord.block_id}</code></dd></div> : null}
        </dl>
        <h5 className="font-semibold">{t('healthCloudWorkoutPreviewSets')}</h5>
        {previewTotalSets > 0 ? <ol className="max-h-72 list-decimal space-y-2 overflow-y-auto pl-6">
          {previewSets.map((fields, index) => <li key={index} className="rounded border border-border p-2">
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
              {fields.map(field => <div key={field.key} className="min-w-0">
                <dt className="text-muted-foreground">{field.key === 'set' ? t('healthCloudWorkoutPreviewSetNumber') : field.key === 'type' ? t('healthCloudWorkoutPreviewSetType') : field.key === 'done' ? t('healthCloudWorkoutPreviewCompletion') : <code>{field.key}</code>}</dt>
                <dd className="break-all"><code>{field.value}{field.truncated ? '…' : ''}</code></dd>
              </div>)}
            </dl>
          </li>)}
        </ol> : <p>{t('healthCloudWorkoutPreviewNoSets')}</p>}
        {previewTotalSets > previewSets.length ? <p role="status">{t('healthCloudWorkoutPreviewSetLimit').replace('{shown}', String(previewSets.length)).replace('{total}', String(previewTotalSets))}</p> : null}
        {previewHasTruncatedValues ? <p role="status">{t('healthCloudWorkoutPreviewValuesTruncated')}</p> : null}
      </section> : null}
    </div> : null}
  </section>;
}
