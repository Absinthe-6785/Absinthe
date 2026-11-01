import { supabase } from './supabase';
import { createLocalHealthDriver, type LocalExerciseBlockReceiveInput } from './healthLocalRepository';
import { createWorkoutCloudComparison } from './healthWorkoutCloudComparison';
import { supportedWorkoutContent, supportedExerciseBlockContent } from './healthWorkoutCloudContent';
import { stableRecoveryJson } from './recoveryExportPackage';
import type { HealthRecoveryRecord } from './healthRecoveryExport';
import type { WorkoutReceiveStatus } from './healthWorkoutCloudSingleReceive';
import { assistedRepsMatchExerciseType } from './healthAssistedReps';

const inFlight = new Set<string>(), uncertain = new Set<string>();

/** Read-only inspection precedes explicit confirmation. Never receives the workout itself. */
export function createExerciseBlockCloudSingleReceive(accountId: string, intended: HealthRecoveryRecord, accountCurrent: () => boolean) {
  const workout = structuredClone(intended), content = supportedWorkoutContent(workout, accountId);
  const key = `${accountId}:${workout.block_id}`;
  let live = true, attempted = false, expiresAt = 0;
  let prepared: Pick<LocalExerciseBlockReceiveInput, 'record' | 'expectedImportState'> | null = null;
  const controller = new AbortController();
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION' && session?.user.id === accountId) return;
    live = false; controller.abort();
  });
  const current = () => live && !controller.signal.aborted && accountCurrent();
  const writable = () => current() && expiresAt > Date.now();
  const assertCurrent = () => { if (!current()) throw new Error('health_block_receive_stale'); };
  const cancel = () => { live = false; controller.abort(); subscription.unsubscribe(); };
  const observe = async () => {
    assertCurrent();
    if (!content || uncertain.has(key) || typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('health_block_receive_denied');
    const first = await supabase.auth.getSession(); assertCurrent();
    const session = first.data.session;
    if (first.error || session?.user.id !== accountId || !session.access_token || !session.expires_at
      || session.expires_at * 1000 <= Date.now()) throw new Error('health_block_receive_auth');
    const token = session.access_token;
    expiresAt = session.expires_at * 1000;
    const user = await supabase.auth.getUser(token); assertCurrent();
    if (user.error || user.data.user?.id !== accountId) throw new Error('health_block_receive_auth');
    const checkSession = async () => {
      const result = await supabase.auth.getSession(); assertCurrent();
      const value = result.data.session;
      if (result.error || value?.user.id !== accountId || value.access_token !== token || !value.expires_at) throw new Error('health_block_receive_auth');
      expiresAt = Math.min(expiresAt, value.expires_at * 1000);
      if (!writable()) throw new Error('health_block_receive_expired');
    };
    const comparison = createWorkoutCloudComparison(accountId, current, () => { live = false; controller.abort(); });
    try {
      await comparison.compare(); assertCurrent();
      const fresh = comparison.remoteOnlyRecord(String(workout.id)), authority = comparison.localAuthority();
      if (!fresh || !authority || supportedWorkoutContent(fresh, accountId) !== content) throw new Error('health_block_receive_source');
      const base = new URL(import.meta.env.VITE_SUPABASE_URL);
      if (base.protocol !== 'https:' || base.pathname !== '/' || base.search || base.hash || base.username || base.password) throw new Error('health_block_receive_origin');
      const read = async (table: 'workout_logs' | 'exercise_blocks', id: string): Promise<HealthRecoveryRecord | null> => {
        assertCurrent();
        const url = new URL(`/rest/v1/${table}`, base);
        url.search = new URLSearchParams({ select: '*', id: `eq.${id}`, user_id: `eq.${accountId}`, limit: '2' }).toString();
        const response = await fetch(url, { method: 'GET', headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
          signal: controller.signal, credentials: 'omit', redirect: 'error' });
        assertCurrent(); if (!response.ok) throw new Error('health_block_receive_read');
        const values = await response.json(); assertCurrent();
        return Array.isArray(values) && values.length === 1 && values[0]?.id === id && values[0]?.user_id === accountId ? values[0] : null;
      };
      const block = await read('exercise_blocks', String(workout.block_id));
      const blockContent = supportedExerciseBlockContent(block, accountId);
      if (!block || !blockContent || !assistedRepsMatchExerciseType(block.type, workout.sets as unknown[])) throw new Error('health_block_receive_content');
      const sourceCurrent = async () => {
        if (supportedWorkoutContent(await read('workout_logs', String(workout.id)) ?? {}, accountId) !== content
          || supportedExerciseBlockContent(await read('exercise_blocks', String(workout.block_id)), accountId) !== blockContent) throw new Error('health_block_receive_source');
        await checkSession();
      };
      await sourceCurrent();
      const input: LocalExerciseBlockReceiveInput = { accountId, record: block, workout, expectedImportState: authority, isCurrent: writable, signal: controller.signal };
      return { input, sourceCurrent };
    } finally { comparison.cancel(); }
  };
  let inspection: Promise<HealthRecoveryRecord | null> | undefined, attempt: Promise<WorkoutReceiveStatus> | undefined;
  const inspect = () => inspection ??= (async () => {
    const deadline = setTimeout(() => controller.abort(), 15_000);
    try {
      const { input } = await observe();
      const driver = await createLocalHealthDriver({ existingOnly: true });
      try {
        if (await driver.verifyExerciseBlockReceive(input) !== 'ABSENT' || !writable()) return null;
        prepared = structuredClone({ record: input.record, expectedImportState: input.expectedImportState });
        return structuredClone(input.record);
      } finally { driver.close(); }
    } catch { return null; }
    finally { clearTimeout(deadline); if (!prepared) cancel(); }
  })();
  const run = async (): Promise<WorkoutReceiveStatus> => {
    if (!prepared || inFlight.has(key) || uncertain.has(key)) { cancel(); return 'DENIED'; }
    inFlight.add(key);
    const deadline = setTimeout(() => controller.abort(), 15_000);
    try {
      const { input, sourceCurrent } = await observe();
      if (supportedExerciseBlockContent(input.record, accountId) !== supportedExerciseBlockContent(prepared.record, accountId)) return 'DENIED';
      const driver = await createLocalHealthDriver({ existingOnly: true });
      try {
        if (await driver.verifyExerciseBlockReceive(input) === 'CONFLICT') return 'CONFLICT';
        if (stableRecoveryJson(input.expectedImportState) !== stableRecoveryJson(prepared.expectedImportState)) return 'DENIED';
        await sourceCurrent();
        attempted = true;
        const result = await driver.createReceivedExerciseBlock(input);
        if (result.status !== 'CREATED') return result.status;
        await sourceCurrent();
        await driver.verifyExerciseBlockReceive(input, result.state); // final async boundary
        return writable() ? 'LOCAL_CREATE_CONFIRMED' : 'INDETERMINATE';
      } finally { driver.close(); }
    } catch { return attempted ? 'INDETERMINATE' : 'DENIED'; }
    finally { clearTimeout(deadline); cancel(); inFlight.delete(key); }
  };
  return { inspect, receive: () => attempt ??= run().then(status => { if (status === 'INDETERMINATE') uncertain.add(key); return status; }), cancel };
}
export type ExerciseBlockCloudSingleReceive = ReturnType<typeof createExerciseBlockCloudSingleReceive>;
