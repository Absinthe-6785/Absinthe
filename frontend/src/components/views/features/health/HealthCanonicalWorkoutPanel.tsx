import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from '../../../../lib/i18n';
import { normalizeWorkoutCardioMode, type WorkoutExerciseSnapshotV1 } from '../../../../lib/workoutSessionV1';
import { WorkspaceToolbarPrimary } from '../../../common/WorkspaceToolbar';
import type { ExerciseBlock } from '../../../../types';
import type { CanonicalWorkoutDraftResume } from './canonicalWorkoutDraft';
import type { OpenHealthCanonicalWorkerProduct } from './healthCanonicalWorkerProduct';
import type { ActiveCanonicalWorkoutReadInput } from './compositeWorkoutReadProjection';
import { openHealthCanonicalLocalSave } from './healthCanonicalLocalSave';
import {
  createWorkoutEditorBodyweightSet, createWorkoutEditorCardioSet, createWorkoutEditorEntry,
  createWorkoutEditorStrengthSet, createWorkoutSessionEditor, editWorkoutEditorBodyweightSet, editWorkoutEditorStrengthSet,
  type WorkoutEditorEntry, type WorkoutEditorSet,
  type WorkoutSessionEditor,
} from './workoutSessionEditorAdapter';

type Context = Awaited<ReturnType<typeof openHealthCanonicalLocalSave | OpenHealthCanonicalWorkerProduct>>;

function exerciseSnapshot(block: ExerciseBlock): WorkoutExerciseSnapshotV1 {
  const { id, name, type, tags = [], cardio_mode } = block;
  if (type !== 'strength' && type !== 'bodyweight' && type !== 'cardio') throw new Error('UNSUPPORTED_CANONICAL_EXERCISE');
  return { id, name, type, tags, cardioMode: normalizeWorkoutCardioMode(type, cardio_mode) };
}

/** A separate new-record editor within Workout; it never imports editable legacy rows. */
export function HealthCanonicalWorkoutPanel({ accountId, date, blocks, captureCurrent, openWorkerProduct }: {
  accountId: string;
  date: string;
  blocks: readonly ExerciseBlock[];
  captureCurrent: () => (() => boolean) | null;
  openWorkerProduct?: OpenHealthCanonicalWorkerProduct;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<CanonicalWorkoutDraftResume | null>(null);
  const [error, setError] = useState(false);
  const [setEntry, setSetEntry] = useState<{ entryId: string; set?: WorkoutEditorSet } | null>(null);
  const [dayRows, setDayRows] = useState<readonly ActiveCanonicalWorkoutReadInput[]>([]);
  const [syncIssue, setSyncIssue] = useState<'conflict' | 'uncertain' | 'unavailable' | null>(null);
  const context = useRef<Context | null>(null);
  const detachAbort = useRef<(() => void) | null>(null);
  const lifetime = useRef<object | null>(null);
  const flight = useRef<object | null>(null);

  function close() {
    lifetime.current = null;
    flight.current = null;
    detachAbort.current?.();
    detachAbort.current = null;
    context.current?.close();
    context.current = null;
  }
  useLayoutEffect(() => {
    // Same account and date can still be a different isolated device. Revoke
    // the previous mounted writer before this opener can expose any controls.
    setOpen(false); setState(null); setBusy(false); setSetEntry(null);
    setDayRows([]); setError(false); setSyncIssue(null);
    return close;
  }, [openWorkerProduct]);

  async function run(work: (current: () => boolean) => Promise<void>) {
    if (flight.current) return;
    const token = {};
    flight.current = token;
    const current = () => flight.current === token;
    setBusy(true);
    setError(false);
    try { await work(current); }
    catch { if (current()) setError(true); }
    finally { if (current()) { flight.current = null; setBusy(false); } }
  }

  function enter() {
    const isCurrent = captureCurrent();
    if (!isCurrent || lifetime.current) return;
    const panel = {};
    lifetime.current = panel;
    setOpen(true);
    void run(async current => {
      const next = await (openWorkerProduct ?? openHealthCanonicalLocalSave)(accountId, date, () => lifetime.current === panel && isCurrent());
      if (!current() || !next.isCurrent()) { next.close(); return; }
      context.current = next;
      const revoke = () => {
        close(); setState({ kind: 'unavailable' }); setBusy(false); setSetEntry(null); setDayRows([]); setSyncIssue(null);
      };
      next.signal.addEventListener('abort', revoke, { once: true });
      detachAbort.current = () => next.signal.removeEventListener('abort', revoke);
      const restored = await next.resume();
      if (!current() || !next.isCurrent()) return;
      if ('readDay' in next) {
        const rows = await next.readDay();
        if (current() && next.isCurrent()) { setState(restored); setDayRows(rows); }
      } else if (restored.kind === 'missing') {
        const editing = await next.saveEditor(createWorkoutSessionEditor(date), null);
        if (current() && next.isCurrent()) setState({ kind: 'editing', ...editing });
      } else setState(restored);
    });
  }

  async function writeEditor(makeEditor: () => WorkoutSessionEditor, onEdit?: () => void) {
    const next = context.current;
    if (!next || !next.isCurrent() || state?.kind !== 'editing') return;
    await run(async current => {
      const edited = await next.saveEditor(makeEditor(), state.token);
      if (current() && next.isCurrent()) { setState({ kind: 'editing', ...edited }); onEdit?.(); }
    });
  }

  function addSet(event: FormEvent<HTMLFormElement>, entry: WorkoutEditorEntry, editor: WorkoutSessionEditor) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const text = (name: string) => String(fields.get(name) ?? '');
    void writeEditor(() => {
      const prior = setEntry?.set;
      const ordinal = prior?.ordinal ?? entry.sets.length + 1;
      const done = fields.has('done');
      const { type } = entry.exerciseSnapshot;
      const reps = { repsInput: text('reps'), assistedRepsInput: text('assisted'), dropset: fields.has('dropset'), done };
      const weightUnit: 'lbs' | 'kg' = text('unit') === 'lbs' ? 'lbs' : 'kg';
      const strength = { ...reps, weightInput: text('weight'), weightUnit };
      const set = prior?.kind === 'strength' ? editWorkoutEditorStrengthSet(prior, strength)
        : prior?.kind === 'bodyweight' ? editWorkoutEditorBodyweightSet(prior, reps)
        : type === 'cardio'
        ? createWorkoutEditorCardioSet({ durationInput: text('duration'), distanceKilometersInput: text('distance'), done }, ordinal)
        : type === 'strength'
          ? createWorkoutEditorStrengthSet(strength, ordinal)
          : createWorkoutEditorBodyweightSet(reps, ordinal);
      return { ...editor, entries: editor.entries.map(value =>
        value.entryId === entry.entryId ? { ...value, sets: prior
          ? value.sets.map(item => item.setId === prior.setId ? set : item) : [...value.sets, set] } : value) };
    }, () => setSetEntry(null));
  }

  function save() {
    const next = context.current;
    if (!next || !next.isCurrent() || state?.kind !== 'editing' || setEntry) return;
    void run(async current => {
      let result: CanonicalWorkoutDraftResume;
      try { result = 'synchronize' in next ? await next.save(state.token, state.editor.expectedLocalRevision !== null)
        : await next.save(state.token); }
      catch {
        result = await next.resume();
        if (current() && next.isCurrent() && result.kind === 'editing') setError(true);
      }
      if (current() && next.isCurrent()) {
        setState(result);
        setSyncIssue(null);
        if ('readDay' in next && result.kind === 'committed_locally') {
          const rows = await next.readDay(result.submission.entityId);
          if (current() && next.isCurrent()) {
            setDayRows(previous => [
              ...previous.filter(row => row.entityId !== result.submission.entityId), ...rows,
            ].sort((left, right) => left.entityId.localeCompare(right.entityId)));
          }
        }
      }
    });
  }

  function startOrReopen(row?: ActiveCanonicalWorkoutReadInput) {
    const next = context.current;
    if (!next || !('reopen' in next) || !next.isCurrent() || !state) return;
    void run(async current => {
      const snapshot = row
        ? await next.reopen(row.entityId, row.localRevision, 'token' in state ? state.token : null)
        : await next.saveEditor(createWorkoutSessionEditor(date), null);
      if (current() && next.isCurrent()) { setState({ kind: 'editing', ...snapshot }); setSyncIssue(null); }
    });
  }

  function synchronize() {
    const next = context.current;
    if (!next || !('synchronize' in next) || !next.isCurrent() || !state) return;
    const token = 'token' in state ? state.token : null;
    const sameDraft = (value: CanonicalWorkoutDraftResume) => value.kind !== 'unavailable'
      && ('token' in value ? value.token : null) === token;
    void run(async current => {
      try {
        const result = await next.synchronize(token);
        if (current() && next.isCurrent()) {
          if (sameDraft(result.state)) setState(result.state);
          if (result.rows) setDayRows(result.rows);
          setSyncIssue(sameDraft(result.state) ? result.issue : 'unavailable');
        }
      } catch {
        if (!current() || !next.isCurrent()) return;
        // A pull/discovery error must not hide an already durable receipt or draft.
        const restored = await next.resume();
        if (!current() || !next.isCurrent()) return;
        if (sameDraft(restored)) setState(restored);
        setSyncIssue('unavailable');
      }
    });
  }

  if (!open) return <button type="button" data-health-canonical-open onClick={enter}
    className="min-h-10 rounded-lg border px-3 py-2 text-sm font-bold">{openWorkerProduct ? 'Canonical workout (isolated QA)' : t('healthCanonicalNewLocal')}</button>;

  const editor = state && 'editor' in state ? state.editor : null;
  const editing = state?.kind === 'editing' && (state.editor.expectedLocalRevision === null || !!openWorkerProduct);
  const counts = new Map<string, number>();
  for (const block of blocks) counts.set(block.id, (counts.get(block.id) ?? 0) + 1);
  const available = blocks.filter(block => {
    try { exerciseSnapshot(block); } catch { return false; }
    return !editor?.entries.some(entry => entry.exerciseSnapshot.id === block.id)
      && counts.get(block.id) === 1;
  });
  const status = state?.kind === 'committed_locally' ? 'healthCanonicalLocalCommitted'
    : state?.kind === 'uncertain' ? 'healthCanonicalLocalUncertain'
      : error || state?.kind === 'unavailable' || (!editing && state?.kind === 'editing') ? 'failedSave'
        : busy ? 'loading' : null;
  return <section aria-label={t('healthCanonicalNewLocal')} data-health-canonical-draft
    className="space-y-2 border-b p-2 xl:max-h-[50dvh] xl:overflow-auto">
    <button type="button" disabled={busy} onClick={() => {
      close(); setOpen(false); setState(null); setSetEntry(null); setDayRows([]); setSyncIssue(null); setBusy(false); setError(false);
    }}>{t('close')}</button>
    {status && <p role="status">{t(status)}</p>}
    {openWorkerProduct && <>
      {editing && <p role="status" data-health-canonical-state="draft">Unsaved draft</p>}
      {state?.kind === 'committed_locally' && <p role="status" data-health-canonical-state={state.delivery.kind}>
        {state.delivery.kind === 'acknowledged' ? `Remote acknowledgement confirmed (revision ${state.delivery.serverRevision}).`
          : state.delivery.kind === 'conflict' ? 'Synchronization conflict. Local workout preserved.'
            : state.delivery.kind === 'uncertain' ? 'Synchronization completion uncertain.' : 'Locally saved; synchronization pending.'}
      </p>}
      {syncIssue && <p role="status" data-health-canonical-sync-issue={syncIssue}>
        {syncIssue === 'unavailable' ? 'Synchronization unavailable. Local work preserved.'
          : syncIssue === 'conflict' ? 'Synchronization conflict. Local work preserved.' : 'Synchronization completion uncertain.'}
      </p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="min-h-10 px-2" data-health-canonical-sync
          disabled={busy || !state || state.kind === 'unavailable' || state.kind === 'uncertain'} onClick={synchronize}>Sync workouts</button>
        {state?.kind === 'missing' && dayRows.length === 0 && <button type="button" className="min-h-10 px-2"
          data-health-canonical-new disabled={busy} onClick={() => startOrReopen()}>New workout</button>}
      </div>
      <ul>{dayRows.map(row => <li key={row.entityId} data-health-canonical-session={row.entityId} className="break-words">
        <span>{row.entityId}</span>
        <ul>{row.session.entries.map(entry => <li key={entry.id}>{entry.exercise.name}
          <ol>{entry.sets.map(set => <li key={set.id}>{set.ordinal}. {set.kind === 'strength'
            ? [set.sourceValue, set.sourceUnit, set.reps === null ? null : `${t('previousReps')}: ${set.reps}`].filter(value => value !== null).join(' ')
            : set.kind === 'bodyweight' ? (set.reps === null ? '' : `${t('previousReps')}: ${set.reps}`)
              : [set.durationSeconds === null ? null : `${set.durationSeconds} s`, set.distanceMeters === null ? null : `${set.distanceMeters} m`].filter(Boolean).join(' / ')}</li>)}</ol>
        </li>)}</ul>
        {(state?.kind === 'missing' || state?.kind === 'committed_locally' && state.delivery.kind === 'acknowledged'
          && state.submission.entityId === row.entityId) && <button type="button" className="min-h-10 px-2"
            data-health-canonical-reopen disabled={busy} onClick={() => startOrReopen(row)}>Edit workout</button>}
      </li>)}</ul>
    </>}
    <fieldset disabled={busy || !editing} className="space-y-2">
      {editing && <form onSubmit={event => {
        event.preventDefault();
        const id = new FormData(event.currentTarget).get('exercise');
        const block = available.find(value => value.id === id);
        if (!block || !editor) return;
        void writeEditor(() => ({ ...editor, entries: [...editor.entries, createWorkoutEditorEntry(exerciseSnapshot(block))] }));
      }}>
        <label>{t('addExercise')} <select name="exercise" defaultValue="" required>
          <option value="" disabled>—</option>
          {available.map(block => <option key={block.id} value={block.id}>{block.name}</option>)}
        </select></label>
        <button type="submit" disabled={!!setEntry || available.length === 0}>{t('addExercise')}</button>
      </form>}
      {editor && <ol>{editor.entries.map(entry => <li key={entry.entryId} className="space-y-1">
        <h3>{entry.exerciseSnapshot.name}</h3>
        <ol>{entry.sets.map(set => <li key={set.setId}>
          {set.ordinal}. {set.kind === 'cardio'
            ? [set.durationSeconds !== null && `${set.durationSeconds} s`, set.distanceMeters !== null && `${set.distanceMeters} m`].filter(Boolean).join(' / ')
            : [set.kind === 'strength' && set.sourceValue !== null && `${set.sourceValue} ${set.sourceUnit}`,
              set.reps !== null && `${t('previousReps')}: ${set.reps}`,
              set.assistedReps !== null && `${t('healthAssistedReps')}: ${set.assistedReps}`,
              set.dropset && t('dropSet')].filter(Boolean).join(' / ')}
          {set.done && ' ✓'}
          {openWorkerProduct && editing && set.kind !== 'cardio' && <button type="button"
            className="min-h-10 px-2" data-health-canonical-edit-set disabled={!!setEntry}
            onClick={() => setSetEntry({ entryId: entry.entryId, set })}>Edit set {set.ordinal}</button>}
        </li>)}</ol>
        {editing && setEntry?.entryId === entry.entryId ? <form onSubmit={event => addSet(event, entry, editor)}>
          {entry.exerciseSnapshot.type === 'cardio' ? <>
            {entry.exerciseSnapshot.cardioMode !== 'distance' && (
              <label>{t('previousTime')} (hh:mm:ss) <input name="duration" /></label>
            )}
            {entry.exerciseSnapshot.cardioMode !== 'time' && (
              <label>{t('previousDistance')} (km) <input name="distance" inputMode="decimal" /></label>
            )}
          </> : <>
            {entry.exerciseSnapshot.type === 'strength' && <>
              <label>{t('healthCanonicalWeight')} <input name="weight" inputMode="decimal"
                defaultValue={setEntry.set?.kind === 'strength' ? setEntry.set.sourceValue ?? '' : ''} /></label>
              <select name="unit" aria-label="kg / lbs" defaultValue={setEntry.set?.kind === 'strength' ? setEntry.set.sourceUnit ?? 'kg' : 'kg'}>
                <option value="kg">kg</option><option value="lbs">lbs</option></select>
            </>}
            <label>{t('previousReps')} <input name="reps" inputMode="numeric" defaultValue={setEntry.set && setEntry.set.kind !== 'cardio' ? setEntry.set.reps ?? '' : ''} /></label>
            <label>{t('healthAssistedReps')} <input name="assisted" inputMode="numeric" defaultValue={setEntry.set && setEntry.set.kind !== 'cardio' ? setEntry.set.assistedReps ?? '' : ''} /></label>
            <label><input name="dropset" type="checkbox" defaultChecked={setEntry.set?.kind !== 'cardio' && setEntry.set?.dropset} /> {t('dropSet')}</label>
          </>}
          <label><input name="done" type="checkbox" defaultChecked={setEntry.set?.done} /> {t('healthCanonicalSetDone')}</label>
          <button type="submit">{setEntry.set ? 'Apply set changes' : t('addSet')}</button>
          <button type="button" onClick={() => { setSetEntry(null); setError(false); }}>{t('cancel')}</button>
        </form> : editing && <button type="button" data-health-canonical-add-set disabled={!!setEntry} onClick={() => setSetEntry({ entryId: entry.entryId })}>{t('addSet')}</button>}
      </li>)}</ol>}
      {editing && <WorkspaceToolbarPrimary dataHook="data-health-canonical-save" label={t('healthCanonicalSaveLocal')}
        onClick={save} disabled={!!setEntry || !editor?.entries.length || editor.entries.some(entry => entry.sets.length === 0)} />}
    </fieldset>
  </section>;
}
