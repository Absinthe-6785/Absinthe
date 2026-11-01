import { supabase } from './supabase';
import { createLocalHealthDriver, type LocalWorkoutReceiveInput } from './healthLocalRepository';
import { createWorkoutCloudComparison } from './healthWorkoutCloudComparison';
import { supportedWorkoutContent, supportedExerciseBlockContent } from './healthWorkoutCloudContent';
import type { HealthRecoveryRecord } from './healthRecoveryExport';
import { beginLegacyWorkoutMutation } from '../components/views/features/health/legacyWorkoutMutationCoverage';

export type WorkoutReceiveStatus = 'DENIED' | 'LOCAL_CREATE_CONFIRMED' | 'CONFLICT' | 'INDETERMINATE';
const inFlight = new Set<string>(), uncertain = new Set<string>();

/** Explicit one-row receive. Every remote request is read-only; IDB alone owns atomic admission. */
export function createWorkoutCloudSingleReceive(accountId: string, intended: HealthRecoveryRecord, accountCurrent: () => boolean) {
  const row = structuredClone(intended), content = supportedWorkoutContent(row, accountId);
  const key = `${accountId}:${row.id}`;
  let live = true, attempted = false, expiresAt = 0;
  const controller = new AbortController();
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION' && session?.user.id === accountId) return;
    live = false; controller.abort();
  });
  const current = () => live && !controller.signal.aborted && accountCurrent();
  const writable = () => current() && expiresAt > Date.now();
  const assertCurrent = () => { if (!current()) throw new Error('health_receive_stale'); };
  const cancel = () => { live = false; controller.abort(); subscription.unsubscribe(); };
  let attempt: Promise<WorkoutReceiveStatus> | undefined;
  const run = async (): Promise<WorkoutReceiveStatus> => {
    if (!content || inFlight.has(key) || uncertain.has(key)) { cancel(); return 'DENIED'; }
    inFlight.add(key);
    const comparison = createWorkoutCloudComparison(accountId, current, () => { live = false; controller.abort(); });
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      assertCurrent();
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'DENIED';
      const first = await supabase.auth.getSession(); assertCurrent();
      const session = first.data.session;
      if (first.error || session?.user.id !== accountId || !session.access_token || !session.expires_at
        || session.expires_at * 1000 <= Date.now()) return 'DENIED';
      const token = session.access_token;
      expiresAt = session.expires_at * 1000;
      const user = await supabase.auth.getUser(token); assertCurrent();
      if (user.error || user.data.user?.id !== accountId) return 'DENIED';
      const checkSession = async () => {
        const result = await supabase.auth.getSession(); assertCurrent();
        const value = result.data.session;
        if (result.error || value?.user.id !== accountId || value.access_token !== token || !value.expires_at) throw new Error('health_receive_auth');
        expiresAt = Math.min(expiresAt, value.expires_at * 1000);
        if (!writable()) throw new Error('health_receive_expired');
      };
      const report = await comparison.compare(); assertCurrent();
      if ((['localOnly', 'matching', 'divergent'] as const).some(category => report.details[category].some(item => item.id === row.id))) return 'CONFLICT';
      const fresh = comparison.remoteOnlyRecord(String(row.id));
      const comparedAuthority = comparison.localAuthority();
      if (!fresh || !comparedAuthority || supportedWorkoutContent(fresh, accountId) !== content) return 'DENIED';
      const base = new URL(import.meta.env.VITE_SUPABASE_URL);
      if (base.protocol !== 'https:' || base.pathname !== '/' || base.search || base.hash || base.username || base.password) return 'DENIED';
      const headers = { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };
      const read = async (table: 'workout_logs' | 'exercise_blocks', id: string): Promise<HealthRecoveryRecord | null> => {
        assertCurrent();
        const url = new URL(`/rest/v1/${table}`, base);
        url.search = new URLSearchParams({ select: '*', id: `eq.${id}`, user_id: `eq.${accountId}`, limit: '2' }).toString();
        const response = await fetch(url, { method: 'GET', headers, signal: controller.signal, credentials: 'omit', redirect: 'error' });
        assertCurrent();
        if (!response.ok) throw new Error('health_receive_remote_read');
        const values = await response.json(); assertCurrent();
        return Array.isArray(values) && values.length === 1 && values[0]?.id === id && values[0]?.user_id === accountId ? values[0] : null;
      };
      deadline = setTimeout(() => controller.abort(), 15_000);
      const block = await read('exercise_blocks', String(row.block_id));
      const blockContent = supportedExerciseBlockContent(block, accountId);
      if (!block || !blockContent || supportedWorkoutContent(await read('workout_logs', String(row.id)) ?? {}, accountId) !== content) return 'DENIED';
      await checkSession();
      const driver = await createLocalHealthDriver({ existingOnly: true });
      try {
        assertCurrent();
        // Bind to the authority used by the complete comparison, never adopt a later episode.
        const input: LocalWorkoutReceiveInput = { accountId, record: row, exerciseBlock: block,
          expectedImportState: comparedAuthority, isCurrent: writable, signal: controller.signal };
        if (supportedWorkoutContent(await read('workout_logs', String(row.id)) ?? {}, accountId) !== content
          || supportedExerciseBlockContent(await read('exercise_blocks', String(row.block_id)), accountId) !== blockContent) return 'DENIED';
        await checkSession();
        const finish = beginLegacyWorkoutMutation(accountId, [{ date: String(row.date), blockId: String(row.block_id) }]);
        try {
          attempted = true;
          const result = await driver.createReceivedWorkout(input);
          if (result.status !== 'CREATED') return result.status;
          // Remote and local databases cannot share a transaction. Changed source after commit
          // is uncertainty, never permission to roll back/delete the received local row.
          if (supportedWorkoutContent(await read('workout_logs', String(row.id)) ?? {}, accountId) !== content
            || supportedExerciseBlockContent(await read('exercise_blocks', String(row.block_id)), accountId) !== blockContent) return 'INDETERMINATE';
          await checkSession();
          await driver.verifyReceivedWorkout(input, result.state); // last async boundary
          if (!writable()) return 'INDETERMINATE';
          return 'LOCAL_CREATE_CONFIRMED';
        } finally { finish(); }
      } finally { driver.close(); }
    } catch { return attempted ? 'INDETERMINATE' : 'DENIED'; }
    finally { clearTimeout(deadline); comparison.cancel(); cancel(); inFlight.delete(key); }
  };
  return { receive: () => attempt ??= run().then(status => { if (status === 'INDETERMINATE') uncertain.add(key); return status; }), cancel };
}
export type WorkoutCloudSingleReceive = ReturnType<typeof createWorkoutCloudSingleReceive>;
