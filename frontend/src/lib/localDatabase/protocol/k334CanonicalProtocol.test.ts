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
const recordId = (prefix: string, character: string) => `${prefix}${digest(character)}`;
const tupleId = () => recordId('dat:v1:', 'e');
const bytesToHex = (value: Uint8Array) => Array.from(value, byte => byte.toString(16).padStart(2, '0')).join('');
const code = (result: { readonly ok: boolean; readonly error?: { readonly code: string } }) =>
  result.ok ? undefined : result.error?.code;

function boundary(): Record<string, unknown> {
  return {
    'boundary.effectiveSequence': 1,
    'boundary.effectiveAfterRecordId': null,
    'boundary.prospectiveOnly': true,
  };
}

function provenance(): Record<string, unknown> {
  return {
    'provenance.sourceKind': 'owner_evidence',
    'provenance.sourceRecordId': null,
    'provenance.sourceDigest': digest('a'),
    'provenance.recorderId': 'recorder.main',
  };
}

function base(recordType: string): Record<string, unknown> {
  return {
    recordType,
    recordSchemaVersion: 1,
    repositoryNamespace: 'absinthe.installation.main',
    namespaceKey: digest('f'),
  };
}

function candidateCollectionHex(): string {
  const collection = createCandidateReferenceCollection([{
    candidateRecordId: recordId('dar:v1:authority-evidence:', 'c'),
    candidateCanonicalDigest: digest('d'),
  }]);
  if (!collection.ok) throw new Error('candidate fixture');
  return bytesToHex(collection.value.bytes);
}

function quarantineCollectionHex(): string {
  const collection = createQuarantineBasisReferenceCollection([{
    observationRecordId: recordId('dar:v1:fork-observation:', 'e'),
    observationCanonicalDigest: digest('d'),
  }]);
  if (!collection.ok) throw new Error('quarantine fixture');
  return bytesToHex(collection.value.bytes);
}

function authorityEvidencePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...base('authority_evidence_v1'),
    subjectId: 'subject.main',
    issuerId: 'issuer.main',
    lineageId: 'lineage.main',
    predecessorRecordId: null,
    supersedesRecordId: null,
    action: 'grant',
    lifecycleStatus: 'recorded',
    ...boundary(),
    compatibilityTupleId: tupleId(),
    ...provenance(),
    ...overrides,
  };
}

function validPayloads(): Readonly<Record<string, Record<string, unknown>>> {
  return Object.freeze({
    authority_evidence: authorityEvidencePayload(),
    issuer_policy: {
      ...base('issuer_policy_v1'), issuerId: 'issuer.main', subjectId: 'subject.main', action: 'revoke',
      compatibilityTupleId: tupleId(), lifecycleStatus: 'recorded', predecessorRecordId: null,
      supersedesRecordId: null, terminationRecordId: null, ...boundary(), ...provenance(),
    },
    rollback_permission: {
      ...base('rollback_permission_v1'), issuerId: 'issuer.main', subjectId: 'subject.main',
      rollbackTargetRecordId: recordId('dar:v1:authority-evidence:', 'b'), compatibilityTupleId: tupleId(),
      predecessorRecordId: null, supersedesRecordId: null, terminationRecordId: null, ...boundary(), ...provenance(),
    },
    termination: {
      ...base('termination_v1'), subjectId: 'subject.main', issuerId: 'issuer.main', targetKind: 'authority_evidence',
      targetRecordId: recordId('dar:v1:authority-evidence:', 'b'),
      issuerAuthorityRecordId: recordId('dar:v1:authority-evidence:', 'c'), predecessorRecordId: null,
      supersedesRecordId: null, ...boundary(), ...provenance(),
    },
    compatibility_tuple: {
      ...base('authority_compatibility_tuple_v1'), authorityProtocolVersion: 1, authorityRecordSchemaVersion: 1,
      manifestEvidenceVersion: 1, subjectNamespace: 'subject.main', issuerNamespace: 'issuer.main',
      compatibilityPolicyVersion: 1, installationNamespace: 'absinthe.installation.main', action: 'grant',
      sourceClass: 'legacy', migrationEpoch: 1, ...boundary(), ...provenance(),
    },
    external_subject_mapping: {
      ...base('external_subject_mapping_v1'), mappingKind: 'subject', provider: 'provider.main',
      externalNamespace: 'namespace.main', externalIdentifier: 'External:1', internalId: 'subject.main',
      predecessorRecordId: null, supersedesRecordId: null, ...boundary(), ...provenance(),
    },
    external_issuer_mapping: {
      ...base('external_issuer_mapping_v1'), mappingKind: 'issuer', provider: 'provider.main',
      externalNamespace: 'namespace.main', externalIdentifier: 'External:1', internalId: 'issuer.main',
      predecessorRecordId: null, supersedesRecordId: null, ...boundary(), ...provenance(),
    },
    conflict_observation: {
      ...base('conflict_observation_v1'), subjectId: 'subject.main', lineageId: null, effectiveSequence: 1,
      predecessorRecordId: null, candidateCollectionBytes: candidateCollectionHex(), reasonCode: 'conflicting_candidate',
      ...provenance(),
    },
    fork_observation: {
      ...base('fork_observation_v1'), subjectId: 'subject.main', lineageId: 'lineage.main', effectiveSequence: 1,
      predecessorRecordId: null, candidateCollectionBytes: candidateCollectionHex(), reasonCode: 'confirmed_fork',
      ...provenance(),
    },
    subject_quarantine: {
      ...base('subject_quarantine_v1'), subjectId: 'subject.main', quarantineState: 'forked', reasonCode: 'confirmed_fork',
      quarantineBasisCollectionBytes: quarantineCollectionHex(), permanent: true, ...boundary(), ...provenance(),
    },
    migration_classification: {
      ...base('migration_classification_v1'), batchId: 'batch.main', sourceKind: 'legacy', sourceDigest: digest('b'),
      classification: 'A', supersedesClassificationId: null, ...provenance(),
    },
  });
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
    expect(code(decodeK334CanonicalRecord({
      ...created.value,
      recordId: recordId('dar:v1:authority-evidence:', 'b'),
    }))).toBe('CANONICAL_DIGEST_MISMATCH');
  });

  it('creates, encodes, and decodes every supported semantic record kind', () => {
    for (const [kind, payload] of Object.entries(validPayloads())) {
      const created = createK334CanonicalRecord({ kind, payload });
      expect(created.ok, kind).toBe(true);
      if (!created.ok) continue;
      const encoded = encodeK334CanonicalRecord(created.value);
      expect(encoded.ok, kind).toBe(true);
      if (!encoded.ok) continue;
      expect(decodeK334CanonicalRecordBytes(encoded.value)).toEqual(created);
    }
  });

  it('rejects semantic violations before identity construction and preserves input isolation', () => {
    const valid = authorityEvidencePayload();
    const created = createK334CanonicalRecord({ kind: 'authority_evidence', payload: valid });
    expect(created.ok).toBe(true);
    valid.action = 'revoke';
    if (created.ok) expect(created.value.payload.action).toBe('grant');

    expect(code(createK334CanonicalRecord({ kind: 'authority_evidence', payload: authorityEvidencePayload({ action: 'revoke' }) }))).toBe('RECORD_KIND_MISMATCH');
    const missingSubject = authorityEvidencePayload(); delete missingSubject.subjectId;
    expect(code(createK334CanonicalRecord({ kind: 'authority_evidence', payload: missingSubject }))).toBe('MISSING_FIELD');
    expect(code(createK334CanonicalRecord({ kind: 'authority_evidence', payload: authorityEvidencePayload({ subjectId: 'bad value' }) }))).toBe('INVALID_IDENTIFIER');
    expect(code(createK334CanonicalRecord({ kind: 'authority_evidence', payload: authorityEvidencePayload({ 'provenance.sourceDigest': 'A'.repeat(64) }) }))).toBe('INVALID_DIGEST');
    expect(code(createK334CanonicalRecord({ kind: 'authority_evidence', payload: authorityEvidencePayload({ 'boundary.effectiveSequence': 0 }) }))).toBe('INVALID_INTEGER');
    expect(code(createK334CanonicalRecord({ kind: 'external_subject_mapping', payload: {
      ...validPayloads().external_subject_mapping, provider: 'Provider.Main',
    } }))).toBe('INVALID_IDENTIFIER');
    expect(code(createK334CanonicalRecord({ kind: 'compatibility_tuple', payload: {
      ...validPayloads().compatibility_tuple, migrationEpoch: '1',
    } }))).toBe('INVALID_FIELD_TYPE');
    expect(code(createK334CanonicalRecord({ kind: 'compatibility_tuple', payload: {
      ...validPayloads().compatibility_tuple, installationNamespace: 'absinthe.installation.other',
    } }))).toBe('RELATIONSHIP_MISMATCH');
    expect(code(createK334CanonicalRecord({ kind: 'conflict_observation', payload: {
      ...validPayloads().conflict_observation, candidateCollectionBytes: quarantineCollectionHex(),
    } }))).toBe('INVALID_ENCODED_INPUT');
    expect(code(createK334CanonicalRecord({ kind: 'conflict_observation', payload: {
      ...validPayloads().conflict_observation, 'boundary.effectiveSequence': 1,
    } }))).toBe('UNKNOWN_FIELD');
    expect(code(createK334CanonicalRecord({ kind: 'subject_quarantine', payload: {
      ...validPayloads().subject_quarantine, permanent: false,
    } }))).toBe('INVALID_FIELD_TYPE');
  });

  it('canonicalizes candidate collections by full pair bytes, not input order, and preserves distinct IDs', () => {
    const first = { candidateRecordId: recordId('dar:v1:authority-evidence:', 'a'), candidateCanonicalDigest: digest('a') };
    const second = { candidateRecordId: recordId('dar:v1:authority-evidence:', 'b'), candidateCanonicalDigest: digest('a') };
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
    const candidate = { candidateRecordId: recordId('dar:v1:authority-evidence:', 'a'), candidateCanonicalDigest: digest('a') };
    const candidatePair = encodeCandidateReference(candidate);
    const quarantine = createQuarantineBasisReferenceCollection([
      { observationRecordId: recordId('dar:v1:fork-observation:', 'a'), observationCanonicalDigest: digest('a') },
    ]);
    expect(candidatePair.ok && quarantine.ok).toBe(true);
    if (!candidatePair.ok || !quarantine.ok) return;
    expect(candidatePair.value).not.toEqual(quarantine.value.bytes);
    const malformed = new Uint8Array(candidatePair.value); malformed[0] = 0;
    expect(code(decodeCandidateReferenceCollection(malformed))).toBe('INVALID_ENCODED_INPUT');
  });

  it('accepts only conflict or fork observation IDs as quarantine bases before collection identity generation', () => {
    const fork = {
      observationRecordId: recordId('dar:v1:fork-observation:', 'a'),
      observationCanonicalDigest: digest('a'),
    };
    const conflict = {
      observationRecordId: recordId('dar:v1:conflict-observation:', 'b'),
      observationCanonicalDigest: digest('b'),
    };
    const accepted = createQuarantineBasisReferenceCollection([fork, conflict]);
    expect(accepted.ok).toBe(true);

    const invalidPrefixes = [
      'dar:v1:authority-evidence:',
      'dar:v1:issuer-policy:',
      'dar:v1:termination:',
      'dar:v1:external-subject-mapping:',
      'dar:v1:migration-classification:',
    ];
    for (const prefix of invalidPrefixes) {
      expect(code(createQuarantineBasisReferenceCollection([{
        observationRecordId: recordId(prefix, 'c'),
        observationCanonicalDigest: digest('c'),
      }]))).toBe('INVALID_IDENTIFIER');
    }
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
    }))).toBe('RECORD_KIND_MISMATCH');
    const different = createK334CanonicalRecord({
      kind: 'authority_evidence', payload: authorityEvidencePayload({ lifecycleStatus: 'proposed' }),
    });
    expect(different.ok).toBe(true);
    if (different.ok) {
      expect(code(repository.append({ ...different.value, recordId: created.value.recordId }))).toBe('CANONICAL_DIGEST_MISMATCH');
    }
    expect(repository.size()).toBe(1);
  });
});
