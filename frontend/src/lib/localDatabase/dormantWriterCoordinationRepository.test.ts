import 'fake-indexeddb/auto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { namespaceFingerprint } from './namespace';
import { sha256Hex } from './outboxIdentity';
import { LOCAL_DATABASE_STORES } from './schema';
import { LOCAL_DATABASE_NAME, LOCAL_DATABASE_VERSION, type LocalDatabaseNamespace } from './types';
import {
  DORMANT_WRITER_COORDINATION_ENVELOPE_SCHEMA,
  DORMANT_WRITER_COORDINATION_LIMITS,
  DORMANT_WRITER_COORDINATION_STORE,
  createDormantWriterCoordinationCapability,
  decodeDormantWriterCoordinationEnvelope,
  encodeDormantWriterCoordinationEnvelope,
  openDormantWriterCoordinationDatabase,
  type DormantWriterCoordinationCas,
  type DormantWriterCoordinationRepository,
} from './dormantWriterCoordinationRepository';
import {
  K329B_REVIEWED_WRITER_MANIFEST_ENTRIES,
  createWriterCoordinationModel,
  deriveCoordinationAuthorityDigest,
  encodeWriterCoordinationModelCanonical,
  reduceWriterCoordination,
  type AdmissionOperationRecord,
  type SourceVerificationObservation,
  type WriterCoordinationAction,
  type WriterCoordinationActor,
  type WriterCoordinationModelState,
  type WriterRegistrationRecord,
} from './writerCoordinationEligibility';

const capability = createDormantWriterCoordinationCapability('test');
const developerCapability = createDormantWriterCoordinationCapability('developer');
const namespace: LocalDatabaseNamespace = {
  userId: 'user-k330', projectRef: 'project-k330', deviceId: 'device-k330',
  generationId: 'generation-k330', schemaVersion: 1,
};
const PHYSICAL = '1'.repeat(64);
const SOURCE = '2'.repeat(64);
const OTHER = '3'.repeat(64);
const COORDINATOR = `writer-session-v1:${'a'.repeat(32)}`;
const VERIFIER = `writer-session-v1:${'b'.repeat(32)}`;
const RECOVERY = `writer-session-v1:${'c'.repeat(32)}`;
const coordinator: WriterCoordinationActor = { kind: 'coordinator', sessionId: COORDINATOR };
const verifier: WriterCoordinationActor = { kind: 'verifier', sessionId: VERIFIER };
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const repositories: DormantWriterCoordinationRepository[] = [];
const participating = K329B_REVIEWED_WRITER_MANIFEST_ENTRIES
  .filter(entry => entry.coordinationRequirement === 'must_participate');

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(LOCAL_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('delete_blocked'));
  });
}

function rawOpen(version = LOCAL_DATABASE_VERSION, upgrade?: (db: IDBDatabase, tx: IDBTransaction) => void): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DATABASE_NAME, version);
    request.onupgradeneeded = () => upgrade?.(request.result, request.transaction!);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('transaction_aborted'));
    transaction.onerror = () => undefined;
  });
}

async function open(options: { developer?: boolean; scope?: LocalDatabaseNamespace } = {}) {
  const repository = await openDormantWriterCoordinationDatabase(options.scope ?? namespace, {
    capability: options.developer ? developerCapability : capability,
  });
  repositories.push(repository);
  return repository;
}

async function initialize(repository: DormantWriterCoordinationRepository) {
  return repository.initialize({
    expectedDatabaseGeneration: repository.namespace.generationId,
    physicalSourceDigest: PHYSICAL,
    coordinatorSessionId: COORDINATOR,
    verifierSessionId: VERIFIER,
    recoverySessionId: RECOVERY,
  });
}

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
  index = 0, overrides: Partial<AdmissionOperationRecord> = {}): AdmissionOperationRecord {
  return {
    kind: 'absinthe_writer_admission_operation', schemaVersion: 1, byteFormatVersion: 1,
    physicalSourceDigest: PHYSICAL,
    operationId: `writer-operation-v1:${nonce(index + 20, 64)}`,
    idempotencyKey: `writer-idempotency-v1:${nonce(index + 40, 64)}`,
    writerTypeId: record.writerTypeId, writerId: record.writerId, sessionId: record.sessionId,
    coordinationEpoch: state.authority.coordinationEpoch,
    admissionTransitionRevision: state.authority.transitionRevision,
    mutationType: 'entity_put', expectedSourceRevision: '40', state: 'admitted',
    committedSourceRevision: null, terminalResult: null, ...overrides,
  };
}

function observation(overrides: Partial<SourceVerificationObservation> = {}): SourceVerificationObservation {
  return {
    physicalSourceDigest: PHYSICAL, sourceType: 'indexeddb', ownershipProven: true,
    canonical: true, withinBounds: true, revisionBefore: '41', digestBefore: SOURCE,
    revisionAfter: '41', digestAfter: SOURCE, authoritativeSourceDecision: 'indexeddb',
    ambiguityCode: null, k328AdapterAvailable: true, k328PhysicalSourceDigest: PHYSICAL,
    ...overrides,
  };
}

function action(state: WriterCoordinationModelState, actor: WriterCoordinationActor,
  body: Record<string, unknown>): WriterCoordinationAction {
  return {
    ...body, actor,
    expectedTransitionRevision: state.authority.transitionRevision,
    expectedCoordinationEpoch: state.authority.coordinationEpoch,
    expectedAuthorityDigest: deriveCoordinationAuthorityDigest(state.authority),
  } as unknown as WriterCoordinationAction;
}

function cas(state: WriterCoordinationModelState,
  overrides: Partial<DormantWriterCoordinationCas> = {}): DormantWriterCoordinationCas {
  return {
    databaseGeneration: namespace.generationId,
    coordinationEpoch: state.authority.coordinationEpoch,
    transitionRevision: state.authority.transitionRevision,
    authorityDigest: deriveCoordinationAuthorityDigest(state.authority),
    ...overrides,
  };
}

async function apply(repository: DormantWriterCoordinationRepository, state: WriterCoordinationModelState,
  actor: WriterCoordinationActor, body: Record<string, unknown>, casOverrides: Partial<DormantWriterCoordinationCas> = {}) {
  return repository.applyAction({ action: action(state, actor, body), cas: cas(state, casOverrides) });
}

async function registerAll(repository: DormantWriterCoordinationRepository, state: WriterCoordinationModelState) {
  let current = state;
  for (let index = 0; index < participating.length; index += 1) {
    const record = registration(index);
    current = await repository.registerWriter({
      action: action(current, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId },
        { type: 'REGISTER_WRITER', registration: record }) as Extract<WriterCoordinationAction, { type: 'REGISTER_WRITER' }>,
      cas: cas(current),
    });
  }
  return current;
}

type Stage = 'initialized' | 'registered' | 'requested' | 'closed' | 'draining'
  | 'checkpoint4' | 'verifying' | 'source' | 'eligible';

async function buildTo(repository: DormantWriterCoordinationRepository, stage: Stage) {
  let state = await initialize(repository);
  if (stage === 'initialized') return state;
  state = await registerAll(repository, state);
  if (stage === 'registered') return state;
  state = await repository.captureCheckpoint({
    action: action(state, coordinator, { type: 'CAPTURE_BEFORE_DRAIN' }) as never,
    cas: cas(state, { previousCheckpointDigest: null }),
  });
  state = await apply(repository, state, coordinator, { type: 'REQUEST_DRAIN' });
  if (stage === 'requested') return state;
  const drainRevision = state.authority.drainRequestTransitionRevision!;
  for (const record of state.registrations) {
    state = await repository.recordDrainAcknowledgement({
      action: action(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId }, {
        type: 'ACKNOWLEDGE_DRAIN', writerId: record.writerId, drainRequestTransitionRevision: drainRevision,
      }) as never,
      cas: cas(state),
    });
  }
  state = await apply(repository, state, coordinator, { type: 'CLOSE_ADMISSION' });
  if (stage === 'closed') return state;
  state = await repository.captureCheckpoint({
    action: action(state, coordinator, { type: 'CAPTURE_AFTER_ADMISSION_CLOSED' }) as never,
    cas: cas(state, { previousCheckpointDigest: state.checkpointChain[0].checkpointDigest }),
  });
  state = await apply(repository, state, coordinator, { type: 'BEGIN_DRAIN' });
  if (stage === 'draining') return state;
  state = await repository.transitionEpoch({
    action: action(state, coordinator, { type: 'MARK_QUIESCENT' }) as never,
    cas: cas(state),
  });
  state = await repository.captureCheckpoint({
    action: action(state, coordinator, { type: 'CAPTURE_AFTER_OPERATIONS_TERMINAL' }) as never,
    cas: cas(state, { previousCheckpointDigest: state.checkpointChain[1].checkpointDigest }),
  });
  state = await repository.captureCheckpoint({
    action: action(state, verifier, { type: 'CAPTURE_BEFORE_SOURCE_VERIFICATION' }) as never,
    cas: cas(state, { previousCheckpointDigest: state.checkpointChain[2].checkpointDigest }),
  });
  if (stage === 'checkpoint4') return state;
  state = await apply(repository, state, verifier, { type: 'BEGIN_SOURCE_VERIFICATION' });
  if (stage === 'verifying') return state;
  state = await repository.storeSourceEvidence({
    action: action(state, verifier, { type: 'CAPTURE_SOURCE_EVIDENCE', observation: observation() }) as never,
    cas: cas(state, {
      previousCheckpointDigest: state.checkpointChain[3].checkpointDigest,
      expectedSourceRevision: '41',
    }),
  });
  if (stage === 'source') return state;
  return repository.storeEligibilityEvidenceAtomically({
    actor: verifier,
    cas: cas(state, {
      previousCheckpointDigest: state.checkpointChain[4].checkpointDigest,
      expectedSourceRevision: '41',
    }),
  });
}

async function rawPut(repository: DormantWriterCoordinationRepository, bytes: Uint8Array): Promise<void> {
  const db = await rawOpen();
  const transaction = db.transaction(DORMANT_WRITER_COORDINATION_STORE, 'readwrite');
  transaction.objectStore(DORMANT_WRITER_COORDINATION_STORE)
    .put(bytes, [repository.namespaceKey, repository.namespace.generationId]);
  await transactionDone(transaction);
  db.close();
}

async function unsafeEnvelope(state: WriterCoordinationModelState, overrides: Record<string, unknown> = {}) {
  const modelText = textDecoder.decode(encodeWriterCoordinationModelCanonical(state));
  const value = {
    kind: 'absinthe_dormant_writer_coordination_envelope',
    schemaVersion: DORMANT_WRITER_COORDINATION_ENVELOPE_SCHEMA,
    databaseNamespace: await namespaceFingerprint(namespace),
    databaseGeneration: namespace.generationId,
    coordinationEpoch: state.authority.coordinationEpoch,
    transitionRevision: state.authority.transitionRevision,
    authorityDigest: deriveCoordinationAuthorityDigest(state.authority),
    canonicalModelDigest: sha256Hex(modelText),
    coordinationModel: JSON.parse(modelText) as unknown,
    ...overrides,
  };
  return textEncoder.encode(JSON.stringify(value));
}

beforeEach(async () => { await deleteDatabase().catch(() => undefined); });
afterEach(async () => {
  for (const repository of repositories.splice(0)) repository.close();
  await deleteDatabase().catch(() => undefined);
});

describe('K-330 dormant schema and initialization', () => {
  it('requires a private capability and reports no state distinctly', async () => {
    await expect(openDormantWriterCoordinationDatabase(namespace, { capability: {} as never }))
      .rejects.toMatchObject({ code: 'DORMANT_WRITER_COORDINATION_CAPABILITY_REQUIRED' });
    const repository = await open();
    await expect(repository.readSnapshot()).resolves.toEqual({ status: 'empty' });
    await expect(repository.readCurrentEpoch()).resolves.toBeNull();
  });

  it('initializes epoch one, reopens deterministically, and rejects duplicate initialization', async () => {
    const repository = await open();
    const state = await initialize(repository);
    expect(state.authority).toMatchObject({ coordinationEpoch: 1, transitionRevision: 0, state: 'OPEN' });
    expect(await repository.readCurrentEpoch()).toBe(1);
    repository.close();
    const reopened = await open();
    const snapshot = await reopened.readSnapshot();
    expect(snapshot).toMatchObject({ status: 'valid', state: { authority: { coordinationEpoch: 1 } } });
    await expect(initialize(reopened)).rejects.toMatchObject({ code: 'DORMANT_WRITER_COORDINATION_ALREADY_INITIALIZED' });
  });

  it('rejects stale generation before any write', async () => {
    const repository = await open();
    await expect(repository.initialize({
      expectedDatabaseGeneration: 'generation-stale', physicalSourceDigest: PHYSICAL,
      coordinatorSessionId: COORDINATOR, verifierSessionId: VERIFIER, recoverySessionId: RECOVERY,
    })).rejects.toMatchObject({ code: 'WRITER_COORDINATION_GENERATION_MISMATCH' });
    await expect(repository.readSnapshot()).resolves.toEqual({ status: 'empty' });
  });

  it('keeps the store isolated as one key/value store with no indexes', async () => {
    const repository = await open(); await initialize(repository);
    const db = await rawOpen();
    expect(db.version).toBe(4);
    expect(db.objectStoreNames.contains(DORMANT_WRITER_COORDINATION_STORE)).toBe(true);
    const store = db.transaction(DORMANT_WRITER_COORDINATION_STORE).objectStore(DORMANT_WRITER_COORDINATION_STORE);
    expect(store.keyPath).toBeNull();
    expect(store.autoIncrement).toBe(false);
    expect(store.indexNames).toHaveLength(0);
    db.close();
  });

  it('preserves a populated version-3 database during the additive version-4 upgrade', async () => {
    const oldStores = Object.values(LOCAL_DATABASE_STORES).filter(name => name !== DORMANT_WRITER_COORDINATION_STORE);
    const previous = await rawOpen(3, (db) => {
      for (const name of oldStores) db.createObjectStore(name);
    });
    const write = previous.transaction(LOCAL_DATABASE_STORES.migrationState, 'readwrite');
    write.objectStore(LOCAL_DATABASE_STORES.migrationState).put('preserved', 'sentinel');
    await transactionDone(write); previous.close();
    const repository = await open();
    expect(await repository.readSnapshot()).toEqual({ status: 'empty' });
    const upgraded = await rawOpen();
    const read = upgraded.transaction(LOCAL_DATABASE_STORES.migrationState, 'readonly');
    const request = read.objectStore(LOCAL_DATABASE_STORES.migrationState).get('sentinel');
    const result = await new Promise(resolve => { request.onsuccess = () => resolve(request.result); });
    expect(result).toBe('preserved');
    expect(upgraded.objectStoreNames.contains(DORMANT_WRITER_COORDINATION_STORE)).toBe(true);
    upgraded.close();
  });
});

describe('K-330 canonical envelope and restart rejection', () => {
  it('round trips exact canonical bytes with namespace, generation, model, and authority digests', async () => {
    const repository = await open(); const state = await initialize(repository);
    const bytes = encodeDormantWriterCoordinationEnvelope({
      databaseNamespace: repository.namespaceKey, databaseGeneration: namespace.generationId, state,
    });
    const decoded = decodeDormantWriterCoordinationEnvelope(bytes, repository.namespaceKey, namespace.generationId);
    expect(decoded).toEqual(state);
    expect(encodeDormantWriterCoordinationEnvelope({
      databaseNamespace: repository.namespaceKey, databaseGeneration: namespace.generationId, state: decoded,
    })).toEqual(bytes);
  });

  it.each([
    ['invalid UTF-8', new Uint8Array([0xc3, 0x28])],
    ['trailing bytes', textEncoder.encode('{}\n')],
    ['empty bytes', new Uint8Array()],
    ['oversized bytes', new Uint8Array(DORMANT_WRITER_COORDINATION_LIMITS.envelopeBytes + 1)],
  ])('rejects corrupt envelope bytes: %s', async (_label, bytes) => {
    const repository = await open(); await initialize(repository); await rawPut(repository, bytes);
    await expect(repository.readSnapshot()).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });

  it('distinguishes unsupported envelope schema from corruption', async () => {
    const repository = await open(); const state = await initialize(repository);
    const parsed = JSON.parse(textDecoder.decode(await unsafeEnvelope(state))) as Record<string, unknown>;
    parsed.schemaVersion = 2;
    await rawPut(repository, textEncoder.encode(JSON.stringify(parsed)));
    await expect(repository.readSnapshot()).rejects.toMatchObject({
      code: 'DORMANT_WRITER_COORDINATION_SCHEMA_UNSUPPORTED',
    });
  });

  it.each([
    ['model digest', { canonicalModelDigest: OTHER }],
    ['authority digest', { authorityDigest: OTHER }],
    ['generation', { databaseGeneration: 'generation-other' }],
    ['namespace', { databaseNamespace: OTHER }],
  ])('rejects mismatched envelope binding: %s', async (_label, override) => {
    const repository = await open(); const state = await initialize(repository);
    await rawPut(repository, await unsafeEnvelope(state, override));
    await expect(repository.readSnapshot()).rejects.toHaveProperty('code');
  });

  it('rejects duplicate keys, extra fields, and noncanonical key order', async () => {
    const repository = await open(); const state = await initialize(repository);
    const raw = textDecoder.decode(await unsafeEnvelope(state));
    for (const changed of [
      raw.replace('{', '{"schemaVersion":1,'),
      raw.replace('{', '{"unknown":true,'),
      raw.replace('"kind":"absinthe_dormant_writer_coordination_envelope","schemaVersion":1',
        '"schemaVersion":1,"kind":"absinthe_dormant_writer_coordination_envelope"'),
    ]) {
      await rawPut(repository, textEncoder.encode(changed));
      await expect(repository.readSnapshot()).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
    }
  });

  it('rejects a canonical K-329 checkpoint-6 state without eligibility evidence', async () => {
    const repository = await open(); const source = await buildTo(repository, 'source');
    const reduced = reduceWriterCoordination(source, action(source, verifier, { type: 'CAPTURE_BEFORE_ELIGIBILITY_COMMIT' }));
    expect(reduced.ok).toBe(true);
    if (!reduced.ok) throw new Error(reduced.code);
    const modelText = textDecoder.decode(encodeWriterCoordinationModelCanonical(reduced.state));
    await rawPut(repository, textEncoder.encode(JSON.stringify({
      kind: 'absinthe_dormant_writer_coordination_envelope', schemaVersion: 1,
      databaseNamespace: repository.namespaceKey, databaseGeneration: namespace.generationId,
      coordinationEpoch: reduced.state.authority.coordinationEpoch,
      transitionRevision: reduced.state.authority.transitionRevision,
      authorityDigest: deriveCoordinationAuthorityDigest(reduced.state.authority),
      canonicalModelDigest: sha256Hex(modelText), coordinationModel: JSON.parse(modelText),
    })));
    await expect(repository.readSnapshot()).rejects.toMatchObject({ code: 'WRITER_COORDINATION_MODEL_REJECTED' });
  });

  it.each(['source without checkpoint 5', 'checkpoint 5 without source', 'mixed revision graph'])
    ('rejects manually constructed partial persisted graph: %s', async (kind) => {
      const repository = await open(); const source = await buildTo(repository, 'source');
      const parsed = JSON.parse(textDecoder.decode(await unsafeEnvelope(source))) as {
        coordinationModel: WriterCoordinationModelState; canonicalModelDigest: string;
      } & Record<string, unknown>;
      if (kind === 'source without checkpoint 5') parsed.coordinationModel.checkpointChain =
        parsed.coordinationModel.checkpointChain.slice(0, 4);
      if (kind === 'checkpoint 5 without source') parsed.coordinationModel.sourceEvidence = null;
      if (kind === 'mixed revision graph') parsed.coordinationModel.authority.transitionRevision += 1;
      parsed.canonicalModelDigest = sha256Hex(JSON.stringify(parsed.coordinationModel));
      await rawPut(repository, textEncoder.encode(JSON.stringify(parsed)));
      await expect(repository.readSnapshot()).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
    });

  it('rejects canonical eligibility evidence without checkpoint 6 on repository restart', async () => {
    const repository = await open(); const eligible = await buildTo(repository, 'eligible');
    const parsed = JSON.parse(textDecoder.decode(await unsafeEnvelope(eligible))) as {
      coordinationModel: WriterCoordinationModelState; canonicalModelDigest: string;
    };
    parsed.coordinationModel.checkpointChain = parsed.coordinationModel.checkpointChain.slice(0, 5);
    parsed.canonicalModelDigest = sha256Hex(JSON.stringify(parsed.coordinationModel));
    await rawPut(repository, textEncoder.encode(JSON.stringify(parsed)));
    await expect(repository.readSnapshot()).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });

  it('rejects a canonical mixed-epoch registration graph on repository restart', async () => {
    const repository = await open(); const registered = await buildTo(repository, 'registered');
    const parsed = JSON.parse(textDecoder.decode(await unsafeEnvelope(registered))) as {
      coordinationModel: WriterCoordinationModelState; canonicalModelDigest: string;
    };
    parsed.coordinationModel.registrations[0].coordinationEpoch += 1;
    parsed.canonicalModelDigest = sha256Hex(JSON.stringify(parsed.coordinationModel));
    await rawPut(repository, textEncoder.encode(JSON.stringify(parsed)));
    await expect(repository.readSnapshot()).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });
});

describe('K-330 repository lifecycle and CAS', () => {
  it('persists registration and returns a detached restart snapshot', async () => {
    const repository = await open(); let state = await initialize(repository); const record = registration(0);
    state = await repository.registerWriter({
      action: action(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId },
        { type: 'REGISTER_WRITER', registration: record }) as never,
      cas: cas(state),
    });
    state.registrations[0].lastSeenSequence = 999;
    const snapshot = await repository.readSnapshot();
    expect(snapshot).toMatchObject({ status: 'valid', state: { registrations: [{ writerId: record.writerId }] } });
  });

  it.each([
    ['generation', { databaseGeneration: 'generation-other' }, 'WRITER_COORDINATION_GENERATION_MISMATCH'],
    ['epoch', { coordinationEpoch: 2 }, 'WRITER_COORDINATION_EPOCH_MISMATCH'],
    ['revision', { transitionRevision: 1 }, 'WRITER_COORDINATION_REVISION_MISMATCH'],
    ['authority', { authorityDigest: OTHER }, 'WRITER_COORDINATION_AUTHORITY_MISMATCH'],
    ['checkpoint', { previousCheckpointDigest: OTHER }, 'WRITER_COORDINATION_CHECKPOINT_PREDECESSOR_MISMATCH'],
  ])('rejects stale %s CAS without changing bytes', async (_label, override, code) => {
    const repository = await open(); const state = await initialize(repository); const before = await repository.readSnapshot();
    await expect(repository.applyAction({
      action: action(state, coordinator, { type: 'ABORT', failureCode: null }), cas: cas(state, override),
    })).rejects.toMatchObject({ code });
    expect(await repository.readSnapshot()).toEqual(before);
  });

  it('rejects accessor-backed CAS evidence without invoking it', async () => {
    const repository = await open(); const state = await initialize(repository); let accessed = false;
    const unsafe = cas(state) as DormantWriterCoordinationCas;
    Object.defineProperty(unsafe, 'authorityDigest', {
      enumerable: true,
      get: () => { accessed = true; return deriveCoordinationAuthorityDigest(state.authority); },
    });
    await expect(repository.applyAction({
      action: action(state, coordinator, { type: 'ABORT', failureCode: null }), cas: unsafe,
    })).rejects.toMatchObject({ code: 'WRITER_COORDINATION_REVISION_MISMATCH' });
    expect(accessed).toBe(false);
  });

  it('detaches mutable CAS evidence before the transactional comparison', async () => {
    const repository = await open(); const state = await initialize(repository); const record = registration(0);
    const valid = cas(state);
    const accepted = repository.registerWriter({
      action: action(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId },
        { type: 'REGISTER_WRITER', registration: record }) as never,
      cas: valid,
    });
    Object.assign(valid, {
      databaseGeneration: 'generation-mutated', coordinationEpoch: 99,
      transitionRevision: 99, authorityDigest: OTHER,
    });
    await expect(accepted).resolves.toMatchObject({ registrations: [{ writerId: record.writerId }] });

    const current = (await repository.readSnapshot());
    if (current.status !== 'valid') throw new Error('expected persisted coordination state');
    const stale = { ...current.cas, transitionRevision: current.cas.transitionRevision - 1 };
    const rejected = repository.applyAction({
      action: action(current.state, coordinator, { type: 'ABORT', failureCode: null }), cas: stale,
    });
    Object.assign(stale, current.cas);
    await expect(rejected).rejects.toMatchObject({ code: 'WRITER_COORDINATION_REVISION_MISMATCH' });
  });

  it('rejects unknown and duplicate writer identities through the K-329 reducer', async () => {
    const repository = await open(); let state = await initialize(repository);
    const unknown = registration(0, {
      writerTypeId: 'unknown.writer',
      writerId: `writer-v1:window:unknown.writer:${nonce(1, 32)}`,
    });
    await expect(repository.registerWriter({
      action: action(state, { kind: 'writer', writerId: unknown.writerId, sessionId: unknown.sessionId },
        { type: 'REGISTER_WRITER', registration: unknown }) as never, cas: cas(state),
    })).rejects.toMatchObject({ code: 'WRITER_COORDINATION_MODEL_REJECTED', modelCode: 'UNKNOWN_WRITER_PRESENT' });
    const record = registration(0);
    state = await repository.registerWriter({
      action: action(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId },
        { type: 'REGISTER_WRITER', registration: record }) as never, cas: cas(state),
    });
    const duplicate = registration(1, { writerTypeId: record.writerTypeId, contextType: record.contextType,
      capabilities: record.capabilities, writerId: record.writerId });
    await expect(repository.registerWriter({
      action: action(state, { kind: 'writer', writerId: duplicate.writerId, sessionId: duplicate.sessionId },
        { type: 'REGISTER_WRITER', registration: duplicate }) as never, cas: cas(state),
    })).rejects.toMatchObject({ modelCode: 'DUPLICATE_WRITER_IDENTITY' });
  });

  it('admits, idempotently retries, terminalizes, and rejects conflicting terminalization', async () => {
    const repository = await open(); let state = await initialize(repository); const record = registration(0);
    state = await repository.registerWriter({
      action: action(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId },
        { type: 'REGISTER_WRITER', registration: record }) as never, cas: cas(state),
    });
    const admitted = operation(record, state);
    state = await repository.admitOperation({
      action: action(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId },
        { type: 'ADMIT_OPERATION', operation: admitted }) as never, cas: cas(state),
    });
    const retryAction = action(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId },
      { type: 'ADMIT_OPERATION', operation: admitted }) as Extract<WriterCoordinationAction, { type: 'ADMIT_OPERATION' }>;
    const retried = await repository.admitOperation({ action: retryAction, cas: cas(state) });
    expect(retried.authority.transitionRevision).toBe(state.authority.transitionRevision);
    state = await repository.transitionOperation({
      action: action(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId }, {
        type: 'TERMINALIZE_OPERATION', operationId: admitted.operationId,
        result: 'committed', committedSourceRevision: '41',
      }) as never,
      cas: cas(state, { expectedOperationState: 'admitted' }),
    });
    await expect(repository.transitionOperation({
      action: action(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId }, {
        type: 'TERMINALIZE_OPERATION', operationId: admitted.operationId,
        result: 'failed', committedSourceRevision: null,
      }) as never,
      cas: cas(state, { expectedOperationState: 'admitted' }),
    })).rejects.toMatchObject({ code: 'WRITER_COORDINATION_OPERATION_STATE_MISMATCH' });
    const reopened = await repository.readSnapshot();
    expect(reopened).toMatchObject({ status: 'valid', state: { operations: [{ state: 'committed' }] } });
  });

  it('stores source evidence with checkpoint 5 and eligibility with checkpoint 6 atomically', async () => {
    const repository = await open(); const source = await buildTo(repository, 'source');
    expect(source).toMatchObject({ checkpointChain: { length: 5 }, sourceEvidence: { revisionAfter: '41' } });
    const eligible = await repository.storeEligibilityEvidenceAtomically({
      actor: verifier,
      cas: cas(source, {
        previousCheckpointDigest: source.checkpointChain[4].checkpointDigest,
        expectedSourceRevision: '41',
      }),
    });
    expect(eligible).toMatchObject({ authority: { state: 'ELIGIBLE' }, checkpointChain: { length: 6 },
      eligibilityEvidence: { result: 'eligible', k328PhysicalSourceDigest: PHYSICAL } });
    repository.close();
    const reopened = await open();
    await expect(reopened.readSnapshot()).resolves.toMatchObject({ status: 'valid', state: {
      authority: { state: 'ELIGIBLE' }, checkpointChain: { length: 6 }, eligibilityEvidence: { result: 'eligible' },
    } });
  });

  it('does not let the generic action API bypass checkpoint CAS', async () => {
    const repository = await open(); const registered = await buildTo(repository, 'registered');
    await expect(repository.applyAction({
      action: action(registered, coordinator, { type: 'CAPTURE_BEFORE_DRAIN' }), cas: cas(registered),
    })).rejects.toMatchObject({ code: 'WRITER_COORDINATION_CHECKPOINT_PREDECESSOR_MISMATCH' });
  });

  it('does not let the generic action API persist checkpoint 6 without eligibility', async () => {
    const repository = await open(); const source = await buildTo(repository, 'source');
    await expect(repository.applyAction({
      action: action(source, verifier, { type: 'CAPTURE_BEFORE_ELIGIBILITY_COMMIT' }),
      cas: cas(source, { previousCheckpointDigest: source.checkpointChain[4].checkpointDigest,
        expectedSourceRevision: '41' }),
    })).rejects.toMatchObject({ code: 'WRITER_COORDINATION_MODEL_REJECTED' });
  });

  it('rejects stale source revision and wrong K-328 evidence without persisting it', async () => {
    const repository = await open(); const verifying = await buildTo(repository, 'verifying');
    const sourceAction = action(verifying, verifier, {
      type: 'CAPTURE_SOURCE_EVIDENCE', observation: observation(),
    }) as Extract<WriterCoordinationAction, { type: 'CAPTURE_SOURCE_EVIDENCE' }>;
    await expect(repository.storeSourceEvidence({ action: sourceAction, cas: cas(verifying, {
      previousCheckpointDigest: verifying.checkpointChain[3].checkpointDigest,
      expectedSourceRevision: '40',
    }) })).rejects.toMatchObject({ code: 'WRITER_COORDINATION_SOURCE_REVISION_MISMATCH' });
    const wrongAction = action(verifying, verifier, {
      type: 'CAPTURE_SOURCE_EVIDENCE', observation: observation({ k328PhysicalSourceDigest: OTHER }),
    }) as Extract<WriterCoordinationAction, { type: 'CAPTURE_SOURCE_EVIDENCE' }>;
    await expect(repository.storeSourceEvidence({ action: wrongAction, cas: cas(verifying, {
      previousCheckpointDigest: verifying.checkpointChain[3].checkpointDigest,
      expectedSourceRevision: '41',
    }) })).rejects.toMatchObject({ modelCode: 'K328_PHYSICAL_IDENTITY_MISMATCH' });
    await expect(repository.readSnapshot()).resolves.toMatchObject({ status: 'valid', state: {
      checkpointChain: { length: 4 }, sourceEvidence: null,
    } });
  });

  it('allows only test-capability validated whole-envelope replacement with exact CAS', async () => {
    const repository = await open(); const state = await initialize(repository);
    const replacement = reduceWriterCoordination(state, action(state, coordinator, {
      type: 'ABORT', failureCode: null,
    }));
    expect(replacement.ok).toBe(true);
    if (!replacement.ok) throw new Error(replacement.code);
    const replaced = await repository.replaceValidatedSnapshotForTest({ state: replacement.state, cas: cas(state) });
    expect(replaced.authority.state).toBe('ABORTED');
    await expect(repository.replaceValidatedSnapshotForTest({ state, cas: cas(state) }))
      .rejects.toMatchObject({ code: 'WRITER_COORDINATION_REVISION_MISMATCH' });
    const developer = await open({ developer: true });
    await expect(developer.replaceValidatedSnapshotForTest({ state: replacement.state, cas: cas(replaced) }))
      .rejects.toMatchObject({ code: 'DORMANT_WRITER_COORDINATION_CAPABILITY_REQUIRED' });
  });

  it('aborts test-only replacement without exposing any part of the replacement', async () => {
    const repository = await open(); const state = await initialize(repository);
    const replacement = reduceWriterCoordination(state, action(state, coordinator, {
      type: 'ABORT', failureCode: null,
    }));
    expect(replacement.ok).toBe(true);
    if (!replacement.ok) throw new Error(replacement.code);
    const before = await repository.readSnapshot();
    await expect(repository.replaceValidatedSnapshotForTest({
      state: replacement.state, cas: cas(state), failurePointForTest: 'after_write_request',
    })).rejects.toMatchObject({ code: 'DORMANT_WRITER_COORDINATION_TRANSACTION_ABORTED' });
    repository.close();
    const reopened = await open();
    await expect(reopened.readSnapshot()).resolves.toEqual(before);
  });
});

describe('K-330 transaction and deterministic concurrency evidence', () => {
  it('aborts initialization and mutation writes without partial visibility', async () => {
    const repository = await open();
    await expect(repository.initialize({
      expectedDatabaseGeneration: namespace.generationId, physicalSourceDigest: PHYSICAL,
      coordinatorSessionId: COORDINATOR, verifierSessionId: VERIFIER, recoverySessionId: RECOVERY,
      failurePointForTest: 'after_write_request',
    })).rejects.toMatchObject({ code: 'DORMANT_WRITER_COORDINATION_TRANSACTION_ABORTED' });
    expect(await repository.readSnapshot()).toEqual({ status: 'empty' });
    const state = await initialize(repository); const record = registration(0);
    await expect(repository.registerWriter({
      action: action(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId },
        { type: 'REGISTER_WRITER', registration: record }) as never,
      cas: cas(state), failurePointForTest: 'after_write_request',
    })).rejects.toMatchObject({ code: 'DORMANT_WRITER_COORDINATION_TRANSACTION_ABORTED' });
    await expect(repository.readSnapshot()).resolves.toMatchObject({ status: 'valid', state: { registrations: [] } });
  });

  it('does not expose source/checkpoint or eligibility/checkpoint partial commits after abort', async () => {
    const repository = await open(); const verifying = await buildTo(repository, 'verifying');
    await expect(repository.storeSourceEvidence({
      action: action(verifying, verifier, {
        type: 'CAPTURE_SOURCE_EVIDENCE', observation: observation(),
      }) as never,
      cas: cas(verifying, { previousCheckpointDigest: verifying.checkpointChain[3].checkpointDigest,
        expectedSourceRevision: '41' }),
      failurePointForTest: 'after_write_request',
    })).rejects.toMatchObject({ code: 'DORMANT_WRITER_COORDINATION_TRANSACTION_ABORTED' });
    await expect(repository.readSnapshot()).resolves.toMatchObject({ status: 'valid', state: {
      checkpointChain: { length: 4 }, sourceEvidence: null,
    } });
    const source = await repository.storeSourceEvidence({
      action: action(verifying, verifier, {
        type: 'CAPTURE_SOURCE_EVIDENCE', observation: observation(),
      }) as never,
      cas: cas(verifying, { previousCheckpointDigest: verifying.checkpointChain[3].checkpointDigest,
        expectedSourceRevision: '41' }),
    });
    await expect(repository.storeEligibilityEvidenceAtomically({
      actor: verifier,
      cas: cas(source, { previousCheckpointDigest: source.checkpointChain[4].checkpointDigest,
        expectedSourceRevision: '41' }),
      failurePointForTest: 'after_write_request',
    })).rejects.toMatchObject({ code: 'DORMANT_WRITER_COORDINATION_TRANSACTION_ABORTED' });
    await expect(repository.readSnapshot()).resolves.toMatchObject({ status: 'valid', state: {
      checkpointChain: { length: 5 }, eligibilityEvidence: null,
    } });
  });

  it('allows exactly one concurrent registration CAS winner across two contexts', async () => {
    const first = await open(); const second = await open(); const state = await initialize(first);
    const one = registration(0); const two = registration(1);
    const results = await Promise.allSettled([
      first.registerWriter({ action: action(state, { kind: 'writer', writerId: one.writerId, sessionId: one.sessionId },
        { type: 'REGISTER_WRITER', registration: one }) as never, cas: cas(state) }),
      second.registerWriter({ action: action(state, { kind: 'writer', writerId: two.writerId, sessionId: two.sessionId },
        { type: 'REGISTER_WRITER', registration: two }) as never, cas: cas(state) }),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')[0]).toMatchObject({
      reason: { code: 'WRITER_COORDINATION_REVISION_MISMATCH' },
    });
    const snapshot = await first.readSnapshot();
    expect(snapshot).toMatchObject({ status: 'valid', state: { registrations: { length: 1 } } });
  });

  it.each(['same writer/session', 'same writer ID with a new session'])
    ('serializes concurrent registration identity collision: %s', async (variant) => {
      const first = await open(); const second = await open(); const state = await initialize(first);
      const one = registration(0);
      const two = variant === 'same writer/session' ? one : registration(0, {
        writerId: one.writerId, sessionId: `writer-session-v1:${nonce(999, 32)}`,
      });
      const inputs = [one, two].map((record, index) => (index === 0 ? first : second).registerWriter({
        action: action(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId },
          { type: 'REGISTER_WRITER', registration: record }) as never,
        cas: cas(state),
      }));
      const results = await Promise.allSettled(inputs);
      expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter(result => result.status === 'rejected')[0])
        .toMatchObject({ reason: { code: 'WRITER_COORDINATION_REVISION_MISMATCH' } });
    });

  it('allows exactly one concurrent operation admission and checkpoint capture winner', async () => {
    const first = await open(); const second = await open(); let state = await initialize(first); const record = registration(0);
    state = await first.registerWriter({
      action: action(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId },
        { type: 'REGISTER_WRITER', registration: record }) as never, cas: cas(state),
    });
    const admissions = await Promise.allSettled([0, 1].map(index => {
      const value = operation(record, state, index);
      return (index === 0 ? first : second).admitOperation({
        action: action(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId },
          { type: 'ADMIT_OPERATION', operation: value }) as never,
        cas: cas(state),
      });
    }));
    expect(admissions.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(admissions.filter(result => result.status === 'rejected')[0])
      .toMatchObject({ reason: { code: 'WRITER_COORDINATION_REVISION_MISMATCH' } });

    await deleteDatabase().catch(() => undefined);
    repositories.splice(0).forEach(repository => repository.close());
    const checkpointFirst = await open(); const checkpointSecond = await open();
    state = await registerAll(checkpointFirst, await initialize(checkpointFirst));
    const checkpointAction = action(state, coordinator, { type: 'CAPTURE_BEFORE_DRAIN' }) as never;
    const checkpoints = await Promise.allSettled([
      checkpointFirst.captureCheckpoint({ action: checkpointAction, cas: cas(state, { previousCheckpointDigest: null }) }),
      checkpointSecond.captureCheckpoint({ action: checkpointAction, cas: cas(state, { previousCheckpointDigest: null }) }),
    ]);
    expect(checkpoints.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(checkpoints.filter(result => result.status === 'rejected')[0])
      .toMatchObject({ reason: { code: 'WRITER_COORDINATION_REVISION_MISMATCH' } });
  });

  it('allows exactly one source and eligibility commit winner', async () => {
    const first = await open(); const second = await open(); const verifying = await buildTo(first, 'verifying');
    const sourceInput = {
      action: action(verifying, verifier, { type: 'CAPTURE_SOURCE_EVIDENCE', observation: observation() }) as never,
      cas: cas(verifying, { previousCheckpointDigest: verifying.checkpointChain[3].checkpointDigest,
        expectedSourceRevision: '41' }),
    };
    const sources = await Promise.allSettled([first.storeSourceEvidence(sourceInput), second.storeSourceEvidence(sourceInput)]);
    expect(sources.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(sources.filter(result => result.status === 'rejected')[0])
      .toMatchObject({ reason: { code: 'WRITER_COORDINATION_REVISION_MISMATCH' } });
    const source = (sources.find(result => result.status === 'fulfilled') as PromiseFulfilledResult<WriterCoordinationModelState>).value;
    const eligibilityInput = { actor: verifier, cas: cas(source, {
      previousCheckpointDigest: source.checkpointChain[4].checkpointDigest, expectedSourceRevision: '41',
    }) };
    const eligibility = await Promise.allSettled([
      first.storeEligibilityEvidenceAtomically(eligibilityInput),
      second.storeEligibilityEvidenceAtomically(eligibilityInput),
    ]);
    expect(eligibility.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(eligibility.filter(result => result.status === 'rejected')[0])
      .toMatchObject({ reason: { code: 'WRITER_COORDINATION_REVISION_MISMATCH' } });
  });

  it('fences an epoch transition racing a late registration', async () => {
    const first = await open(); const second = await open(); const draining = await buildTo(first, 'draining');
    const late = registration(participating.length + 10);
    const results = await Promise.allSettled([
      first.transitionEpoch({ action: action(draining, coordinator, { type: 'MARK_QUIESCENT' }) as never,
        cas: cas(draining) }),
      second.registerWriter({ action: action(draining, {
        kind: 'writer', writerId: late.writerId, sessionId: late.sessionId,
      }, { type: 'REGISTER_WRITER', registration: late }) as never, cas: cas(draining) }),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const snapshot = await first.readSnapshot();
    expect(snapshot).toMatchObject({ status: 'valid', state: { authority: { coordinationEpoch: 2 } } });
  });

  it('keeps generation keys isolated and rejects a stale generation token', async () => {
    const generationOne = await open(); const stateOne = await initialize(generationOne);
    const otherNamespace = { ...namespace, generationId: 'generation-k330-next' };
    const generationTwo = await open({ scope: otherNamespace });
    const stateTwo = await generationTwo.initialize({
      expectedDatabaseGeneration: otherNamespace.generationId, physicalSourceDigest: PHYSICAL,
      coordinatorSessionId: COORDINATOR, verifierSessionId: VERIFIER, recoverySessionId: RECOVERY,
    });
    await expect(generationTwo.applyAction({
      action: action(stateTwo, coordinator, { type: 'ABORT', failureCode: null }),
      cas: { ...cas(stateTwo), databaseGeneration: namespace.generationId },
    })).rejects.toMatchObject({ code: 'WRITER_COORDINATION_GENERATION_MISMATCH' });
    await expect(generationOne.readSnapshot()).resolves.toMatchObject({ status: 'valid', state: stateOne });
    await expect(generationTwo.readSnapshot()).resolves.toMatchObject({ status: 'valid', state: stateTwo });
  });

  it('limits failure injection to the test capability', async () => {
    const repository = await open({ developer: true });
    await expect(repository.initialize({
      expectedDatabaseGeneration: namespace.generationId, physicalSourceDigest: PHYSICAL,
      coordinatorSessionId: COORDINATOR, verifierSessionId: VERIFIER, recoverySessionId: RECOVERY,
      failurePointForTest: 'after_write_request',
    })).rejects.toMatchObject({ code: 'DORMANT_WRITER_COORDINATION_CAPABILITY_REQUIRED' });
  });
});

async function sourceFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...await sourceFiles(path));
    else if (/\.(?:ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.tsx')) {
      result.push(path);
    }
  }
  return result;
}

describe('K-330 production dormancy audit', () => {
  it('has no caller outside the isolated dormant repository', async () => {
    const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
    const sourceRoot = join(frontendRoot, 'src');
    const references: string[] = [];
    for (const path of await sourceFiles(sourceRoot)) {
      const local = relative(sourceRoot, path).replaceAll('\\', '/');
      if (local === 'lib/localDatabase/dormantWriterCoordinationRepository.ts') continue;
      const content = await readFile(path, 'utf8');
      if (content.includes('openDormantWriterCoordinationDatabase')
        || content.includes('createDormantWriterCoordinationCapability')) references.push(local);
    }
    expect(references).toEqual([]);
  });

  it('does not import production writers, K-328, UI, network, timers, or workers', async () => {
    const content = await readFile(fileURLToPath(new URL('./dormantWriterCoordinationRepository.ts', import.meta.url)), 'utf8');
    for (const forbidden of [
      'notePersistence', 'noteIndexedDb', 'crossContextHandoff', 'localFirstCutover', 'legacyNotesMigration',
      '@supabase', 'fetch(', 'XMLHttpRequest', 'WebSocket(', 'navigator.locks', 'setInterval(',
      'Worker(', 'ServiceWorker', 'react',
    ]) expect(content, forbidden).not.toContain(forbidden);
  });

  it('keeps K-326G fail-closed and does not clear or delete existing stores', async () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
    const migration = await readFile(join(root, 'src/lib/localDatabase/legacyNotesMigration.ts'), 'utf8');
    expect(migration.match(/mutationSafety: 'uncoordinated_legacy_writers', crossContextSafe: false/g)).toHaveLength(2);
    const cutover = await readFile(join(root, 'src/lib/localDatabase/localFirstCutover.ts'), 'utf8');
    expect(cutover).toContain("if (!safety.crossContextSafe) fail('CUTOVER_SOURCE_NOT_CROSS_CONTEXT_SAFE'");
    const repository = await readFile(fileURLToPath(new URL('./dormantWriterCoordinationRepository.ts', import.meta.url)), 'utf8');
    expect(repository).not.toContain('.clear(');
    expect(repository).not.toContain('deleteDatabase(');
  });
});
