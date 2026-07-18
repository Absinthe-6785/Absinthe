import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { K332_RESPONSIBILITY_MATRIX } from '../crossModuleSourceAuthorityK332.testSupport';
import { K331G_LIMITS } from '../productionWriterAdmissionK331G.testSupport';
import { PROTOCOL_CANONICAL_LIMITS } from './canonicalProtocolValue';
import { buildCanonicalProtocolPreimage } from './canonicalProtocolPreimage';
import {
  PRODUCTION_PROTOCOL_ERROR_CODES,
  PROTOCOL_ERROR_LABEL_LIMITS,
  protocolFail,
} from './protocolResult';
import {
  decodeBoundedArray,
  decodeBoundedString,
  decodeCanonicalRevision,
  decodeDigest,
  decodeEnum,
  decodeExactObject,
  decodeIdentifier,
  decodeLiteral,
  decodePositiveSafeInteger,
} from './strictProtocolDecode';
import {
  createSourceAuthorityRecord,
  createSourceTransactionReferenceRecord,
  createWriterIdentityRecord,
  createWriterSessionRecord,
  decodeRepresentativeProtocolRecord,
  decodeRepresentativeProtocolRecordBytes,
  decodeSourceAuthorityRecord,
  decodeSourceTransactionReferenceRecord,
  decodeWriterIdentityRecord,
  decodeWriterSessionRecord,
  encodeRepresentativeProtocolRecord,
  validateRepresentativeAuthorityGraph,
  type RepresentativeProtocolRecord,
  type SourceAuthorityRecord,
  type SourceTransactionReferenceRecord,
  type WriterIdentityRecord,
  type WriterSessionRecord,
} from './writerAuthorityProtocol';

const digest = (character: string) => character.repeat(64);

function must<T>(result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown }): T {
  if (!result.ok) throw new Error('fixture creation failed');
  return result.value;
}

function errorCode(result: { readonly ok: boolean; readonly error?: { readonly code: string } }): string | undefined {
  return result.ok ? undefined : result.error?.code;
}

function fixtures(): {
  writer: WriterIdentityRecord;
  session: WriterSessionRecord;
  authority: SourceAuthorityRecord;
  reference: SourceTransactionReferenceRecord;
} {
  const writer = must(createWriterIdentityRecord({
    id: 'writer-v2.window.interactive.0001', namespaceId: 'namespace-1', physicalSourceDigest: digest('1'),
    writerTypeId: 'legacy.notes.store_actions', manifestDigest: digest('2'),
  }));
  const session = must(createWriterSessionRecord({
    id: 'session-1', namespaceId: 'namespace-1', generationId: 'generation-1',
    physicalSourceDigest: digest('1'), writerId: writer.id, writerDigest: writer.writerDigest,
    epoch: 1, capabilityDigest: digest('3'),
  }));
  const authority = must(createSourceAuthorityRecord({
    id: 'authority-1', namespaceId: 'namespace-1', generationId: 'generation-1',
    physicalSourceDigest: digest('1'), sourceRevision: '42', operationRegistryRoot: digest('4'),
    terminalRoot: digest('5'), outboxRoot: digest('6'), mmrStateId: 'mmr-1', mmrStateDigest: digest('7'),
    lifecycleHeadId: 'lifecycle-1', lifecycleHeadDigest: digest('8'),
  }));
  const reference = must(createSourceTransactionReferenceRecord({
    id: 'reference-1', namespaceId: 'namespace-1', generationId: 'generation-1',
    physicalSourceDigest: digest('1'), committedSourceRevision: '42', sourceAuthorityId: authority.id,
    sourceAuthorityDigest: authority.authorityDigest, operationId: 'operation-1', operationDigest: digest('9'),
    admissionId: 'admission-1', admissionDigest: digest('a'), writerId: writer.id, writerDigest: writer.writerDigest,
    sessionId: session.id, sessionDigest: session.sessionDigest, terminalId: 'terminal-1', terminalDigest: digest('b'),
    outboxId: 'outbox-1', outboxDigest: digest('c'), mmrStateId: authority.mmrStateId,
    mmrStateDigest: authority.mmrStateDigest, checkpointId: 'checkpoint-1', checkpointDigest: digest('d'),
    graphVersion: 1,
  }));
  return { writer, session, authority, reference };
}

function inputWithoutSelfDigest(
  record: RepresentativeProtocolRecord,
  selfDigest: 'writerDigest' | 'sessionDigest' | 'authorityDigest' | 'referenceDigest',
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record)
    .filter(([field]) => field !== 'kind' && field !== 'version' && field !== selfDigest));
}

function resealWriter(record: WriterIdentityRecord, overrides: Record<string, unknown>): WriterIdentityRecord {
  return must(createWriterIdentityRecord({ ...inputWithoutSelfDigest(record, 'writerDigest'), ...overrides }));
}

function resealSession(record: WriterSessionRecord, overrides: Record<string, unknown>): WriterSessionRecord {
  return must(createWriterSessionRecord({ ...inputWithoutSelfDigest(record, 'sessionDigest'), ...overrides }));
}

function resealAuthority(record: SourceAuthorityRecord, overrides: Record<string, unknown>): SourceAuthorityRecord {
  return must(createSourceAuthorityRecord({ ...inputWithoutSelfDigest(record, 'authorityDigest'), ...overrides }));
}

function resealReference(
  record: SourceTransactionReferenceRecord,
  overrides: Record<string, unknown>,
): SourceTransactionReferenceRecord {
  return must(createSourceTransactionReferenceRecord({
    ...inputWithoutSelfDigest(record, 'referenceDigest'), ...overrides,
  }));
}

describe('K-333A representative production records', () => {
  it('creates, verifies, canonically encodes, and explicitly dispatches all four record kinds', () => {
    const records = Object.values(fixtures()) as RepresentativeProtocolRecord[];
    expect(records.map(record => record.kind)).toEqual([
      'absinthe_writer_identity', 'absinthe_writer_session', 'absinthe_source_authority',
      'absinthe_source_transaction_reference',
    ]);
    for (const record of records) {
      const encoded = encodeRepresentativeProtocolRecord(record);
      expect(encoded.ok).toBe(true);
      const repeated = encodeRepresentativeProtocolRecord(record);
      expect(repeated).toEqual(encoded);
      if (encoded.ok) expect(decodeRepresentativeProtocolRecordBytes(encoded.value)).toEqual({ ok: true, value: record });
    }
  });

  it('applies exact negative codec coverage to every representative record', () => {
    const { writer, session, authority, reference } = fixtures();
    const cases = [
      { record: writer, decode: decodeWriterIdentityRecord, digestField: 'manifestDigest' },
      { record: session, decode: decodeWriterSessionRecord, digestField: 'capabilityDigest' },
      { record: authority, decode: decodeSourceAuthorityRecord, digestField: 'terminalRoot' },
      { record: reference, decode: decodeSourceTransactionReferenceRecord, digestField: 'terminalDigest' },
    ] as const;
    for (const entry of cases) {
      const { id: _id, ...missing } = entry.record;
      expect(errorCode(entry.decode(missing))).toBe('MISSING_FIELD');
      expect(errorCode(entry.decode({ ...entry.record, extra: true }))).toBe('UNKNOWN_FIELD');
      expect(errorCode(entry.decode({ ...entry.record, kind: 'absinthe_wrong_kind' }))).toBe('RECORD_KIND_MISMATCH');
      expect(errorCode(entry.decode({ ...entry.record, version: 2 }))).toBe('UNSUPPORTED_RECORD_VERSION');
      expect(errorCode(entry.decode({ ...entry.record, id: 1 }))).toBe('INVALID_FIELD_TYPE');
      expect(errorCode(entry.decode({ ...entry.record, id: 'Invalid' }))).toBe('INVALID_IDENTIFIER');
      expect(errorCode(entry.decode({ ...entry.record, [entry.digestField]: 'bad' }))).toBe('INVALID_DIGEST');
      expect(errorCode(entry.decode({ ...entry.record, [entry.digestField]: digest('f') })))
        .toBe('CANONICAL_DIGEST_MISMATCH');
      const encoded = must(encodeRepresentativeProtocolRecord(entry.record));
      const oversized = new Uint8Array(32 * 1024 + 1); oversized.set(encoded);
      expect(errorCode(decodeRepresentativeProtocolRecordBytes(oversized))).toBe('INPUT_TOO_LARGE');
    }
  });

  it('binds writer, session, namespace, physical source, generation, revision, authority, and MMR evidence', () => {
    const graph = fixtures();
    expect(validateRepresentativeAuthorityGraph(graph)).toEqual({ ok: true, value: undefined });
    const mismatches = [
      { ...graph, session: { ...graph.session, writerId: 'writer-other' } },
      { ...graph, reference: { ...graph.reference, generationId: 'generation-other' } },
      { ...graph, reference: { ...graph.reference, committedSourceRevision: '43' } },
      { ...graph, reference: { ...graph.reference, mmrStateDigest: digest('e') } },
    ];
    for (const mismatch of mismatches) {
      expect(errorCode(validateRepresentativeAuthorityGraph(mismatch))).toBe('CANONICAL_DIGEST_MISMATCH');
    }
    const validButOtherWriter = fixtures();
    const replacement = must(createWriterIdentityRecord({
      id: validButOtherWriter.writer.id, namespaceId: 'namespace-other', physicalSourceDigest: digest('1'),
      writerTypeId: validButOtherWriter.writer.writerTypeId, manifestDigest: validButOtherWriter.writer.manifestDigest,
    }));
    expect(errorCode(validateRepresentativeAuthorityGraph({ ...validButOtherWriter, writer: replacement })))
      .toBe('RELATIONSHIP_MISMATCH');
  });

  it('rejects digest tampering, partial lifecycle pairs, and noncanonical revisions', () => {
    const { writer, authority } = fixtures();
    expect(errorCode(decodeWriterIdentityRecord({ ...writer, manifestDigest: digest('f') })))
      .toBe('CANONICAL_DIGEST_MISMATCH');
    expect(errorCode(decodeSourceAuthorityRecord({ ...authority, lifecycleHeadDigest: null })))
      .toBe('RELATIONSHIP_MISMATCH');
    expect(errorCode(decodeSourceAuthorityRecord({ ...authority, sourceRevision: '042' })))
      .toBe('INVALID_INTEGER');
  });

  it('strictly rejects missing, unknown, malformed, mismatched-kind, and unsupported-version fields', () => {
    const { writer } = fixtures();
    const { id: _missing, ...missing } = writer;
    expect(errorCode(decodeWriterIdentityRecord(missing))).toBe('MISSING_FIELD');
    expect(errorCode(decodeWriterIdentityRecord({ ...writer, extra: true }))).toBe('UNKNOWN_FIELD');
    expect(errorCode(decodeWriterIdentityRecord({ ...writer, id: 1 }))).toBe('INVALID_FIELD_TYPE');
    expect(errorCode(decodeWriterIdentityRecord({ ...writer, id: 'https://unsafe.example' }))).toBe('INVALID_IDENTIFIER');
    expect(errorCode(decodeWriterIdentityRecord({ ...writer, manifestDigest: 'ABC' }))).toBe('INVALID_DIGEST');
    expect(errorCode(decodeRepresentativeProtocolRecord({ ...writer, kind: 'unknown' }))).toBe('RECORD_KIND_MISMATCH');
    expect(errorCode(decodeRepresentativeProtocolRecord({ ...writer, version: 2 }))).toBe('UNSUPPORTED_RECORD_VERSION');
  });

  it('rejects unsupported record prototypes and accessors without invoking getters or toJSON', () => {
    const { writer } = fixtures();
    let invoked = false;
    const accessor = { ...writer };
    Object.defineProperty(accessor, 'id', { enumerable: true, get: () => { invoked = true; return writer.id; } });
    expect(errorCode(decodeWriterIdentityRecord(accessor))).toBe('INVALID_FIELD_TYPE');
    expect(invoked).toBe(false);
    expect(errorCode(decodeWriterIdentityRecord(new (class Similar { constructor() { Object.assign(this, writer); } })())))
      .toBe('INVALID_FIELD_TYPE');
    expect(errorCode(decodeWriterIdentityRecord({ ...writer, toJSON: () => writer }))).toBe('UNKNOWN_FIELD');
  });

  it('provides bounded enum and unique-array helpers without normalization', () => {
    expect(decodeEnum('interactive', ['interactive', 'worker'] as const, 'writerTypeId'))
      .toEqual({ ok: true, value: 'interactive' });
    expect(errorCode(decodeEnum('unknown', ['interactive', 'worker'] as const, 'writerTypeId')))
      .toBe('INVALID_ENUM_VALUE');
    expect(errorCode(decodeBoundedArray('not-array', 'writers', decodeIdentifier))).toBe('INVALID_ARRAY');
    expect(errorCode(decodeBoundedArray(['one', 'one'], 'writers', decodeIdentifier, { uniqueBy: value => value })))
      .toBe('DUPLICATE_ENTRY');
    expect(errorCode(decodeBoundedArray(Array.from({ length: 129 }, () => 'one'), 'writers', decodeIdentifier)))
      .toBe('RESOURCE_LIMIT_EXCEEDED');
    expect(decodeBoundedString('bounded', 'label', 7)).toEqual({ ok: true, value: 'bounded' });
    expect(errorCode(decodeBoundedString('e\u0301', 'label'))).toBe('NON_CANONICAL_VALUE');
    expect(errorCode(decodeBoundedString('too-long', 'label', 3))).toBe('RESOURCE_LIMIT_EXCEEDED');
    expect(errorCode(decodeIdentifier('A-uppercase', 'identifier'))).toBe('INVALID_IDENTIFIER');
  });

  it('commits every mutable record field and rejects stale self-digests', () => {
    const original = fixtures();
    const cases = [
      {
        record: original.writer,
        digestField: 'writerDigest',
        decode: decodeWriterIdentityRecord,
        create: createWriterIdentityRecord,
        mutations: {
          id: 'writer-v2.window.interactive.0002', namespaceId: 'namespace-2',
          physicalSourceDigest: digest('e'), writerTypeId: 'legacy.notes.worker_actions', manifestDigest: digest('f'),
        },
      },
      {
        record: original.session,
        digestField: 'sessionDigest',
        decode: decodeWriterSessionRecord,
        create: createWriterSessionRecord,
        mutations: {
          id: 'session-2', namespaceId: 'namespace-2', generationId: 'generation-2',
          physicalSourceDigest: digest('e'), writerId: 'writer-v2.window.interactive.0002',
          writerDigest: digest('f'), epoch: 2, capabilityDigest: digest('0'),
        },
      },
      {
        record: original.authority,
        digestField: 'authorityDigest',
        decode: decodeSourceAuthorityRecord,
        create: createSourceAuthorityRecord,
        mutations: {
          id: 'authority-2', namespaceId: 'namespace-2', generationId: 'generation-2',
          physicalSourceDigest: digest('e'), sourceRevision: '43', operationRegistryRoot: digest('f'),
          terminalRoot: digest('0'), outboxRoot: digest('a'), mmrStateId: 'mmr-2', mmrStateDigest: digest('b'),
          lifecycleHeadId: 'lifecycle-2', lifecycleHeadDigest: digest('c'),
        },
      },
      {
        record: original.reference,
        digestField: 'referenceDigest',
        decode: decodeSourceTransactionReferenceRecord,
        create: createSourceTransactionReferenceRecord,
        mutations: {
          id: 'reference-2', namespaceId: 'namespace-2', generationId: 'generation-2',
          physicalSourceDigest: digest('e'), committedSourceRevision: '43', sourceAuthorityId: 'authority-2',
          sourceAuthorityDigest: digest('f'), operationId: 'operation-2', operationDigest: digest('0'),
          admissionId: 'admission-2', admissionDigest: digest('1'), writerId: 'writer-v2.window.interactive.0002',
          writerDigest: digest('2'), sessionId: 'session-2', sessionDigest: digest('3'),
          terminalId: 'terminal-2', terminalDigest: digest('4'), outboxId: 'outbox-2', outboxDigest: digest('5'),
          mmrStateId: 'mmr-2', mmrStateDigest: digest('6'), checkpointId: 'checkpoint-2', checkpointDigest: digest('7'),
        },
      },
    ] as const;

    for (const entry of cases) {
      const originalDigest = entry.record[entry.digestField];
      for (const [field, replacement] of Object.entries(entry.mutations)) {
        const input = { ...inputWithoutSelfDigest(entry.record, entry.digestField), [field]: replacement };
        const created = entry.create(input);
        expect(created.ok, `${entry.record.kind}.${field} creation`).toBe(true);
        if (!created.ok) continue;
        expect(created.value[entry.digestField], `${entry.record.kind}.${field} commitment`).not.toBe(originalDigest);
        expect(entry.decode(created.value).ok, `${entry.record.kind}.${field} valid decode`).toBe(true);
        expect(errorCode(entry.decode({ ...entry.record, [field]: replacement })), `${entry.record.kind}.${field} stale digest`)
          .toBe('CANONICAL_DIGEST_MISMATCH');
      }
      expect(errorCode(entry.decode({ ...entry.record, [entry.digestField]: digest('0') })))
        .toBe('CANONICAL_DIGEST_MISMATCH');
    }
    expect(errorCode(createSourceTransactionReferenceRecord({
      ...inputWithoutSelfDigest(original.reference, 'referenceDigest'), graphVersion: 2,
    }))).toBe('UNSUPPORTED_RECORD_VERSION');
  });

  it('enforces complete lifecycle pairs during creation and decoding', () => {
    const { authority } = fixtures();
    const input = inputWithoutSelfDigest(authority, 'authorityDigest');
    expect(createSourceAuthorityRecord({ ...input, lifecycleHeadId: null, lifecycleHeadDigest: null }).ok).toBe(true);
    expect(createSourceAuthorityRecord(input).ok).toBe(true);
    expect(errorCode(createSourceAuthorityRecord({ ...input, lifecycleHeadId: null }))).toBe('RELATIONSHIP_MISMATCH');
    expect(errorCode(createSourceAuthorityRecord({ ...input, lifecycleHeadDigest: null }))).toBe('RELATIONSHIP_MISMATCH');
    const { lifecycleHeadId: _id, ...missingId } = input;
    const { lifecycleHeadDigest: _digest, ...missingDigest } = input;
    const { lifecycleHeadId: _bothId, lifecycleHeadDigest: _bothDigest, ...missingBoth } = input;
    expect(errorCode(createSourceAuthorityRecord(missingId))).toBe('MISSING_FIELD');
    expect(errorCode(createSourceAuthorityRecord(missingDigest))).toBe('MISSING_FIELD');
    expect(errorCode(createSourceAuthorityRecord(missingBoth))).toBe('MISSING_FIELD');
  });

  it('reports relationship mismatches after every changed record is independently re-sealed', () => {
    const graph = fixtures();
    const mismatches = [
      { ...graph, writer: resealWriter(graph.writer, { namespaceId: 'namespace-2' }) },
      { ...graph, writer: resealWriter(graph.writer, { physicalSourceDigest: digest('e') }) },
      { ...graph, session: resealSession(graph.session, { writerId: 'writer-other' }) },
      { ...graph, session: resealSession(graph.session, { writerDigest: digest('e') }) },
      { ...graph, session: resealSession(graph.session, { generationId: 'generation-2' }) },
      { ...graph, reference: resealReference(graph.reference, { namespaceId: 'namespace-2' }) },
      { ...graph, reference: resealReference(graph.reference, { physicalSourceDigest: digest('e') }) },
      { ...graph, reference: resealReference(graph.reference, { generationId: 'generation-2' }) },
      { ...graph, reference: resealReference(graph.reference, { writerId: 'writer-other' }) },
      { ...graph, reference: resealReference(graph.reference, { writerDigest: digest('e') }) },
      { ...graph, reference: resealReference(graph.reference, { sessionId: 'session-other' }) },
      { ...graph, reference: resealReference(graph.reference, { sessionDigest: digest('e') }) },
      { ...graph, reference: resealReference(graph.reference, { sourceAuthorityId: 'authority-other' }) },
      { ...graph, reference: resealReference(graph.reference, { sourceAuthorityDigest: digest('e') }) },
      { ...graph, reference: resealReference(graph.reference, { committedSourceRevision: '43' }) },
      { ...graph, reference: resealReference(graph.reference, { mmrStateId: 'mmr-other' }) },
      { ...graph, reference: resealReference(graph.reference, { mmrStateDigest: digest('e') }) },
    ];
    for (const mismatch of mismatches) {
      expect(errorCode(validateRepresentativeAuthorityGraph(mismatch))).toBe('RELATIONSHIP_MISMATCH');
    }

    const otherWriter = resealWriter(graph.writer, {
      id: 'writer-v2.window.interactive.0002', namespaceId: 'namespace-2', physicalSourceDigest: digest('e'),
    });
    const otherSession = resealSession(graph.session, {
      id: 'session-2', namespaceId: 'namespace-2', generationId: 'generation-2',
      physicalSourceDigest: digest('e'), writerId: otherWriter.id, writerDigest: otherWriter.writerDigest,
    });
    const otherAuthority = resealAuthority(graph.authority, {
      id: 'authority-2', namespaceId: 'namespace-2', generationId: 'generation-2',
      physicalSourceDigest: digest('e'), sourceRevision: '43', mmrStateId: 'mmr-2', mmrStateDigest: digest('f'),
    });
    const otherReference = resealReference(graph.reference, {
      id: 'reference-2', namespaceId: 'namespace-2', generationId: 'generation-2', physicalSourceDigest: digest('e'),
      writerId: otherWriter.id, writerDigest: otherWriter.writerDigest,
      sessionId: otherSession.id, sessionDigest: otherSession.sessionDigest,
      sourceAuthorityId: otherAuthority.id, sourceAuthorityDigest: otherAuthority.authorityDigest,
      committedSourceRevision: otherAuthority.sourceRevision,
      mmrStateId: otherAuthority.mmrStateId, mmrStateDigest: otherAuthority.mmrStateDigest,
    });
    const otherGraph = {
      writer: otherWriter, session: otherSession, authority: otherAuthority, reference: otherReference,
    };
    expect(validateRepresentativeAuthorityGraph(otherGraph).ok).toBe(true);
    expect(errorCode(validateRepresentativeAuthorityGraph({ ...graph, reference: otherReference })))
      .toBe('RELATIONSHIP_MISMATCH');
    expect(errorCode(validateRepresentativeAuthorityGraph({ ...otherGraph, session: graph.session })))
      .toBe('RELATIONSHIP_MISMATCH');
  });

  it('keeps creators, decoders, byte codecs, and graph validation total over hostile values', () => {
    const activeProxy = new Proxy(Object.create(null) as object, { ownKeys: () => { throw new Error('trap'); } });
    const revocable = Proxy.revocable(Object.create(null) as object, {}); revocable.revoke();
    const values: unknown[] = [null, undefined, true, 1, 'value', [], {}, new Date(), activeProxy, revocable.proxy];
    const functions = [
      createWriterIdentityRecord, createWriterSessionRecord, createSourceAuthorityRecord,
      createSourceTransactionReferenceRecord, decodeWriterIdentityRecord, decodeWriterSessionRecord,
      decodeSourceAuthorityRecord, decodeSourceTransactionReferenceRecord, decodeRepresentativeProtocolRecord,
      decodeRepresentativeProtocolRecordBytes, validateRepresentativeAuthorityGraph,
    ] as const;
    for (const fn of functions) for (const value of values) expect(() => fn(value)).not.toThrow();
    const { writer } = fixtures();
    expect(errorCode(createWriterIdentityRecord({
      ...inputWithoutSelfDigest(writer, 'writerDigest'), unexpected: true,
    }))).toBe('UNKNOWN_FIELD');
    const graph = fixtures();
    const { writer: _missingWriter, ...missingGraphKey } = graph;
    expect(errorCode(validateRepresentativeAuthorityGraph(missingGraphKey))).toBe('MISSING_FIELD');
    expect(errorCode(validateRepresentativeAuthorityGraph({ ...graph, unexpected: true }))).toBe('UNKNOWN_FIELD');

    const creatorCases = [
      [createWriterIdentityRecord, inputWithoutSelfDigest(graph.writer, 'writerDigest')],
      [createWriterSessionRecord, inputWithoutSelfDigest(graph.session, 'sessionDigest')],
      [createSourceAuthorityRecord, inputWithoutSelfDigest(graph.authority, 'authorityDigest')],
      [createSourceTransactionReferenceRecord, inputWithoutSelfDigest(graph.reference, 'referenceDigest')],
    ] as const;
    for (const [create, input] of creatorCases) {
      expect(errorCode(create(null))).toBe('INVALID_FIELD_TYPE');
      expect(errorCode(create({ ...input, unexpected: true }))).toBe('UNKNOWN_FIELD');
      const [first] = Object.keys(input);
      const missing = { ...input }; delete missing[first];
      expect(errorCode(create(missing))).toBe('MISSING_FIELD');
    }
  });

  it('returns exact field errors for every declared record field category', () => {
    const { writer, session, authority, reference } = fixtures();
    const cases: readonly [
      (value: unknown) => { readonly ok: boolean; readonly error?: { readonly code: string } },
      RepresentativeProtocolRecord,
      Readonly<Record<string, readonly [unknown, string]>>,
    ][] = [
      [decodeWriterIdentityRecord, writer, {
        kind: ['wrong', 'RECORD_KIND_MISMATCH'], version: [2, 'UNSUPPORTED_RECORD_VERSION'],
        id: ['Invalid', 'INVALID_IDENTIFIER'], namespaceId: ['Invalid', 'INVALID_IDENTIFIER'],
        physicalSourceDigest: ['bad', 'INVALID_DIGEST'], writerTypeId: ['Invalid', 'INVALID_IDENTIFIER'],
        manifestDigest: ['bad', 'INVALID_DIGEST'], writerDigest: ['bad', 'INVALID_DIGEST'],
      }],
      [decodeWriterSessionRecord, session, {
        kind: ['wrong', 'RECORD_KIND_MISMATCH'], version: [2, 'UNSUPPORTED_RECORD_VERSION'],
        id: ['Invalid', 'INVALID_IDENTIFIER'], namespaceId: ['Invalid', 'INVALID_IDENTIFIER'],
        generationId: ['Invalid', 'INVALID_IDENTIFIER'], physicalSourceDigest: ['bad', 'INVALID_DIGEST'],
        writerId: ['Invalid', 'INVALID_IDENTIFIER'], writerDigest: ['bad', 'INVALID_DIGEST'],
        epoch: [0, 'INVALID_INTEGER'], capabilityDigest: ['bad', 'INVALID_DIGEST'],
        sessionDigest: ['bad', 'INVALID_DIGEST'],
      }],
      [decodeSourceAuthorityRecord, authority, {
        kind: ['wrong', 'RECORD_KIND_MISMATCH'], version: [2, 'UNSUPPORTED_RECORD_VERSION'],
        id: ['Invalid', 'INVALID_IDENTIFIER'], namespaceId: ['Invalid', 'INVALID_IDENTIFIER'],
        generationId: ['Invalid', 'INVALID_IDENTIFIER'], physicalSourceDigest: ['bad', 'INVALID_DIGEST'],
        sourceRevision: ['042', 'INVALID_INTEGER'], operationRegistryRoot: ['bad', 'INVALID_DIGEST'],
        terminalRoot: ['bad', 'INVALID_DIGEST'], outboxRoot: ['bad', 'INVALID_DIGEST'],
        mmrStateId: ['Invalid', 'INVALID_IDENTIFIER'], mmrStateDigest: ['bad', 'INVALID_DIGEST'],
        lifecycleHeadId: ['Invalid', 'INVALID_IDENTIFIER'], lifecycleHeadDigest: ['bad', 'INVALID_DIGEST'],
        authorityDigest: ['bad', 'INVALID_DIGEST'],
      }],
      [decodeSourceTransactionReferenceRecord, reference, {
        kind: ['wrong', 'RECORD_KIND_MISMATCH'], version: [2, 'UNSUPPORTED_RECORD_VERSION'],
        id: ['Invalid', 'INVALID_IDENTIFIER'], namespaceId: ['Invalid', 'INVALID_IDENTIFIER'],
        generationId: ['Invalid', 'INVALID_IDENTIFIER'], physicalSourceDigest: ['bad', 'INVALID_DIGEST'],
        committedSourceRevision: ['042', 'INVALID_INTEGER'], sourceAuthorityId: ['Invalid', 'INVALID_IDENTIFIER'],
        sourceAuthorityDigest: ['bad', 'INVALID_DIGEST'], operationId: ['Invalid', 'INVALID_IDENTIFIER'],
        operationDigest: ['bad', 'INVALID_DIGEST'], admissionId: ['Invalid', 'INVALID_IDENTIFIER'],
        admissionDigest: ['bad', 'INVALID_DIGEST'], writerId: ['Invalid', 'INVALID_IDENTIFIER'],
        writerDigest: ['bad', 'INVALID_DIGEST'], sessionId: ['Invalid', 'INVALID_IDENTIFIER'],
        sessionDigest: ['bad', 'INVALID_DIGEST'], terminalId: ['Invalid', 'INVALID_IDENTIFIER'],
        terminalDigest: ['bad', 'INVALID_DIGEST'], outboxId: ['Invalid', 'INVALID_IDENTIFIER'],
        outboxDigest: ['bad', 'INVALID_DIGEST'], mmrStateId: ['Invalid', 'INVALID_IDENTIFIER'],
        mmrStateDigest: ['bad', 'INVALID_DIGEST'], checkpointId: ['Invalid', 'INVALID_IDENTIFIER'],
        checkpointDigest: ['bad', 'INVALID_DIGEST'], graphVersion: [2, 'UNSUPPORTED_RECORD_VERSION'],
        referenceDigest: ['bad', 'INVALID_DIGEST'],
      }],
    ];
    for (const [decode, record, invalidFields] of cases) {
      for (const [field, [replacement, expected]] of Object.entries(invalidFields)) {
        expect(errorCode(decode({ ...record, [field]: replacement })), `${record.kind}.${field}`).toBe(expected);
      }
    }
  });

  it('bounds error metadata independently of hostile field names and callers', () => {
    const hostile = `${'x'.repeat(140_000)}\n\u0000한글`;
    const result = decodeExactObject({ [hostile]: true }, [], []);
    expect(errorCode(result)).toBe('UNKNOWN_FIELD');
    if (!result.ok) {
      expect(result.error.field).toBe('unknown_field');
      expect(JSON.stringify(result.error).length).toBeLessThan(256);
      expect(JSON.stringify(result.error)).not.toContain('한글');
    }
    const bounded = protocolFail('UNKNOWN_FIELD', hostile, hostile);
    expect(bounded.error.operation.length).toBeLessThanOrEqual(PROTOCOL_ERROR_LABEL_LIMITS.maxOperationCharacters);
    expect(bounded.error.field?.length ?? 0).toBeLessThanOrEqual(PROTOCOL_ERROR_LABEL_LIMITS.maxFieldCharacters);
    expect(JSON.stringify(bounded.error)).not.toContain('한글');
    const proxyKey = new Proxy({}, {
      ownKeys: () => [hostile],
      getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true, value: true }),
    });
    expect(() => decodeExactObject(proxyKey, [], [])).not.toThrow();
    const proxyResult = decodeExactObject(proxyKey, [], []);
    expect(errorCode(proxyResult)).toBe('UNKNOWN_FIELD');
    if (!proxyResult.ok) expect(proxyResult.error.field).toBe('unknown_field');
  });

  it('enforces global helper ceilings even when callers request larger limits', () => {
    expect(decodeBoundedString('ok', 'field', PROTOCOL_CANONICAL_LIMITS.maxStringBytes).ok).toBe(true);
    expect(decodeBoundedString('ok', 'field', PROTOCOL_CANONICAL_LIMITS.maxStringBytes - 1).ok).toBe(true);
    for (const limit of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY,
      PROTOCOL_CANONICAL_LIMITS.maxStringBytes + 1, Number.MAX_SAFE_INTEGER + 1]) {
      expect(errorCode(decodeBoundedString('ok', 'field', limit))).toBe('INVALID_INTEGER');
    }
    expect(decodeBoundedArray([], 'items', decodeIdentifier,
      { maxEntries: PROTOCOL_CANONICAL_LIMITS.maxArrayEntries }).ok).toBe(true);
    expect(decodeBoundedArray([], 'items', decodeIdentifier,
      { maxEntries: PROTOCOL_CANONICAL_LIMITS.maxArrayEntries - 1 }).ok).toBe(true);
    for (const limit of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY,
      PROTOCOL_CANONICAL_LIMITS.maxArrayEntries + 1, Number.MAX_SAFE_INTEGER + 1]) {
      expect(errorCode(decodeBoundedArray([], 'items', decodeIdentifier, { maxEntries: limit })))
        .toBe('INVALID_INTEGER');
    }
  });

  it('keeps every exported strict decode helper total over alternate runtime inputs', () => {
    const revoked = Proxy.revocable([], {}); revoked.revoke();
    const hostile: unknown[] = [null, undefined, true, 1, 'value', [], {}, new Date(), new Proxy([], {}), revoked.proxy];
    const helpers = [
      (value: unknown) => decodeExactObject(value, ['field']),
      (value: unknown) => decodeBoundedString(value, 'field'),
      (value: unknown) => decodeIdentifier(value, 'field'),
      (value: unknown) => decodeDigest(value, 'field'),
      (value: unknown) => decodePositiveSafeInteger(value, 'field'),
      (value: unknown) => decodeCanonicalRevision(value, 'field'),
      (value: unknown) => decodeLiteral(value, 'expected', 'field'),
      (value: unknown) => decodeEnum(value, ['expected'] as const, 'field'),
      (value: unknown) => decodeBoundedArray(value, 'field', decodeIdentifier),
    ];
    for (const helper of helpers) for (const value of hostile) expect(() => helper(value)).not.toThrow();
    const badSchema = Proxy.revocable(['field'], {}); badSchema.revoke();
    expect(() => decodeExactObject({}, badSchema.proxy)).not.toThrow();
    const badEnum = Proxy.revocable(['expected'], {}); badEnum.revoke();
    expect(() => decodeEnum('expected', badEnum.proxy)).not.toThrow();
    expect(() => decodeBoundedArray([], 'field', null as never, { uniqueBy: null as never })).not.toThrow();
  });

  it('uses only emitted, exercised stable production protocol error codes', () => {
    const { writer, session } = fixtures();
    const observed = new Set<string>([
      errorCode(decodeRepresentativeProtocolRecordBytes(new Uint8Array(32 * 1024 + 1))),
      errorCode(encodeRepresentativeProtocolRecord({ ...writer, writerTypeId: 'a'.repeat(4_097) })),
      errorCode(decodeRepresentativeProtocolRecordBytes(new Uint8Array([0xc3, 0x28]))),
      errorCode(decodeRepresentativeProtocolRecordBytes(new TextEncoder().encode('{"version":1,"kind":"x"}'))),
      errorCode(decodeRepresentativeProtocolRecord({ ...writer, kind: 'unknown' })),
      errorCode(decodeRepresentativeProtocolRecord({ ...writer, version: 2 })),
      errorCode(decodeWriterIdentityRecord((({ id: _id, ...rest }) => rest)(writer))),
      errorCode(decodeWriterIdentityRecord({ ...writer, extra: true })),
      errorCode(decodeWriterIdentityRecord({ ...writer, id: 1 })),
      errorCode(decodeWriterIdentityRecord({ ...writer, id: 'https://unsafe.example' })),
      errorCode(decodeWriterIdentityRecord({ ...writer, manifestDigest: 'bad' })),
      errorCode(decodeRepresentativeProtocolRecord({ ...session, epoch: 0 })),
      errorCode(decodeBoundedArray('bad', 'array', decodeIdentifier)),
      errorCode(decodeEnum('bad', ['good'] as const, 'enum')),
      errorCode(decodeBoundedArray(['same', 'same'], 'array', decodeIdentifier, { uniqueBy: value => value })),
      errorCode(decodeBoundedArray(Array.from({ length: 129 }, () => 'one'), 'array', decodeIdentifier)),
      errorCode(decodeWriterIdentityRecord({ ...writer, manifestDigest: digest('f') })),
      errorCode(validateRepresentativeAuthorityGraph({ ...fixtures(), writer: must(createWriterIdentityRecord({
        id: writer.id, namespaceId: 'namespace-other', physicalSourceDigest: writer.physicalSourceDigest,
        writerTypeId: writer.writerTypeId, manifestDigest: writer.manifestDigest,
      })) })),
      errorCode((() => {
        const moduleDomain = 'bad.domain' as never;
        // The public type prevents this in typed callers; runtime validation protects decoded/untyped boundaries.
        return buildCanonicalProtocolPreimage(moduleDomain, 1, {});
      })()),
    ].filter((entry): entry is string => entry !== undefined));
    expect([...observed].sort()).toEqual([...PRODUCTION_PROTOCOL_ERROR_CODES].sort());
  });
});

describe('K-333A ownership and dormancy boundaries', () => {
  it('preserves inherited K-331 bounds and the K-332 production ownership split', () => {
    expect(PROTOCOL_CANONICAL_LIMITS.maxEncodedBytes).toBe(K331G_LIMITS.maxEncodedProofBytes);
    expect(PROTOCOL_CANONICAL_LIMITS.maxArrayEntries).toBe(K331G_LIMITS.maxArrayEntries);
    const k333 = K332_RESPONSIBILITY_MATRIX.find(row => row.task === 'K-333');
    const k334 = K332_RESPONSIBILITY_MATRIX.find(row => row.task === 'K-334');
    expect(k333?.owns).toEqual(expect.arrayContaining([
      'production canonical codecs', 'strict decoders', 'stable protocol errors and compatibility',
    ]));
    expect(k334?.owns).toContain('atomic repository transactions');
    expect(k333?.owns).not.toContain('atomic repository transactions');
  });

  it('has no persistence, browser, network, runtime activation, K-332 test-support, or external production caller', () => {
    const protocolRoot = dirname(fileURLToPath(import.meta.url));
    const localDatabaseRoot = dirname(protocolRoot);
    const protocolSources = readdirSync(protocolRoot)
      .filter(name => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .map(name => readFileSync(join(protocolRoot, name), 'utf8'))
      .join('\n');
    expect(protocolSources).not.toMatch(/indexedDB|localStorage|sessionStorage|fetch\s*\(|navigator\.|document\.|window\./);
    expect(protocolSources).not.toMatch(/crossModuleSourceAuthorityK332|productionWriterAdmissionK331G/);

    const externalProductionSources: string[] = [];
    const visit = (directory: string) => {
      for (const entry of readdirSync(directory)) {
        const path = join(directory, entry);
        if (path === protocolRoot) continue;
        if (statSync(path).isDirectory()) visit(path);
        else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts') && readFileSync(path, 'utf8').includes('/protocol/')) {
          externalProductionSources.push(path);
        }
      }
    };
    visit(localDatabaseRoot);
    expect(externalProductionSources).toEqual([]);
  });

  it('retains the exact production ineligibility invariant in predecessor contracts', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
    const sources = [
      join(root, 'docs', 'K-330-dormant-writer-registry-admission-foundation.md'),
      join(root, 'docs', 'K-332-cross-module-source-authority-protocol-contract.md'),
    ].map(path => readFileSync(path, 'utf8'));
    expect(sources.every(source => source.includes('NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE'))).toBe(true);
  });
});
