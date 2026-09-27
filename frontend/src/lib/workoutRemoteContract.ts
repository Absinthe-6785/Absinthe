import { hashCanonicalPayload } from './localDatabase/canonicalPayload';
import type { BoundWorkoutDeliveryBindingV1, OutboxRecord } from './localDatabase/types';

export const WORKOUT_REMOTE_DOMAIN = 'health_workout_session' as const;
export const WORKOUT_REMOTE_CONTRACT = 'absinthe-workout-remote-v1' as const;
export const WORKOUT_REMOTE_PROTOCOL_VERSION = 2 as const;
export const WORKOUT_SAFE_SCOPE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
export const WORKOUT_WIRE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const WORKOUT_WIRE_UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const WORKOUT_DIGEST = /^[a-f0-9]{64}$/;

export function canonicalWorkoutUuid(value: unknown): string {
  if (typeof value !== 'string') throw new Error('workout_invalid_uuid');
  const canonical = value.toLowerCase();
  if (!WORKOUT_WIRE_UUID_V4.test(canonical)) throw new Error('workout_invalid_uuid');
  return canonical;
}

export function validateBoundWorkoutDeliveryBinding(value: unknown): value is BoundWorkoutDeliveryBindingV1 {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const binding = value as Record<string, unknown>;
  const keys = Object.keys(binding).sort().join(',');
  return keys === [
    'authorityEpoch', 'boundPayloadHash', 'contractVersion', 'generationBindingId', 'projectScope',
    'remoteCasBaseRevision', 'requestDigest', 'state', 'version', 'wireEntityId',
  ].sort().join(',')
    && binding.version === 1 && binding.state === 'bound'
    && binding.contractVersion === WORKOUT_REMOTE_CONTRACT
    && typeof binding.projectScope === 'string' && WORKOUT_SAFE_SCOPE.test(binding.projectScope)
    && typeof binding.authorityEpoch === 'number' && Number.isSafeInteger(binding.authorityEpoch) && binding.authorityEpoch > 0
    && typeof binding.generationBindingId === 'string' && WORKOUT_WIRE_UUID.test(binding.generationBindingId)
    && (binding.remoteCasBaseRevision === null
      || typeof binding.remoteCasBaseRevision === 'number' && Number.isSafeInteger(binding.remoteCasBaseRevision)
        && binding.remoteCasBaseRevision > 0)
    && typeof binding.wireEntityId === 'string' && WORKOUT_WIRE_UUID_V4.test(binding.wireEntityId)
    && typeof binding.requestDigest === 'string' && WORKOUT_DIGEST.test(binding.requestDigest)
    && typeof binding.boundPayloadHash === 'string' && WORKOUT_DIGEST.test(binding.boundPayloadHash);
}

export interface WorkoutDigestInput {
  authenticatedOwnerId: string;
  projectScope: string;
  namespaceKey: string;
  generationId: string;
  deviceId: string;
  generationBindingId: string;
  authorityEpoch: number;
  mutationId: string;
  idempotencyKey: string;
  wireEntityId: string;
  operation: OutboxRecord['operation'];
  remoteCasBaseRevision: number | null;
  localRevision: number;
  payloadHash: string;
}

/** Exact G4A Python tuple; createdAt is deliberately excluded. */
export function workoutRequestDigest(input: WorkoutDigestInput): string {
  const owner = typeof input.authenticatedOwnerId === 'string' ? input.authenticatedOwnerId.toLowerCase() : '';
  if (!WORKOUT_WIRE_UUID.test(owner) || !WORKOUT_SAFE_SCOPE.test(input.projectScope)
    || !WORKOUT_DIGEST.test(input.namespaceKey) || !WORKOUT_SAFE_SCOPE.test(input.generationId)
    || !WORKOUT_SAFE_SCOPE.test(input.deviceId) || !WORKOUT_WIRE_UUID.test(input.generationBindingId)
    || !Number.isSafeInteger(input.authorityEpoch) || input.authorityEpoch < 1
    || !/^mut\.[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.mutationId)
    || !/^k322\.[a-f0-9]{64}$/.test(input.idempotencyKey)
    || !WORKOUT_WIRE_UUID_V4.test(input.wireEntityId)
    || !['upsert', 'tombstone', 'restore'].includes(input.operation)
    || input.remoteCasBaseRevision !== null && (!Number.isSafeInteger(input.remoteCasBaseRevision) || input.remoteCasBaseRevision < 1)
    || !Number.isSafeInteger(input.localRevision) || input.localRevision < 1
    || !WORKOUT_DIGEST.test(input.payloadHash)) throw new Error('workout_invalid_digest_input');
  return hashCanonicalPayload([
    WORKOUT_REMOTE_CONTRACT, WORKOUT_REMOTE_PROTOCOL_VERSION, owner, input.projectScope, WORKOUT_REMOTE_DOMAIN,
    input.namespaceKey, input.generationId, input.deviceId, input.generationBindingId, input.authorityEpoch,
    input.mutationId, input.idempotencyKey, input.wireEntityId, input.operation,
    input.remoteCasBaseRevision, input.localRevision, input.payloadHash,
  ]);
}
