import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from '../../../../lib/i18n';
import { normalizeWorkoutCardioMode, type WorkoutExerciseSnapshotV1 } from '../../../../lib/workoutSessionV1';
import { WorkspaceToolbarPrimary } from '../../../common/WorkspaceToolbar';
import type { ExerciseBlock } from '../../../../types';
import type { CanonicalWorkoutDraftResume } from './canonicalWorkoutDraft';
import { openHealthCanonicalLocalSave } from './healthCanonicalLocalSave';
import {
  createWorkoutEditorBodyweightSet, createWorkoutEditorCardioSet, createWorkoutEditorEntry,
  createWorkoutEditorStrengthSet, createWorkoutSessionEditor, type WorkoutEditorEntry,
  type WorkoutSessionEditor,
} from './workoutSessionEditorAdapter';

type Context = Awaited<ReturnType<typeof openHealthCanonicalLocalSave>>;

function exerciseSnapshot(block: ExerciseBlock): WorkoutExerciseSnapshotV1 {
  const { id, name, type, tags = [], cardio_mode } = block;
  if (type !== 'strength' && type !== 'bodyweight' && type !== 'cardio') throw new Error('UNSUPPORTED_CANONICAL_EXERCISE');
  return { id, name, type, tags, cardioMode: normalizeWorkoutCardioMode(type, cardio_mode) };
}

/** A separate new-record editor within Workout; it never imports editable legacy rows. */
export function HealthCanonicalWorkoutPanel({ accountId, date, blocks, captureCurrent }: {
  accountId: string;
  date: string;
  blocks: readonly ExerciseBlock[];
  captureCurrent: () => (() => boolean) | null;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<CanonicalWorkoutDraftResume | null>(null);
  const [error, setError] = useState(false);
  const [setEntry, setSetEntry] = useState<string | null>(null);
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
  useLayoutEffect(() => close, []);

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
      const next = await openHealthCanonicalLocalSave(accountId, date, () => lifetime.current === panel && isCurrent());
      if (!current() || !next.isCurrent()) { next.close(); return; }
      context.current = next;
      const revoke = () => {
        close(); setState({ kind: 'unavailable' }); setBusy(false); setSetEntry(null);
      };
      next.signal.addEventListener('abort', revoke, { once: true });
      detachAbort.current = () => next.signal.removeEventListener('abort', revoke);
      const restored = await next.resume();
      if (!current() || !next.isCurrent()) return;
      if (restored.kind === 'missing') {
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
      const ordinal = entry.sets.length + 1;
      const done = fields.has('done');
      const { type } = entry.exerciseSnapshot;
      const reps = { repsInput: text('reps'), assistedRepsInput: text('assisted'), dropset: fields.has('dropset'), done };
      const weightUnit = text('unit') === 'lbs' ? 'lbs' : 'kg';
      const set = type === 'cardio'
        ? createWorkoutEditorCardioSet({ durationInput: text('duration'), distanceKilometersInput: text('distance'), done }, ordinal)
        : type === 'strength'
          ? createWorkoutEditorStrengthSet({ ...reps, weightInput: text('weight'), weightUnit }, ordinal)
          : createWorkoutEditorBodyweightSet(reps, ordinal);
      return { ...editor, entries: editor.entries.map(value =>
        value.entryId === entry.entryId ? { ...value, sets: [...value.sets, set] } : value) };
    }, () => setSetEntry(null));
  }

  function save() {
    const next = context.current;
    if (!next || !next.isCurrent() || state?.kind !== 'editing' || setEntry) return;
    void run(async current => {
      let result: CanonicalWorkoutDraftResume;
      try { result = await next.save(state.token); }
      catch {
        result = await next.resume();
        if (current() && next.isCurrent() && result.kind === 'editing') setError(true);
      }
      if (current() && next.isCurrent()) setState(result);
    });
  }

  if (!open) return <button type="button" data-health-canonical-open onClick={enter}
    className="min-h-10 rounded-lg border px-3 py-2 text-sm font-bold">{t('healthCanonicalNewLocal')}</button>;

  const editor = state && 'editor' in state ? state.editor : null;
  const editing = state?.kind === 'editing' && state.editor.expectedLocalRevision === null;
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
      close(); setOpen(false); setState(null); setSetEntry(null);
    }}>{t('close')}</button>
    {status && <p role="status">{t(status)}</p>}
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
        </li>)}</ol>
        {editing && setEntry === entry.entryId ? <form onSubmit={event => addSet(event, entry, editor)}>
          {entry.exerciseSnapshot.type === 'cardio' ? <>
            {entry.exerciseSnapshot.cardioMode !== 'distance' && (
              <label>{t('previousTime')} (hh:mm:ss) <input name="duration" /></label>
            )}
            {entry.exerciseSnapshot.cardioMode !== 'time' && (
              <label>{t('previousDistance')} (km) <input name="distance" inputMode="decimal" /></label>
            )}
          </> : <>
            {entry.exerciseSnapshot.type === 'strength' && <>
              <label>{t('healthCanonicalWeight')} <input name="weight" inputMode="decimal" /></label>
              <select name="unit" aria-label="kg / lbs"><option value="kg">kg</option><option value="lbs">lbs</option></select>
            </>}
            <label>{t('previousReps')} <input name="reps" inputMode="numeric" /></label>
            <label>{t('healthAssistedReps')} <input name="assisted" inputMode="numeric" /></label>
            <label><input name="dropset" type="checkbox" /> {t('dropSet')}</label>
          </>}
          <label><input name="done" type="checkbox" /> {t('healthCanonicalSetDone')}</label>
          <button type="submit">{t('addSet')}</button>
          <button type="button" onClick={() => { setSetEntry(null); setError(false); }}>{t('cancel')}</button>
        </form> : editing && <button type="button" disabled={!!setEntry} onClick={() => setSetEntry(entry.entryId)}>{t('addSet')}</button>}
      </li>)}</ol>}
      {editing && <WorkspaceToolbarPrimary dataHook="data-health-canonical-save" label={t('healthCanonicalSaveLocal')}
        onClick={save} disabled={!!setEntry || !editor?.entries.length || editor.entries.some(entry => entry.sets.length === 0)} />}
    </fieldset>
  </section>;
}
