import { describe, expect, it } from 'vitest';
import { buildCanonicalProtocolPreimage } from './canonicalProtocolPreimage';
import { encodeCanonicalProtocolValue } from './canonicalProtocolValue';
import type { ProtocolResult } from './protocolResult';
import {
  TRANSACTION_EVIDENCE_COMPATIBILITY,
  createAdmissionRecord,
  createImmutableOutboxIntentRecord,
  createOperationRecord,
  createTerminalStateRecord,
  decodeAdmissionRecord,
  decodeImmutableOutboxIntentRecord,
  decodeOperationRecord,
  decodeTerminalStateRecord,
  decodeTransactionEvidenceRecord,
  decodeTransactionEvidenceRecordBytes,
  encodeTransactionEvidenceRecord,
  validateProductionTransactionEvidenceGraph,
  validateTransactionEvidenceCompatibility,
  type AdmissionRecord,
  type ImmutableOutboxIntentRecord,
  type OperationRecord,
  type TerminalStateRecord,
  type TransactionEvidenceRecord,
} from './transactionEvidenceProtocol';
import {
  createSourceAuthorityRecord,
  createSourceTransactionReferenceRecord,
  createWriterIdentityRecord,
  createWriterSessionRecord,
} from './writerAuthorityProtocol';

const digest = (character: string): string => character.repeat(64);
const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

function must<T>(result: ProtocolResult<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

function errorCode(result: ProtocolResult<unknown>): string | undefined {
  return result.ok ? undefined : result.error.code;
}

function fixtures() {
  const writer = must(createWriterIdentityRecord({
    id: 'writer-v2.window.interactive.0001', namespaceId: 'namespace-1', physicalSourceDigest: digest('1'),
    writerTypeId: 'legacy.notes.store_actions', manifestDigest: digest('2'),
  }));
  const session = must(createWriterSessionRecord({
    id: 'session-1', namespaceId: writer.namespaceId, generationId: 'generation-1',
    physicalSourceDigest: writer.physicalSourceDigest, writerId: writer.id, writerDigest: writer.writerDigest,
    epoch: 7, capabilityDigest: digest('3'),
  }));
  const admission = must(createAdmissionRecord({
    id: 'admission-1', operationId: 'operation-1', writerId: writer.id, sessionId: session.id, decision: 'admitted',
  }));
  const operation = must(createOperationRecord({
    id: admission.operationId, namespace: writer.namespaceId, generation: session.generationId,
    admissionId: admission.id, admissionDigest: admission.admissionDigest,
    writerId: writer.id, writerDigest: writer.writerDigest, sessionId: session.id, sessionDigest: session.sessionDigest,
    mutationKind: 'note_upsert', committedRevision: '42', affectedIdentityDigest: digest('4'),
    canonicalInputDigest: digest('5'), resultDigest: digest('6'), outboxId: 'outbox-1', outboxIntentDigest: digest('7'),
  }));
  const outbox = must(createImmutableOutboxIntentRecord({
    id: operation.outboxId, operationId: operation.id, intentDigest: operation.outboxIntentDigest,
  }));
  const terminal = must(createTerminalStateRecord({
    id: 'terminal-1', operationId: operation.id, state: 'committed', resultDigest: operation.resultDigest,
  }));
  const authority = must(createSourceAuthorityRecord({
    id: 'authority-1', namespaceId: writer.namespaceId, generationId: session.generationId,
    physicalSourceDigest: writer.physicalSourceDigest, sourceRevision: operation.committedRevision,
    operationRegistryRoot: digest('8'), terminalRoot: digest('9'), outboxRoot: digest('a'),
    mmrStateId: 'mmr-1', mmrStateDigest: digest('b'), lifecycleHeadId: null, lifecycleHeadDigest: null,
  }));
  const reference = must(createSourceTransactionReferenceRecord({
    id: 'reference-1', namespaceId: writer.namespaceId, generationId: session.generationId,
    physicalSourceDigest: writer.physicalSourceDigest, committedSourceRevision: operation.committedRevision,
    sourceAuthorityId: authority.id, sourceAuthorityDigest: authority.authorityDigest,
    operationId: operation.id, operationDigest: operation.operationDigest,
    admissionId: admission.id, admissionDigest: admission.admissionDigest,
    writerId: writer.id, writerDigest: writer.writerDigest, sessionId: session.id, sessionDigest: session.sessionDigest,
    terminalId: terminal.id, terminalDigest: terminal.terminalDigest,
    outboxId: outbox.id, outboxDigest: outbox.outboxDigest,
    mmrStateId: authority.mmrStateId, mmrStateDigest: authority.mmrStateDigest,
    checkpointId: 'checkpoint-1', checkpointDigest: digest('c'), graphVersion: 1,
  }));
  return { writer, session, admission, operation, outbox, terminal, authority, reference };
}

function inputs(record: TransactionEvidenceRecord): Record<string, unknown> {
  const self = record.kind === 'absinthe_k330_operation' ? 'operationDigest'
    : record.kind === 'absinthe_k330_admission' ? 'admissionDigest'
      : record.kind === 'absinthe_immutable_outbox_intent' ? 'outboxDigest' : 'terminalDigest';
  return Object.fromEntries(Object.entries(record)
    .filter(([field]) => field !== 'kind' && field !== 'version' && field !== self));
}

const creators = {
  absinthe_k330_operation: createOperationRecord,
  absinthe_k330_admission: createAdmissionRecord,
  absinthe_immutable_outbox_intent: createImmutableOutboxIntentRecord,
  absinthe_terminal_state: createTerminalStateRecord,
} as const;

describe('K-333B transaction evidence record codecs', () => {
  it('creates, strictly decodes, freezes, and canonically round trips each selected record', () => {
    const graph = fixtures();
    const records: readonly TransactionEvidenceRecord[] = [graph.operation, graph.admission, graph.outbox, graph.terminal];
    for (const record of records) {
      const decoded = decodeTransactionEvidenceRecord(record);
      expect(decoded.ok).toBe(true);
      if (!decoded.ok) continue;
      expect(Object.isFrozen(decoded.value)).toBe(true);
      const bytes = must(encodeTransactionEvidenceRecord(record));
      expect(must(decodeTransactionEvidenceRecordBytes(bytes))).toEqual(record);
      expect(must(encodeCanonicalProtocolValue(record))).toEqual(bytes);
    }
  });

  it('rejects kind, version, missing, unknown, primitive, array, and self-digest corruption exactly', () => {
    const { operation, admission, outbox, terminal } = fixtures();
    const cases = [
      [decodeOperationRecord, operation, 'operationDigest'],
      [decodeAdmissionRecord, admission, 'admissionDigest'],
      [decodeImmutableOutboxIntentRecord, outbox, 'outboxDigest'],
      [decodeTerminalStateRecord, terminal, 'terminalDigest'],
    ] as const;
    for (const [decode, record, self] of cases) {
      expect(errorCode(decode({ ...record, kind: 'wrong' }))).toBe('RECORD_KIND_MISMATCH');
      expect(errorCode(decode({ ...record, version: 2 }))).toBe('UNSUPPORTED_RECORD_VERSION');
      const missing = { ...record } as Record<string, unknown>;
      delete missing.id;
      expect(errorCode(decode(missing))).toBe('MISSING_FIELD');
      expect(errorCode(decode({ ...record, extra: true }))).toBe('UNKNOWN_FIELD');
      expect(errorCode(decode({ ...record, [self]: digest('f') }))).toBe('CANONICAL_DIGEST_MISMATCH');
      for (const hostile of [null, 1, 'record', [], true]) {
        expect(errorCode(decode(hostile))).toBe('INVALID_FIELD_TYPE');
      }
    }
  });

  it('rejects malformed field classes and closed semantic values', () => {
    const { operation, admission, outbox, terminal } = fixtures();
    expect(errorCode(decodeOperationRecord({ ...operation, id: 'Invalid' }))).toBe('INVALID_IDENTIFIER');
    expect(errorCode(decodeOperationRecord({ ...operation, writerDigest: 'bad' }))).toBe('INVALID_DIGEST');
    expect(errorCode(decodeOperationRecord({ ...operation, committedRevision: '042' }))).toBe('INVALID_INTEGER');
    expect(errorCode(decodeOperationRecord({ ...operation, mutationKind: 'note_delete' }))).toBe('INVALID_ENUM_VALUE');
    expect(errorCode(decodeAdmissionRecord({ ...admission, decision: 'rejected' }))).toBe('INVALID_ENUM_VALUE');
    expect(errorCode(decodeTerminalStateRecord({ ...terminal, state: 'pending' }))).toBe('INVALID_ENUM_VALUE');
    expect(errorCode(decodeImmutableOutboxIntentRecord({ ...outbox, intentDigest: 'bad' }))).toBe('INVALID_DIGEST');
  });

  it('keeps every creator and decoder total over active, throwing, and revoked proxies', () => {
    const active = new Proxy(Object.create(null) as object, { ownKeys: () => { throw new Error('trap'); } });
    const throwing = new Proxy(Object.create(null) as object, { getPrototypeOf: () => { throw new Error('trap'); } });
    const pair = Proxy.revocable(Object.create(null) as object, {});
    pair.revoke();
    for (const hostile of [active, throwing, pair.proxy]) {
      expect(() => createOperationRecord(hostile)).not.toThrow();
      expect(() => createAdmissionRecord(hostile)).not.toThrow();
      expect(() => createImmutableOutboxIntentRecord(hostile)).not.toThrow();
      expect(() => createTerminalStateRecord(hostile)).not.toThrow();
      expect(() => decodeTransactionEvidenceRecord(hostile)).not.toThrow();
      expect(errorCode(decodeTransactionEvidenceRecord(hostile))).toBe('INVALID_FIELD_TYPE');
      expect(() => validateTransactionEvidenceCompatibility(hostile)).not.toThrow();
      expect(() => validateProductionTransactionEvidenceGraph(hostile)).not.toThrow();
    }
  });

  it('rejects oversized and noncanonical byte envelopes before record dispatch', () => {
    expect(errorCode(decodeTransactionEvidenceRecordBytes(new Uint8Array(32 * 1024 + 1)))).toBe('INPUT_TOO_LARGE');
    const noncanonical = new TextEncoder().encode('{"version":1,"kind":"absinthe_terminal_state"}');
    expect(errorCode(decodeTransactionEvidenceRecordBytes(noncanonical))).toBe('NON_CANONICAL_VALUE');
  });

  it('commits every mutable non-self field and rejects an old digest on each valid mutation', () => {
    const graph = fixtures();
    const cases = [
      { record: graph.operation, self: 'operationDigest', changes: {
        id: 'operation-2', namespace: 'namespace-2', generation: 'generation-2', admissionId: 'admission-2',
        admissionDigest: digest('d'), writerId: 'writer-other', writerDigest: digest('d'), sessionId: 'session-2',
        sessionDigest: digest('d'), mutationKind: 'note_tombstone', committedRevision: '43',
        affectedIdentityDigest: digest('d'), canonicalInputDigest: digest('d'), resultDigest: digest('d'),
        outboxId: 'outbox-2', outboxIntentDigest: digest('d'),
      } },
      { record: graph.admission, self: 'admissionDigest', changes: {
        id: 'admission-2', operationId: 'operation-2', writerId: 'writer-other', sessionId: 'session-2',
      } },
      { record: graph.outbox, self: 'outboxDigest', changes: {
        id: 'outbox-2', operationId: 'operation-2', intentDigest: digest('d'),
      } },
      { record: graph.terminal, self: 'terminalDigest', changes: {
        id: 'terminal-2', operationId: 'operation-2', resultDigest: digest('d'),
      } },
    ] as const;
    for (const entry of cases) {
      const originalDigest = entry.record[entry.self];
      for (const [field, value] of Object.entries(entry.changes)) {
        const created = creators[entry.record.kind]({ ...inputs(entry.record), [field]: value });
        expect(created.ok, `${entry.record.kind}.${field}`).toBe(true);
        if (!created.ok) continue;
        const newDigest = created.value[entry.self as keyof typeof created.value];
        expect(newDigest).not.toBe(originalDigest);
        expect(decodeTransactionEvidenceRecord(created.value).ok).toBe(true);
        expect(errorCode(decodeTransactionEvidenceRecord({ ...created.value, [entry.self]: originalDigest })))
          .toBe('CANONICAL_DIGEST_MISMATCH');
      }
    }
  });
});

describe('K-333B transaction evidence graph and compatibility', () => {
  it('accepts one exact independently decoded transaction evidence graph', () => {
    expect(validateProductionTransactionEvidenceGraph(fixtures()).ok).toBe(true);
  });

  it('rejects every selected edge after independently valid resealing', () => {
    const graph = fixtures();
    const wrongAdmission = must(createAdmissionRecord({ ...inputs(graph.admission), operationId: 'operation-other' }));
    const wrongOperation = must(createOperationRecord({ ...inputs(graph.operation), namespace: 'namespace-other' }));
    const wrongOutbox = must(createImmutableOutboxIntentRecord({ ...inputs(graph.outbox), operationId: 'operation-other' }));
    const wrongTerminal = must(createTerminalStateRecord({ ...inputs(graph.terminal), resultDigest: digest('d') }));
    for (const invalid of [
      { ...graph, operation: wrongOperation },
      { ...graph, admission: wrongAdmission },
      { ...graph, outbox: wrongOutbox },
      { ...graph, terminal: wrongTerminal },
    ]) {
      expect(errorCode(validateProductionTransactionEvidenceGraph(invalid))).toBe('RELATIONSHIP_MISMATCH');
    }
  });

  it('rejects independently valid namespace, generation, writer, session, and authority-revision replay', () => {
    const graph = fixtures();
    const operationReplays = [
      must(createOperationRecord({ ...inputs(graph.operation), namespace: 'namespace-other' })),
      must(createOperationRecord({ ...inputs(graph.operation), generation: 'generation-other' })),
      must(createOperationRecord({ ...inputs(graph.operation), writerId: 'writer-other' })),
      must(createOperationRecord({ ...inputs(graph.operation), writerDigest: digest('d') })),
      must(createOperationRecord({ ...inputs(graph.operation), sessionId: 'session-other' })),
      must(createOperationRecord({ ...inputs(graph.operation), sessionDigest: digest('d') })),
    ];
    for (const operation of operationReplays) {
      expect(decodeOperationRecord(operation).ok).toBe(true);
      expect(errorCode(validateProductionTransactionEvidenceGraph({ ...graph, operation })))
        .toBe('RELATIONSHIP_MISMATCH');
    }
    const authority = must(createSourceAuthorityRecord({
      id: graph.authority.id, namespaceId: graph.authority.namespaceId, generationId: graph.authority.generationId,
      physicalSourceDigest: graph.authority.physicalSourceDigest, sourceRevision: '43',
      operationRegistryRoot: graph.authority.operationRegistryRoot, terminalRoot: graph.authority.terminalRoot,
      outboxRoot: graph.authority.outboxRoot, mmrStateId: graph.authority.mmrStateId,
      mmrStateDigest: graph.authority.mmrStateDigest, lifecycleHeadId: graph.authority.lifecycleHeadId,
      lifecycleHeadDigest: graph.authority.lifecycleHeadDigest,
    }));
    const reference = must(createSourceTransactionReferenceRecord({
      id: graph.reference.id, namespaceId: graph.reference.namespaceId, generationId: graph.reference.generationId,
      physicalSourceDigest: graph.reference.physicalSourceDigest, committedSourceRevision: '43',
      sourceAuthorityId: authority.id, sourceAuthorityDigest: authority.authorityDigest,
      operationId: graph.reference.operationId, operationDigest: graph.reference.operationDigest,
      admissionId: graph.reference.admissionId, admissionDigest: graph.reference.admissionDigest,
      writerId: graph.reference.writerId, writerDigest: graph.reference.writerDigest,
      sessionId: graph.reference.sessionId, sessionDigest: graph.reference.sessionDigest,
      terminalId: graph.reference.terminalId, terminalDigest: graph.reference.terminalDigest,
      outboxId: graph.reference.outboxId, outboxDigest: graph.reference.outboxDigest,
      mmrStateId: authority.mmrStateId, mmrStateDigest: authority.mmrStateDigest,
      checkpointId: graph.reference.checkpointId, checkpointDigest: graph.reference.checkpointDigest, graphVersion: 1,
    }));
    expect(errorCode(validateProductionTransactionEvidenceGraph({ ...graph, authority, reference })))
      .toBe('RELATIONSHIP_MISMATCH');
  });

  it('rejects valid operation, admission, outbox, and terminal records mixed from another transaction', () => {
    const graph = fixtures();
    const otherOperation = must(createOperationRecord({ ...inputs(graph.operation), id: 'operation-2' }));
    const otherAdmission = must(createAdmissionRecord({ ...inputs(graph.admission), id: 'admission-2' }));
    const otherOutbox = must(createImmutableOutboxIntentRecord({ ...inputs(graph.outbox), id: 'outbox-2' }));
    const otherTerminal = must(createTerminalStateRecord({ ...inputs(graph.terminal), id: 'terminal-2' }));
    for (const invalid of [
      { ...graph, operation: otherOperation }, { ...graph, admission: otherAdmission },
      { ...graph, outbox: otherOutbox }, { ...graph, terminal: otherTerminal },
    ]) expect(errorCode(validateProductionTransactionEvidenceGraph(invalid))).toBe('RELATIONSHIP_MISMATCH');
  });

  it('uses a closed immutable compatibility table and rejects unsupported tuples before graph access', () => {
    expect(Object.isFrozen(TRANSACTION_EVIDENCE_COMPATIBILITY)).toBe(true);
    for (const [predecessorKind, predecessorVersion, successorKind, successorVersion] of TRANSACTION_EVIDENCE_COMPATIBILITY) {
      expect(validateTransactionEvidenceCompatibility({
        predecessorKind, predecessorVersion, successorKind, successorVersion,
      }).ok).toBe(true);
    }
    expect(errorCode(validateTransactionEvidenceCompatibility({
      predecessorKind: 'absinthe_k330_operation', predecessorVersion: 2,
      successorKind: 'absinthe_k330_admission', successorVersion: 1,
    }))).toBe('UNSUPPORTED_RECORD_VERSION');
    expect(errorCode(validateTransactionEvidenceCompatibility({
      predecessorKind: 'absinthe_k330_admission', predecessorVersion: 1,
      successorKind: 'absinthe_k330_operation', successorVersion: 1,
    }))).toBe('RELATIONSHIP_MISMATCH');
  });
});

describe('K-333B fixed stable vectors', () => {
  it('keeps independent canonical payload, preimage, and digest literals for every new record', () => {
    const { operation, admission, outbox, terminal } = fixtures();
    const vectors = [
      [operation, 'operationDigest', 'absinthe.operation.v1',
        '{"admissionDigest":"7357e9f46b8137e5d600d69eecfdcf49d13965f596c93b62c99d0c97b8170f1d","admissionId":"admission-1","affectedIdentityDigest":"4444444444444444444444444444444444444444444444444444444444444444","canonicalInputDigest":"5555555555555555555555555555555555555555555555555555555555555555","committedRevision":"42","generation":"generation-1","id":"operation-1","kind":"absinthe_k330_operation","mutationKind":"note_upsert","namespace":"namespace-1","outboxId":"outbox-1","outboxIntentDigest":"7777777777777777777777777777777777777777777777777777777777777777","resultDigest":"6666666666666666666666666666666666666666666666666666666666666666","sessionDigest":"7b117eb86dcf836f23df4154ae7e9089d99363bfc66d276eed41a60c75f026c3","sessionId":"session-1","version":1,"writerDigest":"d213325403db4caf9c6b2ba44329b204fab0294307dc4823fa879dfcd9e867af","writerId":"writer-v2.window.interactive.0001"}',
        'a861daeaafe2ee6585aada8cfd37749c8ba130c8547e3115500545a5fbc42cc9'],
      [admission, 'admissionDigest', 'absinthe.admission.v1',
        '{"decision":"admitted","id":"admission-1","kind":"absinthe_k330_admission","operationId":"operation-1","sessionId":"session-1","version":1,"writerId":"writer-v2.window.interactive.0001"}',
        '7357e9f46b8137e5d600d69eecfdcf49d13965f596c93b62c99d0c97b8170f1d'],
      [outbox, 'outboxDigest', 'absinthe.immutable_outbox_intent.v1',
        '{"id":"outbox-1","intentDigest":"7777777777777777777777777777777777777777777777777777777777777777","kind":"absinthe_immutable_outbox_intent","operationId":"operation-1","version":1}',
        '967597287bd3e1870e38603b59ce042343820f6c342ce80f810321a2c8b8a6dd'],
      [terminal, 'terminalDigest', 'absinthe.terminal_state.v1',
        '{"id":"terminal-1","kind":"absinthe_terminal_state","operationId":"operation-1","resultDigest":"6666666666666666666666666666666666666666666666666666666666666666","state":"committed","version":1}',
        'cf3dd187a009f4e82a6045cde2c7a944abff4c1e6bf1d4b215902c4b259f3738'],
    ] as const;
    for (const [record, self, domain, expectedPayload, expectedDigest] of vectors) {
      const payload = { ...record } as Record<string, unknown>;
      delete payload[self];
      const payloadText = text(must(encodeCanonicalProtocolValue(payload)));
      const preimageText = text(must(buildCanonicalProtocolPreimage(domain, 1, payload)));
      expect(payloadText).toBe(expectedPayload);
      expect(preimageText).toBe(`absinthe-protocol-preimage-v1\nD:${new TextEncoder().encode(domain).byteLength}:${domain}\nV:1\nP:${new TextEncoder().encode(expectedPayload).byteLength}:${expectedPayload}`);
      expect(record[self]).toBe(expectedDigest);
    }
  });
});
