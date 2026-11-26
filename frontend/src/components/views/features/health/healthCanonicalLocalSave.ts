import {
  closeLocalDatabase, createDormantLocalDatabaseCapability, LOCAL_SCHEMA_VERSION, openLocalDatabase,
} from '../../../../lib/localDatabase';
import { runtimeSessionReadOwner } from '../../../../lib/remoteBoundary';
import { HEALTH_ROUTINE_DEVICE_ID_KEY, HEALTH_ROUTINE_GENERATION_ID } from '../../../../lib/workoutLocalReaderAuthority';
import { WORKOUT_WIRE_UUID_V4 } from '../../../../lib/workoutRemoteContract';
import { WorkoutSessionRepository } from '../../../../lib/workoutSessionRepository';
import { createCanonicalWorkoutDraftStore } from './canonicalWorkoutDraft';
import { HEALTH_CANONICAL_LOCAL_SAVE_ENABLED } from './healthCanonicalLocalSaveConfig';

/** Never share an authority/binding namespace with the existing production readers/workers. */
export const ISOLATED_CANONICAL_WORKOUT_PROJECT = 'absinthe-health-canonical-local-qa';

export async function openHealthCanonicalLocalSave(
  accountId: string, localDate: string, isCurrentWorkout: () => boolean,
) {
  if (import.meta.env.PROD || !HEALTH_CANONICAL_LOCAL_SAVE_ENABLED
    || !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) throw new Error('CANONICAL_LOCAL_SAVE_DISABLED');

  const owner = runtimeSessionReadOwner();
  const deviceId = localStorage.getItem(HEALTH_ROUTINE_DEVICE_ID_KEY);
  if (!owner || owner.accountId !== accountId || !deviceId || !WORKOUT_WIRE_UUID_V4.test(deviceId)) {
    throw new Error('CANONICAL_LOCAL_SAVE_UNAVAILABLE');
  }

  const isCurrent = () => {
    try {
      return isCurrentWorkout() && !owner.signal.aborted && runtimeSessionReadOwner() === owner
        && localStorage.getItem(HEALTH_ROUTINE_DEVICE_ID_KEY) === deviceId;
    } catch { return false; }
  };
  const current = () => {
    if (!isCurrent()) throw new Error('STALE_CANONICAL_LOCAL_SAVE');
  };
  current();
  const database = await openLocalDatabase({
    userId: accountId, deviceId, generationId: HEALTH_ROUTINE_GENERATION_ID,
    projectRef: ISOLATED_CANONICAL_WORKOUT_PROJECT, schemaVersion: LOCAL_SCHEMA_VERSION,
  }, { capability: createDormantLocalDatabaseCapability('developer'), requireExistingSchema: true });

  async function verifyIsolated() {
    const [active, remoteAuthority, reset] = await Promise.all([
      database.getActiveGeneration(), database.getWorkoutRemoteAuthority(), database.getWorkoutRemoteResetIntent(),
    ]);
    current();
    if (active.generationId !== database.namespace.generationId || active.status !== 'active' || remoteAuthority || reset) {
      throw new Error('CANONICAL_LOCAL_SAVE_UNAVAILABLE');
    }
  }

  try {
    if (!navigator.locks) throw new Error('CANONICAL_DRAFT_LOCK_UNAVAILABLE');
    await verifyIsolated();
    const drafts = createCanonicalWorkoutDraftStore({
      scope: { accountId, localDate, namespaceKey: database.namespaceKey, generationId: database.namespace.generationId },
      storage: localStorage, locks: navigator.locks, isCurrent,
    });
    return {
      saveEditor: drafts.saveEditor,
      resume: () => drafts.resume(database),
      async save(token: string) {
        const repository = new WorkoutSessionRepository(database);
        await drafts.submitNewSession(token, verifyIsolated, record => repository.createWorkoutSession(record));
        return drafts.resume(database);
      },
      isCurrent,
      signal: owner.signal,
      close: () => closeLocalDatabase(database),
    };
  } catch (error) {
    closeLocalDatabase(database);
    throw error;
  }
}
