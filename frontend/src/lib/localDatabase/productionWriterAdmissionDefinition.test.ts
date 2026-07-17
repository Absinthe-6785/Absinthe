import { describe, expect, it } from 'vitest';
import {
  K329B_REVIEWED_WRITER_MANIFEST_ENTRIES,
  createWriterCoordinationModel,
  decodeWriterCoordinationModelCanonical,
  deriveCoordinationAuthorityDigest,
  encodeWriterCoordinationModelCanonical,
  reduceWriterCoordination,
  type AdmissionOperationRecord,
  type WriterCoordinationAction,
  type WriterCoordinationActor,
  type WriterCoordinationModelState,
  type WriterRegistrationRecord,
  type SourceVerificationObservation,
} from './writerCoordinationEligibility';

const PHYSICAL_SOURCE = '1'.repeat(64);
const COORDINATOR_SESSION = `writer-session-v1:${'a'.repeat(32)}`;
const VERIFIER_SESSION = `writer-session-v1:${'b'.repeat(32)}`;
const RECOVERY_SESSION = `writer-session-v1:${'c'.repeat(32)}`;
const coordinator: WriterCoordinationActor = { kind: 'coordinator', sessionId: COORDINATOR_SESSION };
const verifier: WriterCoordinationActor = { kind: 'verifier', sessionId: VERIFIER_SESSION };
const participating = K329B_REVIEWED_WRITER_MANIFEST_ENTRIES
  .filter(entry => entry.coordinationRequirement === 'must_participate');

function hex(index: number, width: number): string {
  return index.toString(16).padStart(width, '0').slice(-width);
}

function model(): WriterCoordinationModelState {
  return createWriterCoordinationModel({
    physicalSourceDigest: PHYSICAL_SOURCE,
    coordinatorSessionId: COORDINATOR_SESSION,
    verifierSessionId: VERIFIER_SESSION,
    recoverySessionId: RECOVERY_SESSION,
  });
}

function registration(index: number, overrides: Partial<WriterRegistrationRecord> = {}): WriterRegistrationRecord {
  const entry = participating[index % participating.length];
  const contextType = entry.contextTypes[0];
  return {
    kind: 'absinthe_writer_registration',
    schemaVersion: 1,
    byteFormatVersion: 1,
    physicalSourceDigest: PHYSICAL_SOURCE,
    writerTypeId: entry.writerTypeId,
    writerId: `writer-v1:${contextType}:${entry.writerTypeId}:${hex(index + 1, 32)}`,
    sessionId: `writer-session-v1:${hex(index + 101, 32)}`,
    contextType,
    coordinationEpoch: 1,
    capabilities: [...entry.requiredCapabilities],
    registrationState: 'registered',
    coordinated: false,
    acknowledgedDrainRevision: null,
    latestOperationId: null,
    lastSeenSequence: 0,
    ...overrides,
  };
}

function action(
  state: WriterCoordinationModelState,
  actor: WriterCoordinationActor,
  body: Record<string, unknown>,
): WriterCoordinationAction {
  return {
    ...body,
    actor,
    expectedTransitionRevision: state.authority.transitionRevision,
    expectedCoordinationEpoch: state.authority.coordinationEpoch,
    expectedAuthorityDigest: deriveCoordinationAuthorityDigest(state.authority),
  } as unknown as WriterCoordinationAction;
}

function apply(
  state: WriterCoordinationModelState,
  actor: WriterCoordinationActor,
  body: Record<string, unknown>,
): WriterCoordinationModelState {
  const result = reduceWriterCoordination(state, action(state, actor, body));
  expect(result).toMatchObject({ ok: true });
  if (!result.ok) throw new Error(result.code);
  return result.state;
}

function register(state: WriterCoordinationModelState, record: WriterRegistrationRecord): WriterCoordinationModelState {
  return apply(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId }, {
    type: 'REGISTER_WRITER',
    registration: record,
  });
}

function registerAll(): WriterCoordinationModelState {
  return participating.reduce((state, _entry, index) => register(state, registration(index)), model());
}

function operation(
  owner: WriterRegistrationRecord,
  state: WriterCoordinationModelState,
  index = 1,
): AdmissionOperationRecord {
  return {
    kind: 'absinthe_writer_admission_operation',
    schemaVersion: 1,
    byteFormatVersion: 1,
    physicalSourceDigest: PHYSICAL_SOURCE,
    operationId: `writer-operation-v1:${hex(index, 64)}`,
    idempotencyKey: `writer-idempotency-v1:${hex(index + 1000, 64)}`,
    writerTypeId: owner.writerTypeId,
    writerId: owner.writerId,
    sessionId: owner.sessionId,
    coordinationEpoch: state.authority.coordinationEpoch,
    admissionTransitionRevision: state.authority.transitionRevision,
    mutationType: 'entity_put',
    expectedSourceRevision: '40',
    state: 'admitted',
    committedSourceRevision: null,
    terminalResult: null,
  };
}

type IntegrationPolicySnapshot = {
  webLocksAvailable: boolean;
  protocolVersion: number;
  expectedProtocolVersion: number;
  maintenanceOwner: string | null;
  writerSessionId: string;
  writerKind: 'interactive' | 'sync' | 'maintenance';
  syncPaused: boolean;
};

function integrationPolicySnapshot(input: IntegrationPolicySnapshot): string | null {
  if (!input.webLocksAvailable) return 'WEB_LOCKS_UNAVAILABLE';
  if (input.protocolVersion !== input.expectedProtocolVersion) return 'UNSUPPORTED_PROTOCOL_VERSION';
  if (input.maintenanceOwner !== null && input.maintenanceOwner !== input.writerSessionId) {
    return 'MAINTENANCE_ADMISSION_EXCLUSIVE';
  }
  if (input.writerKind === 'sync' && input.syncPaused) return 'SYNC_APPLY_PAUSED';
  return null;
}

type SourceReceiptFixture = Readonly<{
  operationId: string;
  writerSessionId: string;
  mutationDigest: string;
  previousSourceRevision: string;
  committedSourceRevision: string;
  outboxMutationId: string;
  receiptDigest: string;
}>;

type SourceAuthorityFixture = Readonly<{
  revision: string;
  receipts: Readonly<Record<string, SourceReceiptFixture>>;
  outboxMutationIds: readonly string[];
}>;

type SourceMutationFixture = Readonly<{
  operationId: string;
  writerSessionId: string;
  mutationDigest: string;
  expectedSourceRevision: string;
}>;

type SourceCommitFixtureResult =
  | Readonly<{ ok: true; state: SourceAuthorityFixture; receipt: SourceReceiptFixture; reused: boolean }>
  | Readonly<{ ok: false; code: 'SOURCE_REVISION_MISMATCH' | 'OPERATION_IDENTITY_MISMATCH' }>;

function commitSourceFixture(state: SourceAuthorityFixture, input: SourceMutationFixture): SourceCommitFixtureResult {
  const existing = state.receipts[input.operationId];
  if (existing) {
    if (existing.writerSessionId !== input.writerSessionId
      || existing.mutationDigest !== input.mutationDigest
      || existing.previousSourceRevision !== input.expectedSourceRevision) {
      return { ok: false, code: 'OPERATION_IDENTITY_MISMATCH' };
    }
    return { ok: true, state, receipt: existing, reused: true };
  }
  if (input.expectedSourceRevision !== state.revision) {
    return { ok: false, code: 'SOURCE_REVISION_MISMATCH' };
  }
  const committedSourceRevision = (BigInt(state.revision) + 1n).toString(10);
  const receipt: SourceReceiptFixture = Object.freeze({
    operationId: input.operationId,
    writerSessionId: input.writerSessionId,
    mutationDigest: input.mutationDigest,
    previousSourceRevision: state.revision,
    committedSourceRevision,
    outboxMutationId: `outbox:${input.operationId}`,
    receiptDigest: `receipt:${input.operationId}:${committedSourceRevision}:${input.mutationDigest}`,
  });
  return {
    ok: true,
    reused: false,
    receipt,
    state: Object.freeze({
      revision: committedSourceRevision,
      receipts: Object.freeze({ ...state.receipts, [input.operationId]: receipt }),
      outboxMutationIds: Object.freeze([...state.outboxMutationIds, receipt.outboxMutationId]),
    }),
  };
}

type ReconciliationClassification =
  | 'NO_OPERATION'
  | 'ADMITTED_SOURCE_UNCOMMITTED'
  | 'RECONCILE_TERMINAL_FROM_RECEIPT'
  | 'COMMITTED'
  | 'CORRUPT_PERSISTED_GRAPH';

function classifyReceiptGraph(input: Readonly<{
  admission: boolean;
  receipt: boolean;
  entityRevisionAdvanced: boolean;
  outbox: boolean;
  terminalCommitted: boolean;
}>): ReconciliationClassification {
  if (input.receipt) {
    if (!input.admission || !input.entityRevisionAdvanced || !input.outbox) return 'CORRUPT_PERSISTED_GRAPH';
    return input.terminalCommitted ? 'COMMITTED' : 'RECONCILE_TERMINAL_FROM_RECEIPT';
  }
  if (input.terminalCommitted || input.entityRevisionAdvanced || input.outbox) return 'CORRUPT_PERSISTED_GRAPH';
  return input.admission ? 'ADMITTED_SOURCE_UNCOMMITTED' : 'NO_OPERATION';
}

type ReceiptBackedOperationFixture = Readonly<{
  namespaceFingerprint: string;
  generationId: string;
  operationId: string;
  coordinationEpoch: number;
  admissionReceiptDigest: string;
  receiptDigest: string | null;
  previousSourceRevision: string | null;
  committedSourceRevision: string | null;
  sourceAuthorityRevision: string;
  entitySetDigestMatches: boolean;
  outboxSetDigestMatches: boolean;
  admitted: boolean;
  terminal: 'absent' | 'committed' | 'failed' | 'aborted';
  terminalReceiptDigest: string | null;
}>;

type ReconcileCommittedSourceReceiptInput = Readonly<{
  namespaceFingerprint: string;
  generationId: string;
  operationId: string;
}>;

type ReceiptReconciliationResult =
  | Readonly<{ ok: true; operation: ReceiptBackedOperationFixture; reused: boolean }>
  | Readonly<{ ok: false; code:
      | 'RECONCILIATION_RECEIPT_NOT_FOUND'
      | 'RECONCILIATION_OPERATION_NOT_ADMITTED'
      | 'RECONCILIATION_RECEIPT_DIGEST_MISMATCH'
      | 'RECONCILIATION_SOURCE_REVISION_MISMATCH'
      | 'RECONCILIATION_TERMINAL_CONFLICT'
      | 'RECONCILIATION_STALE_EPOCH' }>;

function reconcileCommittedSourceReceiptFixture(
  persisted: ReceiptBackedOperationFixture,
  input: ReconcileCommittedSourceReceiptInput,
  currentEpoch: number,
): ReceiptReconciliationResult {
  if (persisted.namespaceFingerprint !== input.namespaceFingerprint
    || persisted.generationId !== input.generationId
    || persisted.operationId !== input.operationId
    || !persisted.admitted) {
    return { ok: false, code: 'RECONCILIATION_OPERATION_NOT_ADMITTED' };
  }
  if (persisted.coordinationEpoch !== currentEpoch) {
    return { ok: false, code: 'RECONCILIATION_STALE_EPOCH' };
  }
  if (persisted.receiptDigest === null || persisted.previousSourceRevision === null
    || persisted.committedSourceRevision === null) {
    return { ok: false, code: 'RECONCILIATION_RECEIPT_NOT_FOUND' };
  }
  if (!persisted.entitySetDigestMatches || !persisted.outboxSetDigestMatches) {
    return { ok: false, code: 'RECONCILIATION_RECEIPT_DIGEST_MISMATCH' };
  }
  if (BigInt(persisted.committedSourceRevision) !== BigInt(persisted.previousSourceRevision) + 1n
    || BigInt(persisted.sourceAuthorityRevision) < BigInt(persisted.committedSourceRevision)) {
    return { ok: false, code: 'RECONCILIATION_SOURCE_REVISION_MISMATCH' };
  }
  if (persisted.terminal === 'failed' || persisted.terminal === 'aborted') {
    return { ok: false, code: 'RECONCILIATION_TERMINAL_CONFLICT' };
  }
  if (persisted.terminal === 'committed') {
    if (persisted.terminalReceiptDigest !== persisted.receiptDigest) {
      return { ok: false, code: 'RECONCILIATION_TERMINAL_CONFLICT' };
    }
    return { ok: true, operation: persisted, reused: true };
  }
  return {
    ok: true,
    reused: false,
    operation: Object.freeze({
      ...persisted,
      terminal: 'committed',
      terminalReceiptDigest: persisted.receiptDigest,
    }),
  };
}

function receiptBackedOperation(
  overrides: Partial<ReceiptBackedOperationFixture> = {},
): ReceiptBackedOperationFixture {
  return Object.freeze({
    namespaceFingerprint: 'namespace-digest',
    generationId: 'generation-a',
    operationId: 'operation-a',
    coordinationEpoch: 7,
    admissionReceiptDigest: 'admission-digest',
    receiptDigest: 'receipt-digest',
    previousSourceRevision: '40',
    committedSourceRevision: '41',
    sourceAuthorityRevision: '41',
    entitySetDigestMatches: true,
    outboxSetDigestMatches: true,
    admitted: true,
    terminal: 'absent',
    terminalReceiptDigest: null,
    ...overrides,
  });
}

type DrainAdmissionDecision =
  | 'SOURCE_COMMIT_ALLOWED'
  | 'RECONCILE_ONLY'
  | 'NEW_ADMISSION_CLOSED'
  | 'STALE_EPOCH'
  | 'OPERATION_ALREADY_TERMINAL';

function evaluateDrainAwareAdmission(input: Readonly<{
  admittedBeforeDrain: boolean;
  drainState: 'open' | 'requested' | 'closed' | 'quiescent';
  admissionEpoch: number;
  currentEpoch: number;
  terminal: boolean;
  receiptExists: boolean;
}>): DrainAdmissionDecision {
  if (input.admissionEpoch !== input.currentEpoch) return 'STALE_EPOCH';
  if (!input.admittedBeforeDrain && input.drainState !== 'open') return 'NEW_ADMISSION_CLOSED';
  if (input.terminal) return 'OPERATION_ALREADY_TERMINAL';
  if (input.receiptExists) return 'RECONCILE_ONLY';
  return 'SOURCE_COMMIT_ALLOWED';
}

type BootstrapEvidenceFixture = Readonly<{
  namespaceFingerprint: string;
  generationId: string;
  revision: '0';
  aggregateEntityDigest: string;
  generationManifestDigest: string;
  outboxBaselineDigest: string;
  bootstrapEvidenceDigest: string;
}>;

type BootstrapResult =
  | Readonly<{ ok: true; authority: BootstrapEvidenceFixture; reused: boolean }>
  | Readonly<{ ok: false; code: 'SOURCE_AUTHORITY_BOOTSTRAP_CONFLICT' }>;

function bootstrapSourceAuthorityFixture(
  existing: BootstrapEvidenceFixture | null,
  candidate: Omit<BootstrapEvidenceFixture, 'revision'>,
): BootstrapResult {
  const authority = Object.freeze({ ...candidate, revision: '0' as const });
  if (existing === null) return { ok: true, authority, reused: false };
  const canonical = (value: BootstrapEvidenceFixture): readonly string[] => [
    value.namespaceFingerprint,
    value.generationId,
    value.revision,
    value.aggregateEntityDigest,
    value.generationManifestDigest,
    value.outboxBaselineDigest,
    value.bootstrapEvidenceDigest,
  ];
  const existingCanonical = canonical(existing);
  const candidateCanonical = canonical(authority);
  if (existingCanonical.some((value, index) => value !== candidateCanonical[index])) {
    return { ok: false, code: 'SOURCE_AUTHORITY_BOOTSTRAP_CONFLICT' };
  }
  return { ok: true, authority: existing, reused: true };
}

const K331B_FUTURE_TASK_ORDER = Object.freeze([
  'K-332_SOURCE_AUTHORITY_AND_PROTOCOL_CONTRACT',
  'K-333_PROTOCOL_AND_REPOSITORY_MODEL_EXTENSION',
  'K-334_DORMANT_SOURCE_TRANSACTION_REPOSITORY',
  'K-335_DORMANT_COORDINATION_CLIENT',
]);

const CENTRAL_MUTATION_MANIFEST_POLICY = Object.freeze({
  role: 'AUDIT_AND_ADMISSION_INVENTORY',
  routesMutations: false,
  invokesFunctions: false,
  overridesCoordinationAuthority: false,
  wrapperReferenceCardinality: 'EXACTLY_ONE_ENTRY',
});

const FIRST_WRITE_PROTOCOL_POLICY = Object.freeze({
  compatibilityDescriptor: 'transient',
  transition: 'ATOMIC_REGISTER_AND_ADMIT',
  durableRegisteredIdleBoundary: false,
});

const K331A_FIELD_CLASSIFICATION = Object.freeze({
  reused: Object.freeze([
    'writerTypeId', 'contextType', 'capabilities', 'mutationType', 'writerId', 'sessionId', 'operationId',
    'coordinationEpoch', 'admissionTransitionRevision', 'expectedSourceRevision', 'physicalSourceDigest',
    'manifestVersion', 'authorityDigest', 'terminalState', 'drainState', 'checkpointChain',
  ]),
  persistedNew: Object.freeze([
    'contextId', 'semanticMutationKind', 'protocolVersion', 'sourceImplementationId',
    'sourceTransactionReceiptDigest', 'committedSourceRevision', 'maintenanceOwnerIdentity',
  ]),
  transient: Object.freeze(['webLockState', 'pendingPromise', 'uiState', 'runtimeCallback', 'visibilityState']),
});

const PHYSICAL_SINK_REACHABILITY = Object.freeze({
  clearIndexedDbNotes: 'PRODUCTION_REACHABLE_VIA_RESET',
  deleteNoteFromIndexedDb: 'DORMANT_VIA_UNREFERENCED_FACADE',
});

function sourceObservation(): SourceVerificationObservation {
  return {
    physicalSourceDigest: PHYSICAL_SOURCE,
    sourceType: 'indexeddb',
    ownershipProven: true,
    canonical: true,
    withinBounds: true,
    revisionBefore: '41',
    digestBefore: '2'.repeat(64),
    revisionAfter: '41',
    digestAfter: '2'.repeat(64),
    authoritativeSourceDecision: 'indexeddb',
    ambiguityCode: null,
    k328AdapterAvailable: true,
    k328PhysicalSourceDigest: PHYSICAL_SOURCE,
  };
}

describe('K-331 dormant production-writer admission definition', () => {
  it('registers two tab-scoped sessions without transferring identity', () => {
    let state = model();
    const first = registration(0);
    const second = registration(participating.length, {
      writerId: `writer-v1:${first.contextType}:${first.writerTypeId}:${hex(99, 32)}`,
      sessionId: `writer-session-v1:${hex(199, 32)}`,
    });
    state = register(state, first);
    state = register(state, second);
    expect(state.registrations.map(value => value.sessionId)).toEqual([first.sessionId, second.sessionId]);
  });

  it('rejects a capability mismatch at registration', () => {
    const state = model();
    const record = registration(0, { capabilities: ['admission'] });
    expect(reduceWriterCoordination(state, action(
      state,
      { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId },
      { type: 'REGISTER_WRITER', registration: record },
    ))).toEqual({ ok: false, code: 'WRITER_NOT_COORDINATED' });
  });

  it('treats an exact duplicate operation identity as idempotent', () => {
    let state = registerAll();
    const owner = state.registrations[0];
    const admitted = operation(owner, state);
    state = apply(state, { kind: 'writer', writerId: owner.writerId, sessionId: owner.sessionId }, {
      type: 'ADMIT_OPERATION', operation: admitted,
    });
    const repeated = reduceWriterCoordination(state, action(
      state,
      { kind: 'writer', writerId: owner.writerId, sessionId: owner.sessionId },
      { type: 'ADMIT_OPERATION', operation: admitted },
    ));
    expect(repeated).toEqual({ ok: true, state });
  });

  it('rejects a conflicting duplicate operation identity', () => {
    let state = registerAll();
    const owner = state.registrations[0];
    const admitted = operation(owner, state);
    state = apply(state, { kind: 'writer', writerId: owner.writerId, sessionId: owner.sessionId }, {
      type: 'ADMIT_OPERATION', operation: admitted,
    });
    expect(reduceWriterCoordination(state, action(
      state,
      { kind: 'writer', writerId: owner.writerId, sessionId: owner.sessionId },
      { type: 'ADMIT_OPERATION', operation: { ...admitted, expectedSourceRevision: '41' } },
    ))).toEqual({ ok: false, code: 'IN_FLIGHT_STATE_AMBIGUOUS' });
  });

  it('allows a pre-drain admitted operation to terminalize during drain request', () => {
    let state = registerAll();
    const owner = state.registrations[0];
    state = apply(state, { kind: 'writer', writerId: owner.writerId, sessionId: owner.sessionId }, {
      type: 'ADMIT_OPERATION', operation: operation(owner, state),
    });
    state = apply(state, coordinator, { type: 'CAPTURE_BEFORE_DRAIN' });
    state = apply(state, coordinator, { type: 'REQUEST_DRAIN' });
    state = apply(state, { kind: 'writer', writerId: owner.writerId, sessionId: owner.sessionId }, {
      type: 'TERMINALIZE_OPERATION',
      operationId: state.operations[0].operationId,
      result: 'committed',
      committedSourceRevision: '41',
    });
    expect(state.authority.unresolvedOperationCount).toBe(0);
    expect(state.operations[0]).toMatchObject({ state: 'committed', committedSourceRevision: '41' });
  });

  it('rejects new admission after the durable drain closure transition', () => {
    let state = registerAll();
    state = apply(state, coordinator, { type: 'CAPTURE_BEFORE_DRAIN' });
    state = apply(state, coordinator, { type: 'REQUEST_DRAIN' });
    expect(state.authority).toMatchObject({
      state: 'DRAIN_REQUESTED',
      admissionOpen: false,
      drainRequestTransitionRevision: state.authority.transitionRevision,
    });
    const owner = state.registrations[0];
    expect(reduceWriterCoordination(state, action(
      state,
      { kind: 'writer', writerId: owner.writerId, sessionId: owner.sessionId },
      { type: 'ADMIT_OPERATION', operation: operation(owner, state) },
    ))).toEqual({ ok: false, code: 'ADMISSION_NOT_CLOSED' });
  });

  it('persists an unresolved admitted operation across deterministic restart', () => {
    let state = registerAll();
    const owner = state.registrations[0];
    state = apply(state, { kind: 'writer', writerId: owner.writerId, sessionId: owner.sessionId }, {
      type: 'ADMIT_OPERATION', operation: operation(owner, state),
    });
    const decoded = decodeWriterCoordinationModelCanonical(encodeWriterCoordinationModelCanonical(state));
    expect(decoded).toMatchObject({ ok: true, value: { authority: { unresolvedOperationCount: 1 } } });
    if (!decoded.ok) throw new Error(decoded.code);
    expect(decoded.value.operations[0].state).toBe('admitted');
  });

  it('blocks quiescence when a crash leaves an operation ambiguous', () => {
    let state = registerAll();
    const owner = state.registrations[0];
    state = apply(state, { kind: 'writer', writerId: owner.writerId, sessionId: owner.sessionId }, {
      type: 'ADMIT_OPERATION', operation: operation(owner, state),
    });
    state = apply(state, coordinator, { type: 'CAPTURE_BEFORE_DRAIN' });
    state = apply(state, coordinator, { type: 'REQUEST_DRAIN' });
    expect(state.authority.unresolvedOperationCount).toBe(1);
    expect(state.operations[0].state).toBe('admitted');
  });

  it('rejects a stale tab action after an epoch transition', () => {
    let state = registerAll();
    state = apply(state, coordinator, { type: 'CAPTURE_BEFORE_DRAIN' });
    state = apply(state, coordinator, { type: 'REQUEST_DRAIN' });
    const revision = state.authority.drainRequestTransitionRevision!;
    for (const record of state.registrations) {
      state = apply(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId }, {
        type: 'ACKNOWLEDGE_DRAIN', writerId: record.writerId, drainRequestTransitionRevision: revision,
      });
    }
    state = apply(state, coordinator, { type: 'CLOSE_ADMISSION' });
    state = apply(state, coordinator, { type: 'CAPTURE_AFTER_ADMISSION_CLOSED' });
    state = apply(state, coordinator, { type: 'BEGIN_DRAIN' });
    state = apply(state, coordinator, { type: 'MARK_QUIESCENT' });
    const owner = state.registrations[0];
    const stale = action(state, { kind: 'writer', writerId: owner.writerId, sessionId: owner.sessionId }, {
      type: 'ADMIT_OPERATION', operation: operation(owner, state),
    });
    stale.expectedCoordinationEpoch -= 1;
    expect(reduceWriterCoordination(state, stale)).toEqual({ ok: false, code: 'COORDINATION_EPOCH_STALE' });
  });

  it('policy snapshot: Web Locks unsupported fails closed', () => {
    expect(integrationPolicySnapshot({ webLocksAvailable: false, protocolVersion: 1, expectedProtocolVersion: 1,
      maintenanceOwner: null, writerSessionId: 'session-a', writerKind: 'interactive', syncPaused: false }))
      .toBe('WEB_LOCKS_UNAVAILABLE');
  });

  it('policy snapshot: mixed writer-coordination protocol versions are rejected', () => {
    expect(integrationPolicySnapshot({ webLocksAvailable: true, protocolVersion: 1, expectedProtocolVersion: 2,
      maintenanceOwner: null, writerSessionId: 'session-a', writerKind: 'interactive', syncPaused: false }))
      .toBe('UNSUPPORTED_PROTOCOL_VERSION');
  });

  it('policy snapshot: maintenance admission is exclusive', () => {
    expect(integrationPolicySnapshot({ webLocksAvailable: true, protocolVersion: 1, expectedProtocolVersion: 1,
      maintenanceOwner: 'maintenance-session', writerSessionId: 'interactive-session',
      writerKind: 'interactive', syncPaused: false })).toBe('MAINTENANCE_ADMISSION_EXCLUSIVE');
  });

  it('policy snapshot: sync apply pauses while the drain policy is active', () => {
    expect(integrationPolicySnapshot({ webLocksAvailable: true, protocolVersion: 1, expectedProtocolVersion: 1,
      maintenanceOwner: null, writerSessionId: 'sync-session', writerKind: 'sync', syncPaused: true }))
      .toBe('SYNC_APPLY_PAUSED');
  });

  it('round-trips restart evidence deterministically without time or browser state', () => {
    const state = registerAll();
    const first = encodeWriterCoordinationModelCanonical(state);
    const decoded = decodeWriterCoordinationModelCanonical(first);
    expect(decoded).toMatchObject({ ok: true });
    if (!decoded.ok) throw new Error(decoded.code);
    expect(encodeWriterCoordinationModelCanonical(decoded.value)).toEqual(first);
  });

  it('architecture fixture: exact source retry returns the existing receipt without another revision', () => {
    const initial: SourceAuthorityFixture = Object.freeze({ revision: '40', receipts: Object.freeze({}), outboxMutationIds: Object.freeze([]) });
    const input: SourceMutationFixture = Object.freeze({
      operationId: 'operation-a', writerSessionId: 'session-a', mutationDigest: 'digest-a', expectedSourceRevision: '40',
    });
    const first = commitSourceFixture(initial, input);
    expect(first).toMatchObject({ ok: true, reused: false, state: { revision: '41', outboxMutationIds: ['outbox:operation-a'] } });
    if (!first.ok) throw new Error(first.code);
    const retry = commitSourceFixture(first.state, input);
    expect(retry).toMatchObject({ ok: true, reused: true, state: { revision: '41', outboxMutationIds: ['outbox:operation-a'] } });
    if (!retry.ok) throw new Error(retry.code);
    expect(retry.receipt).toBe(first.receipt);
  });

  it('architecture fixture: conflicting source receipt reuse fails closed', () => {
    const initial: SourceAuthorityFixture = Object.freeze({ revision: '40', receipts: Object.freeze({}), outboxMutationIds: Object.freeze([]) });
    const first = commitSourceFixture(initial, {
      operationId: 'operation-a', writerSessionId: 'session-a', mutationDigest: 'digest-a', expectedSourceRevision: '40',
    });
    if (!first.ok) throw new Error(first.code);
    expect(commitSourceFixture(first.state, {
      operationId: 'operation-a', writerSessionId: 'session-a', mutationDigest: 'digest-b', expectedSourceRevision: '40',
    })).toEqual({ ok: false, code: 'OPERATION_IDENTITY_MISMATCH' });
  });

  it('architecture fixture: receipt reconciliation has no ambiguous success classification', () => {
    expect(classifyReceiptGraph({ admission: true, receipt: false, entityRevisionAdvanced: false,
      outbox: false, terminalCommitted: false })).toBe('ADMITTED_SOURCE_UNCOMMITTED');
    expect(classifyReceiptGraph({ admission: true, receipt: true, entityRevisionAdvanced: true,
      outbox: true, terminalCommitted: false })).toBe('RECONCILE_TERMINAL_FROM_RECEIPT');
    expect(classifyReceiptGraph({ admission: true, receipt: true, entityRevisionAdvanced: true,
      outbox: true, terminalCommitted: true })).toBe('COMMITTED');
    expect(classifyReceiptGraph({ admission: true, receipt: false, entityRevisionAdvanced: false,
      outbox: false, terminalCommitted: true })).toBe('CORRUPT_PERSISTED_GRAPH');
    expect(classifyReceiptGraph({ admission: false, receipt: true, entityRevisionAdvanced: true,
      outbox: true, terminalCommitted: false })).toBe('CORRUPT_PERSISTED_GRAPH');
    expect(classifyReceiptGraph({ admission: true, receipt: true, entityRevisionAdvanced: true,
      outbox: false, terminalCommitted: false })).toBe('CORRUPT_PERSISTED_GRAPH');
    expect(classifyReceiptGraph({ admission: true, receipt: false, entityRevisionAdvanced: true,
      outbox: false, terminalCommitted: false })).toBe('CORRUPT_PERSISTED_GRAPH');
  });

  it('behavioral model evidence: checkpoint 5 and source evidence commit in one reducer transition', () => {
    let state = registerAll();
    state = apply(state, coordinator, { type: 'CAPTURE_BEFORE_DRAIN' });
    state = apply(state, coordinator, { type: 'REQUEST_DRAIN' });
    const drainRevision = state.authority.drainRequestTransitionRevision!;
    for (const record of state.registrations) {
      state = apply(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId }, {
        type: 'ACKNOWLEDGE_DRAIN', writerId: record.writerId, drainRequestTransitionRevision: drainRevision,
      });
    }
    state = apply(state, coordinator, { type: 'CLOSE_ADMISSION' });
    state = apply(state, coordinator, { type: 'CAPTURE_AFTER_ADMISSION_CLOSED' });
    state = apply(state, coordinator, { type: 'BEGIN_DRAIN' });
    state = apply(state, coordinator, { type: 'MARK_QUIESCENT' });
    state = apply(state, coordinator, { type: 'CAPTURE_AFTER_OPERATIONS_TERMINAL' });
    state = apply(state, verifier, { type: 'CAPTURE_BEFORE_SOURCE_VERIFICATION' });
    state = apply(state, verifier, { type: 'BEGIN_SOURCE_VERIFICATION' });
    expect(state).toMatchObject({ sourceEvidence: null, checkpointChain: expect.any(Array) });
    expect(state.checkpointChain).toHaveLength(4);
    state = apply(state, verifier, { type: 'CAPTURE_SOURCE_EVIDENCE', observation: sourceObservation() });
    expect(state.sourceEvidence).not.toBeNull();
    expect(state.checkpointChain).toHaveLength(5);
    expect(state.checkpointChain[4].sourceEvidenceDigest).toBe(state.sourceEvidence!.evidenceDigest);
  });

  it('policy snapshot: first write atomically registers and admits without a durable idle boundary', () => {
    expect(FIRST_WRITE_PROTOCOL_POLICY).toEqual({
      compatibilityDescriptor: 'transient',
      transition: 'ATOMIC_REGISTER_AND_ADMIT',
      durableRegisteredIdleBoundary: false,
    });
  });

  it('policy snapshot: existing, new persisted, and transient protocol fields do not overlap', () => {
    const sets = Object.values(K331A_FIELD_CLASSIFICATION).map(values => new Set(values));
    for (let left = 0; left < sets.length; left += 1) {
      for (let right = left + 1; right < sets.length; right += 1) {
        expect([...sets[left]].filter(value => sets[right].has(value))).toEqual([]);
      }
    }
  });

  it('source topology snapshot: IDB clear is reachable while the delete facade is dormant', () => {
    expect(PHYSICAL_SINK_REACHABILITY).toEqual({
      clearIndexedDbNotes: 'PRODUCTION_REACHABLE_VIA_RESET',
      deleteNoteFromIndexedDb: 'DORMANT_VIA_UNREFERENCED_FACADE',
    });
  });

  it('architecture fixture: repository reconciliation accepts lookup identity but no caller receipt truth', () => {
    const input: ReconcileCommittedSourceReceiptInput = Object.freeze({
      namespaceFingerprint: 'namespace-digest', generationId: 'generation-a', operationId: 'operation-a',
    });
    expect(Object.keys(input).sort()).toEqual(['generationId', 'namespaceFingerprint', 'operationId']);
    expect(reconcileCommittedSourceReceiptFixture(receiptBackedOperation(), input, 7))
      .toMatchObject({ ok: true, reused: false, operation: { terminal: 'committed', terminalReceiptDigest: 'receipt-digest' } });
  });

  it('architecture fixture: exact receipt reconciliation retry is idempotent', () => {
    const persisted = receiptBackedOperation({ terminal: 'committed', terminalReceiptDigest: 'receipt-digest' });
    const result = reconcileCommittedSourceReceiptFixture(persisted, {
      namespaceFingerprint: persisted.namespaceFingerprint,
      generationId: persisted.generationId,
      operationId: persisted.operationId,
    }, 7);
    expect(result).toEqual({ ok: true, operation: persisted, reused: true });
  });

  it('architecture fixture: committed receipt conflicts with failure or abort terminal state', () => {
    for (const terminal of ['failed', 'aborted'] as const) {
      const persisted = receiptBackedOperation({ terminal });
      expect(reconcileCommittedSourceReceiptFixture(persisted, {
        namespaceFingerprint: persisted.namespaceFingerprint,
        generationId: persisted.generationId,
        operationId: persisted.operationId,
      }, 7)).toEqual({ ok: false, code: 'RECONCILIATION_TERMINAL_CONFLICT' });
    }
  });

  it('architecture fixture: missing receipt cannot be projected as source success', () => {
    const persisted = receiptBackedOperation({ receiptDigest: null, previousSourceRevision: null,
      committedSourceRevision: null });
    expect(reconcileCommittedSourceReceiptFixture(persisted, {
      namespaceFingerprint: persisted.namespaceFingerprint,
      generationId: persisted.generationId,
      operationId: persisted.operationId,
    }, 7)).toEqual({ ok: false, code: 'RECONCILIATION_RECEIPT_NOT_FOUND' });
  });

  it('architecture fixture: unknown operation and stale epoch fail reconciliation closed', () => {
    const persisted = receiptBackedOperation();
    expect(reconcileCommittedSourceReceiptFixture(persisted, {
      namespaceFingerprint: persisted.namespaceFingerprint,
      generationId: persisted.generationId,
      operationId: 'operation-unknown',
    }, 7)).toEqual({ ok: false, code: 'RECONCILIATION_OPERATION_NOT_ADMITTED' });
    expect(reconcileCommittedSourceReceiptFixture(persisted, {
      namespaceFingerprint: persisted.namespaceFingerprint,
      generationId: persisted.generationId,
      operationId: persisted.operationId,
    }, 8)).toEqual({ ok: false, code: 'RECONCILIATION_STALE_EPOCH' });
  });

  it('architecture fixture: reconciliation rereads source revision plus entity and outbox evidence', () => {
    const advancedAuthority = receiptBackedOperation({ sourceAuthorityRevision: '42' });
    expect(reconcileCommittedSourceReceiptFixture(advancedAuthority, {
      namespaceFingerprint: advancedAuthority.namespaceFingerprint,
      generationId: advancedAuthority.generationId,
      operationId: advancedAuthority.operationId,
    }, 7)).toMatchObject({ ok: true });
    for (const overrides of [
      { sourceAuthorityRevision: '40' },
      { entitySetDigestMatches: false },
      { outboxSetDigestMatches: false },
    ] satisfies Array<Partial<ReceiptBackedOperationFixture>>) {
      const persisted = receiptBackedOperation(overrides);
      const result = reconcileCommittedSourceReceiptFixture(persisted, {
        namespaceFingerprint: persisted.namespaceFingerprint,
        generationId: persisted.generationId,
        operationId: persisted.operationId,
      }, 7);
      expect(result).toMatchObject({ ok: false });
    }
  });

  it('architecture fixture: drain closes new admissions but preserves exact pre-drain work', () => {
    expect(evaluateDrainAwareAdmission({ admittedBeforeDrain: true, drainState: 'open', admissionEpoch: 7,
      currentEpoch: 7, terminal: false, receiptExists: false })).toBe('SOURCE_COMMIT_ALLOWED');
    expect(evaluateDrainAwareAdmission({ admittedBeforeDrain: true, drainState: 'requested', admissionEpoch: 7,
      currentEpoch: 7, terminal: false, receiptExists: false })).toBe('SOURCE_COMMIT_ALLOWED');
    expect(evaluateDrainAwareAdmission({ admittedBeforeDrain: true, drainState: 'closed', admissionEpoch: 7,
      currentEpoch: 7, terminal: false, receiptExists: true })).toBe('RECONCILE_ONLY');
    expect(evaluateDrainAwareAdmission({ admittedBeforeDrain: false, drainState: 'requested', admissionEpoch: 7,
      currentEpoch: 7, terminal: false, receiptExists: false })).toBe('NEW_ADMISSION_CLOSED');
  });

  it('architecture fixture: only an epoch transition fences a previous admitted operation', () => {
    expect(evaluateDrainAwareAdmission({ admittedBeforeDrain: true, drainState: 'requested', admissionEpoch: 7,
      currentEpoch: 8, terminal: false, receiptExists: false })).toBe('STALE_EPOCH');
  });

  it('architecture fixture: source authority bootstrap binds revision zero to the verified snapshot', () => {
    const result = bootstrapSourceAuthorityFixture(null, {
      namespaceFingerprint: 'namespace-digest', generationId: 'generation-a',
      aggregateEntityDigest: 'entity-digest', generationManifestDigest: 'manifest-digest',
      outboxBaselineDigest: 'outbox-digest', bootstrapEvidenceDigest: 'bootstrap-digest',
    });
    expect(result).toMatchObject({ ok: true, reused: false, authority: {
      revision: '0', aggregateEntityDigest: 'entity-digest', generationManifestDigest: 'manifest-digest',
    } });
  });

  it('architecture fixture: exact bootstrap retry is idempotent and creates no mutation receipt', () => {
    const candidate = Object.freeze({
      namespaceFingerprint: 'namespace-digest', generationId: 'generation-a',
      aggregateEntityDigest: 'entity-digest', generationManifestDigest: 'manifest-digest',
      outboxBaselineDigest: 'outbox-digest', bootstrapEvidenceDigest: 'bootstrap-digest',
    });
    const first = bootstrapSourceAuthorityFixture(null, candidate);
    if (!first.ok) throw new Error(first.code);
    const retry = bootstrapSourceAuthorityFixture(first.authority, candidate);
    expect(retry).toEqual({ ok: true, authority: first.authority, reused: true });
    expect(Object.keys(first.authority)).not.toContain('operationId');
    expect(Object.keys(first.authority)).not.toContain('receiptDigest');
  });

  it('architecture fixture: conflicting bootstrap evidence fails closed', () => {
    const first = bootstrapSourceAuthorityFixture(null, {
      namespaceFingerprint: 'namespace-digest', generationId: 'generation-a',
      aggregateEntityDigest: 'entity-digest', generationManifestDigest: 'manifest-digest',
      outboxBaselineDigest: 'outbox-digest', bootstrapEvidenceDigest: 'bootstrap-digest',
    });
    if (!first.ok) throw new Error(first.code);
    expect(bootstrapSourceAuthorityFixture(first.authority, {
      namespaceFingerprint: 'namespace-digest', generationId: 'generation-a',
      aggregateEntityDigest: 'changed-entity-digest', generationManifestDigest: 'manifest-digest',
      outboxBaselineDigest: 'outbox-digest', bootstrapEvidenceDigest: 'changed-bootstrap-digest',
    })).toEqual({ ok: false, code: 'SOURCE_AUTHORITY_BOOTSTRAP_CONFLICT' });
  });

  it('policy snapshot: protocol evolution precedes the dormant source repository', () => {
    expect(K331B_FUTURE_TASK_ORDER.indexOf('K-333_PROTOCOL_AND_REPOSITORY_MODEL_EXTENSION'))
      .toBeLessThan(K331B_FUTURE_TASK_ORDER.indexOf('K-334_DORMANT_SOURCE_TRANSACTION_REPOSITORY'));
  });

  it('policy snapshot: the central mutation manifest audits admission but never routes mutations', () => {
    expect(CENTRAL_MUTATION_MANIFEST_POLICY).toEqual({
      role: 'AUDIT_AND_ADMISSION_INVENTORY',
      routesMutations: false,
      invokesFunctions: false,
      overridesCoordinationAuthority: false,
      wrapperReferenceCardinality: 'EXACTLY_ONE_ENTRY',
    });
  });
});
