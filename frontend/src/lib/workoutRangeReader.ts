import {
  closeLocalDatabase, createWorkoutReaderLocalDatabaseCapability, openLocalDatabase,
  type LocalDatabaseRepository,
} from './localDatabase/repository';
import { LocalDatabaseError } from './localDatabase/errors';
import { LOCAL_SCHEMA_VERSION, type LocalDatabaseNamespace } from './localDatabase/types';
import {
  HEALTH_ROUTINE_GENERATION_ID, HEALTH_ROUTINE_PROJECT_REF, readEstablishedWorkoutDeviceId,
} from './workoutLocalReaderAuthority';
import { WorkoutSessionRepository, WORKOUT_SESSION_DOMAIN } from './workoutSessionRepository';
import type { SelectedDayCanonicalScope } from './workoutSelectedDayReader';
import {
  CompositeWorkoutReadIsolationError, type ActiveCanonicalWorkoutReadInput,
} from '../components/views/features/health/compositeWorkoutReadProjection';

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

/** Dormant active-domain reader. The mutable-capable database handle never escapes this class. */
export class WorkoutRangeReader {
  private closed = false;

  private constructor(
    private readonly repository: LocalDatabaseRepository,
    private readonly deviceStorage: Storage,
    readonly accountId: string,
    readonly deviceId: string,
  ) {}

  static async open(accountId: string, storage: Storage): Promise<WorkoutRangeReader> {
    const owner = accountId.toLowerCase();
    const deviceId = readEstablishedWorkoutDeviceId(storage);
    const namespace: LocalDatabaseNamespace = {
      userId: owner, projectRef: HEALTH_ROUTINE_PROJECT_REF, deviceId,
      generationId: HEALTH_ROUTINE_GENERATION_ID, schemaVersion: LOCAL_SCHEMA_VERSION,
    };
    const capability = createWorkoutReaderLocalDatabaseCapability();
    let repository = await openLocalDatabase(namespace, { capability });
    try {
      try {
        await repository.initializeNamespace();
      } catch (error) {
        if (!(error instanceof LocalDatabaseError) || error.code !== 'STALE_GENERATION') throw error;
      }
      const metadata = await repository.readDatabaseMetadata();
      if (metadata.activeGenerationId !== repository.namespace.generationId) {
        closeLocalDatabase(repository);
        repository = await openLocalDatabase(
          { ...namespace, generationId: metadata.activeGenerationId }, { capability },
        );
      }
      const reader = new WorkoutRangeReader(repository, storage, owner, deviceId);
      await reader.verifyCurrentScope();
      return reader;
    } catch (error) {
      closeLocalDatabase(repository);
      throw error;
    }
  }

  get scope(): SelectedDayCanonicalScope {
    return Object.freeze({
      accountId: this.accountId, deviceId: this.deviceId,
      namespaceKey: this.repository.namespaceKey,
      generationId: this.repository.namespace.generationId,
    });
  }

  async verifyCurrentScope(): Promise<void> {
    if (this.closed || readEstablishedWorkoutDeviceId(this.deviceStorage) !== this.deviceId) {
      throw new LocalDatabaseError('STALE_GENERATION', 'verify_workout_range_scope');
    }
    const active = await this.repository.getActiveGeneration();
    if (active.generationId !== this.repository.namespace.generationId || active.status !== 'active'
      || readEstablishedWorkoutDeviceId(this.deviceStorage) !== this.deviceId || this.closed) {
      throw new LocalDatabaseError('STALE_GENERATION', 'verify_workout_range_scope');
    }
  }

  async readAllActive(): Promise<readonly ActiveCanonicalWorkoutReadInput[]> {
    await this.verifyCurrentScope();
    // This is the sole canonical domain scan for one source-snapshot load.
    const entities = await new WorkoutSessionRepository(this.repository).listWorkoutSessions();
    await this.verifyCurrentScope();
    return freezeDeep(entities.map(entity => {
      const revision = entity.localRevision ?? entity.revision;
      if ((entity.accountId !== undefined && entity.accountId.toLowerCase() !== this.accountId)
        || entity.ownerId?.toLowerCase() !== this.accountId) {
        throw new CompositeWorkoutReadIsolationError('ACCOUNT_MISMATCH');
      }
      if (entity.namespaceKey !== this.repository.namespaceKey) {
        throw new CompositeWorkoutReadIsolationError('NAMESPACE_MISMATCH');
      }
      if (entity.generationId !== this.repository.namespace.generationId) {
        throw new CompositeWorkoutReadIsolationError('GENERATION_MISMATCH');
      }
      if (entity.domain !== WORKOUT_SESSION_DOMAIN
        || entity.isDeleted !== false || entity.deletedAt !== null
        || entity.localRevision !== undefined && entity.localRevision !== entity.revision
        || !Number.isSafeInteger(revision) || revision < 1) {
        throw new Error('workout_range_canonical_envelope_invalid');
      }
      return {
        accountId: this.accountId, namespaceKey: entity.namespaceKey,
        generationId: entity.generationId, entityId: entity.entityId,
        localRevision: revision, session: structuredClone(entity.record),
      };
    }));
  }

  close(): void {
    if (!this.closed) closeLocalDatabase(this.repository);
    this.closed = true;
  }
}
