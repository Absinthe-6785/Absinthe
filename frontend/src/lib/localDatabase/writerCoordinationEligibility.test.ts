import { describe, expect, it } from 'vitest';
import * as contract from './writerCoordinationEligibility';
import {
  CHECKPOINT_KINDS,
  K329B_REVIEWED_WRITER_COUNT,
  K329B_REVIEWED_WRITER_MANIFEST_ENTRIES,
  REVIEWED_MANIFEST_AUTHORITY_ID,
  REVIEWED_MANIFEST_VERSION,
  createK329BReviewedManifestAuthority,
  createK329BReviewedWriterManifest,
  createWriterCoordinationModel,
  decodeAdmissionOperationCanonical,
  decodeCoordinationAuthorityCanonical,
  decodeEligibilityEvidenceCanonical,
  decodeRegistrationCheckpointCanonical,
  decodeReviewedManifestAuthorityCanonical,
  decodeReviewedWriterManifestCanonical,
  decodeSourceVerificationEvidenceCanonical,
  decodeWriterCoordinationModelCanonical,
  decodeWriterRegistrationCanonical,
  deriveCoordinationAuthorityDigest,
  deriveCurrentCoordinationGraph,
  deriveLiveWriterInstanceSetDigest,
  deriveRegistrationCheckpointDigest,
  deriveReviewedManifestAuthorityDigest,
  deriveReviewedWriterManifestDigest,
  deriveSourceVerificationEvidenceDigest,
  encodeAdmissionOperationCanonical,
  encodeCoordinationAuthorityCanonical,
  encodeEligibilityEvidenceCanonical,
  encodeRegistrationCheckpointCanonical,
  encodeReviewedManifestAuthorityCanonical,
  encodeReviewedWriterManifestCanonical,
  encodeSourceVerificationEvidenceCanonical,
  encodeWriterCoordinationModelCanonical,
  encodeWriterRegistrationCanonical,
  reduceWriterCoordination,
  validateReviewedManifestAuthority,
  validateReviewedWriterManifest,
  validateWriterCoordinationModelState,
  validateWriterCoordinationModelRelations,
  validateWriterRegistration,
  type AdmissionOperationRecord,
  type SourceVerificationObservation,
  type WriterCoordinationAction,
  type WriterCoordinationActor,
  type WriterCoordinationModelState,
  type WriterEligibilityErrorCode,
  type WriterRegistrationRecord,
} from './writerCoordinationEligibility';

const PHYSICAL = '1'.repeat(64);
const SOURCE = '2'.repeat(64);
const OTHER = '3'.repeat(64);
const COORDINATOR = `writer-session-v1:${'a'.repeat(32)}`;
const VERIFIER = `writer-session-v1:${'b'.repeat(32)}`;
const RECOVERY = `writer-session-v1:${'c'.repeat(32)}`;
const coordinator: WriterCoordinationActor = { kind: 'coordinator', sessionId: COORDINATOR };
const verifier: WriterCoordinationActor = { kind: 'verifier', sessionId: VERIFIER };
const recovery: WriterCoordinationActor = { kind: 'recovery', sessionId: RECOVERY };
const text = new TextEncoder();

const participating = K329B_REVIEWED_WRITER_MANIFEST_ENTRIES
  .filter(entry => entry.coordinationRequirement === 'must_participate');

function nonce(index: number, width: number): string {
  return index.toString(16).padStart(width, '0').slice(-width);
}
function registration(index: number, overrides: Partial<WriterRegistrationRecord> = {}): WriterRegistrationRecord {
  const entry = participating[index % participating.length];
  const context = entry.contextTypes[0];
  return {
    kind: 'absinthe_writer_registration', schemaVersion: 1, byteFormatVersion: 1,
    physicalSourceDigest: PHYSICAL, writerTypeId: entry.writerTypeId,
    writerId: `writer-v1:${context}:${entry.writerTypeId}:${nonce(index + 1, 32)}`,
    sessionId: `writer-session-v1:${nonce(index + 100, 32)}`,
    contextType: context, coordinationEpoch: 1, capabilities: [...entry.requiredCapabilities],
    registrationState: 'registered', coordinated: false, acknowledgedDrainRevision: null,
    latestOperationId: null, lastSeenSequence: 0, ...overrides,
  };
}
function operation(record: WriterRegistrationRecord, state: WriterCoordinationModelState,
  overrides: Partial<AdmissionOperationRecord> = {}): AdmissionOperationRecord {
  return {
    kind: 'absinthe_writer_admission_operation', schemaVersion: 1, byteFormatVersion: 1,
    physicalSourceDigest: PHYSICAL, operationId: `writer-operation-v1:${'d'.repeat(64)}`,
    idempotencyKey: `writer-idempotency-v1:${'e'.repeat(64)}`, writerTypeId: record.writerTypeId,
    writerId: record.writerId, sessionId: record.sessionId, coordinationEpoch: state.authority.coordinationEpoch,
    admissionTransitionRevision: state.authority.transitionRevision, mutationType: 'snapshot_replace',
    expectedSourceRevision: '40', state: 'admitted', committedSourceRevision: null, terminalResult: null,
    ...overrides,
  };
}
function model(): WriterCoordinationModelState {
  return createWriterCoordinationModel({ physicalSourceDigest: PHYSICAL, coordinatorSessionId: COORDINATOR,
    verifierSessionId: VERIFIER, recoverySessionId: RECOVERY });
}
function action(state: WriterCoordinationModelState, actor: WriterCoordinationActor,
  body: Record<string, unknown>): WriterCoordinationAction {
  return { ...body, actor, expectedTransitionRevision: state.authority.transitionRevision,
    expectedCoordinationEpoch: state.authority.coordinationEpoch,
    expectedAuthorityDigest: deriveCoordinationAuthorityDigest(state.authority) } as unknown as WriterCoordinationAction;
}
function success(state: WriterCoordinationModelState, actor: WriterCoordinationActor,
  body: Record<string, unknown>): WriterCoordinationModelState {
  const result = reduceWriterCoordination(state, action(state, actor, body));
  expect(result).toMatchObject({ ok: true });
  if (!result.ok) throw new Error(result.code);
  return result.state;
}
function failure(state: WriterCoordinationModelState, actor: WriterCoordinationActor,
  body: Record<string, unknown>, code: WriterEligibilityErrorCode): void {
  expect(reduceWriterCoordination(state, action(state, actor, body))).toEqual({ ok: false, code });
}
function registered(): WriterCoordinationModelState {
  let state = model();
  participating.forEach((_, index) => {
    const record = registration(index);
    state = success(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId },
      { type: 'REGISTER_WRITER', registration: record });
  });
  return state;
}
function observation(overrides: Partial<SourceVerificationObservation> = {}): SourceVerificationObservation {
  return { physicalSourceDigest: PHYSICAL, sourceType: 'indexeddb', ownershipProven: true,
    canonical: true, withinBounds: true, revisionBefore: '41', digestBefore: SOURCE,
    revisionAfter: '41', digestAfter: SOURCE, authoritativeSourceDecision: 'indexeddb', ambiguityCode: null,
    k328AdapterAvailable: true, k328PhysicalSourceDigest: PHYSICAL, ...overrides };
}

type Stage = 'registered' | 'before_drain' | 'requested' | 'acked' | 'closed' | 'checkpoint2'
  | 'draining' | 'quiescent' | 'checkpoint3' | 'checkpoint4' | 'verifying' | 'source'
  | 'checkpoint5' | 'checkpoint6' | 'eligible';
function buildTo(stage: Stage, source = observation()): WriterCoordinationModelState {
  let state = registered(); if (stage === 'registered') return state;
  state = success(state, coordinator, { type: 'CAPTURE_BEFORE_DRAIN' }); if (stage === 'before_drain') return state;
  state = success(state, coordinator, { type: 'REQUEST_DRAIN' }); if (stage === 'requested') return state;
  const drainRevision = state.authority.drainRequestTransitionRevision!;
  for (const record of state.registrations) {
    state = success(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId },
      { type: 'ACKNOWLEDGE_DRAIN', writerId: record.writerId, drainRequestTransitionRevision: drainRevision });
  }
  if (stage === 'acked') return state;
  state = success(state, coordinator, { type: 'CLOSE_ADMISSION' }); if (stage === 'closed') return state;
  state = success(state, coordinator, { type: 'CAPTURE_AFTER_ADMISSION_CLOSED' }); if (stage === 'checkpoint2') return state;
  state = success(state, coordinator, { type: 'BEGIN_DRAIN' }); if (stage === 'draining') return state;
  state = success(state, coordinator, { type: 'MARK_QUIESCENT' }); if (stage === 'quiescent') return state;
  state = success(state, coordinator, { type: 'CAPTURE_AFTER_OPERATIONS_TERMINAL' }); if (stage === 'checkpoint3') return state;
  state = success(state, verifier, { type: 'CAPTURE_BEFORE_SOURCE_VERIFICATION' }); if (stage === 'checkpoint4') return state;
  state = success(state, verifier, { type: 'BEGIN_SOURCE_VERIFICATION' }); if (stage === 'verifying') return state;
  state = success(state, verifier, { type: 'CAPTURE_SOURCE_EVIDENCE', observation: source });
  if (stage === 'source' || stage === 'checkpoint5') return state;
  state = success(state, verifier, { type: 'CAPTURE_BEFORE_ELIGIBILITY_COMMIT' }); if (stage === 'checkpoint6') return state;
  state = success(state, verifier, { type: 'COMMIT_ELIGIBILITY',
    expectedFinalCheckpointDigest: state.checkpointChain[5].checkpointDigest });
  return state;
}

function buildTerminalOperationToCheckpoint6(): WriterCoordinationModelState {
  let state = registered(); const owner = state.registrations[0];
  state = success(state, { kind: 'writer', writerId: owner.writerId, sessionId: owner.sessionId },
    { type: 'ADMIT_OPERATION', operation: operation(owner, state) });
  state = success(state, coordinator, { type: 'CAPTURE_BEFORE_DRAIN' });
  state = success(state, coordinator, { type: 'REQUEST_DRAIN' });
  state = success(state, { kind: 'writer', writerId: owner.writerId, sessionId: owner.sessionId },
    { type: 'TERMINALIZE_OPERATION', operationId: state.operations[0].operationId,
      result: 'committed', committedSourceRevision: '41' });
  const drainRevision = state.authority.drainRequestTransitionRevision!;
  for (const record of state.registrations) {
    state = success(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId },
      { type: 'ACKNOWLEDGE_DRAIN', writerId: record.writerId, drainRequestTransitionRevision: drainRevision });
  }
  state = success(state, coordinator, { type: 'CLOSE_ADMISSION' });
  state = success(state, coordinator, { type: 'CAPTURE_AFTER_ADMISSION_CLOSED' });
  state = success(state, coordinator, { type: 'BEGIN_DRAIN' });
  state = success(state, coordinator, { type: 'MARK_QUIESCENT' });
  state = success(state, coordinator, { type: 'CAPTURE_AFTER_OPERATIONS_TERMINAL' });
  state = success(state, verifier, { type: 'CAPTURE_BEFORE_SOURCE_VERIFICATION' });
  state = success(state, verifier, { type: 'BEGIN_SOURCE_VERIFICATION' });
  state = success(state, verifier, { type: 'CAPTURE_SOURCE_EVIDENCE', observation: observation() });
  return success(state, verifier, { type: 'CAPTURE_BEFORE_ELIGIBILITY_COMMIT' });
}

function cloneModel(state: WriterCoordinationModelState): WriterCoordinationModelState {
  return JSON.parse(new TextDecoder().decode(encodeWriterCoordinationModelCanonical(state))) as WriterCoordinationModelState;
}

function expectFullGraphTamperRejected(base: WriterCoordinationModelState,
  mutate: (state: WriterCoordinationModelState) => void, code: WriterEligibilityErrorCode): void {
  const forged = cloneModel(base); mutate(forged);
  expect(validateWriterCoordinationModelState(forged)).toBe(false);
  expect(validateWriterCoordinationModelRelations(forged)).toBe(code);
  expect(decodeWriterCoordinationModelCanonical(text.encode(JSON.stringify(forged)))).toEqual({ ok: false,
    code: 'ELIGIBILITY_EVIDENCE_CORRUPT' });
  expect(reduceWriterCoordination(forged, action(forged, verifier, { type: 'COMMIT_ELIGIBILITY',
    expectedFinalCheckpointDigest: forged.checkpointChain[5].checkpointDigest }))).toEqual({ ok: false, code });
}

function replaceSourceEvidence(state: WriterCoordinationModelState,
  patch: Partial<NonNullable<WriterCoordinationModelState['sourceEvidence']>>): void {
  const current = state.sourceEvidence!; const { evidenceDigest: _ignored, ...content } = { ...current, ...patch };
  state.sourceEvidence = { ...content, evidenceDigest: deriveSourceVerificationEvidenceDigest(content) };
}

describe('K-329B trusted reviewed manifest authority', () => {
  it('binds the exact source-reviewed 30-entry inventory', () => {
    const manifest = createK329BReviewedWriterManifest(PHYSICAL);
    const authority = createK329BReviewedManifestAuthority(PHYSICAL);
    expect(K329B_REVIEWED_WRITER_COUNT).toBe(30);
    expect(manifest.entries).toHaveLength(30);
    expect(authority).toMatchObject({ authorityId: REVIEWED_MANIFEST_AUTHORITY_ID,
      manifestVersion: REVIEWED_MANIFEST_VERSION, reviewedEntryCount: 30,
      manifestDigest: deriveReviewedWriterManifestDigest(manifest) });
    const counts = manifest.entries.reduce<Record<string, number>>((result, entry) => {
      result[entry.authorityRole] = (result[entry.authorityRole] ?? 0) + 1; return result;
    }, {});
    expect(counts).toEqual({ dormant_or_test_writer: 6, auxiliary_container_writer: 4,
      authoritative_source_writer: 15, metadata_writer: 4, remote_only_writer: 1 });
  });

  it('contains the backup, migration, and restore attachment paths', () => {
    expect(K329B_REVIEWED_WRITER_MANIFEST_ENTRIES.map(entry => entry.writerTypeId)).toEqual(expect.arrayContaining([
      'legacy.notes.embedded_attachment_backup', 'legacy.notes.embedded_attachment_migration',
      'legacy.notes.embedded_attachment_restore',
    ]));
  });

  it('rejects an arbitrary one-entry manifest even with its matching digest', () => {
    const state = model();
    const oneEntry = { ...state.reviewedManifest, entries: [state.reviewedManifest.entries.find(entry =>
      entry.coordinationRequirement === 'must_participate')!] };
    const forged = { ...state, reviewedManifest: oneEntry };
    expect(reduceWriterCoordination(forged, action(forged, coordinator, { type: 'CAPTURE_BEFORE_DRAIN' })))
      .toEqual({ ok: false, code: 'REVIEWED_MANIFEST_AUTHORITY_MISMATCH' });
  });

  const authorityMutations = [
    ['authority id', { authorityId: 'caller-manifest' }],
    ['manifest version', { manifestVersion: 'k329c-source-reviewed-v1' }],
    ['entry count', { reviewedEntryCount: 29 }],
    ['manifest digest', { manifestDigest: OTHER }],
    ['physical source', { physicalSourceDigest: OTHER }],
  ] as const;
  for (const [name, overrides] of authorityMutations) {
    it(`rejects changed trusted authority: ${name}`, () => {
      const state = model(); const changed = { ...state.reviewedManifestAuthority, ...overrides } as never;
      expect(validateReviewedManifestAuthority(changed)).toBe(false);
    });
  }

  it('has no free-form eligibility evaluator export', () => {
    expect('evaluateWriterCoordinationEligibility' in contract).toBe(false);
  });
});

describe('K-329B canonical durable schemas', () => {
  it('round trips every expanded schema with exact canonical bytes', () => {
    const eligible = buildTo('eligible');
    const cases = [
      [eligible.reviewedManifest, encodeReviewedWriterManifestCanonical, decodeReviewedWriterManifestCanonical],
      [eligible.reviewedManifestAuthority, encodeReviewedManifestAuthorityCanonical, decodeReviewedManifestAuthorityCanonical],
      [eligible.authority, encodeCoordinationAuthorityCanonical, decodeCoordinationAuthorityCanonical],
      [eligible.registrations[0], encodeWriterRegistrationCanonical, decodeWriterRegistrationCanonical],
      [eligible.checkpointChain[0], encodeRegistrationCheckpointCanonical, decodeRegistrationCheckpointCanonical],
      [eligible.sourceEvidence!, encodeSourceVerificationEvidenceCanonical, decodeSourceVerificationEvidenceCanonical],
      [eligible.eligibilityEvidence!, encodeEligibilityEvidenceCanonical, decodeEligibilityEvidenceCanonical],
      [eligible, encodeWriterCoordinationModelCanonical, decodeWriterCoordinationModelCanonical],
    ] as const;
    for (const [value, encode, decode] of cases) expect((decode as never as (bytes: Uint8Array) => { ok: boolean })
      ((encode as never as (value: unknown) => Uint8Array)(value)).ok).toBe(true);
  });

  it('round trips operation evidence', () => {
    const state = registered(); const record = operation(state.registrations[0], state);
    expect(decodeAdmissionOperationCanonical(encodeAdmissionOperationCanonical(record))).toEqual({ ok: true, value: record });
  });

  it('rejects duplicate keys, invalid UTF-8, trailing bytes, and alternate order', () => {
    const bytes = encodeReviewedManifestAuthorityCanonical(createK329BReviewedManifestAuthority(PHYSICAL));
    const raw = new TextDecoder().decode(bytes);
    expect(decodeReviewedManifestAuthorityCanonical(text.encode(raw.replace('{', '{"schemaVersion":1,'))).ok).toBe(false);
    expect(decodeReviewedManifestAuthorityCanonical(new Uint8Array([0xc3, 0x28])).ok).toBe(false);
    expect(decodeReviewedManifestAuthorityCanonical(text.encode(`${raw}\n`)).ok).toBe(false);
    expect(decodeReviewedManifestAuthorityCanonical(text.encode(raw.replace(
      '"kind":"absinthe_reviewed_manifest_authority","schemaVersion":1',
      '"schemaVersion":1,"kind":"absinthe_reviewed_manifest_authority"'))).ok).toBe(false);
  });

  it('rejects forged checkpoint linkage and unknown model fields', () => {
    const state = buildTo('checkpoint3');
    const badCheckpoint = { ...state.checkpointChain[2], previousCheckpointDigest: OTHER };
    expect(decodeRegistrationCheckpointCanonical(text.encode(JSON.stringify(badCheckpoint))).ok).toBe(false);
    const raw = new TextDecoder().decode(encodeWriterCoordinationModelCanonical(state));
    expect(decodeWriterCoordinationModelCanonical(text.encode(raw.replace('{', '{"unknown":true,'))).ok).toBe(false);
  });
});

describe('K-329B writer registration and drain lifecycle', () => {
  it('registers only the bound writer in canonical initial state', () => {
    const state = model(); const record = registration(0);
    const next = success(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId },
      { type: 'REGISTER_WRITER', registration: record });
    expect(next.registrations[0]).toMatchObject({ registrationState: 'registered', coordinated: false,
      acknowledgedDrainRevision: null, latestOperationId: null });
  });

  it('rejects coordinator and verifier registration', () => {
    const state = model(); const record = registration(0);
    failure(state, coordinator, { type: 'REGISTER_WRITER', registration: record }, 'ACTOR_UNAUTHORIZED');
    failure(state, verifier, { type: 'REGISTER_WRITER', registration: record }, 'ACTOR_UNAUTHORIZED');
  });

  it('rejects pre-acknowledged and pre-coordinated registration', () => {
    const state = model();
    for (const record of [registration(0, { registrationState: 'drain_acknowledged', coordinated: true,
      acknowledgedDrainRevision: 0 }), registration(0, { coordinated: true })]) {
      const actor: WriterCoordinationActor = { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId };
      const result = reduceWriterCoordination(state, action(state, actor, { type: 'REGISTER_WRITER', registration: record }));
      expect(result).toMatchObject({ ok: false });
    }
  });

  it('rejects duplicate writer ID and session ID', () => {
    let state = model(); const first = registration(0);
    state = success(state, { kind: 'writer', writerId: first.writerId, sessionId: first.sessionId },
      { type: 'REGISTER_WRITER', registration: first });
    const sameWriter = registration(1, { writerTypeId: first.writerTypeId, contextType: first.contextType,
      capabilities: first.capabilities, writerId: first.writerId });
    failure(state, { kind: 'writer', writerId: sameWriter.writerId, sessionId: sameWriter.sessionId },
      { type: 'REGISTER_WRITER', registration: sameWriter }, 'DUPLICATE_WRITER_IDENTITY');
    const sameSession = registration(1, { sessionId: first.sessionId });
    failure(state, { kind: 'writer', writerId: sameSession.writerId, sessionId: sameSession.sessionId },
      { type: 'REGISTER_WRITER', registration: sameSession }, 'DUPLICATE_WRITER_IDENTITY');
  });

  it('binds acknowledgement to the exact drain request and same writer', () => {
    const requested = buildTo('requested'); const record = requested.registrations[0];
    const drainRevision = requested.authority.drainRequestTransitionRevision!;
    failure(requested, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId },
      { type: 'ACKNOWLEDGE_DRAIN', writerId: record.writerId, drainRequestTransitionRevision: drainRevision - 1 },
      'DRAIN_ACKNOWLEDGEMENT_INVALID');
    failure(requested, coordinator,
      { type: 'ACKNOWLEDGE_DRAIN', writerId: record.writerId, drainRequestTransitionRevision: drainRevision },
      'ACTOR_UNAUTHORIZED');
    const other = requested.registrations[1];
    failure(requested, { kind: 'writer', writerId: other.writerId, sessionId: other.sessionId },
      { type: 'ACKNOWLEDGE_DRAIN', writerId: record.writerId, drainRequestTransitionRevision: drainRevision },
      'ACTOR_UNAUTHORIZED');
  });

  it('rejects acknowledgement before drain and with an active operation', () => {
    const open = registered(); const record = open.registrations[0];
    failure(open, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId },
      { type: 'ACKNOWLEDGE_DRAIN', writerId: record.writerId, drainRequestTransitionRevision: 0 },
      'DRAIN_ACKNOWLEDGEMENT_INVALID');
    let state = success(open, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId },
      { type: 'ADMIT_OPERATION', operation: operation(record, open) });
    state = success(state, coordinator, { type: 'CAPTURE_BEFORE_DRAIN' });
    state = success(state, coordinator, { type: 'REQUEST_DRAIN' });
    failure(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId },
      { type: 'ACKNOWLEDGE_DRAIN', writerId: record.writerId,
        drainRequestTransitionRevision: state.authority.drainRequestTransitionRevision },
      'DRAIN_ACKNOWLEDGEMENT_INVALID');
  });

  it('rejects new and restarted same-type writers after drain closes admission', () => {
    const state = buildTo('requested');
    for (const record of [registration(100), registration(100, { sessionId: `writer-session-v1:${'f'.repeat(32)}` })]) {
      failure(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId },
        { type: 'REGISTER_WRITER', registration: record }, 'ADMISSION_NOT_CLOSED');
    }
  });

  it('rejects unknown writer type and embedded type/context mismatch', () => {
    const state = model();
    const unknown = registration(0, { writerTypeId: 'unknown_writer',
      writerId: `writer-v1:window:unknown_writer:${'f'.repeat(32)}` });
    failure(state, { kind: 'writer', writerId: unknown.writerId, sessionId: unknown.sessionId },
      { type: 'REGISTER_WRITER', registration: unknown }, 'UNKNOWN_WRITER_PRESENT');
    expect(validateWriterRegistration(registration(0, { writerTypeId: 'other_writer' }))).toBe(false);
    expect(validateWriterRegistration(registration(0, { contextType: 'dedicated_worker' }))).toBe(false);
  });
});

describe('K-329B durable checkpoint/source graph and eligibility', () => {
  it('executes the complete six-checkpoint path solely through reducer state', () => {
    const state = buildTo('eligible');
    expect(state.authority.state).toBe('ELIGIBLE');
    expect(state.checkpointChain.map(checkpoint => checkpoint.checkpointKind)).toEqual(CHECKPOINT_KINDS);
    expect(state.checkpointChain.map(checkpoint => checkpoint.previousCheckpointDigest)).toEqual([
      null, ...state.checkpointChain.slice(0, 5).map(checkpoint => checkpoint.checkpointDigest),
    ]);
    expect(state.checkpointChain.every(checkpoint => checkpoint.coordinatorSessionId === COORDINATOR)).toBe(true);
    expect(state.checkpointChain.slice(0, 4).every(checkpoint => checkpoint.sourceRevision === null
      && checkpoint.sourceDigest === null)).toBe(true);
    expect(state.checkpointChain.slice(4).every(checkpoint => checkpoint.sourceRevision === '41'
      && checkpoint.sourceDigest === SOURCE)).toBe(true);
    expect(state.eligibilityEvidence).toMatchObject({ result: 'eligible',
      finalCheckpointDigest: state.checkpointChain[5].checkpointDigest,
      sourceEvidenceDigest: state.sourceEvidence?.evidenceDigest });
  });

  it('rejects skipped, duplicate, reordered, and replayed checkpoint actions', () => {
    failure(registered(), coordinator, { type: 'CAPTURE_AFTER_ADMISSION_CLOSED' }, 'CHECKPOINT_CHAIN_INVALID');
    const one = buildTo('before_drain');
    failure(one, coordinator, { type: 'CAPTURE_BEFORE_DRAIN' }, 'CHECKPOINT_CHAIN_INVALID');
    const two = buildTo('checkpoint2');
    failure(two, coordinator, { type: 'CAPTURE_BEFORE_DRAIN' }, 'CHECKPOINT_CHAIN_INVALID');
    const three = buildTo('checkpoint3');
    failure(three, coordinator, { type: 'CAPTURE_AFTER_OPERATIONS_TERMINAL' }, 'CHECKPOINT_CHAIN_INVALID');
  });

  it('rejects forged previous checkpoint digest during canonical restart', () => {
    const state = buildTo('checkpoint3');
    const chain = [...state.checkpointChain]; chain[2] = { ...chain[2], previousCheckpointDigest: OTHER };
    const forged = { ...state, checkpointChain: chain };
    expect(reduceWriterCoordination(forged, action(forged, verifier,
      { type: 'CAPTURE_BEFORE_SOURCE_VERIFICATION' }))).toEqual({ ok: false, code: 'CHECKPOINT_CHAIN_INVALID' });
  });

  it('rejects checkpoint coordinator binding and terminal evidence relation corruption', () => {
    const state = buildTo('checkpoint3'); const chain = [...state.checkpointChain];
    chain[2] = { ...chain[2], coordinatorSessionId: RECOVERY };
    const forged = { ...state, checkpointChain: chain };
    expect(validateWriterCoordinationModelState(forged)).toBe(false);
    const eligible = buildTo('eligible');
    expect(validateWriterCoordinationModelState({ ...eligible,
      authority: { ...eligible.authority, state: 'VERIFYING_SOURCE' } })).toBe(false);
  });

  it('requires verifier-only source capture', () => {
    const state = buildTo('verifying');
    failure(state, coordinator, { type: 'CAPTURE_SOURCE_EVIDENCE', observation: observation() }, 'ACTOR_UNAUTHORIZED');
    failure(state, recovery, { type: 'CAPTURE_SOURCE_EVIDENCE', observation: observation() }, 'ACTOR_UNAUTHORIZED');
  });

  it('rejects missing source evidence and an incomplete final checkpoint chain', () => {
    const state = buildTo('verifying');
    failure(state, verifier, { type: 'CAPTURE_AFTER_SOURCE_VERIFICATION' }, 'SOURCE_EVIDENCE_MISSING');
    failure(state, verifier, { type: 'COMMIT_ELIGIBILITY', expectedFinalCheckpointDigest: OTHER },
      'CHECKPOINT_CHAIN_INVALID');
  });

  it('rejects caller-supplied source flags on COMMIT_ELIGIBILITY', () => {
    const state = buildTo('checkpoint6');
    const forged = action(state, verifier, { type: 'COMMIT_ELIGIBILITY',
      expectedFinalCheckpointDigest: state.checkpointChain[5].checkpointDigest, source: observation() }) as never;
    expect(reduceWriterCoordination(state, forged)).toEqual({ ok: false, code: 'ELIGIBILITY_EVIDENCE_CORRUPT' });
  });

  const sourceFailures: readonly [string, Partial<SourceVerificationObservation>, WriterEligibilityErrorCode][] = [
    ['revision change', { revisionAfter: '42' }, 'SOURCE_REVISION_UNSTABLE'],
    ['digest change', { digestAfter: OTHER }, 'SOURCE_CHANGED_DURING_VERIFICATION'],
    ['ownership', { ownershipProven: false }, 'SOURCE_OWNERSHIP_UNPROVEN'],
    ['canonicality', { canonical: false }, 'SOURCE_MALFORMED'],
    ['bounds', { withinBounds: false }, 'SOURCE_RESOURCE_BOUND_EXCEEDED'],
    ['adapter absent', { k328AdapterAvailable: false }, 'K328_ADAPTER_UNAVAILABLE'],
  ];
  for (const [name, overrides, code] of sourceFailures) {
    it(`rejects durable source evidence: ${name}`, () => {
      const state = buildTo('checkpoint6', observation(overrides));
      failure(state, verifier, { type: 'COMMIT_ELIGIBILITY',
        expectedFinalCheckpointDigest: state.checkpointChain[5].checkpointDigest }, code);
    });
  }

  it('rejects source evidence captured from another physical source', () => {
    const state = buildTo('verifying');
    failure(state, verifier, { type: 'CAPTURE_SOURCE_EVIDENCE',
      observation: observation({ physicalSourceDigest: OTHER }) }, 'K328_PHYSICAL_IDENTITY_MISMATCH');
  });

  it('rejects source evidence with a mismatched K-328 physical binding before persistence', () => {
    const state = buildTo('verifying');
    failure(state, verifier, { type: 'CAPTURE_SOURCE_EVIDENCE',
      observation: observation({ k328PhysicalSourceDigest: OTHER }) }, 'K328_PHYSICAL_IDENTITY_MISMATCH');
  });

  it('rejects wrong commit actor, stale revision, stale epoch, and final digest', () => {
    const state = buildTo('checkpoint6');
    failure(state, coordinator, { type: 'COMMIT_ELIGIBILITY',
      expectedFinalCheckpointDigest: state.checkpointChain[5].checkpointDigest }, 'ACTOR_UNAUTHORIZED');
    const staleRevision = { ...action(state, verifier, { type: 'COMMIT_ELIGIBILITY',
      expectedFinalCheckpointDigest: state.checkpointChain[5].checkpointDigest }),
    expectedTransitionRevision: state.authority.transitionRevision - 1 };
    expect(reduceWriterCoordination(state, staleRevision)).toEqual({ ok: false, code: 'TRANSITION_REVISION_STALE' });
    const staleEpoch = { ...action(state, verifier, { type: 'COMMIT_ELIGIBILITY',
      expectedFinalCheckpointDigest: state.checkpointChain[5].checkpointDigest }),
    expectedCoordinationEpoch: state.authority.coordinationEpoch - 1 };
    expect(reduceWriterCoordination(state, staleEpoch)).toEqual({ ok: false, code: 'COORDINATION_EPOCH_STALE' });
    failure(state, verifier, { type: 'COMMIT_ELIGIBILITY', expectedFinalCheckpointDigest: OTHER },
      'CHECKPOINT_CHAIN_INVALID');
  });
});

describe('K-329B reducer-based admission and completion races', () => {
  it('serializes close and admit from the same revision', () => {
    const beforeDrain = buildTo('before_drain'); const writer = beforeDrain.registrations[0];
    const lateAdmission = action(beforeDrain, { kind: 'writer', writerId: writer.writerId, sessionId: writer.sessionId },
      { type: 'ADMIT_OPERATION', operation: operation(writer, beforeDrain) });
    const closed = success(beforeDrain, coordinator, { type: 'REQUEST_DRAIN' });
    expect(reduceWriterCoordination(closed, lateAdmission)).toEqual({ ok: false, code: 'TRANSITION_REVISION_STALE' });
  });

  it('rejects admission after close even with refreshed CAS and rejects stale epoch admission', () => {
    const closed = buildTo('requested'); const writer = closed.registrations[0];
    failure(closed, { kind: 'writer', writerId: writer.writerId, sessionId: writer.sessionId },
      { type: 'ADMIT_OPERATION', operation: operation(writer, closed) }, 'ADMISSION_NOT_CLOSED');
    const open = registered(); const stale = operation(open.registrations[0], open, { coordinationEpoch: 99 });
    failure(open, { kind: 'writer', writerId: stale.writerId, sessionId: stale.sessionId },
      { type: 'ADMIT_OPERATION', operation: stale }, 'IN_FLIGHT_STATE_AMBIGUOUS');
  });

  it('accepts exact idempotent admission replay and rejects conflicting identity retries', () => {
    let state = registered(); const writer = state.registrations[0]; const first = operation(writer, state);
    state = success(state, { kind: 'writer', writerId: writer.writerId, sessionId: writer.sessionId },
      { type: 'ADMIT_OPERATION', operation: first });
    expect(success(state, { kind: 'writer', writerId: writer.writerId, sessionId: writer.sessionId },
      { type: 'ADMIT_OPERATION', operation: first })).toBe(state);
    for (const retry of [{ ...first, operationId: `writer-operation-v1:${'f'.repeat(64)}` },
      { ...first, idempotencyKey: `writer-idempotency-v1:${'f'.repeat(64)}`, expectedSourceRevision: '39' }]) {
      failure(state, { kind: 'writer', writerId: writer.writerId, sessionId: writer.sessionId },
        { type: 'ADMIT_OPERATION', operation: retry }, 'IN_FLIGHT_STATE_AMBIGUOUS');
    }
  });

  it('preserves crash-before-mutation and blocks quiescence without terminal evidence', () => {
    let state = registered(); const writer = state.registrations[0];
    state = success(state, { kind: 'writer', writerId: writer.writerId, sessionId: writer.sessionId },
      { type: 'ADMIT_OPERATION', operation: operation(writer, state) });
    const restored = decodeWriterCoordinationModelCanonical(encodeWriterCoordinationModelCanonical(state));
    expect(restored).toMatchObject({ ok: true, value: { authority: { unresolvedOperationCount: 1 },
      operations: [{ state: 'admitted' }] } });
  });

  it('preserves terminal evidence after response loss and rejects replay', () => {
    let state = registered(); const writer = state.registrations[0];
    state = success(state, { kind: 'writer', writerId: writer.writerId, sessionId: writer.sessionId },
      { type: 'ADMIT_OPERATION', operation: operation(writer, state) });
    const terminal = action(state, { kind: 'writer', writerId: writer.writerId, sessionId: writer.sessionId },
      { type: 'TERMINALIZE_OPERATION', operationId: state.operations[0].operationId,
        result: 'committed', committedSourceRevision: '41' });
    const committed = reduceWriterCoordination(state, terminal); expect(committed.ok).toBe(true);
    if (!committed.ok) return;
    expect(committed.state.operations[0]).toMatchObject({ state: 'committed', committedSourceRevision: '41' });
    expect(reduceWriterCoordination(committed.state, terminal)).toEqual({ ok: false, code: 'TRANSITION_REVISION_STALE' });
    expect(success(committed.state, { kind: 'writer', writerId: writer.writerId, sessionId: writer.sessionId },
      { type: 'TERMINALIZE_OPERATION', operationId: committed.state.operations[0].operationId,
        result: 'committed', committedSourceRevision: '41' })).toBe(committed.state);
  });

  it('blocks operation appearance, writer appearance, and coordinator change during verification', () => {
    const state = buildTo('verifying'); const writer = state.registrations[0];
    failure(state, { kind: 'writer', writerId: writer.writerId, sessionId: writer.sessionId },
      { type: 'ADMIT_OPERATION', operation: operation(writer, state) }, 'ADMISSION_NOT_CLOSED');
    const newcomer = registration(100, { coordinationEpoch: state.authority.coordinationEpoch });
    failure(state, { kind: 'writer', writerId: newcomer.writerId, sessionId: newcomer.sessionId },
      { type: 'REGISTER_WRITER', registration: newcomer }, 'ADMISSION_NOT_CLOSED');
    failure(state, { kind: 'coordinator', sessionId: `writer-session-v1:${'f'.repeat(32)}` },
      { type: 'ABORT', failureCode: null }, 'ACTOR_UNAUTHORIZED');
  });
});

describe('K-329B restart and partial-graph evidence', () => {
  const stages: readonly Stage[] = ['registered', 'before_drain', 'requested', 'acked', 'closed', 'checkpoint2',
    'draining', 'quiescent', 'checkpoint3', 'checkpoint4', 'verifying', 'source', 'checkpoint5', 'checkpoint6'];
  for (const stage of stages) {
    it(`round trips the complete canonical model at ${stage}`, () => {
      const state = buildTo(stage); const decoded = decodeWriterCoordinationModelCanonical(encodeWriterCoordinationModelCanonical(state));
      expect(decoded).toEqual({ ok: true, value: state });
    });
  }

  it('does not synthesize missing checkpoints after two- or five-checkpoint restart', () => {
    const two = buildTo('checkpoint2');
    failure(two, verifier, { type: 'COMMIT_ELIGIBILITY', expectedFinalCheckpointDigest: OTHER }, 'CHECKPOINT_CHAIN_INVALID');
    const five = buildTo('checkpoint5');
    failure(five, verifier, { type: 'COMMIT_ELIGIBILITY', expectedFinalCheckpointDigest: OTHER }, 'CHECKPOINT_CHAIN_INVALID');
  });

  it('persists source evidence with checkpoint five without synthesizing checkpoint six', () => {
    const state = buildTo('source');
    const decoded = decodeWriterCoordinationModelCanonical(encodeWriterCoordinationModelCanonical(state));
    expect(decoded).toMatchObject({ ok: true, value: { checkpointChain: { length: 5 },
      sourceEvidence: { evidenceDigest: state.sourceEvidence?.evidenceDigest } } });
  });

  it('preserves closed admission and exact authority sessions across restart', () => {
    const state = buildTo('verifying'); const decoded = decodeWriterCoordinationModelCanonical(
      encodeWriterCoordinationModelCanonical(state));
    expect(decoded).toMatchObject({ ok: true, value: { authority: { admissionOpen: false,
      coordinatorSessionId: COORDINATOR, verifierSessionId: VERIFIER, recoverySessionId: RECOVERY } } });
  });

  it('allows recovery only to abort and never to resume or commit', () => {
    const state = buildTo('verifying');
    failure(state, recovery, { type: 'BEGIN_SOURCE_VERIFICATION' }, 'ACTOR_UNAUTHORIZED');
    failure(state, recovery, { type: 'COMMIT_ELIGIBILITY', expectedFinalCheckpointDigest: OTHER }, 'ACTOR_UNAUTHORIZED');
    expect(success(state, recovery, { type: 'ABORT', failureCode: 'SOURCE_EVIDENCE_INVALID' }).authority.state).toBe('FAILED');
  });

  it('rejects manifest authority mismatch after restart', () => {
    const state = buildTo('checkpoint4');
    const manifestAuthority = { ...state.reviewedManifestAuthority, manifestDigest: OTHER };
    const changed = { ...state, reviewedManifestAuthority: manifestAuthority };
    expect(reduceWriterCoordination(changed, action(changed, verifier,
      { type: 'BEGIN_SOURCE_VERIFICATION' }))).toEqual({ ok: false, code: 'REVIEWED_MANIFEST_AUTHORITY_MISMATCH' });
  });

  it('detects writer disappearance before final checkpoint', () => {
    const state = buildTo('checkpoint4');
    const changed = { ...state, registrations: state.registrations.slice(1) };
    expect(reduceWriterCoordination(changed, action(changed, verifier,
      { type: 'BEGIN_SOURCE_VERIFICATION' }))).toEqual({ ok: false, code: 'CURRENT_GRAPH_CHECKPOINT_MISMATCH' });
  });
});

describe('K-329B remaining reducer race and authority negatives', () => {
  it('accepts only the exact writer acknowledgement and rejects replay after the epoch fence', () => {
    let state = buildTo('requested'); const record = state.registrations[0];
    const drainRevision = state.authority.drainRequestTransitionRevision!;
    state = success(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId },
      { type: 'ACKNOWLEDGE_DRAIN', writerId: record.writerId, drainRequestTransitionRevision: drainRevision });
    expect(state.registrations[0].acknowledgedDrainRevision).toBe(drainRevision);
    const fenced = buildTo('quiescent'); const fencedWriter = fenced.registrations[0];
    failure(fenced, { kind: 'writer', writerId: fencedWriter.writerId, sessionId: fencedWriter.sessionId },
      { type: 'ACKNOWLEDGE_DRAIN', writerId: fencedWriter.writerId, drainRequestTransitionRevision: drainRevision },
      'DRAIN_ACKNOWLEDGEMENT_INVALID');
  });

  it('rejects future drain acknowledgement revision', () => {
    const state = buildTo('requested'); const record = state.registrations[0];
    failure(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId },
      { type: 'ACKNOWLEDGE_DRAIN', writerId: record.writerId,
        drainRequestTransitionRevision: state.authority.drainRequestTransitionRevision! + 1 },
      'DRAIN_ACKNOWLEDGEMENT_INVALID');
  });

  it('rejects a wrong expected authority digest independently of revision', () => {
    const state = registered();
    const forged = { ...action(state, coordinator, { type: 'CAPTURE_BEFORE_DRAIN' }), expectedAuthorityDigest: OTHER };
    expect(reduceWriterCoordination(state, forged)).toEqual({ ok: false, code: 'TRANSITION_REVISION_STALE' });
  });

  it('rejects writer, coordinator, and recovery actors at verifier-only checkpoints', () => {
    const state = buildTo('quiescent'); const record = state.registrations[0];
    failure(state, coordinator, { type: 'CAPTURE_BEFORE_SOURCE_VERIFICATION' }, 'ACTOR_UNAUTHORIZED');
    failure(state, recovery, { type: 'CAPTURE_BEFORE_SOURCE_VERIFICATION' }, 'ACTOR_UNAUTHORIZED');
    failure(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId },
      { type: 'CAPTURE_BEFORE_SOURCE_VERIFICATION' }, 'ACTOR_UNAUTHORIZED');
  });

  it('rejects verifier and recovery actors at coordinator-only checkpoints', () => {
    const state = registered();
    failure(state, verifier, { type: 'CAPTURE_BEFORE_DRAIN' }, 'ACTOR_UNAUTHORIZED');
    failure(state, recovery, { type: 'CAPTURE_BEFORE_DRAIN' }, 'ACTOR_UNAUTHORIZED');
  });

  it('rejects a writer capturing source evidence', () => {
    const state = buildTo('verifying'); const record = state.registrations[0];
    failure(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId },
      { type: 'CAPTURE_SOURCE_EVIDENCE', observation: observation() }, 'ACTOR_UNAUTHORIZED');
  });

  it('rejects ambiguous durable source decisions and bounded rejection codes', () => {
    const state = buildTo('checkpoint6', observation({ authoritativeSourceDecision: 'ambiguous',
      ambiguityCode: 'MIXED_SOURCE_DIVERGENCE' }));
    failure(state, verifier, { type: 'COMMIT_ELIGIBILITY',
      expectedFinalCheckpointDigest: state.checkpointChain[5].checkpointDigest }, 'MIXED_SOURCE_DIVERGENCE');
  });

  it('rejects operation terminalization by another registered writer', () => {
    let state = registered(); const owner = state.registrations[0]; const other = state.registrations[1];
    state = success(state, { kind: 'writer', writerId: owner.writerId, sessionId: owner.sessionId },
      { type: 'ADMIT_OPERATION', operation: operation(owner, state) });
    failure(state, { kind: 'writer', writerId: other.writerId, sessionId: other.sessionId },
      { type: 'TERMINALIZE_OPERATION', operationId: state.operations[0].operationId,
        result: 'committed', committedSourceRevision: '41' }, 'IN_FLIGHT_STATE_AMBIGUOUS');
  });

  it('rejects malformed committed terminal evidence', () => {
    let state = registered(); const owner = state.registrations[0];
    state = success(state, { kind: 'writer', writerId: owner.writerId, sessionId: owner.sessionId },
      { type: 'ADMIT_OPERATION', operation: operation(owner, state) });
    failure(state, { kind: 'writer', writerId: owner.writerId, sessionId: owner.sessionId },
      { type: 'TERMINALIZE_OPERATION', operationId: state.operations[0].operationId,
        result: 'committed', committedSourceRevision: null }, 'IN_FLIGHT_STATE_AMBIGUOUS');
  });

  it('rejects writer appearance between checkpoint two and three through the registration action', () => {
    const state = buildTo('checkpoint2'); const newcomer = registration(100);
    failure(state, { kind: 'writer', writerId: newcomer.writerId, sessionId: newcomer.sessionId },
      { type: 'REGISTER_WRITER', registration: newcomer }, 'ADMISSION_NOT_CLOSED');
  });

  it('rejects session restart between checkpoint four and five through the registration action', () => {
    const state = buildTo('checkpoint4'); const restarted = registration(100,
      { coordinationEpoch: state.authority.coordinationEpoch });
    failure(state, { kind: 'writer', writerId: restarted.writerId, sessionId: restarted.sessionId },
      { type: 'REGISTER_WRITER', registration: restarted }, 'ADMISSION_NOT_CLOSED');
  });

  for (const [name, mutate] of [
    ['capability', (record: WriterRegistrationRecord) => ({ ...record, capabilities: ['admission', 'drain_ack'] as const })],
    ['state', (record: WriterRegistrationRecord) => ({ ...record, registrationState: 'disabled' as const,
      coordinated: true, acknowledgedDrainRevision: null })],
    ['context/session identity', (record: WriterRegistrationRecord) => ({ ...record, contextType: 'dedicated_worker' as const,
      writerId: `writer-v1:dedicated_worker:${record.writerTypeId}:${'f'.repeat(32)}` })],
  ] as const) {
    it(`detects persisted writer ${name} mutation during protected verification`, () => {
      const state = buildTo('checkpoint4'); const records = [...state.registrations]; records[0] = mutate(records[0]);
      const changed = { ...state, registrations: records };
      expect(reduceWriterCoordination(changed, action(changed, verifier,
        { type: 'BEGIN_SOURCE_VERIFICATION' }))).toEqual({ ok: false, code: 'CURRENT_GRAPH_CHECKPOINT_MISMATCH' });
    });
  }

  it('rejects trusted manifest context, capability, and role mutation', () => {
    const state = registered();
    for (const mutation of [
      { contextTypes: ['dedicated_worker'] as const },
      { requiredCapabilities: ['admission', 'drain_ack'] as const },
      { authorityRole: 'metadata_writer' as const },
    ]) {
      const entries = state.reviewedManifest.entries.map((entry, index) => index === 0 ? { ...entry, ...mutation } : entry);
      const changed = { ...state, reviewedManifest: { ...state.reviewedManifest, entries } };
      expect(reduceWriterCoordination(changed, action(changed, coordinator,
        { type: 'CAPTURE_BEFORE_DRAIN' }))).toEqual({ ok: false, code: 'REVIEWED_MANIFEST_AUTHORITY_MISMATCH' });
    }
  });

  it('rejects copying the final checkpoint into an earlier phase', () => {
    const state = buildTo('checkpoint6'); const chain = [...state.checkpointChain]; chain[0] = chain[5];
    const forged = { ...state, checkpointChain: chain };
    expect(reduceWriterCoordination(forged, action(forged, verifier, { type: 'COMMIT_ELIGIBILITY',
      expectedFinalCheckpointDigest: chain[5].checkpointDigest }))).toEqual({ ok: false, code: 'CHECKPOINT_CHAIN_INVALID' });
  });

  it('rejects source evidence replay under a new epoch', () => {
    const state = buildTo('source');
    const replayed = { ...state, authority: { ...state.authority,
      coordinationEpoch: state.authority.coordinationEpoch + 1 } };
    expect(reduceWriterCoordination(replayed, action(replayed, verifier,
      { type: 'CAPTURE_AFTER_SOURCE_VERIFICATION' }))).toEqual({ ok: false, code: 'COORDINATION_EPOCH_STALE' });
  });

  it('keeps terminal states closed and permits only bounded abort actors before terminal state', () => {
    const state = buildTo('verifying');
    for (const actor of [coordinator, verifier, recovery]) {
      expect(success(state, actor, { type: 'ABORT', failureCode: null }).authority.state).toBe('ABORTED');
    }
    const eligible = buildTo('eligible');
    failure(eligible, recovery, { type: 'ABORT', failureCode: null }, 'TRANSITION_REVISION_STALE');
  });
});

describe('K-329C current-graph checkpoint rebinding', () => {
  const full = () => buildTo('checkpoint6');

  it.each([
    ['different writer and session', (state: WriterCoordinationModelState) => {
      const record = state.registrations[0]; state.registrations = [{ ...record,
        writerId: `writer-v1:${record.contextType}:${record.writerTypeId}:${'f'.repeat(32)}`,
        sessionId: `writer-session-v1:${'e'.repeat(32)}` }, ...state.registrations.slice(1)];
    }],
    ['same writer and new session', (state: WriterCoordinationModelState) => {
      state.registrations = [{ ...state.registrations[0], sessionId: `writer-session-v1:${'e'.repeat(32)}` },
        ...state.registrations.slice(1)];
    }],
    ['new writer and same session', (state: WriterCoordinationModelState) => {
      const record = state.registrations[0]; state.registrations = [{ ...record,
        writerId: `writer-v1:${record.contextType}:${record.writerTypeId}:${'f'.repeat(32)}` },
      ...state.registrations.slice(1)];
    }],
    ['capability mutation', (state: WriterCoordinationModelState) => {
      state.registrations = [{ ...state.registrations[0], capabilities: ['admission', 'source_write'] },
        ...state.registrations.slice(1)];
    }],
    ['lifecycle mutation', (state: WriterCoordinationModelState) => {
      state.registrations = [{ ...state.registrations[0], registrationState: 'disabled', coordinated: true,
        acknowledgedDrainRevision: null }, ...state.registrations.slice(1)];
    }],
    ['acknowledgement revision mutation', (state: WriterCoordinationModelState) => {
      state.registrations = [{ ...state.registrations[0],
        acknowledgedDrainRevision: state.registrations[0].acknowledgedDrainRevision! + 1 },
      ...state.registrations.slice(1)];
    }],
    ['registration removal', (state: WriterCoordinationModelState) => {
      state.registrations = state.registrations.slice(1);
    }],
    ['extra same-type registration', (state: WriterCoordinationModelState) => {
      const record = state.registrations[0]; state.registrations = [...state.registrations, { ...record,
        writerId: `writer-v1:${record.contextType}:${record.writerTypeId}:${'f'.repeat(32)}`,
        sessionId: `writer-session-v1:${'e'.repeat(32)}` }];
    }],
  ] as const)('rejects %s after checkpoint six at validate, decode, and commit', (_name, mutate) => {
    expectFullGraphTamperRejected(full(), mutate, 'CURRENT_GRAPH_CHECKPOINT_MISMATCH');
  });

  it('derives one canonical current graph and binds checkpoint six exactly', () => {
    const state = full(); const graph = deriveCurrentCoordinationGraph(state); const final = state.checkpointChain[5];
    expect(graph).toEqual({ stableWriterIdentityDigest: final.stableIdentityDigest,
      liveWriterInstanceDigest: final.liveInstanceDigest, operationSetDigest: final.operationDigest,
      unresolvedOperationDigest: final.unresolvedOperationDigest,
      unresolvedOperationCount: final.unresolvedOperationCount, registrationCount: final.registrationCount,
      operationCount: final.operationCount });
    expect(graph.unresolvedOperationDigest).toBe(contract.ZERO_UNRESOLVED_OPERATION_DIGEST);
  });
});

describe('K-329C operation and registration relations', () => {
  const terminal = () => buildTerminalOperationToCheckpoint6();

  it('rejects a terminal operation with no registration', () => {
    expectFullGraphTamperRejected(terminal(), state => { state.registrations = []; },
      'OPERATION_REGISTRATION_RELATION_INVALID');
  });

  it.each([
    ['wrong session', (state: WriterCoordinationModelState) => {
      state.operations = [{ ...state.operations[0], sessionId: `writer-session-v1:${'e'.repeat(32)}` }];
    }],
    ['wrong source', (state: WriterCoordinationModelState) => {
      state.operations = [{ ...state.operations[0], physicalSourceDigest: OTHER }];
    }],
    ['stale epoch', (state: WriterCoordinationModelState) => {
      state.operations = [{ ...state.operations[0], coordinationEpoch: state.authority.coordinationEpoch - 1 }];
    }],
    ['removed owner registration', (state: WriterCoordinationModelState) => {
      state.registrations = state.registrations.slice(1);
    }],
    ['wrong writer type and identity', (state: WriterCoordinationModelState) => {
      const original = state.operations[0]; const other = state.registrations[1];
      state.operations = [{ ...original, writerTypeId: other.writerTypeId,
        writerId: `writer-v1:${other.contextType}:${other.writerTypeId}:${'f'.repeat(32)}` }];
    }],
  ] as const)('rejects operation relation: %s', (_name, mutate) => {
    expectFullGraphTamperRejected(terminal(), mutate, 'OPERATION_REGISTRATION_RELATION_INVALID');
  });

  it.each([
    ['operation removal', (state: WriterCoordinationModelState) => { state.operations = []; }],
    ['missing latest operation', (state: WriterCoordinationModelState) => {
      state.registrations = [{ ...state.registrations[0], latestOperationId: null }, ...state.registrations.slice(1)];
    }],
    ['active operation under acknowledged writer', (state: WriterCoordinationModelState) => {
      state.operations = [{ ...state.operations[0], state: 'admitted', terminalResult: null,
        committedSourceRevision: null }];
    }],
  ] as const)('rejects reverse registration relation: %s', (_name, mutate) => {
    expectFullGraphTamperRejected(terminal(), mutate, 'REGISTRATION_OPERATION_RELATION_INVALID');
  });

  it.each([
    ['terminal operation addition', (state: WriterCoordinationModelState) => {
      state.operations = [...state.operations, { ...state.operations[0],
        operationId: `writer-operation-v1:${'a'.repeat(64)}`,
        idempotencyKey: `writer-idempotency-v1:${'b'.repeat(64)}` }];
    }],
    ['idempotency-key mutation', (state: WriterCoordinationModelState) => {
      state.operations = [{ ...state.operations[0], idempotencyKey: `writer-idempotency-v1:${'b'.repeat(64)}` }];
    }],
    ['source-commit mutation', (state: WriterCoordinationModelState) => {
      state.operations = [{ ...state.operations[0], committedSourceRevision: '42' }];
    }],
  ] as const)('rejects operation graph divergence: %s', (_name, mutate) => {
    expectFullGraphTamperRejected(terminal(), mutate, 'CURRENT_GRAPH_CHECKPOINT_MISMATCH');
  });

  it('binds both unresolved count and canonical unresolved digest', () => {
    expectFullGraphTamperRejected(terminal(), state => {
      const owner = state.registrations[0]; const admitted = { ...state.operations[0],
        operationId: `writer-operation-v1:${'a'.repeat(64)}`,
        idempotencyKey: `writer-idempotency-v1:${'b'.repeat(64)}`,
        state: 'admitted' as const, terminalResult: null, committedSourceRevision: null };
      state.operations = [...state.operations, admitted];
      state.registrations = [{ ...owner, registrationState: 'registered', coordinated: false,
        acknowledgedDrainRevision: null, latestOperationId: admitted.operationId }, ...state.registrations.slice(1)];
      state.authority = { ...state.authority, unresolvedOperationCount: 1 };
      const graph = deriveCurrentCoordinationGraph(state);
      expect(graph.unresolvedOperationCount).toBe(1);
      expect(graph.unresolvedOperationDigest).not.toBe(contract.ZERO_UNRESOLVED_OPERATION_DIGEST);
    }, 'CURRENT_GRAPH_CHECKPOINT_MISMATCH');
  });
});

describe('K-329C source and eligibility lifecycle relations', () => {
  function expectRestartRejected(base: WriterCoordinationModelState,
    mutate: (state: WriterCoordinationModelState) => void, code: WriterEligibilityErrorCode): void {
    const forged = cloneModel(base); mutate(forged);
    expect(validateWriterCoordinationModelState(forged)).toBe(false);
    expect(validateWriterCoordinationModelRelations(forged)).toBe(code);
    expect(decodeWriterCoordinationModelCanonical(text.encode(JSON.stringify(forged)))).toEqual({ ok: false,
      code: 'ELIGIBILITY_EVIDENCE_CORRUPT' });
  }

  it.each([
    ['no checkpoint chain', (state: WriterCoordinationModelState) => { state.checkpointChain = []; },
      'SOURCE_EVIDENCE_CHECKPOINT_MISMATCH'],
    ['checkpoint four missing', (state: WriterCoordinationModelState) => {
      state.checkpointChain = state.checkpointChain.slice(0, 3);
    }, 'SOURCE_EVIDENCE_CHECKPOINT_MISMATCH'],
    ['checkpoint five missing', (state: WriterCoordinationModelState) => {
      state.checkpointChain = state.checkpointChain.slice(0, 4);
    }, 'SOURCE_EVIDENCE_CHECKPOINT_MISMATCH'],
    ['wrong predecessor', (state: WriterCoordinationModelState) => {
      replaceSourceEvidence(state, { previousCheckpointDigest: state.checkpointChain[2].checkpointDigest });
    }, 'SOURCE_EVIDENCE_CHECKPOINT_MISMATCH'],
    ['wrong capture revision', (state: WriterCoordinationModelState) => {
      replaceSourceEvidence(state, { transitionRevision: state.sourceEvidence!.transitionRevision + 1 });
    }, 'SOURCE_EVIDENCE_LIFECYCLE_MISMATCH'],
    ['wrong epoch', (state: WriterCoordinationModelState) => {
      replaceSourceEvidence(state, { coordinationEpoch: state.sourceEvidence!.coordinationEpoch + 1 });
    }, 'SOURCE_EVIDENCE_CHECKPOINT_MISMATCH'],
    ['wrong verifier', (state: WriterCoordinationModelState) => {
      replaceSourceEvidence(state, { captureActorSessionId: RECOVERY });
    }, 'SOURCE_EVIDENCE_CHECKPOINT_MISMATCH'],
    ['wrong physical source', (state: WriterCoordinationModelState) => {
      replaceSourceEvidence(state, { physicalSourceDigest: OTHER });
    }, 'SOURCE_EVIDENCE_CHECKPOINT_MISMATCH'],
    ['evidence attached in OPEN', (state: WriterCoordinationModelState) => {
      state.authority = { ...state.authority, state: 'OPEN', admissionOpen: true };
    }, 'SOURCE_EVIDENCE_LIFECYCLE_MISMATCH'],
  ] as const)('rejects source restart tamper: %s', (_name, mutate, code) => {
    expectRestartRejected(buildTo('source'), mutate, code);
  });

  it('rejects checkpoint five that does not bind the exact source evidence', () => {
    expectRestartRejected(buildTo('checkpoint5'), state => {
      const chain = [...state.checkpointChain]; const { checkpointDigest: _ignored, ...content } = {
        ...chain[4], sourceEvidenceDigest: OTHER };
      chain[4] = { ...content, checkpointDigest: deriveRegistrationCheckpointDigest(content) };
      state.checkpointChain = chain;
    }, 'SOURCE_EVIDENCE_CHECKPOINT_MISMATCH');
  });

  it('rejects canonical restart state whose source evidence carries a different K-328 physical source binding', () => {
    const original = buildTo('checkpoint6');
    expect(validateWriterCoordinationModelState(original)).toBe(true);
    expect(decodeWriterCoordinationModelCanonical(encodeWriterCoordinationModelCanonical(original)).ok).toBe(true);

    const forged = cloneModel(original);
    replaceSourceEvidence(forged, { k328PhysicalSourceDigest: OTHER });
    expect(decodeSourceVerificationEvidenceCanonical(
      encodeSourceVerificationEvidenceCanonical(forged.sourceEvidence!),
    )).toMatchObject({ ok: true });

    const chain = [...forged.checkpointChain];
    const { checkpointDigest: _checkpointFiveDigest, ...checkpointFiveContent } = {
      ...chain[4], sourceEvidenceDigest: forged.sourceEvidence!.evidenceDigest };
    chain[4] = { ...checkpointFiveContent,
      checkpointDigest: deriveRegistrationCheckpointDigest(checkpointFiveContent) };
    const { checkpointDigest: _checkpointSixDigest, ...checkpointSixContent } = {
      ...chain[5], previousCheckpointDigest: chain[4].checkpointDigest,
      sourceEvidenceDigest: forged.sourceEvidence!.evidenceDigest };
    chain[5] = { ...checkpointSixContent,
      checkpointDigest: deriveRegistrationCheckpointDigest(checkpointSixContent) };
    forged.checkpointChain = chain;

    expect(validateWriterCoordinationModelState(forged)).toBe(false);
    expect(validateWriterCoordinationModelRelations(forged)).toBe('SOURCE_EVIDENCE_CHECKPOINT_MISMATCH');
    expect(decodeWriterCoordinationModelCanonical(text.encode(JSON.stringify(forged)))).toEqual({ ok: false,
      code: 'ELIGIBILITY_EVIDENCE_CORRUPT' });
    expect(reduceWriterCoordination(forged, action(forged, verifier, { type: 'COMMIT_ELIGIBILITY',
      expectedFinalCheckpointDigest: forged.checkpointChain[5].checkpointDigest }))).toEqual({ ok: false,
      code: 'SOURCE_EVIDENCE_CHECKPOINT_MISMATCH' });
  });

  it.each([
    ['stale final checkpoint', (state: WriterCoordinationModelState) => {
      state.eligibilityEvidence = { ...state.eligibilityEvidence!, finalCheckpointDigest: OTHER };
    }],
    ['stale source evidence', (state: WriterCoordinationModelState) => {
      state.eligibilityEvidence = { ...state.eligibilityEvidence!, sourceEvidenceDigest: OTHER };
    }],
    ['stale current graph', (state: WriterCoordinationModelState) => {
      state.eligibilityEvidence = { ...state.eligibilityEvidence!, stableIdentityDigest: OTHER };
    }],
  ] as const)('rejects eligibility restart tamper: %s', (_name, mutate) => {
    expectRestartRejected(buildTo('eligible'), mutate, 'ELIGIBILITY_EVIDENCE_RELATION_MISMATCH');
  });

  it('rejects canonical restart state whose eligibility evidence carries a different K-328 physical source binding', () => {
    const original = buildTo('eligible');
    expect(validateWriterCoordinationModelState(original)).toBe(true);
    expect(decodeWriterCoordinationModelCanonical(encodeWriterCoordinationModelCanonical(original)).ok).toBe(true);

    const forged = cloneModel(original);
    forged.eligibilityEvidence = { ...forged.eligibilityEvidence!, k328PhysicalSourceDigest: OTHER };
    expect(decodeEligibilityEvidenceCanonical(
      encodeEligibilityEvidenceCanonical(forged.eligibilityEvidence),
    )).toMatchObject({ ok: true });
    expect(validateWriterCoordinationModelState(forged)).toBe(false);
    expect(validateWriterCoordinationModelRelations(forged)).toBe('ELIGIBILITY_EVIDENCE_RELATION_MISMATCH');
    expect(decodeWriterCoordinationModelCanonical(text.encode(JSON.stringify(forged)))).toEqual({ ok: false,
      code: 'ELIGIBILITY_EVIDENCE_CORRUPT' });
    expect(reduceWriterCoordination(forged, action(forged, verifier, { type: 'COMMIT_ELIGIBILITY',
      expectedFinalCheckpointDigest: forged.checkpointChain[5].checkpointDigest }))).toEqual({ ok: false,
      code: 'ELIGIBILITY_EVIDENCE_RELATION_MISMATCH' });
  });
});

describe('K-329B immutable reducer and bounded failures', () => {
  it('does not mutate input state', () => {
    const state = registered(); const before = JSON.stringify(state);
    reduceWriterCoordination(state, action(state, coordinator, { type: 'CAPTURE_BEFORE_DRAIN' }));
    expect(JSON.stringify(state)).toBe(before);
  });

  it('derives a stable bounded error policy', () => {
    expect(contract.eligibilityFailure('CHECKPOINT_CHAIN_INVALID')).toEqual({ eligible: false,
      code: 'CHECKPOINT_CHAIN_INVALID', retryable: false,
      requiredAction: 'restart from a new reviewed coordination session' });
  });

  it('rejects unknown action fields and unknown persisted versions', () => {
    const state = registered(); const extra = action(state, coordinator,
      { type: 'CAPTURE_BEFORE_DRAIN', inventoryComplete: true }) as never;
    expect(reduceWriterCoordination(state, extra)).toEqual({ ok: false, code: 'ELIGIBILITY_EVIDENCE_CORRUPT' });
    const bytes = encodeCoordinationAuthorityCanonical(state.authority);
    expect(decodeCoordinationAuthorityCanonical(text.encode(new TextDecoder().decode(bytes)
      .replace('"schemaVersion":1', '"schemaVersion":9')))).toEqual({ ok: false,
      code: 'ELIGIBILITY_PROTOCOL_VERSION_UNSUPPORTED' });
  });

  it('validates exact manifest and full model invariants', () => {
    expect(validateReviewedWriterManifest(createK329BReviewedWriterManifest(PHYSICAL))).toBe(true);
    expect(validateWriterCoordinationModelState(buildTo('eligible'))).toBe(true);
    expect(deriveLiveWriterInstanceSetDigest(buildTo('checkpoint6').registrations)).toMatch(/^[a-f0-9]{64}$/);
  });
});
