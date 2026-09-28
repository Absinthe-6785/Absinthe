import { hashCanonicalPayload } from './localDatabase/canonicalPayload';
import type { WorkoutRemoteChangeV1 } from './localDatabase/types';
import { validTimestamp } from './localDatabase/validation';
import { validateWorkoutSessionV1 } from './workoutSessionV1';
import { canonicalWorkoutUuid, WORKOUT_DIGEST, WORKOUT_REMOTE_DOMAIN, WORKOUT_WIRE_UUID } from './workoutRemoteContract';

export const WORKOUT_PULL_PROVIDER = 'workout_g4a';
export const WORKOUT_PULL_LEASE = 'workout_pull_g4b3';
export const WORKOUT_PULL_PAGE_LIMIT = 100;
export const WORKOUT_SNAPSHOT_PAGE_LIMIT = 16;
/** Keeps a canonical snapshot commit to one bounded IDB transaction. Overflow stays staged and fails closed. */
export const WORKOUT_SNAPSHOT_ITEM_LIMIT = 10_000;
export const WORKOUT_SNAPSHOT_BYTE_LIMIT = 8 * 1024 * 1024;

export class WorkoutPullProtocolError extends Error {
  constructor(readonly code: string) { super(`workout_pull:${code}`); }
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new WorkoutPullProtocolError('MALFORMED_RESPONSE');
  return value as Record<string, unknown>;
}

function safeSequence(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function positiveRevision(value: unknown): value is number {
  return safeSequence(value) && value > 0;
}

function timestamp(value: unknown): value is string {
  return validTimestamp(value) && /T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value);
}

export function validateWorkoutRemoteChange(value: unknown, authorityEpoch: number, serverEpoch: string,
  snapshot = false): WorkoutRemoteChangeV1 {
  const row = object(value);
  const entityId = row.entityId;
  const operation = row.operation;
  if (!positiveRevision(row.sequence) || typeof entityId !== 'string' || !WORKOUT_WIRE_UUID.test(entityId)
    || !positiveRevision(row.serverRevision) || !WORKOUT_DIGEST.test(String(row.contentHash))
    || typeof row.remoteMutationRef !== 'string' || !WORKOUT_WIRE_UUID.test(row.remoteMutationRef)
    || !timestamp(row.serverCommittedAt) || typeof row.isDeleted !== 'boolean'
    || (row.deletedAt !== null && !timestamp(row.deletedAt))
    || snapshot && operation !== undefined
    || !snapshot && (operation !== 'upsert' && operation !== 'restore' && operation !== 'tombstone')
    || !snapshot && row.domain !== WORKOUT_REMOTE_DOMAIN
    || !snapshot && (row.authorityEpoch !== authorityEpoch || row.serverEpoch !== serverEpoch)
    || !snapshot && (operation === 'tombstone') !== row.isDeleted
    || row.isDeleted !== (row.deletedAt !== null)) throw new WorkoutPullProtocolError('MALFORMED_RESPONSE');
  try {
    validateWorkoutSessionV1(row.record);
    if (canonicalWorkoutUuid((row.record as { id: string }).id) !== entityId) throw new Error('identity');
    if (hashCanonicalPayload(row.record) !== row.contentHash) throw new Error('hash');
  } catch { throw new WorkoutPullProtocolError('MALFORMED_RESPONSE'); }
  return {
    sequence: row.sequence as number, entityId, operation: snapshot
      ? row.isDeleted ? 'tombstone' : 'upsert' : operation as WorkoutRemoteChangeV1['operation'],
    serverRevision: row.serverRevision as number, record: row.record, contentHash: row.contentHash as string,
    isDeleted: row.isDeleted, deletedAt: row.deletedAt as string | null,
    remoteMutationRef: row.remoteMutationRef, serverCommittedAt: row.serverCommittedAt,
    authorityEpoch, serverEpoch,
  };
}

export type ValidatedWorkoutPullPage =
  | { kind: 'changes'; serverEpoch: string; retentionFloor: number; nextCursor: number; changes: WorkoutRemoteChangeV1[] }
  | { kind: 'full_resync_required'; errorCode: 'CURSOR_INVALID' | 'SERVER_EPOCH_MISMATCH'; serverEpoch: string };

export function validateWorkoutPullPage(value: unknown, cursor: number, authorityEpoch: number,
  requestedServerEpoch: string | null): ValidatedWorkoutPullPage {
  const page = object(value);
  if (page.status === 'full_resync_required') {
    if (page.protocolVersion !== 2 || !['CURSOR_INVALID', 'SERVER_EPOCH_MISMATCH'].includes(String(page.errorCode))
      || typeof page.serverEpoch !== 'string' || !WORKOUT_WIRE_UUID.test(page.serverEpoch)
      || !safeSequence(page.retentionFloor) || !safeSequence(page.nextCursor)
      || page.nextCursor !== page.retentionFloor || !Array.isArray(page.changes) || page.changes.length !== 0) {
      throw new WorkoutPullProtocolError('MALFORMED_RESPONSE');
    }
    return { kind: 'full_resync_required', errorCode: page.errorCode as 'CURSOR_INVALID' | 'SERVER_EPOCH_MISMATCH',
      serverEpoch: page.serverEpoch };
  }
  if (page.protocolVersion !== 2 || page.status !== 'changes' || page.domain !== WORKOUT_REMOTE_DOMAIN
    || page.authorityEpoch !== authorityEpoch || page.errorCode !== null
    || typeof page.serverEpoch !== 'string' || !WORKOUT_WIRE_UUID.test(page.serverEpoch)
    || requestedServerEpoch !== null && page.serverEpoch !== requestedServerEpoch
    || !safeSequence(page.retentionFloor) || !safeSequence(page.nextCursor)
    || page.retentionFloor > cursor || !Array.isArray(page.changes)
    || page.changes.length > WORKOUT_PULL_PAGE_LIMIT) throw new WorkoutPullProtocolError('MALFORMED_RESPONSE');
  let previous = cursor;
  const changes = page.changes.map(item => {
    const change = validateWorkoutRemoteChange(item, authorityEpoch, page.serverEpoch as string);
    if (change.sequence <= previous) throw new WorkoutPullProtocolError('MALFORMED_RESPONSE');
    previous = change.sequence;
    return change;
  });
  if (changes.length === 0 ? page.nextCursor !== cursor : page.nextCursor !== previous) {
    throw new WorkoutPullProtocolError('MALFORMED_RESPONSE');
  }
  return { kind: 'changes', serverEpoch: page.serverEpoch as string,
    retentionFloor: page.retentionFloor as number, nextCursor: page.nextCursor as number, changes };
}

export interface WorkoutSnapshotStart {
  snapshotToken: string; authorityEpoch: number; serverEpoch: string; watermark: number;
}

export function validateWorkoutSnapshotStart(value: unknown, authorityEpoch: number): WorkoutSnapshotStart {
  const row = object(value);
  if (row.protocolVersion !== 2 || row.status !== 'snapshot' || row.domain !== WORKOUT_REMOTE_DOMAIN
    || row.errorCode !== null || row.authorityEpoch !== authorityEpoch
    || typeof row.snapshotToken !== 'string' || !WORKOUT_WIRE_UUID.test(row.snapshotToken)
    || typeof row.serverEpoch !== 'string' || !WORKOUT_WIRE_UUID.test(row.serverEpoch)
    || !safeSequence(row.watermark)) throw new WorkoutPullProtocolError('MALFORMED_RESPONSE');
  return row as unknown as WorkoutSnapshotStart;
}

export interface WorkoutSnapshotPage { rows: WorkoutRemoteChangeV1[]; nextEntityId: string | null; hasMore: boolean }

export function validateWorkoutSnapshotPage(value: unknown, start: WorkoutSnapshotStart,
  afterEntityId: string | null): WorkoutSnapshotPage {
  const page = object(value);
  if (page.protocolVersion !== 2 || page.status !== 'snapshot_page' || page.domain !== WORKOUT_REMOTE_DOMAIN
    || page.snapshotToken !== start.snapshotToken || page.authorityEpoch !== start.authorityEpoch
    || page.serverEpoch !== start.serverEpoch || page.watermark !== start.watermark || page.errorCode !== null
    || typeof page.hasMore !== 'boolean' || !Array.isArray(page.rows)
    || page.rows.length > WORKOUT_SNAPSHOT_PAGE_LIMIT) throw new WorkoutPullProtocolError('MALFORMED_RESPONSE');
  let previous = afterEntityId;
  const rows = page.rows.map(item => {
    const change = validateWorkoutRemoteChange(item, start.authorityEpoch, start.serverEpoch, true);
    if (change.sequence > start.watermark || previous !== null && change.entityId <= previous) {
      throw new WorkoutPullProtocolError('MALFORMED_RESPONSE');
    }
    previous = change.entityId;
    return change;
  });
  if (page.hasMore ? rows.length === 0 || page.nextEntityId !== previous : page.nextEntityId !== null) {
    throw new WorkoutPullProtocolError('MALFORMED_RESPONSE');
  }
  return { rows, nextEntityId: page.nextEntityId as string | null, hasMore: page.hasMore as boolean };
}
