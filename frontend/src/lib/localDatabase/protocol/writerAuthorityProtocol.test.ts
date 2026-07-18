import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { K332_RESPONSIBILITY_MATRIX } from '../crossModuleSourceAuthorityK332.testSupport';
import { K331G_LIMITS } from '../productionWriterAdmissionK331G.testSupport';
import { PROTOCOL_CANONICAL_LIMITS } from './canonicalProtocolValue';
import { buildCanonicalProtocolPreimage } from './canonicalProtocolPreimage';
import { PRODUCTION_PROTOCOL_ERROR_CODES } from './protocolResult';
import {
  decodeBoundedArray,
  decodeBoundedString,
  decodeDigest,
  decodeEnum,
  decodeIdentifier,
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
    writerType: 'interactive-writer', manifestDigest: digest('2'),
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
      writerType: validButOtherWriter.writer.writerType, manifestDigest: validButOtherWriter.writer.manifestDigest,
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
    expect(decodeEnum('interactive', ['interactive', 'worker'] as const, 'writerType'))
      .toEqual({ ok: true, value: 'interactive' });
    expect(errorCode(decodeEnum('unknown', ['interactive', 'worker'] as const, 'writerType')))
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

  it('uses only emitted, exercised stable production protocol error codes', () => {
    const { writer, session } = fixtures();
    const observed = new Set<string>([
      errorCode(decodeRepresentativeProtocolRecordBytes(new Uint8Array(32 * 1024 + 1))),
      errorCode(encodeRepresentativeProtocolRecord({ ...writer, writerType: 'a'.repeat(4_097) })),
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
        writerType: writer.writerType, manifestDigest: writer.manifestDigest,
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
