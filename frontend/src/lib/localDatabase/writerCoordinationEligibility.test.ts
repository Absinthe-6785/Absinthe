import { describe, expect, it } from 'vitest';
import {
  DeterministicCoordinationScheduler,
  K329A_REVIEWED_WRITER_MANIFEST_ENTRIES,
  assertCoordinationInvariant,
  canTransitionCoordinationState,
  createK329AReviewedWriterManifest,
  decodeAdmissionOperationCanonical,
  decodeCoordinationAuthorityCanonical,
  decodeEligibilityEvidence,
  decodeReviewedWriterManifestCanonical,
  decodeWriterRegistrationCanonical,
  deriveLiveWriterInstanceSetDigest,
  deriveReviewedWriterManifestDigest,
  deriveWriterSetDigest,
  encodeAdmissionOperationCanonical,
  encodeCoordinationAuthorityCanonical,
  encodeEligibilityEvidence,
  encodeReviewedWriterManifestCanonical,
  encodeWriterRegistrationCanonical,
  evaluateWriterCoordinationEligibility,
  reduceWriterCoordination,
  validateAdmissionOperation,
  validateCoordinationAuthority,
  validateReviewedWriterManifest,
  validateWriterRegistration,
  type AdmissionOperationRecord,
  type CoordinationAuthorityRecord,
  type ReviewedWriterManifest,
  type WriterCoordinationAction,
  type WriterCoordinationEligibilityInput,
  type WriterCoordinationModelState,
  type WriterEligibilityErrorCode,
  type WriterRegistrationRecord,
} from './writerCoordinationEligibility';

const PHYSICAL = '1'.repeat(64);
const SOURCE = '2'.repeat(64);
const OTHER = '3'.repeat(64);
const SESSION = `writer-session-v1:${'4'.repeat(32)}`;
const WRITER_TYPE = 'notes_snapshot_writer';
const WRITER_ID = `writer-v1:window:${WRITER_TYPE}:${'5'.repeat(32)}`;
const OPERATION_ID = `writer-operation-v1:${'6'.repeat(64)}`;
const IDEMPOTENCY = `writer-idempotency-v1:${'7'.repeat(64)}`;
const text = new TextEncoder();

function manifest(overrides: Partial<ReviewedWriterManifest> = {}): ReviewedWriterManifest {
  return {
    kind: 'absinthe_reviewed_writer_manifest', schemaVersion: 1, byteFormatVersion: 1,
    physicalSourceDigest: PHYSICAL, manifestVersion: 'k329a-reviewed-v1',
    entries: [{ writerTypeId: WRITER_TYPE, contextTypes: ['window'],
      requiredCapabilities: ['admission', 'drain_ack', 'source_write'],
      authorityRole: 'authoritative_source_writer', coordinationRequirement: 'must_participate',
      exclusionProofCode: null }],
    ...overrides,
  };
}

function authority(overrides: Partial<CoordinationAuthorityRecord> = {}, reviewed = manifest()): CoordinationAuthorityRecord {
  return {
    kind: 'absinthe_writer_coordination_authority', schemaVersion: 1, byteFormatVersion: 1,
    physicalSourceDigest: PHYSICAL, coordinationEpoch: 2, state: 'VERIFYING_SOURCE',
    coordinatorSessionId: SESSION, reviewedManifestDigest: deriveReviewedWriterManifestDigest(reviewed),
    admissionOpen: false, unresolvedOperationCount: 0, sourceRevisionBefore: '41', sourceRevisionAfter: '41',
    sourceDigestBefore: SOURCE, sourceDigestAfter: SOURCE, transitionRevision: 7,
    createdSequence: 1, updatedSequence: 9, failureCode: null, ...overrides,
  };
}

function registration(overrides: Partial<WriterRegistrationRecord> = {}): WriterRegistrationRecord {
  return {
    kind: 'absinthe_writer_registration', schemaVersion: 1, byteFormatVersion: 1,
    physicalSourceDigest: PHYSICAL, writerTypeId: WRITER_TYPE, writerId: WRITER_ID, sessionId: SESSION,
    contextType: 'window', coordinationEpoch: 2, capabilities: ['admission', 'drain_ack', 'source_write'],
    registrationState: 'drain_acknowledged', coordinated: true, acknowledgedTransitionRevision: 7,
    latestOperationId: null, lastSeenSequence: 8, ...overrides,
  };
}

function operation(overrides: Partial<AdmissionOperationRecord> = {}): AdmissionOperationRecord {
  return {
    kind: 'absinthe_writer_admission_operation', schemaVersion: 1, byteFormatVersion: 1,
    physicalSourceDigest: PHYSICAL, operationId: OPERATION_ID, idempotencyKey: IDEMPOTENCY,
    writerTypeId: WRITER_TYPE, writerId: WRITER_ID, sessionId: SESSION, coordinationEpoch: 2,
    admissionTransitionRevision: 2, mutationType: 'snapshot_replace', expectedSourceRevision: '40',
    state: 'committed', committedSourceRevision: '41', terminalResult: 'committed', ...overrides,
  };
}

function checkpoints(records: readonly WriterRegistrationRecord[] = [registration()]) {
  return { beforeDrain: records, afterAdmissionClosed: records, afterOperationsTerminal: records,
    beforeSourceVerification: records, afterSourceVerification: records, beforeEvidenceCommit: records };
}

function validInput(overrides: Partial<WriterCoordinationEligibilityInput> = {}): WriterCoordinationEligibilityInput {
  const reviewed = overrides.reviewedManifest ?? manifest();
  const inputAuthority = overrides.authority ?? authority({}, reviewed);
  return {
    authority: inputAuthority, reviewedManifest: reviewed,
    reviewedManifestDigest: deriveReviewedWriterManifestDigest(reviewed), registrationCheckpoints: checkpoints(),
    operations: [operation()], source: { source: 'indexeddb', physicalSourceDigest: PHYSICAL,
      exactSupportedSource: true, ownershipProven: true, canonical: true, withinBounds: true,
      mixedOrDivergent: false, unknownContainerPresent: false, revisionBefore: '41', revisionAfter: '41',
      digestBefore: SOURCE, digestAfter: SOURCE, rejectionCode: null },
    coordinationSupported: true, lockAvailable: true, restoreOrImportActive: false, syncWriterActive: false,
    k328AdapterAvailable: true, k328PhysicalSourceDigest: PHYSICAL, ...overrides,
  };
}

function expectCode(input: WriterCoordinationEligibilityInput, code: WriterEligibilityErrorCode): void {
  expect(evaluateWriterCoordinationEligibility(input)).toMatchObject({ eligible: false, code });
}

function rawReplace(bytes: Uint8Array, search: string, replacement: string): Uint8Array {
  return text.encode(new TextDecoder().decode(bytes).replace(search, replacement));
}

describe('K-329A reviewed manifest and exact live-instance proof', () => {
  it('ships a non-empty source-reviewed versioned manifest without duplicate types', () => {
    const reviewed = createK329AReviewedWriterManifest(PHYSICAL);
    expect(validateReviewedWriterManifest(reviewed)).toBe(true);
    expect(reviewed.entries).toBe(K329A_REVIEWED_WRITER_MANIFEST_ENTRIES);
    expect(reviewed.entries).toHaveLength(27);
    expect(new Set(reviewed.entries.map(entry => entry.writerTypeId)).size).toBe(reviewed.entries.length);
  });

  it('grants eligibility only with both exact digest layers', () => {
    const input = validInput(); const result = evaluateWriterCoordinationEligibility(input);
    expect(result).toMatchObject({ eligible: true, physicalSourceDigest: PHYSICAL, stableRevision: '41' });
    if (!result.eligible) return;
    expect(result.reviewedManifestDigest).toBe(deriveReviewedWriterManifestDigest(input.reviewedManifest));
    expect(result.liveWriterInstanceSetDigest).toBe(deriveLiveWriterInstanceSetDigest([registration()]));
    expect(assertCoordinationInvariant(input)).toBe(true);
  });

  it('rejects an empty manifest and the legacy empty type digest', () => {
    const empty = manifest({ entries: [] });
    expect(validateReviewedWriterManifest(empty)).toBe(false);
    expect(evaluateWriterCoordinationEligibility({ ...validInput(), reviewedManifest: empty })).toMatchObject({
      eligible: false, code: 'WRITER_INVENTORY_INCOMPLETE',
    });
    expect(() => deriveWriterSetDigest([])).toThrow('WRITER_INVENTORY_INCOMPLETE');
  });

  it('rejects an all-excluded manifest as vacuous', () => {
    const reviewed = manifest({ entries: [{ ...manifest().entries[0], coordinationRequirement: 'excluded_with_proof',
      authorityRole: 'dormant_or_test_writer', exclusionProofCode: 'DORMANT_NO_PRODUCTION_CALLER' }] });
    expect(validateReviewedWriterManifest(reviewed)).toBe(false);
  });

  it('rejects missing exclusion proof and proof on a participating writer', () => {
    expect(validateReviewedWriterManifest(manifest({ entries: [{ ...manifest().entries[0],
      coordinationRequirement: 'excluded_with_proof', exclusionProofCode: null }] }))).toBe(false);
    expect(validateReviewedWriterManifest(manifest({ entries: [{ ...manifest().entries[0],
      exclusionProofCode: 'DORMANT_NO_PRODUCTION_CALLER' }] }))).toBe(false);
  });

  it('rejects an exclusion proof that does not match the reviewed authority role', () => {
    expect(validateReviewedWriterManifest(manifest({ entries: [{ ...manifest().entries[0],
      authorityRole: 'metadata_writer', coordinationRequirement: 'excluded_with_proof',
      exclusionProofCode: 'AUXILIARY_CONTAINER_NOT_AUTHORITY' }] }))).toBe(false);
  });

  it('rejects manifest digest and physical-source changes', () => {
    expectCode(validInput({ reviewedManifestDigest: OTHER }), 'REVIEWED_MANIFEST_DIGEST_MISMATCH');
    const reviewed = manifest({ physicalSourceDigest: OTHER });
    expectCode(validInput({ reviewedManifest: reviewed, authority: authority({}, reviewed) }), 'REVIEWED_MANIFEST_INVALID');
  });

  it('requires every participating manifest type', () => {
    const reviewed = manifest({ entries: [...manifest().entries, { ...manifest().entries[0],
      writerTypeId: 'vault_snapshot_writer' }] });
    expectCode(validInput({ reviewedManifest: reviewed, authority: authority({}, reviewed) }), 'WRITER_INVENTORY_INCOMPLETE');
  });

  it('requires disabled writers to be durably disabled', () => {
    const disabledType = 'vault_snapshot_writer';
    const reviewed = manifest({ entries: [...manifest().entries, { ...manifest().entries[0], writerTypeId: disabledType,
      coordinationRequirement: 'must_be_disabled' }] });
    const notDisabled = registration({ writerTypeId: disabledType,
      writerId: `writer-v1:window:${disabledType}:${'8'.repeat(32)}`,
      sessionId: `writer-session-v1:${'9'.repeat(32)}` });
    expectCode(validInput({ reviewedManifest: reviewed, authority: authority({}, reviewed),
      registrationCheckpoints: checkpoints([registration(), notDisabled]) }), 'WRITER_NOT_COORDINATED');
  });

  it('rejects empty live snapshots', () => {
    expectCode(validInput({ registrationCheckpoints: checkpoints([]) }), 'LIVE_INSTANCE_SET_EMPTY');
  });

  it('rejects a same-type new tab during drain', () => {
    const second = registration({ writerId: `writer-v1:window:${WRITER_TYPE}:${'8'.repeat(32)}`,
      sessionId: `writer-session-v1:${'9'.repeat(32)}` });
    expectCode(validInput({ registrationCheckpoints: { ...checkpoints(), afterAdmissionClosed: [registration(), second] } }),
      'LIVE_INSTANCE_SET_CHANGED');
  });

  it('rejects disappearance and restart even for the same writer type', () => {
    const restarted = registration({ writerId: `writer-v1:window:${WRITER_TYPE}:${'8'.repeat(32)}`,
      sessionId: `writer-session-v1:${'9'.repeat(32)}` });
    expectCode(validInput({ registrationCheckpoints: { ...checkpoints(), beforeEvidenceCommit: [restarted] } }),
      'LIVE_INSTANCE_SET_CHANGED');
    expectCode(validInput({ registrationCheckpoints: { ...checkpoints(), beforeEvidenceCommit: [] } }),
      'LIVE_INSTANCE_SET_EMPTY');
  });

  it('rejects duplicate writer and session identities', () => {
    const duplicateWriter = registration({ sessionId: `writer-session-v1:${'9'.repeat(32)}` });
    expectCode(validInput({ registrationCheckpoints: checkpoints([registration(), duplicateWriter]) }),
      'WRITER_REGISTRATION_MALFORMED');
    const duplicateSession = registration({ writerId: `writer-v1:window:${WRITER_TYPE}:${'8'.repeat(32)}` });
    expectCode(validInput({ registrationCheckpoints: checkpoints([registration(), duplicateSession]) }),
      'WRITER_REGISTRATION_MALFORMED');
  });

  it('rejects capability or state changes inside protected verification', () => {
    const changedCapability = registration({ capabilities: ['admission', 'drain_ack'] });
    expectCode(validInput({ registrationCheckpoints: { ...checkpoints(), afterSourceVerification: [changedCapability] } }),
      'LIVE_INSTANCE_SET_CHANGED');
    const changedState = registration({ registrationState: 'disabled', coordinated: false,
      acknowledgedTransitionRevision: null });
    expectCode(validInput({ registrationCheckpoints: { ...checkpoints(), afterSourceVerification: [changedState] } }),
      'LIVE_INSTANCE_SET_CHANGED');
  });

  it('rejects stale epoch and unknown writer type', () => {
    expectCode(validInput({ registrationCheckpoints: checkpoints([registration({ coordinationEpoch: 1 })]) }),
      'COORDINATION_EPOCH_STALE');
    const unknown = registration({ writerTypeId: 'unknown_writer',
      writerId: `writer-v1:window:unknown_writer:${'5'.repeat(32)}` });
    expectCode(validInput({ registrationCheckpoints: checkpoints([unknown]) }), 'UNKNOWN_WRITER_PRESENT');
  });

  it('binds embedded writer type and context to registration fields', () => {
    expect(validateWriterRegistration(registration({ writerTypeId: 'other_writer' }))).toBe(false);
    expect(validateWriterRegistration(registration({ contextType: 'dedicated_worker' }))).toBe(false);
  });
});

describe('K-329A strict canonical persisted records', () => {
  const cases = [
    ['authority', () => authority(), encodeCoordinationAuthorityCanonical, decodeCoordinationAuthorityCanonical],
    ['registration', () => registration(), encodeWriterRegistrationCanonical, decodeWriterRegistrationCanonical],
    ['operation', () => operation(), encodeAdmissionOperationCanonical, decodeAdmissionOperationCanonical],
    ['manifest', () => manifest(), encodeReviewedWriterManifestCanonical, decodeReviewedWriterManifestCanonical],
  ] as const;

  for (const [name, make, encode, decode] of cases) {
    it(`round trips canonical ${name}`, () => {
      const value = make(); const bytes = (encode as (value: never) => Uint8Array)(value as never);
      expect((decode as (bytes: Uint8Array) => { ok: boolean })(bytes).ok).toBe(true);
    });

    it(`rejects whitespace, reordered, and unknown ${name} bytes`, () => {
      const value = make(); const bytes = (encode as (value: never) => Uint8Array)(value as never);
      const raw = new TextDecoder().decode(bytes);
      expect((decode as (bytes: Uint8Array) => { ok: boolean })(text.encode(` ${raw}`)).ok).toBe(false);
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const reordered = JSON.stringify(Object.fromEntries(Object.entries(parsed).reverse()));
      expect((decode as (bytes: Uint8Array) => { ok: boolean })(text.encode(reordered)).ok).toBe(false);
      expect((decode as (bytes: Uint8Array) => { ok: boolean })(text.encode(raw.replace('{', '{"unknown":1,'))).ok).toBe(false);
    });

    it(`rejects duplicate decoded keys and unsupported ${name} version`, () => {
      const value = make(); const bytes = (encode as (value: never) => Uint8Array)(value as never);
      const raw = new TextDecoder().decode(bytes);
      expect((decode as (bytes: Uint8Array) => { ok: boolean })(text.encode(raw.replace('{', '{"kind":"duplicate",'))).ok).toBe(false);
      expect((decode as (bytes: Uint8Array) => { ok: boolean })(rawReplace(bytes, '"schemaVersion":1', '"schemaVersion":2')).ok).toBe(false);
    });
  }

  it('round trips eligibility evidence and rejects duplicate keys', () => {
    const result = evaluateWriterCoordinationEligibility(validInput()); expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    const bytes = encodeEligibilityEvidence(result.evidence);
    expect(decodeEligibilityEvidence(bytes)).toEqual({ ok: true, evidence: result.evidence });
    const duplicate = text.encode(new TextDecoder().decode(bytes).replace('{', '{"result":"eligible",'));
    expect(decodeEligibilityEvidence(duplicate)).toEqual({ ok: false, code: 'ELIGIBILITY_EVIDENCE_CORRUPT' });
  });

  it('rejects invalid UTF-8 and truncated bytes for every decoder', () => {
    const invalid = new Uint8Array([0xc3, 0x28]);
    expect(decodeCoordinationAuthorityCanonical(invalid).ok).toBe(false);
    expect(decodeWriterRegistrationCanonical(invalid).ok).toBe(false);
    expect(decodeAdmissionOperationCanonical(invalid).ok).toBe(false);
    expect(decodeReviewedWriterManifestCanonical(invalid).ok).toBe(false);
    expect(decodeEligibilityEvidence(invalid).ok).toBe(false);
  });

  it('rejects accessors and inherited properties before persistence', () => {
    const accessor = { ...registration() } as Record<string, unknown>;
    Object.defineProperty(accessor, 'writerTypeId', { enumerable: true, get: () => WRITER_TYPE });
    expect(validateWriterRegistration(accessor)).toBe(false);
    expect(validateCoordinationAuthority(Object.create(authority()))).toBe(false);
  });
});

describe('K-329A eligibility failure boundaries', () => {
  it('rejects admission, operation, restore, and sync ambiguity', () => {
    expectCode(validInput({ authority: authority({ state: 'OPEN', admissionOpen: true }) }), 'ADMISSION_NOT_CLOSED');
    expectCode(validInput({ authority: authority({ unresolvedOperationCount: 1 }) }), 'IN_FLIGHT_WRITE_PRESENT');
    expectCode(validInput({ operations: [operation({ state: 'admitted', committedSourceRevision: null,
      terminalResult: null })] }), 'IN_FLIGHT_WRITE_PRESENT');
    expectCode(validInput({ restoreOrImportActive: true }), 'RESTORE_OR_IMPORT_ACTIVE');
    expectCode(validInput({ syncWriterActive: true }), 'SYNC_WRITER_ACTIVE');
  });

  it('rejects unstable and ambiguous sources', () => {
    const base = validInput();
    expectCode(validInput({ source: { ...base.source, revisionAfter: '42' } }), 'SOURCE_REVISION_UNSTABLE');
    expectCode(validInput({ source: { ...base.source, digestAfter: OTHER } }), 'SOURCE_CHANGED_DURING_VERIFICATION');
    expectCode(validInput({ source: { ...base.source, mixedOrDivergent: true } }), 'MIXED_SOURCE_DIVERGENCE');
    expectCode(validInput({ source: { ...base.source, ownershipProven: false } }), 'SOURCE_OWNERSHIP_UNPROVEN');
    expectCode(validInput({ source: { ...base.source, unknownContainerPresent: true } }), 'UNKNOWN_CONTEXT_PRESENT');
  });

  it('rejects unbounded or unknown source rejection codes', () => {
    const base = validInput();
    expectCode(validInput({ source: { ...base.source, withinBounds: false } }), 'SOURCE_RESOURCE_BOUND_EXCEEDED');
    expectCode(validInput({ source: { ...base.source, rejectionCode: 'not-a-code' as WriterEligibilityErrorCode } }),
      'ELIGIBILITY_EVIDENCE_CORRUPT');
  });

  it('requires the exact K-328 adapter binding without invoking it', () => {
    expectCode(validInput({ k328AdapterAvailable: false }), 'K328_ADAPTER_UNAVAILABLE');
    expectCode(validInput({ k328PhysicalSourceDigest: OTHER }), 'K328_PHYSICAL_IDENTITY_MISMATCH');
  });

  it('validates operation identities and exact terminal semantics', () => {
    expect(validateAdmissionOperation(operation())).toBe(true);
    expect(validateAdmissionOperation(operation({ writerTypeId: 'other_writer' }))).toBe(false);
    expect(validateAdmissionOperation(operation({ state: 'committed', terminalResult: 'failed' }))).toBe(false);
  });
});

function openState(): WriterCoordinationModelState {
  const reviewed = manifest();
  return { authority: authority({ state: 'OPEN', admissionOpen: true, coordinationEpoch: 2,
    transitionRevision: 1, sourceRevisionBefore: null, sourceRevisionAfter: null,
    sourceDigestBefore: null, sourceDigestAfter: null }, reviewed), reviewedManifest: reviewed,
    registrations: [registration({ registrationState: 'registered', coordinated: true,
      acknowledgedTransitionRevision: null })], operations: [], eligibilityEvidence: null };
}
function coordinator(state: WriterCoordinationModelState, action: Omit<WriterCoordinationAction, keyof {
  actor: never; expectedTransitionRevision: never; expectedCoordinationEpoch: never;
}>): WriterCoordinationAction {
  return { ...action, actor: { kind: 'coordinator', sessionId: SESSION },
    expectedTransitionRevision: state.authority.transitionRevision,
    expectedCoordinationEpoch: state.authority.coordinationEpoch } as WriterCoordinationAction;
}

describe('K-329A executable reducer and races', () => {
  it('closes admission before drain and leaves input immutable', () => {
    const initial = openState(); const before = JSON.stringify(initial);
    const request = reduceWriterCoordination(initial, coordinator(initial, { type: 'REQUEST_DRAIN' }));
    expect(request).toMatchObject({ ok: true, state: { authority: { state: 'DRAIN_REQUESTED', admissionOpen: false } } });
    expect(JSON.stringify(initial)).toBe(before);
  });

  it('rejects a late writer registration after the drain linearization point', () => {
    const initial = openState(); const request = reduceWriterCoordination(initial, coordinator(initial, { type: 'REQUEST_DRAIN' }));
    expect(request.ok).toBe(true); if (!request.ok) return;
    const late = registration({ writerId: `writer-v1:window:${WRITER_TYPE}:${'8'.repeat(32)}`,
      sessionId: `writer-session-v1:${'9'.repeat(32)}`, registrationState: 'registered', acknowledgedTransitionRevision: null });
    const action: WriterCoordinationAction = { type: 'REGISTER_WRITER', registration: late,
      actor: { kind: 'writer', writerId: late.writerId, sessionId: late.sessionId },
      expectedTransitionRevision: request.state.authority.transitionRevision,
      expectedCoordinationEpoch: request.state.authority.coordinationEpoch };
    expect(reduceWriterCoordination(request.state, action)).toMatchObject({ ok: false, code: 'ADMISSION_NOT_CLOSED' });
  });

  it('rejects stale CAS and stale epoch actions deterministically', () => {
    const initial = openState();
    expect(reduceWriterCoordination(initial, { ...coordinator(initial, { type: 'REQUEST_DRAIN' }),
      expectedTransitionRevision: 0 })).toEqual({ ok: false, code: 'TRANSITION_REVISION_STALE' });
    expect(reduceWriterCoordination(initial, { ...coordinator(initial, { type: 'REQUEST_DRAIN' }),
      expectedCoordinationEpoch: 1 })).toEqual({ ok: false, code: 'COORDINATION_EPOCH_STALE' });
  });

  it('allows only the bound writer to acknowledge or terminalize', () => {
    const initial = openState();
    const unauthorized: WriterCoordinationAction = { type: 'ACKNOWLEDGE_DRAIN', writerId: WRITER_ID,
      actor: { kind: 'writer', writerId: WRITER_ID, sessionId: `writer-session-v1:${'9'.repeat(32)}` },
      expectedTransitionRevision: 1, expectedCoordinationEpoch: 2 };
    expect(reduceWriterCoordination(initial, unauthorized)).toEqual({ ok: false, code: 'ACTOR_UNAUTHORIZED' });
  });

  it('admits an operation only while OPEN and fences duplicate idempotency', () => {
    const initial = openState();
    const admitted = operation({ state: 'admitted', committedSourceRevision: null, terminalResult: null,
      admissionTransitionRevision: 1 });
    const action: WriterCoordinationAction = { type: 'ADMIT_OPERATION', operation: admitted,
      actor: { kind: 'writer', writerId: WRITER_ID, sessionId: SESSION },
      expectedTransitionRevision: 1, expectedCoordinationEpoch: 2 };
    const first = reduceWriterCoordination(initial, action); expect(first.ok).toBe(true); if (!first.ok) return;
    expect(first.state.authority.unresolvedOperationCount).toBe(1);
    expect(reduceWriterCoordination(first.state, { ...action,
      expectedTransitionRevision: first.state.authority.transitionRevision })).toMatchObject({ ok: false,
      code: 'IN_FLIGHT_STATE_AMBIGUOUS' });
  });

  it('serializes competing drain coordinators with transition CAS', () => {
    const initial = openState(); const sameAction = coordinator(initial, { type: 'REQUEST_DRAIN' });
    const winner = reduceWriterCoordination(initial, sameAction); expect(winner.ok).toBe(true); if (!winner.ok) return;
    expect(reduceWriterCoordination(winner.state, sameAction)).toEqual({ ok: false, code: 'TRANSITION_REVISION_STALE' });
  });

  it('rejects verifier and recovery actions from the wrong durable session', () => {
    const initial = openState();
    expect(reduceWriterCoordination(initial, { ...coordinator(initial, { type: 'ABORT', failureCode: null }),
      actor: { kind: 'recovery', sessionId: `writer-session-v1:${'9'.repeat(32)}` } })).toEqual({ ok: false,
      code: 'ACTOR_UNAUTHORIZED' });
  });

  it('models only reviewed state transitions', () => {
    expect(canTransitionCoordinationState('OPEN', 'DRAIN_REQUESTED')).toBe(true);
    expect(canTransitionCoordinationState('OPEN', 'ELIGIBLE')).toBe(false);
    expect(canTransitionCoordinationState('ELIGIBLE', 'OPEN')).toBe(false);
  });

  it('runs explicit race schedules without timers', () => {
    const scheduler = new DeterministicCoordinationScheduler(); let state = 'open';
    scheduler.schedule('request-drain', () => { state = 'closed'; });
    scheduler.schedule('late-write', () => { if (state === 'open') state = 'mutated'; });
    scheduler.run('request-drain'); scheduler.run('late-write');
    expect(state).toBe('closed'); expect(scheduler.history()).toEqual(['request-drain', 'late-write']);
  });
});

describe('K-329A additional identity, manifest, and canonical negatives', () => {
  const invalidRegistrations: readonly [string, Partial<WriterRegistrationRecord>][] = [
    ['malformed component count', { writerId: `writer-v1:window:${WRITER_TYPE}` }],
    ['uppercase nonce', { writerId: `writer-v1:window:${WRITER_TYPE}:${'A'.repeat(32)}` }],
    ['invalid type character', { writerTypeId: 'notes writer' }],
    ['overlong embedded type', { writerTypeId: 'a'.repeat(81),
      writerId: `writer-v1:window:${'a'.repeat(81)}:${'5'.repeat(32)}` }],
    ['noncanonical context', { writerId: `writer-v1:Window:${WRITER_TYPE}:${'5'.repeat(32)}` }],
    ['invalid session nonce', { sessionId: 'writer-session-v1:not-hex' }],
  ];
  for (const [name, overrides] of invalidRegistrations) {
    it(`rejects writer identity: ${name}`, () => expect(validateWriterRegistration(registration(overrides))).toBe(false));
  }

  const invalidManifests: readonly [string, Partial<ReviewedWriterManifest>][] = [
    ['unknown schema version', { schemaVersion: 2 as 1 }],
    ['unknown byte version', { byteFormatVersion: 2 as 1 }],
    ['malformed physical digest', { physicalSourceDigest: 'short' }],
    ['duplicate type', { entries: [manifest().entries[0], manifest().entries[0]] }],
    ['noncanonical order', { entries: [{ ...manifest().entries[0], writerTypeId: 'z_writer' }, manifest().entries[0]] }],
    ['duplicate capability', { entries: [{ ...manifest().entries[0],
      requiredCapabilities: ['admission', 'admission'] }] }],
  ];
  for (const [name, overrides] of invalidManifests) {
    it(`rejects reviewed manifest: ${name}`, () => expect(validateReviewedWriterManifest(manifest(overrides))).toBe(false));
  }

  it('never confuses the reviewed manifest and live instance digests', () => {
    const input = validInput();
    expect(deriveReviewedWriterManifestDigest(input.reviewedManifest)).not.toBe(
      deriveLiveWriterInstanceSetDigest(input.registrationCheckpoints.beforeEvidenceCommit));
    expectCode({ ...input, reviewedManifestDigest: deriveLiveWriterInstanceSetDigest([registration()]) },
      'REVIEWED_MANIFEST_DIGEST_MISMATCH');
  });

  it('rejects a nested duplicate key in a manifest entry', () => {
    const raw = new TextDecoder().decode(encodeReviewedWriterManifestCanonical(manifest()));
    const duplicate = text.encode(raw.replace('"entries":[{', '"entries":[{"writerTypeId":"duplicate",'));
    expect(decodeReviewedWriterManifestCanonical(duplicate).ok).toBe(false);
  });

  it('rejects duplicate registration capabilities in canonical bytes', () => {
    const raw = new TextDecoder().decode(encodeWriterRegistrationCanonical(registration()));
    const duplicate = text.encode(raw.replace('"capabilities":["admission","drain_ack","source_write"]',
      '"capabilities":["admission","admission","drain_ack","source_write"]'));
    expect(decodeWriterRegistrationCanonical(duplicate).ok).toBe(false);
  });

  it('rejects trailing bytes and excessive nesting', () => {
    const authorityBytes = encodeCoordinationAuthorityCanonical(authority());
    expect(decodeCoordinationAuthorityCanonical(text.encode(`${new TextDecoder().decode(authorityBytes)}\n`)).ok).toBe(false);
    expect(decodeCoordinationAuthorityCanonical(text.encode(`${'['.repeat(18)}null${']'.repeat(18)}`)).ok).toBe(false);
  });

  it('returns unsupported-version distinctly without trusting unknown fields', () => {
    const bytes = rawReplace(encodeAdmissionOperationCanonical(operation()), '"schemaVersion":1', '"schemaVersion":9');
    expect(decodeAdmissionOperationCanonical(bytes)).toEqual({ ok: false,
      code: 'ELIGIBILITY_PROTOCOL_VERSION_UNSUPPORTED' });
  });

  it('derives retryability and action only from a known stable error code', () => {
    const input = validInput();
    expect(evaluateWriterCoordinationEligibility({ ...input, source: { ...input.source,
      rejectionCode: 'SOURCE_REVISION_UNSTABLE' } })).toEqual({ eligible: false,
      code: 'SOURCE_REVISION_UNSTABLE', retryable: true,
      requiredAction: 'restart verification after the source is durably quiescent' });
  });
});

describe('K-329A full protocol execution and restart evidence', () => {
  function success(result: ReturnType<typeof reduceWriterCoordination>): WriterCoordinationModelState {
    expect(result.ok).toBe(true); if (!result.ok) throw new Error(result.code); return result.state;
  }
  function verifierAction(state: WriterCoordinationModelState,
    action: { type: 'BEGIN_SOURCE_VERIFICATION' }
      | { type: 'CAPTURE_SOURCE_CHECKPOINT'; revisionBefore: string; revisionAfter: string; digestBefore: string; digestAfter: string }
      | { type: 'COMMIT_ELIGIBILITY'; input: WriterCoordinationEligibilityInput }): WriterCoordinationAction {
    return { ...action, actor: { kind: 'verifier', sessionId: SESSION },
      expectedTransitionRevision: state.authority.transitionRevision,
      expectedCoordinationEpoch: state.authority.coordinationEpoch };
  }

  it('executes the complete reviewed path from OPEN through ELIGIBLE', () => {
    const initial = openState();
    const requested = success(reduceWriterCoordination(initial, coordinator(initial, { type: 'REQUEST_DRAIN' })));
    const acknowledged = success(reduceWriterCoordination(requested, {
      type: 'ACKNOWLEDGE_DRAIN', writerId: WRITER_ID, actor: { kind: 'writer', writerId: WRITER_ID, sessionId: SESSION },
      expectedTransitionRevision: requested.authority.transitionRevision,
      expectedCoordinationEpoch: requested.authority.coordinationEpoch,
    }));
    const closed = success(reduceWriterCoordination(acknowledged, coordinator(acknowledged, { type: 'CLOSE_ADMISSION' })));
    const draining = success(reduceWriterCoordination(closed, coordinator(closed, { type: 'BEGIN_DRAIN' })));
    const quiescent = success(reduceWriterCoordination(draining, coordinator(draining, { type: 'MARK_QUIESCENT' })));
    expect(quiescent.authority.coordinationEpoch).toBe(3);
    const verifying = success(reduceWriterCoordination(quiescent,
      verifierAction(quiescent, { type: 'BEGIN_SOURCE_VERIFICATION' })));
    const captured = success(reduceWriterCoordination(verifying, verifierAction(verifying,
      { type: 'CAPTURE_SOURCE_CHECKPOINT', revisionBefore: '41', revisionAfter: '41',
        digestBefore: SOURCE, digestAfter: SOURCE })));
    const eligibilityInput: WriterCoordinationEligibilityInput = {
      ...validInput(), authority: captured.authority, reviewedManifest: captured.reviewedManifest,
      reviewedManifestDigest: captured.authority.reviewedManifestDigest,
      registrationCheckpoints: { beforeDrain: initial.registrations, afterAdmissionClosed: closed.registrations,
        afterOperationsTerminal: quiescent.registrations, beforeSourceVerification: quiescent.registrations,
        afterSourceVerification: captured.registrations, beforeEvidenceCommit: captured.registrations },
      operations: captured.operations,
    };
    const eligible = success(reduceWriterCoordination(captured,
      verifierAction(captured, { type: 'COMMIT_ELIGIBILITY', input: eligibilityInput })));
    expect(eligible.authority.state).toBe('ELIGIBLE');
    expect(eligible.eligibilityEvidence).toMatchObject({ result: 'eligible', coordinationEpoch: 3 });
  });

  const resumable: readonly [string, CoordinationAuthorityRecord['state'], WriterCoordinationAction['type']][] = [
    ['open', 'OPEN', 'REQUEST_DRAIN'],
    ['drain requested', 'DRAIN_REQUESTED', 'CLOSE_ADMISSION'],
    ['admission closed', 'ADMISSION_CLOSED', 'BEGIN_DRAIN'],
    ['draining', 'DRAINING', 'MARK_QUIESCENT'],
    ['quiescent candidate', 'QUIESCENT_CANDIDATE', 'BEGIN_SOURCE_VERIFICATION'],
    ['verifying source', 'VERIFYING_SOURCE', 'CAPTURE_SOURCE_CHECKPOINT'],
  ];
  for (const [name, stateName, actionType] of resumable) {
    it(`revalidates a canonical persisted ${name} snapshot before resume`, () => {
      const reviewed = manifest();
      const model: WriterCoordinationModelState = {
        authority: authority({ state: stateName, admissionOpen: stateName === 'OPEN', transitionRevision: 12,
          sourceRevisionBefore: stateName === 'VERIFYING_SOURCE' ? null : '41',
          sourceRevisionAfter: stateName === 'VERIFYING_SOURCE' ? null : '41',
          sourceDigestBefore: stateName === 'VERIFYING_SOURCE' ? null : SOURCE,
          sourceDigestAfter: stateName === 'VERIFYING_SOURCE' ? null : SOURCE }, reviewed),
        reviewedManifest: reviewed,
        registrations: [registration({ acknowledgedTransitionRevision: 7,
          registrationState: stateName === 'OPEN' ? 'registered' : 'drain_acknowledged' })],
        operations: [], eligibilityEvidence: null,
      };
      const decoded = decodeCoordinationAuthorityCanonical(encodeCoordinationAuthorityCanonical(model.authority));
      expect(decoded.ok).toBe(true);
      let action: WriterCoordinationAction;
      if (actionType === 'BEGIN_SOURCE_VERIFICATION') action = verifierAction(model, { type: actionType });
      else if (actionType === 'CAPTURE_SOURCE_CHECKPOINT') action = verifierAction(model,
        { type: actionType, revisionBefore: '41', revisionAfter: '41', digestBefore: SOURCE, digestAfter: SOURCE });
      else action = coordinator(model, { type: actionType } as never);
      expect(reduceWriterCoordination(model, action).ok).toBe(true);
    });
  }

  const forbidden: readonly [string, CoordinationAuthorityRecord['state'], WriterCoordinationAction][] = [
    ['OPEN to eligibility by writer', 'OPEN', { type: 'COMMIT_ELIGIBILITY', input: validInput(),
      actor: { kind: 'writer', writerId: WRITER_ID, sessionId: SESSION }, expectedTransitionRevision: 1,
      expectedCoordinationEpoch: 2 }],
    ['DRAIN_REQUESTED to quiescent', 'DRAIN_REQUESTED', { type: 'MARK_QUIESCENT',
      actor: { kind: 'coordinator', sessionId: SESSION }, expectedTransitionRevision: 1, expectedCoordinationEpoch: 2 }],
    ['ADMISSION_CLOSED to eligibility', 'ADMISSION_CLOSED', { type: 'COMMIT_ELIGIBILITY', input: validInput(),
      actor: { kind: 'verifier', sessionId: SESSION }, expectedTransitionRevision: 1, expectedCoordinationEpoch: 2 }],
    ['QUIESCENT to direct eligibility', 'QUIESCENT_CANDIDATE', { type: 'COMMIT_ELIGIBILITY', input: validInput(),
      actor: { kind: 'verifier', sessionId: SESSION }, expectedTransitionRevision: 1, expectedCoordinationEpoch: 2 }],
    ['ELIGIBLE to abort', 'ELIGIBLE', { type: 'ABORT', failureCode: null,
      actor: { kind: 'coordinator', sessionId: SESSION }, expectedTransitionRevision: 1, expectedCoordinationEpoch: 2 }],
    ['FAILED to drain', 'FAILED', { type: 'REQUEST_DRAIN', actor: { kind: 'coordinator', sessionId: SESSION },
      expectedTransitionRevision: 1, expectedCoordinationEpoch: 2 }],
    ['ABORTED to drain', 'ABORTED', { type: 'REQUEST_DRAIN', actor: { kind: 'coordinator', sessionId: SESSION },
      expectedTransitionRevision: 1, expectedCoordinationEpoch: 2 }],
  ];
  for (const [name, stateName, template] of forbidden) {
    it(`rejects forbidden transition: ${name}`, () => {
      const state = openState();
      const model = { ...state, authority: authority({ state: stateName, admissionOpen: stateName === 'OPEN',
        transitionRevision: 1, sourceRevisionBefore: null, sourceRevisionAfter: null,
        sourceDigestBefore: null, sourceDigestAfter: null }, state.reviewedManifest) };
      expect(reduceWriterCoordination(model, template).ok).toBe(false);
    });
  }

  for (const result of ['committed', 'aborted', 'failed'] as const) {
    it(`terminalizes an admitted operation as ${result} without losing its durable record`, () => {
      const initial = openState();
      const admitted = operation({ state: 'admitted', committedSourceRevision: null, terminalResult: null,
        admissionTransitionRevision: 1 });
      const admittedState = success(reduceWriterCoordination(initial, { type: 'ADMIT_OPERATION', operation: admitted,
        actor: { kind: 'writer', writerId: WRITER_ID, sessionId: SESSION },
        expectedTransitionRevision: 1, expectedCoordinationEpoch: 2 }));
      const terminal = reduceWriterCoordination(admittedState, { type: 'TERMINALIZE_OPERATION', operationId: OPERATION_ID,
        result, committedSourceRevision: result === 'committed' ? '41' : null,
        actor: { kind: 'writer', writerId: WRITER_ID, sessionId: SESSION },
        expectedTransitionRevision: admittedState.authority.transitionRevision, expectedCoordinationEpoch: 2 });
      expect(terminal).toMatchObject({ ok: true, state: { authority: { unresolvedOperationCount: 0 },
        operations: [{ state: result, terminalResult: result }] } });
    });
  }

  it('does not mark DRAINING quiescent with an unresolved operation', () => {
    const state = openState();
    const model = { ...state, authority: authority({ state: 'DRAINING', admissionOpen: false,
      transitionRevision: 1, unresolvedOperationCount: 1 }, state.reviewedManifest),
    operations: [operation({ state: 'admitted', terminalResult: null, committedSourceRevision: null })] };
    expect(reduceWriterCoordination(model, coordinator(model, { type: 'MARK_QUIESCENT' }))).toEqual({ ok: false,
      code: 'IN_FLIGHT_WRITE_PRESENT' });
  });

  it('rejects eligibility evidence built from a registration set different from durable model state', () => {
    const reviewed = manifest();
    const state: WriterCoordinationModelState = { authority: authority({}, reviewed), reviewedManifest: reviewed,
      registrations: [registration()], operations: [], eligibilityEvidence: null };
    const other = registration({ writerId: `writer-v1:window:${WRITER_TYPE}:${'8'.repeat(32)}`,
      sessionId: `writer-session-v1:${'9'.repeat(32)}` });
    const input = validInput({ authority: state.authority, operations: [], registrationCheckpoints: checkpoints([other]) });
    expect(reduceWriterCoordination(state, verifierAction(state, { type: 'COMMIT_ELIGIBILITY', input }))).toEqual({
      ok: false, code: 'LIVE_INSTANCE_SET_CHANGED',
    });
  });

  it('rejects eligibility evidence that omits a durable model operation', () => {
    const reviewed = manifest();
    const state: WriterCoordinationModelState = { authority: authority({}, reviewed), reviewedManifest: reviewed,
      registrations: [registration()], operations: [operation()], eligibilityEvidence: null };
    const input = validInput({ authority: state.authority, operations: [] });
    expect(reduceWriterCoordination(state, verifierAction(state, { type: 'COMMIT_ELIGIBILITY', input }))).toEqual({
      ok: false, code: 'IN_FLIGHT_STATE_AMBIGUOUS',
    });
  });
});
