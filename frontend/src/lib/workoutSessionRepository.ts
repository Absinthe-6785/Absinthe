import {
  type CommittedLocalMutation,
  type LocalDatabaseRepository,
  type LocalEntityEnvelope,
} from './localDatabase';
import { snapshotWorkoutSessionV1, validateWorkoutSessionV1, type WorkoutSessionV1 } from './workoutSessionV1';
import { canonicalWorkoutUuid } from './workoutRemoteContract';

export const WORKOUT_SESSION_DOMAIN = 'health_workout_session';

function sameWorkoutId(left: string, right: string): boolean {
  try { return canonicalWorkoutUuid(left) === canonicalWorkoutUuid(right); }
  catch { return false; }
}

export interface WorkoutMutationOptions {
  now?: string;
  testOnlyAbortAt?: 'before_entity' | 'before_outbox' | 'after_writes';
}

export class WorkoutSessionRepository {
  private readonly database: LocalDatabaseRepository;
  private readonly clock: () => string;

  constructor(database: LocalDatabaseRepository, clock: () => string = () => new Date().toISOString()) {
    this.database = database;
    this.clock = clock;
  }

  private async localEntityId(id: string): Promise<string> {
    let wireId: string;
    try { wireId = canonicalWorkoutUuid(id); }
    catch { return id; }
    const mappings = await this.database.getWorkoutRemoteIdsByWire(wireId);
    const mapped = mappings[0]?.localEntityId;
    if (!mapped) return id;
    if (mapped !== id && await this.database.getEntity(WORKOUT_SESSION_DOMAIN, id)) {
      throw new Error('workout_uuid_mapping_collision');
    }
    return mapped;
  }

  async createWorkoutSession(
    sessionInput: WorkoutSessionV1,
    options: WorkoutMutationOptions = {},
  ): Promise<CommittedLocalMutation<WorkoutSessionV1>> {
    const session = snapshotWorkoutSessionV1(sessionInput);
    return this.database.commitLocalMutation({
      mutation: {
        mode: 'create',
        domain: WORKOUT_SESSION_DOMAIN,
        entityId: session.id,
        record: session,
        ownerId: this.database.namespace.userId,
        source: { kind: 'local', reference: 'workout_session_v1' },
      },
      now: options.now ?? this.clock(),
      deliveryBinding: { version: 1, state: 'unbound' },
      testOnlyAbortAt: options.testOnlyAbortAt,
    });
  }

  async updateWorkoutSession(
    id: string,
    expectedLocalRevision: number,
    sessionInput: WorkoutSessionV1,
    options: WorkoutMutationOptions = {},
  ): Promise<CommittedLocalMutation<WorkoutSessionV1>> {
    const session = snapshotWorkoutSessionV1(sessionInput);
    if (!sameWorkoutId(session.id, id)) throw new Error('workout_session_id_mismatch');
    const entityId = await this.localEntityId(id);
    return this.database.commitLocalMutation({
      mutation: {
        mode: 'update',
        domain: WORKOUT_SESSION_DOMAIN,
        entityId,
        expectedRevision: expectedLocalRevision,
        record: session,
        source: { kind: 'local', reference: 'workout_session_v1' },
      },
      now: options.now ?? this.clock(),
      deliveryBinding: { version: 1, state: 'unbound' },
      testOnlyAbortAt: options.testOnlyAbortAt,
    });
  }

  async deleteWorkoutSession(
    id: string,
    expectedLocalRevision: number,
    options: WorkoutMutationOptions = {},
  ): Promise<CommittedLocalMutation<WorkoutSessionV1>> {
    const entityId = await this.localEntityId(id);
    const existing = await this.database.getEntity<WorkoutSessionV1>(WORKOUT_SESSION_DOMAIN, entityId);
    if (!existing || existing.isDeleted) throw new Error('workout_session_not_active');
    validateWorkoutSessionV1(existing.record);
    if (!sameWorkoutId(existing.record.id, existing.entityId)) throw new Error('workout_session_id_mismatch');
    const result = await this.database.commitLocalMutation<WorkoutSessionV1>({
      mutation: {
        mode: 'tombstone',
        domain: WORKOUT_SESSION_DOMAIN,
        entityId,
        expectedRevision: expectedLocalRevision,
        record: null,
      },
      now: options.now ?? this.clock(),
      deliveryBinding: { version: 1, state: 'unbound' },
      testOnlyAbortAt: options.testOnlyAbortAt,
    });
    return result;
  }

  async restoreWorkoutSession(
    id: string,
    expectedLocalRevision: number,
    sessionInput: WorkoutSessionV1,
    options: WorkoutMutationOptions = {},
  ): Promise<CommittedLocalMutation<WorkoutSessionV1>> {
    const session = snapshotWorkoutSessionV1(sessionInput);
    if (!sameWorkoutId(session.id, id)) throw new Error('workout_session_id_mismatch');
    const entityId = await this.localEntityId(id);
    return this.database.commitLocalMutation({
      mutation: {
        mode: 'restore',
        domain: WORKOUT_SESSION_DOMAIN,
        entityId,
        expectedRevision: expectedLocalRevision,
        record: session,
        source: { kind: 'local', reference: 'workout_session_v1' },
      },
      now: options.now ?? this.clock(),
      deliveryBinding: { version: 1, state: 'unbound' },
      testOnlyAbortAt: options.testOnlyAbortAt,
    });
  }

  async getWorkoutSession(id: string): Promise<LocalEntityEnvelope<WorkoutSessionV1> | null> {
    const entity = await this.database.getEntity<WorkoutSessionV1>(WORKOUT_SESSION_DOMAIN, await this.localEntityId(id));
    if (entity) {
      validateWorkoutSessionV1(entity.record);
      if (!sameWorkoutId(entity.record.id, entity.entityId)) throw new Error('workout_session_id_mismatch');
    }
    return entity;
  }

  async listWorkoutSessions(): Promise<LocalEntityEnvelope<WorkoutSessionV1>[]> {
    const entities = await this.database.listEntities<WorkoutSessionV1>({ domain: WORKOUT_SESSION_DOMAIN });
    for (const entity of entities) {
      validateWorkoutSessionV1(entity.record);
      if (!sameWorkoutId(entity.record.id, entity.entityId)) throw new Error('workout_session_id_mismatch');
    }
    return entities;
  }

  async queryWorkoutSessionsByLocalDate(localDate: string): Promise<LocalEntityEnvelope<WorkoutSessionV1>[]> {
    const sessions = await this.listWorkoutSessions();
    return sessions.filter(entity => entity.record.localDate === localDate);
  }
}
