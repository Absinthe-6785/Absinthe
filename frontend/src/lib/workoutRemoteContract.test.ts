import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canonicalPayloadJson, hashCanonicalPayload } from './localDatabase/canonicalPayload';
import { sha256Hex } from './localDatabase/outboxIdentity';
import { validateWorkoutSessionV1 } from './workoutSessionV1';

type Vector = {
  name: string;
  operation: 'upsert' | 'tombstone' | 'restore';
  remoteCasBaseRevision: number | null;
  localRevision: number;
  mutationId: string;
  idempotencyKey: string;
  deletedAt?: string;
  record: Record<string, unknown> & { id: string };
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
    vector.mutationId, vector.idempotencyKey, vector.record.id,
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
});
