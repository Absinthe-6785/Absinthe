import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { assertJsonDepth, bytesEqual, canonicalizeSourceEntries, utf8ByteLength } from './canonical';
import {
  HANDOFF_AUTHORITY_STORE,
  HANDOFF_CANDIDATE_STORE,
  inspectHandoffObjectCounts,
  openHandoffDatabase,
  persistEvidenceAtomic,
  persistEvidenceAtCandidateStoreKeyForTest,
  persistAuthorityCas,
  readHandoffAuthority,
  readValidatedHandoffEvidence,
} from './database';
import { runCrossContextReadOnlyHandoff, validateCrossContextHandoffRestart } from './handoff';
import { deriveLogicalScopeDigest, derivePhysicalSourceIdentity, validatePhysicalSourceIdentity } from './identity';
import {
  buildTerminalEvidence,
  buildPendingAuthority,
  assertHandoffWriteBudget,
  createCandidateId,
  createHandoffSessionId,
  decodeCandidateBytes,
  encodeAuthority,
  encodeCandidate,
  validateCandidate,
  withAuthorityState,
} from './records';
import { HANDOFF_LIMITS, type HandoffEffect, type PhysicalSourceIdentityV1 } from './types';
import { withPhysicalSourceLock, type ExclusiveLockAdapter } from './webLocks';

const physical: PhysicalSourceIdentityV1 = {
  schemaVersion: 1,
  origin: 'https://app.example.test',
  sourceFamily: 'legacy_notes',
  backend: 'combined_localstorage_indexeddb',
  databaseName: 'absinthe-notes-v1',
  objectStoreName: 'notes',
  physicalSourceVersion: 1,
};

const scope = {
  schemaVersion: 1 as const,
  userId: 'user-a', projectRef: 'project-a', namespaceId: 'namespace-a', deviceId: 'device-a',
};

class ImmediateLocks implements ExclusiveLockAdapter {
  calls = 0;
  async request<T>(_name: string, _options: { mode: 'exclusive'; signal?: AbortSignal }, callback: (lock: Lock | null) => T | Promise<T>): Promise<T> {
    this.calls += 1;
    return callback({ name: _name, mode: 'exclusive' } as Lock);
  }
}

async function graph(records: unknown = [['note-a', '{"title":"A"}']]): Promise<Awaited<ReturnType<typeof buildTerminalEvidence>>> {
  const derived = await derivePhysicalSourceIdentity(physical);
  return buildTerminalEvidence({ physicalSourceDigest: derived.digest, logicalScope: scope, sourceRevision: 7, records });
}

describe('K-328 physical identity and identifiers', () => {
  it('derives one account-independent physical lock name', async () => {
    const first = await derivePhysicalSourceIdentity(physical);
    const second = await derivePhysicalSourceIdentity({ ...physical });
    const scopeA = await deriveLogicalScopeDigest(scope);
    const scopeB = await deriveLogicalScopeDigest({ ...scope, userId: 'user-b', projectRef: 'project-b' });
    expect(first.lockName).toBe(second.lockName);
    expect(first.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(first.lockName).not.toContain(scope.userId);
    expect(scopeA.digest).not.toBe(scopeB.digest);
  });

  it.each([
    null, [], 'source', { ...physical, origin: 'https://app.example.test/' },
    { ...physical, databaseName: 'other' }, { ...physical, extra: true },
  ])('rejects malformed or unsupported physical identity %#', value => {
    expect(() => validatePhysicalSourceIdentity(value)).toThrow();
  });

  it('rejects proxy-wrapped physical identity input', () => {
    expect(() => validatePhysicalSourceIdentity(new Proxy(physical, {}))).toThrow();
  });

  it('generates exact candidate and session identifiers', () => {
    const digest = 'a'.repeat(64);
    expect(createCandidateId(digest)).toBe(`candidate-${'a'.repeat(24)}`);
    expect(utf8ByteLength(createCandidateId(digest))).toBe(34);
    expect(createHandoffSessionId(digest, 0)).toHaveLength(26);
    expect(createHandoffSessionId(digest, Number.MAX_SAFE_INTEGER)).toHaveLength(41);
  });
});

describe('K-328 canonical source capture', () => {
  it('sorts and detaches exact ID/value pairs', () => {
    const source = [['b', '2'], ['a', '1']];
    const result = canonicalizeSourceEntries(source);
    source[0]![1] = 'changed';
    expect(result).toEqual([['a', '1'], ['b', '2']]);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('rejects proxy-wrapped source entries', () => {
    expect(() => canonicalizeSourceEntries(new Proxy([['a', '1']], {}))).toThrow();
  });

  it('rejects duplicate decoded IDs and record-count plus one', () => {
    expect(() => canonicalizeSourceEntries([['a', '1'], ['a', '2']])).toThrow();
    const tooMany = Array.from({ length: HANDOFF_LIMITS.sourceRecordCount + 1 }, (_, index) => [`id-${index}`, '']);
    expect(() => canonicalizeSourceEntries(tooMany)).toThrow();
  });

  it('measures UTF-8 bytes instead of JavaScript string length', () => {
    expect(utf8ByteLength('한')).toBe(3);
    expect(() => canonicalizeSourceEntries([['id', '한'.repeat(7_000)]])).toThrow();
  });

  it('accepts exact source field and aggregate bounds and rejects plus one', () => {
    expect(() => canonicalizeSourceEntries([['i'.repeat(256), 'v'.repeat(20_000)]])).not.toThrow();
    expect(() => canonicalizeSourceEntries([['i'.repeat(257), '']])).toThrow();
    expect(() => canonicalizeSourceEntries([['id', 'v'.repeat(20_001)]])).toThrow();
    const exact: string[][] = [];
    let remaining = HANDOFF_LIMITS.aggregateSourceTupleBytes;
    for (let index = 0; remaining > 0; index += 1) {
      const id = `id-${index}`;
      const base = utf8ByteLength(JSON.stringify([id, '']));
      const valueBytes = Math.min(HANDOFF_LIMITS.sourceRecordValueBytes, remaining - base);
      if (valueBytes < 0) throw new Error('aggregate fixture cannot reconcile');
      exact.push([id, 'v'.repeat(valueBytes)]);
      remaining -= base + valueBytes;
    }
    expect(() => canonicalizeSourceEntries(exact)).not.toThrow();
    exact[exact.length - 1]![1] += 'v';
    expect(() => canonicalizeSourceEntries(exact)).toThrow();
  });

  it('enforces exact transaction arithmetic and plus one', () => {
    expect(1_302 + HANDOFF_LIMITS.demonstratedCandidateHighWaterBytes
      + HANDOFF_LIMITS.applicationReserveBytes).toBe(HANDOFF_LIMITS.transactionWriteBytes);
    expect(() => assertHandoffWriteBudget(1_302, HANDOFF_LIMITS.demonstratedCandidateHighWaterBytes)).not.toThrow();
    expect(() => assertHandoffWriteBudget(1_303, HANDOFF_LIMITS.demonstratedCandidateHighWaterBytes)).toThrow();
  });

  it('enforces JSON depth 64 and rejects depth 65', () => {
    expect(() => assertJsonDepth(`${'['.repeat(64)}0${']'.repeat(64)}`)).not.toThrow();
    expect(() => assertJsonDepth(`${'['.repeat(65)}0${']'.repeat(65)}`)).toThrow();
  });

  it('checks the candidate raw rejection ceiling before parsing', async () => {
    await expect(decodeCandidateBytes(new Uint8Array(HANDOFF_LIMITS.candidatePayloadBytes).fill(0x20)))
      .rejects.toMatchObject({ operation: 'persisted_json' });
    await expect(decodeCandidateBytes(new Uint8Array(HANDOFF_LIMITS.candidatePayloadBytes + 1)))
      .rejects.toMatchObject({ operation: 'persisted_byte_bounds' });
  });

  it('builds a fully rederived immutable candidate/authority graph', async () => {
    const value = await graph();
    expect(value.authority.snapshotCandidateId).toBe(value.candidate.candidateId);
    expect(value.authority.manifestDigest).toBe(value.candidate.manifestDigest);
    expect(encodeAuthority(value.authority).byteLength).toBeLessThan(HANDOFF_LIMITS.authorityPayloadBytes);
    expect(encodeCandidate(value.candidate).byteLength).toBeLessThan(HANDOFF_LIMITS.candidatePayloadBytes);
  });

  it.each([
    `candidate-${'A'.repeat(24)}`, `candidate-${'a'.repeat(23)}`, `candidate-${'a'.repeat(25)}`,
    `candidate-${'a'.repeat(23)}g`, ` candidate-${'a'.repeat(24)}`,
    `candidate-${'a'.repeat(24)} `, `candidate-${'a'.repeat(12)}\0${'a'.repeat(11)}`,
    `candidate-${'а'.repeat(24)}`,
  ])('rejects noncanonical candidate ID %s', async candidateId => {
    const value = await graph();
    await expect(validateCandidate({ ...value.candidate, candidateId })).rejects.toMatchObject({ code: 'CANDIDATE_CORRUPT' });
  });

  it.each([
    `handoff-${'A'.repeat(16)}-7`, `handoff-${'a'.repeat(15)}-7`, `handoff-${'a'.repeat(17)}-7`,
    `handoff-${'a'.repeat(15)}g-7`, `handoff-${'a'.repeat(16)}_7`,
    `handoff-${'a'.repeat(16)}-07`, `handoff-${'a'.repeat(16)}--1`,
    `handoff-${'a'.repeat(16)}--0`, `handoff-${'a'.repeat(16)}-+1`,
    `handoff-${'a'.repeat(16)}-1.0`, `handoff-${'a'.repeat(16)}-1e3`,
    `handoff-${'a'.repeat(16)}-９`, `handoff-${'a'.repeat(16)}-9007199254740992`,
  ])('rejects noncanonical session ID %s', async handoffSessionId => {
    const value = await graph();
    await expect(validateCandidate({ ...value.candidate, handoffSessionId }))
      .rejects.toMatchObject({ code: 'CANDIDATE_CORRUPT' });
  });
});

describe('K-328 Web Locks wrapper', () => {
  it('fails closed when Web Locks are unavailable', async () => {
    const derived = await derivePhysicalSourceIdentity(physical);
    await expect(withPhysicalSourceLock({ physicalSource: derived, locks: null, operation: () => 1 }))
      .resolves.toEqual({ status: 'unsupported' });
  });

  it('does not invoke an already-aborted operation', async () => {
    const derived = await derivePhysicalSourceIdentity(physical);
    const controller = new AbortController(); controller.abort();
    let calls = 0;
    const outcome = await withPhysicalSourceLock({
      physicalSource: derived, locks: new ImmediateLocks(), signal: controller.signal,
      operation: () => { calls += 1; },
    });
    expect(outcome).toEqual({ status: 'aborted' });
    expect(calls).toBe(0);
  });

  it('distinguishes coordinator acquisition failure from operation failure', async () => {
    const derived = await derivePhysicalSourceIdentity(physical);
    const locks: ExclusiveLockAdapter = {
      request: async () => { throw new Error('private coordinator detail'); },
    };
    await expect(withPhysicalSourceLock({ physicalSource: derived, locks, operation: () => 1 }))
      .resolves.toEqual({ status: 'lock_failed' });
  });

  it('distinguishes operation failure and invokes the callback once', async () => {
    const derived = await derivePhysicalSourceIdentity(physical);
    const locks = new ImmediateLocks();
    const result = await withPhysicalSourceLock({
      physicalSource: derived, locks,
      operation: () => { throw new Error('private payload'); },
    });
    expect(result).toMatchObject({ status: 'operation_failed', error: { code: 'LOCK_OPERATION_FAILED' } });
    expect(locks.calls).toBe(1);
    expect(JSON.stringify(result)).not.toContain('private payload');
  });
});

describe('K-328 IndexedDB persistence and restart', () => {
  it('creates the isolated schema and atomically commits one graph', async () => {
    const indexedDB = new IDBFactory();
    const db = await openHandoffDatabase({ indexedDB, databaseName: 'k328-create' });
    expect([...db.objectStoreNames]).toEqual([HANDOFF_AUTHORITY_STORE, HANDOFF_CANDIDATE_STORE]);
    const value = await graph();
    await expect(persistEvidenceAtomic({ db, ...value, expectedAuthorityBytes: null })).resolves.toBe('created');
    await expect(inspectHandoffObjectCounts(db)).resolves.toEqual({ authority: 1, candidate: 1 });
    db.close();
  });

  it('returns identical replay without committed writes', async () => {
    const indexedDB = new IDBFactory();
    const db = await openHandoffDatabase({ indexedDB, databaseName: 'k328-replay' });
    const value = await graph();
    await persistEvidenceAtomic({ db, ...value, expectedAuthorityBytes: null });
    const effects: HandoffEffect[] = [];
    await expect(persistEvidenceAtomic({
      db, ...value, expectedAuthorityBytes: null, observer: { onEffect: effect => effects.push(effect) },
    })).resolves.toBe('existing_identical');
    expect(effects).not.toContain('candidate_committed_write');
    expect(effects).not.toContain('authority_committed_write');
    db.close();
  });

  it('rejects a same-store-key conflicting candidate and preserves original bytes', async () => {
    const indexedDB = new IDBFactory();
    const db = await openHandoffDatabase({ indexedDB, databaseName: 'k328-collision' });
    const first = await graph([['note-a', 'A']]);
    const second = await graph([['note-a', 'B']]);
    await persistEvidenceAtomic({ db, ...first, expectedAuthorityBytes: null });
    const before = await readValidatedHandoffEvidence(db, first.authority.physicalSourceDigest);
    await expect(persistEvidenceAtCandidateStoreKeyForTest({
      db, ...second, expectedAuthorityBytes: encodeAuthority(first.authority),
    }, first.candidate.candidateId)).rejects.toMatchObject({ code: 'CANDIDATE_KEY_COLLISION' });
    const after = await readValidatedHandoffEvidence(db, first.authority.physicalSourceDigest);
    expect(bytesEqual(after!.candidateBytes, before!.candidateBytes)).toBe(true);
    expect(bytesEqual(after!.authorityBytes, before!.authorityBytes)).toBe(true);
    db.close();
  });

  it.each(['after_candidate_request', 'after_both_requests'] as const)(
    'aborts %s without a partial candidate or authority', async failurePointForTest => {
      const indexedDB = new IDBFactory();
      const db = await openHandoffDatabase({ indexedDB, databaseName: `k328-abort-${failurePointForTest}` });
      const value = await graph();
      const effects: HandoffEffect[] = [];
      await expect(persistEvidenceAtomic({
        db, ...value, expectedAuthorityBytes: null, failurePointForTest,
        observer: { onEffect: effect => effects.push(effect) },
      })).rejects.toMatchObject({ code: 'TRANSACTION_ABORTED' });
      expect(effects).toContain('transaction_abort');
      await expect(inspectHandoffObjectCounts(db)).resolves.toEqual({ authority: 0, candidate: 0 });
      db.close();
    },
  );

  it('fails CAS when an authority already binds different evidence', async () => {
    const indexedDB = new IDBFactory();
    const db = await openHandoffDatabase({ indexedDB, databaseName: 'k328-cas' });
    const first = await graph([['note-a', 'A']]);
    const second = await graph([['note-b', 'B']]);
    await persistEvidenceAtomic({ db, ...first, expectedAuthorityBytes: null });
    await expect(persistEvidenceAtomic({ db, ...second, expectedAuthorityBytes: null }))
      .rejects.toMatchObject({ code: 'AUTHORITY_CAS_CONFLICT' });
    db.close();
  });

  it('rejects malformed UTF-8 candidate bytes without repair', async () => {
    await expect(decodeCandidateBytes(new Uint8Array([0xc3, 0x28])))
      .rejects.toMatchObject({ code: 'CANDIDATE_CORRUPT' });
  });

  it('commits through the dormant entry point and validates a fresh restart', async () => {
    const indexedDB = new IDBFactory();
    const locks = new ImmediateLocks();
    const input = {
      physicalSource: physical, logicalScope: scope, indexedDB, databaseName: 'k328-run', locks,
      source: {
        adapter: 'isolated_test_source', isolatedForHandoff: true as const,
        readSnapshot: async () => ({ revision: 7, records: [['note-a', 'A']] }),
      },
    };
    await expect(runCrossContextReadOnlyHandoff(input)).resolves.toMatchObject({ status: 'created', entityCount: 1 });
    await expect(runCrossContextReadOnlyHandoff(input)).resolves.toMatchObject({ status: 'existing_identical' });
    const restarted = await validateCrossContextHandoffRestart({
      physicalSource: physical, indexedDB, databaseName: 'k328-run',
    });
    expect(restarted.authority.state).toBe('read_only_handoff');
    expect(restarted.candidate.records).toEqual([['note-a', 'A']]);
  });

  it('emits every successful-path effect without leaking payloads', async () => {
    const indexedDB = new IDBFactory();
    const effects: HandoffEffect[] = [];
    await runCrossContextReadOnlyHandoff({
      physicalSource: physical,
      logicalScope: scope,
      indexedDB,
      databaseName: 'k328-observability',
      locks: new ImmediateLocks(),
      observer: { onEffect: effect => effects.push(effect) },
      source: {
        adapter: 'isolated_observability_source',
        isolatedForHandoff: true,
        readSnapshot: async () => ({ revision: 7, records: [['note-a', 'A']] }),
      },
    });
    expect(new Set(effects)).toEqual(new Set<HandoffEffect>([
      'coordinator_attempt', 'lock_request', 'lock_acquired', 'database_open',
      'persistence_read', 'source_read', 'digest_operation', 'transaction_start',
      'candidate_create_request', 'candidate_committed_write', 'authority_committed_write',
      'finalization_attempt',
    ]));
    expect(JSON.stringify(effects)).not.toContain('note-a');
  });

  it('leaves a bounded pending authority when source revision changes after exclusion', async () => {
    const indexedDB = new IDBFactory();
    let revision = 7;
    const input = {
      physicalSource: physical, logicalScope: scope, indexedDB, databaseName: 'k328-revision-race',
      locks: new ImmediateLocks(),
      source: {
        adapter: 'isolated_revision_race', isolatedForHandoff: true as const,
        readSnapshot: async () => ({ revision: revision++, records: [['note-a', 'A']] }),
      },
    };
    await expect(runCrossContextReadOnlyHandoff(input)).rejects.toMatchObject({
      code: 'SOURCE_READ_FAILED', operation: 'source_revision_changed',
    });
    const derived = await derivePhysicalSourceIdentity(physical);
    const db = await openHandoffDatabase({ indexedDB, databaseName: 'k328-revision-race' });
    expect((await readHandoffAuthority(db, derived.digest))?.authority.state).toBe('handoff_pending');
    expect(await inspectHandoffObjectCounts(db)).toEqual({ authority: 1, candidate: 0 });
    db.close();
  });

  it('resumes snapshot-committed evidence by finalizing without rereading source', async () => {
    const indexedDB = new IDBFactory();
    const databaseName = 'k328-finalize-resume';
    const value = await graph([['note-a', 'A']]);
    const pending = await buildPendingAuthority({
      physicalSourceDigest: value.authority.physicalSourceDigest,
      logicalScope: scope,
      sourceRevision: value.authority.sourceRevision,
    });
    const snapshotAuthority = withAuthorityState(value.authority, 'snapshot_committed_pending_finalization');
    const db = await openHandoffDatabase({ indexedDB, databaseName });
    await persistAuthorityCas({ db, authority: pending, expectedAuthorityBytes: null });
    await persistEvidenceAtomic({
      db, authority: snapshotAuthority, candidate: value.candidate,
      expectedAuthorityBytes: encodeAuthority(pending),
    });
    db.close();
    let reads = 0;
    const result = await runCrossContextReadOnlyHandoff({
      physicalSource: physical, logicalScope: scope, indexedDB, databaseName,
      locks: new ImmediateLocks(),
      source: {
        adapter: 'isolated_resume_source', isolatedForHandoff: true,
        readSnapshot: async () => { reads += 1; throw new Error('must not read'); },
      },
    });
    expect(result.status).toBe('created');
    expect(reads).toBe(0);
    const restarted = await validateCrossContextHandoffRestart({ physicalSource: physical, indexedDB, databaseName });
    expect(restarted.authority.state).toBe('read_only_handoff');
  });

  it('locked terminal retry performs no source read or rewrite', async () => {
    const indexedDB = new IDBFactory();
    const databaseName = 'k328-locked-retry';
    const base = {
      physicalSource: physical, logicalScope: scope, indexedDB, databaseName, locks: new ImmediateLocks(),
    };
    await runCrossContextReadOnlyHandoff({
      ...base,
      source: {
        adapter: 'isolated_retry_source', isolatedForHandoff: true,
        readSnapshot: async () => ({ revision: 7, records: [['note-a', 'A']] }),
      },
    });
    const effects: HandoffEffect[] = [];
    const result = await runCrossContextReadOnlyHandoff({
      ...base,
      observer: { onEffect: effect => effects.push(effect) },
      source: {
        adapter: 'isolated_retry_source', isolatedForHandoff: true,
        readSnapshot: async () => { throw new Error('must not read'); },
      },
    });
    expect(result.status).toBe('existing_identical');
    expect(effects).not.toContain('source_read');
    expect(effects).not.toContain('candidate_committed_write');
    expect(effects).not.toContain('authority_committed_write');
  });
});
