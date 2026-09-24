import { HEALTH_LOCAL_DATABASE_NAME, type LocalHealthDriver } from '../healthLocalRepository';
import type { LocalDatabaseRepository } from '../localDatabase/repository';
import { hashCanonicalPayload } from '../localDatabase/canonicalPayload';
import { buildWorkoutAdoptionSnapshot } from './source';
import type { WorkoutAdoptionSession } from './types';

/** Dormant G3 operation. No AppContent/HealthView caller may invoke this at startup. */
export async function runDormantWorkoutAdoption(input: {
  database: LocalDatabaseRepository;
  healthDriver: LocalHealthDriver;
  authenticatedAccountId: string;
  now?: () => string;
}): Promise<WorkoutAdoptionSession> {
  const { database, healthDriver, authenticatedAccountId } = input;
  if (authenticatedAccountId !== database.namespace.userId) throw new Error('workout_adoption_account_mismatch');
  const capture = await healthDriver.captureWorkoutAdoptionSource(authenticatedAccountId);
  const sourceInstanceId = hashCanonicalPayload([
    'workout-health-source-instance-v1', database.namespaceKey, HEALTH_LOCAL_DATABASE_NAME,
  ]);
  const snapshot = buildWorkoutAdoptionSnapshot(capture, sourceInstanceId);
  const session = await database.sealWorkoutAdoptionSnapshot(snapshot, (input.now ?? (() => new Date().toISOString()))());
  if (session.status === 'COMPLETED') return database.completeWorkoutAdoption(session.manifestId);
  const items = await database.listWorkoutAdoptionItems(session.manifestId);
  for (const item of items) {
    if (item.classification === 'ADOPTABLE' && item.state === 'ALLOCATED') {
      await database.commitWorkoutAdoptionItem(session.manifestId, item.sourceKeyDigest);
    }
  }
  return database.completeWorkoutAdoption(session.manifestId);
}
