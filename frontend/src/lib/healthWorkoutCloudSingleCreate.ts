import { supabase } from './supabase';
import { createLocalHealthDriver, type HealthWorkoutAdoptionCapture } from './healthLocalRepository';
import { createWorkoutCloudComparison, supportedWorkoutContent, workoutRowsFromCapture } from './healthWorkoutCloudComparison';
import { assistedRepsMatchExerciseType } from './healthAssistedReps';
import { HEALTH_RECOVERY_DATASETS, validateHealthRecoveryDatasets, type HealthRecoveryDatasets, type HealthRecoveryRecord } from './healthRecoveryExport';
import { stableRecoveryJson } from './recoveryExportPackage';

export type WorkoutCreateStatus = 'DENIED' | 'REMOTE_INSERT_CONFIRMED' | 'CONFLICT' | 'INDETERMINATE';
// A timed-out POST may have committed. Never retry it, even from a second UI owner.
const uncertain = new Set<string>();
const inFlight = new Set<string>();
const REQUEST_DEADLINE_MS = 15_000;

/** Explicit, one-row Data API boundary. No SDK/fetcher retry or legacy POST. */
export function createWorkoutCloudSingleCreate(accountId: string, intended: HealthRecoveryRecord, accountCurrent: () => boolean) {
  const row = structuredClone(intended);
  const content = supportedWorkoutContent(row, accountId);
  const key = `${accountId}:${row.id}`;
  let live = true, dispatched = false;
  const controller = new AbortController();
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION' && session?.user.id === accountId) return;
    live = false; controller.abort();
  });
  const isCurrent = () => live && !controller.signal.aborted && accountCurrent();
  const assertCurrent = () => { if (!isCurrent()) throw new Error('workout_transfer_stale'); };
  const cancel = () => { live = false; controller.abort(); subscription.unsubscribe(); };
  let attempt: Promise<WorkoutCreateStatus> | undefined;
  const run = async (): Promise<WorkoutCreateStatus> => {
    if (!content || inFlight.has(key) || uncertain.has(key)) { cancel(); return 'DENIED'; }
    inFlight.add(key);
    const comparison = createWorkoutCloudComparison(accountId, isCurrent, () => { live = false; controller.abort(); });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      assertCurrent();
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'DENIED';
      const first = await supabase.auth.getSession(); assertCurrent();
      const session = first.data.session;
      if (first.error || !session?.access_token || session.user.id !== accountId || !session.expires_at
        || session.expires_at * 1000 <= Date.now()) return 'DENIED';
      const token = session.access_token;
      let authorityExpiresAt = session.expires_at * 1000;
      const user = await supabase.auth.getUser(token); assertCurrent();
      if (user.error || user.data.user?.id !== accountId) return 'DENIED';
      const checkSession = async () => {
        const current = await supabase.auth.getSession(); assertCurrent();
        if (current.error || current.data.session?.access_token !== token || current.data.session.user.id !== accountId
          || !current.data.session.expires_at || current.data.session.expires_at * 1000 <= Date.now()) throw new Error('workout_transfer_auth');
        authorityExpiresAt = Math.min(authorityExpiresAt, current.data.session.expires_at * 1000);
      };
      const report = await comparison.compare(); assertCurrent();
      if (report.details.matching.some(item => item.id === row.id) || report.details.divergent.some(item => item.id === row.id)) return 'CONFLICT';
      const fresh = comparison.localOnlyRecord(String(row.id));
      if (!fresh || supportedWorkoutContent(fresh, accountId) !== content) return 'DENIED';
      await checkSession();
      const base = new URL(import.meta.env.VITE_SUPABASE_URL);
      if (base.protocol !== 'https:' || base.pathname !== '/' || base.search || base.hash || base.username || base.password) return 'DENIED';
      const headers = { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      const url = (table: 'workout_logs' | 'exercise_blocks', id: string) => {
        const result = new URL(`/rest/v1/${table}`, base);
        result.search = new URLSearchParams({ select: '*', id: `eq.${id}`, user_id: `eq.${accountId}`, limit: '2' }).toString();
        return result;
      };
      const read = async (table: 'workout_logs' | 'exercise_blocks', id: string): Promise<HealthRecoveryRecord | null> => {
        assertCurrent();
        const response = await fetch(url(table, id), { method: 'GET', headers, signal: controller.signal, credentials: 'omit', redirect: 'error' });
        assertCurrent();
        if (!response.ok) throw new Error('workout_transfer_read');
        const data = await response.json(); assertCurrent();
        return Array.isArray(data) && data.length === 1 && data[0]?.id === id && data[0]?.user_id === accountId ? data[0] : null;
      };
      timeout = setTimeout(() => controller.abort(), REQUEST_DEADLINE_MS);
      const block = await read('exercise_blocks', String(row.block_id));
      const blockContent = (value: HealthRecoveryRecord | null) => {
        if (!value || Object.keys(value).some(key => !['id', 'user_id', 'name', 'type', 'tags', 'cardio_mode'].includes(key))) return null;
        const datasets = Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(key => [key, key === 'exercise_blocks' ? [value] : []])) as HealthRecoveryDatasets;
        return validateHealthRecoveryDatasets(datasets, accountId).length ? null : stableRecoveryJson(value);
      };
      const expectedBlock = blockContent(block);
      if (!block || !expectedBlock || !['strength', 'bodyweight', 'cardio'].includes(String(block.type))
        || !assistedRepsMatchExerciseType(block.type, row.sets as unknown[])) return 'DENIED';
      await checkSession();
      const driver = await createLocalHealthDriver({ existingOnly: true });
      const validateSource = (capture: HealthWorkoutAdoptionCapture) => {
        const current = workoutRowsFromCapture(accountId, capture).find(item => item.id === row.id);
        const localBlocks = capture.exerciseBlocks.filter(item => item.record.id === row.block_id);
        const localBlock = localBlocks[0];
        if (!current || supportedWorkoutContent(current, accountId) !== content || !localBlock
          || localBlocks.length !== 1
          || localBlock.accountId !== accountId || localBlock.record.user_id !== accountId
          || localBlock.storageKey !== `${accountId}:exercise_blocks:${row.block_id}`
          || blockContent(localBlock.record) !== expectedBlock) throw new Error('workout_transfer_source');
      };
      try {
        let request: Promise<{ response?: Response; error?: unknown }> | undefined;
        await driver.captureWorkoutAdoptionSource(accountId, capture => {
          validateSource(capture); assertCurrent();
          if (session.expires_at! * 1000 <= Date.now() || controller.signal.aborted) throw new Error('workout_transfer_expired');
          // Still inside the verified readonly IDB snapshot: dispatch before
          // another tab can mutate the source. No await, no local write.
          dispatched = true;
          request = fetch(new URL('/rest/v1/workout_logs', base), {
            method: 'POST', headers: { ...headers, Prefer: 'return=minimal' },
            body: JSON.stringify(row), signal: controller.signal, credentials: 'omit', redirect: 'error',
          }).then(response => ({ response }), error => ({ error }));
        });
        const result = await request;
        assertCurrent();
        if (!result?.response) return 'INDETERMINATE';
        if (!result.response.ok) {
          const error = await result.response.json().catch(() => null); assertCurrent();
          if (error?.code === '23505') return 'CONFLICT';
          if (['42501', '23503', '23502', '22P02', '23514'].includes(error?.code)) return 'DENIED';
          return 'INDETERMINATE';
        }
        await checkSession();
        const remote = await read('workout_logs', String(row.id));
        if (!remote || supportedWorkoutContent(remote, accountId) !== content) return 'INDETERMINATE';
        if (blockContent(await read('exercise_blocks', String(row.block_id))) !== expectedBlock) return 'INDETERMINATE';
        await checkSession();
        validateSource(await driver.captureWorkoutAdoptionSource(accountId));
        // Capture is the last async step. An additional auth await here would
        // reopen a competing-writer gap after validating the source.
        assertCurrent();
        if (authorityExpiresAt <= Date.now()) throw new Error('workout_transfer_expired');
        return 'REMOTE_INSERT_CONFIRMED';
      } finally { driver.close(); }
    } catch { return dispatched ? 'INDETERMINATE' : 'DENIED'; }
    finally {
      // Persist the uncertainty fence in memory; only a page reload clears it.
      // No local record or comparison report is persisted by this boundary.
      if (dispatched && controller.signal.aborted) uncertain.add(key);
      clearTimeout(timeout); comparison.cancel(); cancel(); inFlight.delete(key);
    }
  };
  const transfer = () => attempt ??= run().then(status => { if (status === 'INDETERMINATE') uncertain.add(key); return status; });
  return { transfer, cancel };
}
export type WorkoutCloudSingleCreate = ReturnType<typeof createWorkoutCloudSingleCreate>;
