import {
  closeLocalDatabase, createDormantLocalDatabaseCapability, LOCAL_SCHEMA_VERSION, openLocalDatabase,
} from '../../../../lib/localDatabase';
import { runtimeSessionReadOwner } from '../../../../lib/remoteBoundary';
import { HEALTH_ROUTINE_DEVICE_ID_KEY, HEALTH_ROUTINE_GENERATION_ID } from '../../../../lib/workoutLocalReaderAuthority';
import { createWorkoutRemoteControlClient, type WorkoutRemoteControlOptions } from '../../../../lib/workoutRemoteClient';
import { WORKOUT_WIRE_UUID_V4 } from '../../../../lib/workoutRemoteContract';
import { runWorkoutPullIteration } from '../../../../lib/workoutRemotePull';
import { runWorkoutPushIteration } from '../../../../lib/workoutRemotePush';
import { WorkoutSelectedDayReader } from '../../../../lib/workoutSelectedDayReader';
import { WorkoutSessionRepository } from '../../../../lib/workoutSessionRepository';
import { HEALTH_WORKER_PRODUCT_PROJECT, ISOLATED_WORKOUT_WORKER_QA } from '../../../../lib/workoutWorkerQaScope';
import { createCanonicalWorkoutDraftStore } from './canonicalWorkoutDraft';

const origin = 'http://127.0.0.1:8789';
const projectScope = 'health-worker-transport-fixture-v1';

type Fixture = {
  localStorage: Storage;
  locks: Pick<LockManager, 'request'>;
  indexedDBFactory: IDBFactory;
  fetchImpl: typeof fetch;
  getSession: WorkoutRemoteControlOptions['getSession'];
  deviceLifetime: AbortSignal;
  now?: () => string;
};

/** Explicitly injected by mounted Worker QA. There is no app-shell or dev-server routing. */
export async function openHealthCanonicalWorkerProduct(
  fixture: Fixture, accountId: string, localDate: string, isCurrentWorkout: () => boolean,
) {
  if (!ISOLATED_WORKOUT_WORKER_QA) throw new Error('WORKER_PRODUCT_QA_DISABLED');
  const owner = runtimeSessionReadOwner();
  const deviceId = fixture.localStorage.getItem(HEALTH_ROUTINE_DEVICE_ID_KEY);
  if (!owner || owner.accountId !== accountId || !deviceId || !WORKOUT_WIRE_UUID_V4.test(deviceId)
    || !WORKOUT_WIRE_UUID_V4.test(accountId)) throw new Error('WORKER_PRODUCT_QA_IDENTITY_REQUIRED');
  const signal = AbortSignal.any([owner.signal, fixture.deviceLifetime]);

  let closed = false;
  const isCurrent = () => !closed && isCurrentWorkout() && !signal.aborted && runtimeSessionReadOwner() === owner
    && fixture.localStorage.getItem(HEALTH_ROUTINE_DEVICE_ID_KEY) === deviceId;
  const current = () => {
    if (!isCurrent()) throw new Error('STALE_WORKER_PRODUCT');
  };
  current();
  const database = await openLocalDatabase({
    userId: accountId, projectRef: HEALTH_WORKER_PRODUCT_PROJECT, deviceId,
    generationId: HEALTH_ROUTINE_GENERATION_ID, schemaVersion: LOCAL_SCHEMA_VERSION,
  }, { capability: createDormantLocalDatabaseCapability('test'), indexedDBFactory: fixture.indexedDBFactory, requireExistingSchema: true });

  async function verifyLocal() {
    const [active, reset] = await Promise.all([database.getActiveGeneration(), database.getWorkoutRemoteResetIntent()]);
    current();
    if (active.generationId !== database.namespace.generationId || active.status !== 'active' || reset) {
      throw new Error('WORKER_PRODUCT_QA_GENERATION_UNAVAILABLE');
    }
  }

  try {
    await verifyLocal();
    const drafts = createCanonicalWorkoutDraftStore({
      scope: { accountId, localDate, namespaceKey: database.namespaceKey, generationId: database.namespace.generationId },
      storage: fixture.localStorage, locks: fixture.locks, isCurrent,
    });
    const sessions = new WorkoutSessionRepository(database, fixture.now);
    const reader = WorkoutSelectedDayReader.forWorkerQa(database);
    const resume = () => drafts.resume(database, { observeDelivery: true, observeWorkerDeliveryHistory: true });
    const readDay = async (onlyEntityId?: string) => {
      current();
      const rows = await reader.read(localDate, onlyEntityId);
      current();
      return rows;
    };
    const options: WorkoutRemoteControlOptions = {
      baseUrl: origin,
      currentAccountId: () => isCurrent() ? accountId : null,
      currentDeviceId: () => isCurrent() ? deviceId : null,
      getSession: async () => {
        current();
        const session = await fixture.getSession();
        current();
        return session?.accountId === accountId ? session : null;
      },
      fetchImpl: async (input, init) => {
        current();
        const target = new URL(String(input));
        if (target.origin !== origin || !/^\/api\/sync\/v2\/(?:generations|workouts\/(?:authority|generations|mutations|changes))$/.test(target.pathname)) {
          throw new Error('WORKER_PRODUCT_QA_TARGET_REJECTED');
        }
        const response = await fixture.fetchImpl(target.href, init);
        current();
        // A foreign fixture never becomes durable discovery evidence.
        if (response.ok && target.pathname === '/api/sync/v2/workouts/authority') {
          const evidence = await response.clone().json();
          current();
          if (evidence.projectScope !== projectScope) throw new Error('WORKER_PRODUCT_QA_PROJECT_REJECTED');
        }
        return response;
      },
    };
    const control = createWorkoutRemoteControlClient(options);
    let verifiedHere: string | null = null;
    let pullReadPending = false;

    return {
      isCurrent, signal, resume, readDay, saveEditor: drafts.saveEditor,
      reopen: (id: string, revision: number, token: string | null) => drafts.reopenWorkerSession(database, id, revision, token),
      close: () => { closed = true; reader.close(); },
      async save(token: string, editingExisting: boolean) {
        if (editingExisting) {
          await verifyLocal();
          await drafts.submitWorkerEdit(token, database, (record, id, revision) =>
            sessions.updateWorkoutSession(id, revision, record, { shouldContinue: isCurrent }));
        } else {
          await drafts.submitNewSession(token, verifyLocal, record => sessions.createWorkoutSession(record, { shouldContinue: isCurrent }));
        }
        return resume();
      },
      async synchronize(token: string | null) {
        await verifyLocal();
        const draft = await resume();
        if (draft.kind === 'unavailable' || draft.kind === 'uncertain'
          || ('token' in draft ? draft.token : null) !== token) throw new Error('WORKER_PRODUCT_QA_DRAFT_CHANGED');
        let uncertain = false;
        try {
          let authority = verifiedHere ? await database.getWorkoutRemoteAuthority() : null;
          current();
          if (!authority || authority.verificationId !== verifiedHere) authority = await control.discoverAndPersist(database);
          current();
          if (authority.projectScope !== projectScope) throw new Error('WORKER_PRODUCT_QA_PROJECT_REJECTED');
          verifiedHere = authority.verificationId;
          if (draft.kind === 'committed_locally' && draft.delivery.kind !== 'acknowledged' && draft.delivery.kind !== 'conflict') {
            const mutationId = draft.submission.mutationId;
            const row = await database.getOutboxRecord(mutationId);
            current();
            if (!row) throw new Error('WORKER_PRODUCT_QA_OUTBOX_UNAVAILABLE');
            if (row.deliveryBinding?.state === 'unbound') {
              await database.bindWorkoutMutation({ mutationId, expectedVerificationId: authority.verificationId,
                currentAuthenticatedAccount: options.currentAccountId, currentDeviceId: options.currentDeviceId });
            }
            current();
            const push = await runWorkoutPushIteration(database, { ...options, now: fixture.now, onlyMutationId: mutationId, limit: 1 });
            uncertain = push.retryable + push.permanent + push.blocked > 0;
            if (push.permanent + push.blocked > 0) verifiedHere = null;
          }
          current();
          const pull = await runWorkoutPullIteration(database, { ...options, now: fixture.now });
          current();
          if (pull.kind === 'full_resync_required') throw new Error('WORKER_PRODUCT_QA_PULL_UNAVAILABLE');
          pullReadPending ||= pull.kind === 'applied' && pull.applied > 0;
          const state = await resume();
          const rows = pullReadPending ? await readDay() : undefined;
          pullReadPending = false;
          return { state, rows, issue: uncertain ? 'uncertain' as const
            : pull.kind === 'applied' && pull.conflicts > 0 ? 'conflict' as const : null };
        } catch (error) {
          verifiedHere = null;
          current();
          throw error;
        }
      },
    };
  } catch (error) {
    closeLocalDatabase(database);
    throw error;
  }
}

export type OpenHealthCanonicalWorkerProduct = (
  accountId: string, date: string, isCurrent: () => boolean,
) => ReturnType<typeof openHealthCanonicalWorkerProduct>;
