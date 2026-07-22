import { describe, expect, it } from 'vitest';

import {
  createCandidateReferenceCollection,
  createK334CanonicalRecord,
  createQuarantineBasisReferenceCollection,
  decodeCandidateReferenceCollection,
  decodeK334CanonicalRecord,
  decodeK334CanonicalRecordBytes,
  encodeCandidateReference,
  encodeK334CanonicalRecord,
} from './k334CanonicalProtocol';
import { createK334CanonicalRepository } from './k334CanonicalRepository';

const digest = (character: string) => character.repeat(64);
const code = (result: { readonly ok: boolean; readonly error?: { readonly code: string } }) =>
  result.ok ? undefined : result.error?.code;

function authorityEvidencePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    recordType: 'authority_evidence_v1',
    recordSchemaVersion: 1,
    repositoryNamespace: 'absinthe.installation.main',
    namespaceKey: 'namespace.main',
    subjectId: 'subject.main',
    issuerId: 'issuer.main',
    lineageId: 'lineage.main',
    predecessorRecordId: null,
    supersedesRecordId: null,
    action: 'grant',
    lifecycleStatus: 'recorded',
    'boundary.effectiveSequence': 1,
    'boundary.effectiveAfterRecordId': null,
    'boundary.prospectiveOnly': true,
    compatibilityTupleId: 'dat:v1:tuple.main',
    'provenance.sourceKind': 'owner_evidence',
    'provenance.sourceRecordId': null,
    'provenance.sourceDigest': digest('a'),
    'provenance.recorderId': 'recorder.main',
    ...overrides,
  };
}

function authorityEvidence() {
  return createK334CanonicalRecord({ kind: 'authority_evidence', payload: authorityEvidencePayload() });
}

describe('K-334D canonical records', () => {
  it('uses fixed domains and ordered semantic fields independent of object insertion order', () => {
    const first = authorityEvidence();
    const payload = authorityEvidencePayload();
    const reordered = Object.fromEntries(Object.entries(payload).reverse());
    const second = createK334CanonicalRecord({ kind: 'authority_evidence', payload: reordered });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.recordId).toBe(second.value.recordId);
    expect(first.value.canonicalDigest).toBe(second.value.canonicalDigest);
    expect(first.value.recordId).toMatch(/^dar:v1:authority-evidence:[a-f0-9]{64}$/);
    expect(first.value.canonicalDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('round trips canonical record bytes and rejects circular or wrong-type payloads', () => {
    const created = authorityEvidence();
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const encoded = encodeK334CanonicalRecord(created.value);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    expect(decodeK334CanonicalRecordBytes(encoded.value)).toEqual(created);
    expect(code(createK334CanonicalRecord({
      kind: 'authority_evidence', payload: authorityEvidencePayload({ recordId: created.value.recordId }),
    }))).toBe('UNKNOWN_FIELD');
    expect(code(createK334CanonicalRecord({
      kind: 'authority_evidence', payload: authorityEvidencePayload({ recordType: 'issuer_policy_v1' }),
    }))).toBe('RECORD_KIND_MISMATCH');
    expect(code(decodeK334CanonicalRecord({
      ...created.value,
      canonicalDigest: digest('b'),
    }))).toBe('CANONICAL_DIGEST_MISMATCH');
  });

  it('canonicalizes candidate collections by full pair bytes, not input order, and preserves distinct IDs', () => {
    const first = { candidateRecordId: 'dar:v1:candidate-a', candidateCanonicalDigest: digest('a') };
    const second = { candidateRecordId: 'dar:v1:candidate-b', candidateCanonicalDigest: digest('a') };
    const ordered = createCandidateReferenceCollection([first, second, first]);
    const permuted = createCandidateReferenceCollection([second, first]);
    expect(ordered.ok && permuted.ok).toBe(true);
    if (!ordered.ok || !permuted.ok) return;
    expect(ordered.value.references).toHaveLength(2);
    expect(ordered.value.bytes).toEqual(permuted.value.bytes);
    expect(decodeCandidateReferenceCollection(ordered.value.bytes)).toEqual(ordered);
    expect(code(createCandidateReferenceCollection([
      first,
      { candidateRecordId: first.candidateRecordId, candidateCanonicalDigest: digest('b') },
    ]))).toBe('RELATIONSHIP_MISMATCH');
  });

  it('keeps candidate and quarantine-basis domains distinct and rejects malformed pair bytes', () => {
    const candidate = { candidateRecordId: 'dar:v1:candidate-a', candidateCanonicalDigest: digest('a') };
    const candidatePair = encodeCandidateReference(candidate);
    const quarantine = createQuarantineBasisReferenceCollection([
      { observationRecordId: 'dar:v1:observation-a', observationCanonicalDigest: digest('a') },
    ]);
    expect(candidatePair.ok && quarantine.ok).toBe(true);
    if (!candidatePair.ok || !quarantine.ok) return;
    expect(candidatePair.value).not.toEqual(quarantine.value.bytes);
    const malformed = new Uint8Array(candidatePair.value); malformed[0] = 0;
    expect(code(decodeCandidateReferenceCollection(malformed))).toBe('INVALID_ENCODED_INPUT');
  });

  it('provides an append-only, idempotent, fail-closed repository boundary', () => {
    const created = authorityEvidence();
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const repository = createK334CanonicalRepository();
    expect(repository.append(created.value)).toEqual({
      ok: true, value: { disposition: 'appended', record: created.value },
    });
    expect(repository.append(created.value)).toEqual({
      ok: true, value: { disposition: 'idempotent', record: created.value },
    });
    expect(repository.read(created.value.recordId)).toEqual({ ok: true, value: created.value });
    expect(repository.size()).toBe(1);
    expect(code(repository.append({
      ...created.value,
      payload: { ...created.value.payload, action: 'revoke' },
    }))).toBe('CANONICAL_DIGEST_MISMATCH');
  });
});
