import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deriveOutboxIdempotencyKey } from './outboxIdentity';

type Vector = {
  namespaceFingerprint: string;
  generationId: string;
  domain: string;
  entityId: string;
  localRevision: number;
  operation: 'upsert' | 'tombstone';
  expected: string;
};

describe('K-323 frontend/server protocol vectors', () => {
  const fixture = JSON.parse(readFileSync(
    new URL('../../../../protocol/k323-idempotency-vectors.json', import.meta.url),
    'utf8',
  )) as { version: number; vectors: Vector[] };

  it('uses protocol fixture version 1', () => {
    expect(fixture.version).toBe(1);
  });

  it.each(fixture.vectors)('matches $operation revision $localRevision', vector => {
    expect(deriveOutboxIdempotencyKey({
      namespaceKey: vector.namespaceFingerprint,
      generationId: vector.generationId,
      domain: vector.domain,
      entityId: vector.entityId,
      localRevision: vector.localRevision,
      operation: vector.operation,
    })).toBe(vector.expected);
  });
});
