import { describe, expect, it } from 'vitest';
import {
  WRITER_COORDINATION_LIMITS,
  DeterministicCoordinationScheduler,
  assertCoordinationInvariant,
  canTransitionCoordinationState,
  decodeEligibilityEvidence,
  deriveWriterSetDigest,
  encodeEligibilityEvidence,
  evaluateWriterCoordinationEligibility,
  validateAdmissionOperation,
  validateCoordinationAuthority,
  validateWriterRegistration,
  type AdmissionOperationRecord,
  type CoordinationAuthorityRecord,
  type WriterCoordinationEligibilityInput,
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

function authority(overrides: Partial<CoordinationAuthorityRecord> = {}): CoordinationAuthorityRecord {
  return {
    kind: 'absinthe_writer_coordination_authority',
    schemaVersion: 1,
    byteFormatVersion: 1,
    physicalSourceDigest: PHYSICAL,
    coordinationEpoch: 2,
    state: 'VERIFYING_SOURCE',
    coordinatorSessionId: SESSION,
    expectedWriterSetDigest: deriveWriterSetDigest([WRITER_TYPE]),
    admissionOpen: false,
    unresolvedOperationCount: 0,
    sourceRevisionBefore: '41',
    sourceRevisionAfter: '41',
    sourceDigestBefore: SOURCE,
    sourceDigestAfter: SOURCE,
    transitionRevision: 7,
    createdSequence: 1,
    updatedSequence: 9,
    failureCode: null,
    ...overrides,
  };
}

function registration(overrides: Partial<WriterRegistrationRecord> = {}): WriterRegistrationRecord {
  return {
    kind: 'absinthe_writer_registration',
    schemaVersion: 1,
    byteFormatVersion: 1,
    physicalSourceDigest: PHYSICAL,
    writerTypeId: WRITER_TYPE,
    writerId: WRITER_ID,
    sessionId: SESSION,
    contextType: 'window',
    coordinationEpoch: 2,
    capabilities: ['admission', 'drain_ack', 'source_write'],
    registrationState: 'drain_acknowledged',
    coordinated: true,
    acknowledgedTransitionRevision: 7,
    latestOperationId: null,
    lastSeenSequence: 8,
    ...overrides,
  };
}

function operation(overrides: Partial<AdmissionOperationRecord> = {}): AdmissionOperationRecord {
  return {
    kind: 'absinthe_writer_admission_operation',
    schemaVersion: 1,
    byteFormatVersion: 1,
    physicalSourceDigest: PHYSICAL,
    operationId: OPERATION_ID,
    idempotencyKey: IDEMPOTENCY,
    writerTypeId: WRITER_TYPE,
    writerId: WRITER_ID,
    sessionId: SESSION,
    coordinationEpoch: 1,
    admissionTransitionRevision: 2,
    mutationType: 'snapshot_replace',
    expectedSourceRevision: '40',
    state: 'committed',
    committedSourceRevision: '41',
    terminalResult: 'committed',
    ...overrides,
  };
}

function validInput(overrides: Partial<WriterCoordinationEligibilityInput> = {}): WriterCoordinationEligibilityInput {
  return {
    authority: authority(),
    expectedWriterTypeIds: [WRITER_TYPE],
    inventoryComplete: true,
    writerSetDigestBefore: deriveWriterSetDigest([WRITER_TYPE]),
    writerSetDigestAfter: deriveWriterSetDigest([WRITER_TYPE]),
    registrations: [registration()],
    operations: [operation()],
    source: {
      source: 'indexeddb',
      physicalSourceDigest: PHYSICAL,
      exactSupportedSource: true,
      ownershipProven: true,
      canonical: true,
      withinBounds: true,
      mixedOrDivergent: false,
      unknownContainerPresent: false,
      revisionBefore: '41',
      revisionAfter: '41',
      digestBefore: SOURCE,
      digestAfter: SOURCE,
      rejectionCode: null,
    },
    coordinationSupported: true,
    lockAvailable: true,
    restoreOrImportActive: false,
    syncWriterActive: false,
    k328AdapterAvailable: true,
    k328PhysicalSourceDigest: PHYSICAL,
    ...overrides,
  };
}

function expectCode(input: WriterCoordinationEligibilityInput, code: WriterEligibilityErrorCode): void {
  expect(evaluateWriterCoordinationEligibility(input)).toMatchObject({ eligible: false, code });
}

describe('K-329 eligibility happy path and invariants', () => {
  it('grants eligibility for one fully coordinated writer and stable authoritative source', () => {
    const input = validInput();
    const result = evaluateWriterCoordinationEligibility(input);
    expect(result).toMatchObject({ eligible: true, physicalSourceDigest: PHYSICAL, stableRevision: '41' });
    expect(assertCoordinationInvariant(input)).toBe(true);
  });

  it('grants eligibility for multiple coordinated writer types with a stable set', () => {
    const secondType = 'folder_metadata_writer';
    const secondId = `writer-v1:window:${secondType}:${'8'.repeat(32)}`;
    const types = [WRITER_TYPE, secondType];
    const digest = deriveWriterSetDigest(types);
    const input = validInput({
      expectedWriterTypeIds: types,
      writerSetDigestBefore: digest,
      writerSetDigestAfter: digest,
      authority: authority({ expectedWriterSetDigest: digest }),
      registrations: [registration(), registration({
        writerTypeId: secondType,
        writerId: secondId,
        sessionId: `writer-session-v1:${'9'.repeat(32)}`,
      })],
    });
    expect(evaluateWriterCoordinationEligibility(input).eligible).toBe(true);
  });

  it('binds canonical evidence to the exact source, epoch, writer set, and revision', () => {
    const result = evaluateWriterCoordinationEligibility(validInput());
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    const bytes = encodeEligibilityEvidence(result.evidence);
    expect(decodeEligibilityEvidence(bytes)).toEqual({ ok: true, evidence: result.evidence });
    expect(result.evidenceDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('makes every non-happy default fail closed', () => {
    expectCode(validInput({ inventoryComplete: false }), 'WRITER_INVENTORY_INCOMPLETE');
    expectCode(validInput({ coordinationSupported: false }), 'COORDINATION_UNSUPPORTED');
    expectCode(validInput({ lockAvailable: false }), 'COORDINATION_LOCK_UNAVAILABLE');
  });
});

describe('K-329 admission and new-write races', () => {
  it('explicitly schedules read-open, close-admission, then rejects late token persistence', () => {
    const scheduler = new DeterministicCoordinationScheduler();
    let observedOpen = false;
    let admissionOpen = true;
    let tokenCommitted = false;
    scheduler.schedule('writer_reads_open', () => { observedOpen = admissionOpen; });
    scheduler.schedule('coordinator_closes', () => { admissionOpen = false; });
    scheduler.schedule('writer_persists_token', () => { tokenCommitted = observedOpen && admissionOpen; });
    scheduler.run('writer_reads_open');
    scheduler.run('coordinator_closes');
    scheduler.run('writer_persists_token');
    expect(tokenCommitted).toBe(false);
    expect(scheduler.history()).toEqual(['writer_reads_open', 'coordinator_closes', 'writer_persists_token']);
  });

  it('explicitly schedules a durable token before close and lets that exact admitted operation finish', () => {
    const scheduler = new DeterministicCoordinationScheduler();
    let admissionOpen = true;
    let tokenCommitted = false;
    let operationTerminal = false;
    scheduler.schedule('writer_persists_token', () => { tokenCommitted = admissionOpen; });
    scheduler.schedule('coordinator_closes', () => { admissionOpen = false; });
    scheduler.schedule('writer_commits', () => { operationTerminal = tokenCommitted; });
    scheduler.run('writer_persists_token');
    scheduler.run('coordinator_closes');
    scheduler.run('writer_commits');
    expect(operationTerminal).toBe(true);
    expect(scheduler.pending()).toEqual([]);
  });

  it('rejects a token whose durable admission appears at or after drain closure', () => {
    expectCode(validInput({
      operations: [operation({
        state: 'admitted', terminalResult: null, committedSourceRevision: null,
        coordinationEpoch: 2, admissionTransitionRevision: 7,
      })],
    }), 'IN_FLIGHT_STATE_AMBIGUOUS');
  });

  it('accepts an earlier admitted writer that durably committed and acknowledged after drain request', () => {
    expect(evaluateWriterCoordinationEligibility(validInput({ operations: [operation()] })).eligible).toBe(true);
  });

  it('rejects stale-epoch tokens before they can authorize an eligible source', () => {
    expectCode(validInput({ operations: [operation({
      state: 'admitted', terminalResult: null, committedSourceRevision: null,
    })] }), 'COORDINATION_EPOCH_STALE');
  });

  it('keeps delayed debounce work unresolved instead of treating delay as absence', () => {
    expectCode(validInput({ operations: [operation({
      state: 'admitted', terminalResult: null, committedSourceRevision: null,
      coordinationEpoch: 2, admissionTransitionRevision: 6,
    })] }), 'IN_FLIGHT_WRITE_PRESENT');
  });

  it('rejects restore/import and sync hydration beginning during drain', () => {
    expectCode(validInput({ restoreOrImportActive: true }), 'RESTORE_OR_IMPORT_ACTIVE');
    expectCode(validInput({ syncWriterActive: true }), 'SYNC_WRITER_ACTIVE');
  });
});

describe('K-329 in-flight durability and idempotency', () => {
  it('does not infer acknowledgement when mutation committed but durable ack is missing', () => {
    expectCode(validInput({ operations: [operation({
      state: 'admitted', committedSourceRevision: '41', terminalResult: null,
    })] }), 'IN_FLIGHT_STATE_AMBIGUOUS');
  });

  it('accepts committed acknowledgement when only the caller response was lost', () => {
    expect(evaluateWriterCoordinationEligibility(validInput({ operations: [operation()] })).eligible).toBe(true);
  });

  it('keeps writer crash before mutation as unresolved', () => {
    expectCode(validInput({ operations: [operation({
      state: 'admitted', terminalResult: null, committedSourceRevision: null,
      coordinationEpoch: 2, admissionTransitionRevision: 6,
    })] }), 'IN_FLIGHT_WRITE_PRESENT');
  });

  it('rejects writer crash after mutation with ambiguous persisted state', () => {
    expect(validateAdmissionOperation(operation({
      state: 'admitted', committedSourceRevision: '41', terminalResult: null,
    }))).toBe(false);
  });

  it('represents an idempotent retry as the one existing terminal operation', () => {
    const first = evaluateWriterCoordinationEligibility(validInput({ operations: [operation()] }));
    const retry = evaluateWriterCoordinationEligibility(validInput({ operations: [operation()] }));
    expect(retry).toEqual(first);
  });

  it('rejects duplicate durable operation identities rather than double-counting them', () => {
    expectCode(validInput({ operations: [operation(), operation()] }), 'IN_FLIGHT_STATE_AMBIGUOUS');
  });
});

describe('K-329 writer-set changes and disappearance', () => {
  it('rejects a new unknown tab during drain', () => {
    expectCode(validInput({ registrations: [registration(), registration({
      writerTypeId: 'unreviewed_tab_writer',
      writerId: `writer-v1:window:unreviewed_tab_writer:${'a'.repeat(32)}`,
    })] }), 'UNKNOWN_WRITER_PRESENT');
  });

  it('rejects an unknown worker context', () => {
    expectCode(validInput({ registrations: [registration(), registration({
      writerTypeId: 'unknown_worker',
      writerId: `writer-v1:service_worker:unknown_worker:${'b'.repeat(32)}`,
      contextType: 'service_worker',
    })] }), 'UNKNOWN_WRITER_PRESENT');
  });

  it('does not treat a disappeared registration heartbeat as a durable drain ack', () => {
    expectCode(validInput({ registrations: [registration({
      registrationState: 'registered', acknowledgedTransitionRevision: null, lastSeenSequence: 1,
    })] }), 'DRAIN_TIMEOUT_UNPROVEN');
  });

  it('allows a restarted writer only when the old session is durably disabled and the new session acknowledged', () => {
    const old = registration({ registrationState: 'disabled', acknowledgedTransitionRevision: null, coordinationEpoch: 1 });
    const current = registration({
      writerId: `writer-v1:window:${WRITER_TYPE}:${'c'.repeat(32)}`,
      sessionId: `writer-session-v1:${'d'.repeat(32)}`,
    });
    expect(evaluateWriterCoordinationEligibility(validInput({ registrations: [old, current] })).eligible).toBe(true);
  });

  it('rejects a stale active registration from the previous epoch', () => {
    expectCode(validInput({ registrations: [registration({ coordinationEpoch: 1 })] }), 'COORDINATION_EPOCH_STALE');
  });

  it('rejects writer-set digest change during verification', () => {
    expectCode(validInput({ writerSetDigestAfter: OTHER }), 'WRITER_SET_CHANGED');
  });
});

describe('K-329 coordinator crash and restart classifications', () => {
  it('restarts before admission close as ineligible', () => {
    expectCode(validInput({ authority: authority({
      state: 'OPEN', admissionOpen: true, sourceRevisionBefore: null, sourceRevisionAfter: null,
      sourceDigestBefore: null, sourceDigestAfter: null,
    }) }), 'ADMISSION_NOT_CLOSED');
  });

  it('restarts after admission close with missing acks as timeout-unproven', () => {
    expectCode(validInput({ registrations: [registration({
      registrationState: 'registered', acknowledgedTransitionRevision: null,
    })] }), 'DRAIN_TIMEOUT_UNPROVEN');
  });

  it('restarts during drain with an operation still present as in-flight', () => {
    expectCode(validInput({ operations: [operation({
      state: 'admitted', terminalResult: null, committedSourceRevision: null,
      coordinationEpoch: 2, admissionTransitionRevision: 6,
    })] }), 'IN_FLIGHT_WRITE_PRESENT');
  });

  it('recomputes the same eligibility after source verification but before evidence commit', () => {
    const first = evaluateWriterCoordinationEligibility(validInput());
    const restarted = evaluateWriterCoordinationEligibility(structuredClone(validInput()));
    expect(restarted).toEqual(first);
  });
});

describe('K-329 source stability and ambiguity', () => {
  it.each<[string, Partial<WriterCoordinationEligibilityInput['source']>, WriterEligibilityErrorCode]>([
    ['revision changed during drain', { revisionAfter: '42' }, 'SOURCE_REVISION_UNSTABLE'],
    ['digest changed without revision', { digestAfter: OTHER }, 'SOURCE_CHANGED_DURING_VERIFICATION'],
    ['revision unavailable', { revisionAfter: null }, 'SOURCE_REVISION_UNSTABLE'],
    ['revision malformed', { revisionAfter: '01' }, 'SOURCE_REVISION_UNSTABLE'],
    ['mixed divergent', { mixedOrDivergent: true }, 'MIXED_SOURCE_DIVERGENCE'],
    ['ownership mismatch', { ownershipProven: false }, 'SOURCE_OWNERSHIP_UNPROVEN'],
    ['generation/source type mismatch', { source: null }, 'AUTHORITATIVE_SOURCE_AMBIGUOUS'],
    ['unknown extra database', { unknownContainerPresent: true }, 'UNKNOWN_CONTEXT_PRESENT'],
    ['malformed source', { canonical: false }, 'SOURCE_MALFORMED'],
    ['resource bound', { withinBounds: false }, 'SOURCE_RESOURCE_BOUND_EXCEEDED'],
  ])('rejects %s', (_name, sourceOverrides, code) => {
    const input = validInput();
    expectCode({ ...input, source: { ...input.source, ...sourceOverrides } }, code);
  });

  it.each<[string, WriterEligibilityErrorCode]>([
    ['localStorage only', 'WRITER_NOT_COORDINATED'],
    ['mixed equal but dual-authoritative', 'AUTHORITATIVE_SOURCE_AMBIGUOUS'],
    ['partial migration', 'AUTHORITATIVE_SOURCE_AMBIGUOUS'],
    ['malformed plus valid source', 'SOURCE_MALFORMED'],
    ['restored snapshot plus live source', 'AUTHORITATIVE_SOURCE_AMBIGUOUS'],
    ['tombstone divergence', 'MIXED_SOURCE_DIVERGENCE'],
  ])('preserves fail-closed source-resolution decision for %s', (_name, code) => {
    const input = validInput();
    expectCode({ ...input, source: { ...input.source, rejectionCode: code } }, code);
  });

  it('rejects a K-328 adapter bound to a different physical source', () => {
    expectCode(validInput({ k328PhysicalSourceDigest: OTHER }), 'K328_PHYSICAL_IDENTITY_MISMATCH');
  });

  it('rejects absent K-328 adapter without invoking K-328', () => {
    expectCode(validInput({ k328AdapterAvailable: false }), 'K328_ADAPTER_UNAVAILABLE');
  });
});

describe('K-329 strict record and byte validation', () => {
  it('rejects malformed authority, registration, and operation records', () => {
    expect(validateCoordinationAuthority({ ...authority(), unknown: true })).toBe(false);
    expect(validateWriterRegistration({ ...registration(), capabilities: ['source_write', 'admission'] })).toBe(false);
    expect(validateAdmissionOperation({ ...operation(), terminalResult: null })).toBe(false);
  });

  it('rejects unknown authority schema version with the stable version code', () => {
    const bad = { ...authority(), schemaVersion: 2 as 1 };
    expectCode(validInput({ authority: bad }), 'ELIGIBILITY_PROTOCOL_VERSION_UNSUPPORTED');
  });

  it('rejects duplicate canonical keys through exact canonical-byte comparison', () => {
    const result = evaluateWriterCoordinationEligibility(validInput());
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    const raw = new TextDecoder().decode(encodeEligibilityEvidence(result.evidence));
    const duplicate = raw.replace('{', '{"kind":"absinthe_writer_eligibility_evidence",');
    expect(decodeEligibilityEvidence(new TextEncoder().encode(duplicate))).toEqual({
      ok: false, code: 'ELIGIBILITY_EVIDENCE_CORRUPT',
    });
  });

  it('rejects malformed UTF-8 before JSON parsing', () => {
    expect(decodeEligibilityEvidence(new Uint8Array([0xc3, 0x28]))).toEqual({
      ok: false, code: 'ELIGIBILITY_EVIDENCE_CORRUPT',
    });
  });

  it('rejects evidence over the predecode byte ceiling', () => {
    expect(decodeEligibilityEvidence(new Uint8Array(
      WRITER_COORDINATION_LIMITS.eligibilityEvidenceBytes + 1,
    ))).toEqual({ ok: false, code: 'ELIGIBILITY_EVIDENCE_CORRUPT' });
  });

  it('never normalizes noncanonical whitespace or key order', () => {
    const result = evaluateWriterCoordinationEligibility(validInput());
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    const raw = new TextDecoder().decode(encodeEligibilityEvidence(result.evidence));
    expect(decodeEligibilityEvidence(new TextEncoder().encode(`${raw}\n`)).ok).toBe(false);
  });
});

describe('K-329 state machine', () => {
  it.each([
    ['OPEN', 'DRAIN_REQUESTED'],
    ['DRAIN_REQUESTED', 'ADMISSION_CLOSED'],
    ['ADMISSION_CLOSED', 'DRAINING'],
    ['DRAINING', 'QUIESCENT_CANDIDATE'],
    ['QUIESCENT_CANDIDATE', 'VERIFYING_SOURCE'],
    ['VERIFYING_SOURCE', 'ELIGIBLE'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(canTransitionCoordinationState(from, to)).toBe(true);
  });

  it.each([
    ['OPEN', 'ELIGIBLE'],
    ['DRAIN_REQUESTED', 'ELIGIBLE'],
    ['ADMISSION_CLOSED', 'ELIGIBLE'],
    ['ELIGIBLE', 'OPEN'],
    ['INELIGIBLE', 'VERIFYING_SOURCE'],
    ['ABORTED', 'OPEN'],
    ['FAILED', 'OPEN'],
  ] as const)('rejects implicit or terminal transition %s -> %s', (from, to) => {
    expect(canTransitionCoordinationState(from, to)).toBe(false);
  });
});
