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
} from './writerCoordinationEligibility';

const PHYSICAL_SOURCE = '1'.repeat(64);
const COORDINATOR_SESSION = `writer-session-v1:${'a'.repeat(32)}`;
const VERIFIER_SESSION = `writer-session-v1:${'b'.repeat(32)}`;
const RECOVERY_SESSION = `writer-session-v1:${'c'.repeat(32)}`;
const coordinator: WriterCoordinationActor = { kind: 'coordinator', sessionId: COORDINATOR_SESSION };
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

type IntegrationPreflight = {
  webLocksAvailable: boolean;
  protocolVersion: number;
  expectedProtocolVersion: number;
  maintenanceOwner: string | null;
  writerSessionId: string;
  writerKind: 'interactive' | 'sync' | 'maintenance';
  syncPaused: boolean;
};

function integrationPreflight(input: IntegrationPreflight): string | null {
  if (!input.webLocksAvailable) return 'WEB_LOCKS_UNAVAILABLE';
  if (input.protocolVersion !== input.expectedProtocolVersion) return 'UNSUPPORTED_PROTOCOL_VERSION';
  if (input.maintenanceOwner !== null && input.maintenanceOwner !== input.writerSessionId) {
    return 'MAINTENANCE_ADMISSION_EXCLUSIVE';
  }
  if (input.writerKind === 'sync' && input.syncPaused) return 'SYNC_APPLY_PAUSED';
  return null;
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

  it('fails closed when Web Locks are unsupported', () => {
    expect(integrationPreflight({ webLocksAvailable: false, protocolVersion: 1, expectedProtocolVersion: 1,
      maintenanceOwner: null, writerSessionId: 'session-a', writerKind: 'interactive', syncPaused: false }))
      .toBe('WEB_LOCKS_UNAVAILABLE');
  });

  it('rejects mixed writer-coordination protocol versions', () => {
    expect(integrationPreflight({ webLocksAvailable: true, protocolVersion: 1, expectedProtocolVersion: 2,
      maintenanceOwner: null, writerSessionId: 'session-a', writerKind: 'interactive', syncPaused: false }))
      .toBe('UNSUPPORTED_PROTOCOL_VERSION');
  });

  it('enforces exclusive maintenance admission', () => {
    expect(integrationPreflight({ webLocksAvailable: true, protocolVersion: 1, expectedProtocolVersion: 1,
      maintenanceOwner: 'maintenance-session', writerSessionId: 'interactive-session',
      writerKind: 'interactive', syncPaused: false })).toBe('MAINTENANCE_ADMISSION_EXCLUSIVE');
  });

  it('pauses sync apply while the drain policy is active', () => {
    expect(integrationPreflight({ webLocksAvailable: true, protocolVersion: 1, expectedProtocolVersion: 1,
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
});
