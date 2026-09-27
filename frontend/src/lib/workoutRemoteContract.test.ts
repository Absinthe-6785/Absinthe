import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canonicalPayloadJson, hashCanonicalPayload } from './localDatabase/canonicalPayload';
import { sha256Hex } from './localDatabase/outboxIdentity';
import { validateWorkoutSessionV1 } from './workoutSessionV1';
import { workoutRequestDigest } from './workoutRemoteContract';

type Vector = {
  name: string;
  operation: 'upsert' | 'tombstone' | 'restore';
  remoteCasBaseRevision: number | null;
  localRevision: number;
  mutationId: string;
  idempotencyKey: string;
  deletedAt?: string;
  record: Record<string, unknown> & { id: string };
  entityId?: string;
  expectedContentHash: string;
  expectedPayloadHash: string;
  expectedRequestDigest: string;
};
type Fixture = {
  ownerId: string;
  projectScope: string;
  namespaceKey: string;
  generationId: string;
  deviceId: string;
  bindingId: string;
  authorityEpoch: number;
  vectors: Vector[];
};

const fixture = JSON.parse(readFileSync(
  new URL('../../../protocol/rel05g4a-workout-vectors.json', import.meta.url), 'utf8',
)) as Fixture;

function requestDigest(vector: Vector, payloadHash: string): string {
  const tuple = [
    'absinthe-workout-remote-v1', 2, fixture.ownerId, fixture.projectScope,
    'health_workout_session', fixture.namespaceKey, fixture.generationId,
    fixture.deviceId, fixture.bindingId, fixture.authorityEpoch,
    vector.mutationId, vector.idempotencyKey, vector.entityId ?? vector.record.id,
    vector.operation, vector.remoteCasBaseRevision, vector.localRevision, payloadHash,
  ];
  return sha256Hex(JSON.stringify(tuple));
}

describe('REL-05G4A shared Python/JS workout vectors', () => {
  for (const vector of fixture.vectors) {
    it(vector.name, () => {
      validateWorkoutSessionV1(vector.record);
      expect(hashCanonicalPayload(vector.record)).toBe(vector.expectedContentHash);
      const payload = vector.operation === 'tombstone'
        ? { kind: 'tombstone', entityId: vector.record.id,
            revision: vector.localRevision, deletedAt: vector.deletedAt }
        : { kind: 'entity_snapshot', record: vector.record };
      const payloadHash = hashCanonicalPayload(payload);
      expect(payloadHash).toBe(vector.expectedPayloadHash);
      expect(requestDigest(vector, payloadHash)).toBe(vector.expectedRequestDigest);
      expect(workoutRequestDigest({
        authenticatedOwnerId: fixture.ownerId, projectScope: fixture.projectScope,
        namespaceKey: fixture.namespaceKey, generationId: fixture.generationId, deviceId: fixture.deviceId,
        generationBindingId: fixture.bindingId, authorityEpoch: fixture.authorityEpoch,
        mutationId: vector.mutationId, idempotencyKey: vector.idempotencyKey,
        wireEntityId: vector.entityId ?? vector.record.id.toLowerCase(), operation: vector.operation,
        remoteCasBaseRevision: vector.remoteCasBaseRevision, localRevision: vector.localRevision,
        payloadHash,
      })).toBe(vector.expectedRequestDigest);
      expect(canonicalPayloadJson(vector.record)).not.toContain('undefined');
    });
  }

  it('binds the immutable fields, not transmission metadata', () => {
    const vector = fixture.vectors[0]!;
    expect(requestDigest({ ...vector, localRevision: 2 }, vector.expectedPayloadHash))
      .not.toBe(vector.expectedRequestDigest);
    expect(requestDigest(vector, 'f'.repeat(64))).not.toBe(vector.expectedRequestDigest);
    const metadata = { ...vector, createdAt: '2026-09-25T01:02:03Z' };
    expect(requestDigest(metadata, vector.expectedPayloadHash)).toBe(vector.expectedRequestDigest);
  });

  it('makes every G4B1 authority and CAS input digest-sensitive while canonicalizing the owner', () => {
    const vector = fixture.vectors[0]!;
    const input = {
      authenticatedOwnerId: fixture.ownerId, projectScope: fixture.projectScope,
      namespaceKey: fixture.namespaceKey, generationId: fixture.generationId, deviceId: fixture.deviceId,
      generationBindingId: fixture.bindingId, authorityEpoch: fixture.authorityEpoch,
      mutationId: vector.mutationId, idempotencyKey: vector.idempotencyKey,
      wireEntityId: vector.record.id, operation: vector.operation,
      remoteCasBaseRevision: vector.remoteCasBaseRevision, localRevision: vector.localRevision,
      payloadHash: vector.expectedPayloadHash,
    };
    const baseline = workoutRequestDigest(input);
    expect(baseline).toBe(vector.expectedRequestDigest);
    expect(workoutRequestDigest({ ...input, authenticatedOwnerId: fixture.ownerId.toUpperCase() })).toBe(baseline);
    for (const changed of [
      { ...input, projectScope: 'other-project' },
      { ...input, authorityEpoch: 2 },
      { ...input, generationBindingId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' },
      { ...input, wireEntityId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' },
      { ...input, remoteCasBaseRevision: 9 },
      { ...input, localRevision: 2 },
      { ...input, payloadHash: 'f'.repeat(64) },
    ]) expect(workoutRequestDigest(changed)).not.toBe(baseline);
    expect(workoutRequestDigest({ ...input, createdAt: '2030-01-01T00:00:00Z' })).toBe(baseline);
  });

  it('rejects Unicode-digit localDate while retaining ASCII calendar dates', () => {
    const record = fixture.vectors[0]!.record;
    validateWorkoutSessionV1({ ...record, localDate: '2024-02-29' });
    expect(() => validateWorkoutSessionV1({ ...record, localDate: '٢٠٢٦-٠٩-٢٤' }))
      .toThrow('workout_session_invalid');
  });

  it('keeps mixed-case payload UUID bytes while digesting lowercase external identity', () => {
    const vector = fixture.vectors.find(value => value.name === 'mixed-case-internal-uuid-create')!;
    validateWorkoutSessionV1(vector.record);
    expect(vector.record.id).not.toBe(vector.entityId);
    expect(vector.record.id.toLowerCase()).toBe(vector.entityId);
    expect(vector.record).toMatchObject({ entries: [{ id: '1234ABCD-5678-4ABC-8DEF-123456789ABC' }] });
    expect(hashCanonicalPayload(vector.record)).toBe(vector.expectedContentHash);
    const payload = { kind: 'entity_snapshot', record: vector.record };
    expect(hashCanonicalPayload(payload)).toBe(vector.expectedPayloadHash);
    expect(requestDigest(vector, vector.expectedPayloadHash)).toBe(vector.expectedRequestDigest);
    expect(canonicalPayloadJson(vector.record)).toContain(vector.record.id);
  });
});
