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
import { CompositeWorkoutReadIsolationError,
  type ActiveCanonicalWorkoutReadInput } from '../components/views/features/health/compositeWorkoutReadProjection';

export type SelectedDayCanonicalScope = Readonly<{
  accountId: string;
  deviceId: string;
  namespaceKey: string;
  generationId: string;
}>;

export { readEstablishedWorkoutDeviceId } from './workoutLocalReaderAuthority';

export class WorkoutSelectedDayReader {
  private repository: LocalDatabaseRepository;
  private closed = false;
  readonly accountId: string;
  readonly deviceId: string;

  private constructor(repository: LocalDatabaseRepository, accountId: string, deviceId: string) {
    this.repository = repository;
    this.accountId = accountId;
    this.deviceId = deviceId;
  }

  static async open(accountId: string, storage: Storage): Promise<WorkoutSelectedDayReader> {
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
      const active = await repository.getActiveGeneration();
      if (active.generationId !== repository.namespace.generationId || active.status !== 'active') {
        throw new LocalDatabaseError('STALE_GENERATION', 'open_workout_selected_day_reader');
      }
      return new WorkoutSelectedDayReader(repository, owner, deviceId);
    } catch (error) {
      closeLocalDatabase(repository);
      throw error;
    }
  }

  get scope(): SelectedDayCanonicalScope {
    return {
      accountId: this.accountId, deviceId: this.deviceId,
      namespaceKey: this.repository.namespaceKey,
      generationId: this.repository.namespace.generationId,
    };
  }

  async verifyCurrentScope(): Promise<void> {
    if (this.closed) throw new LocalDatabaseError('STALE_GENERATION', 'verify_workout_selected_day_scope');
    const active = await this.repository.getActiveGeneration();
    if (active.generationId !== this.repository.namespace.generationId || active.status !== 'active') {
      throw new LocalDatabaseError('STALE_GENERATION', 'verify_workout_selected_day_scope');
    }
  }

  async read(localDate: string): Promise<readonly ActiveCanonicalWorkoutReadInput[]> {
    if (this.closed) throw new Error('workout_selected_day_reader_closed');
    await this.verifyCurrentScope();
    let entities: Awaited<ReturnType<WorkoutSessionRepository['queryWorkoutSessionsByLocalDate']>>;
    try {
      entities = await new WorkoutSessionRepository(this.repository).queryWorkoutSessionsByLocalDate(localDate);
    } catch (error) {
      // Match the range reader's durable trust boundary, before any returned-row checks.
      if (error instanceof LocalDatabaseError && error.code === 'CORRUPT_PERSISTED_RECORD') {
        switch (error.persistedEntityFailure) {
          case 'ACCOUNT_MISMATCH':
          case 'NAMESPACE_MISMATCH':
          case 'GENERATION_MISMATCH':
            throw new CompositeWorkoutReadIsolationError(error.persistedEntityFailure);
          case 'UNTRUSTED_SCOPE':
            throw new CompositeWorkoutReadIsolationError('INVALID_CONTEXT');
          default:
            // Trusted-scope invalid content and unclassified corruption remain ordinary errors.
            break;
        }
      }
      throw error;
    }
    await this.verifyCurrentScope();
    return entities.map(entity => {
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
        throw new Error('workout_selected_day_canonical_envelope_invalid');
      }
      return {
        accountId: this.accountId, namespaceKey: entity.namespaceKey,
        generationId: entity.generationId, entityId: entity.entityId,
        localRevision: revision, session: entity.record,
      };
    });
  }

  close(): void {
    if (!this.closed) closeLocalDatabase(this.repository);
    this.closed = true;
  }
}
