// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { IDBFactory, IDBIndex as FakeIDBIndex } from 'fake-indexeddb';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeLocalDatabase, createDormantLocalDatabaseCapability, hashCanonicalPayload, openLocalDatabase,
  LocalDatabaseError, LOCAL_DATABASE_NAME, LOCAL_DATABASE_STORES,
  type LocalDatabaseRepository, type LocalEntityEnvelope,
} from '../../../../lib/localDatabase';
import {
  HEALTH_ROUTINE_DEVICE_ID_KEY, HEALTH_ROUTINE_GENERATION_ID, HEALTH_ROUTINE_PROJECT_REF,
} from '../../../../lib/workoutLocalReaderAuthority';
import { WorkoutSessionRepository, WORKOUT_SESSION_DOMAIN } from '../../../../lib/workoutSessionRepository';
import type { WorkoutSessionV1 } from '../../../../lib/workoutSessionV1';
import { WorkoutSelectedDayReader } from '../../../../lib/workoutSelectedDayReader';
import { WorkoutRangeReader } from '../../../../lib/workoutRangeReader';
import { CompositeWorkoutReadIsolationError } from './compositeWorkoutReadProjection';
import type { VerifiedSelectedDayLegacySnapshot } from './selectedDayLegacySnapshot';
import { useHealthSelectedDayComposite, type HealthSelectedDayReadModel } from './useHealthSelectedDayComposite';

// The canonical path is actual IDB -> LocalDatabase -> WorkoutSessionRepository
// -> reader -> B1. ONLY the healthy legacy loader and bootstrap event are controlled;
// this is not evidence of persisted legacy owner qualification or physical-browser QA.
const mocks = vi.hoisted(() => ({ legacy: vi.fn() }));
vi.mock('./selectedDayLegacySnapshot', () => ({ loadVerifiedSelectedDayLegacySnapshot: mocks.legacy }));
vi.mock('../../../../lib/healthSupabaseBootstrap', () => ({
  HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT: 'selected-day-persisted-test-bootstrap',
}));

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const FOREIGN = '22222222-2222-4222-8222-222222222222';
const DEVICE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SESSION = '33333333-3333-4333-8333-333333333333';
const DATE = '2026-10-09';
const PRIVATE = 'REJECTED_CANONICAL_PRIVATE_SENTINEL';
const LEGACY = 'CONTROLLED_HEALTHY_LEGACY_SENTINEL';
let db: LocalDatabaseRepository;
let root: Root | null;
let host: HTMLDivElement;
let latest: HealthSelectedDayReadModel;
const publications: HealthSelectedDayReadModel[] = [];

function session(): WorkoutSessionV1 {
  return { version: 1, id: SESSION, localDate: DATE, entries: [{
    id: '44444444-4444-4444-8444-444444444444',
    exercise: { id: 'squat', name: PRIVATE, type: 'strength', tags: [], cardioMode: null },
    sets: [{ id: '55555555-5555-4555-8555-555555555555', ordinal: 1, kind: 'strength',
      loadKind: 'external_weight', weightKg: '20', sourceValue: '20', sourceUnit: 'kg',
      reps: 8, assistedReps: null, dropset: false, done: true }],
  }] };
}

function healthyLegacy(): VerifiedSelectedDayLegacySnapshot {
  const block = { id: 'legacy-squat', name: LEGACY, type: 'strength', tags: [] };
  const sets = [{ set: 1, type: 'strength' as const, kg: 15, reps: 6, done: true }];
  return {
    daily: { workouts: [{ id: 'legacy-row', block_id: block.id, exercise_blocks: block, sets }],
      inbody: { weight: null, smm: null, pbf: null }, routines: [] },
    persistedRows: [{ accountId: ACCOUNT, rowId: 'legacy-row', localDate: DATE,
      blockId: block.id, sortOrder: 0, exerciseDisplay: { kind: 'current_catalog', block }, sets }],
  };
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(tx.error);
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}

async function persistPatch(patch: Partial<LocalEntityEnvelope<WorkoutSessionV1>>) {
  const raw = await requestValue(indexedDB.open(LOCAL_DATABASE_NAME));
  try {
    const tx = raw.transaction(LOCAL_DATABASE_STORES.entities, 'readwrite');
    const done = transactionDone(tx);
    const store = tx.objectStore(LOCAL_DATABASE_STORES.entities);
    const previous = await requestValue(store.get([
      db.namespaceKey, db.namespace.generationId, WORKOUT_SESSION_DOMAIN, SESSION,
    ]));
    expect(previous.record).toEqual(session());
    const candidate = { ...previous, ...patch } as LocalEntityEnvelope<WorkoutSessionV1>;
    store.put(candidate);
    await done;
    const read = raw.transaction(LOCAL_DATABASE_STORES.entities, 'readonly');
    const readDone = transactionDone(read);
    const persisted = await requestValue(read.objectStore(LOCAL_DATABASE_STORES.entities).get([
      candidate.namespaceKey, candidate.generationId, candidate.domain, candidate.entityId,
    ]));
    await readDone;
    expect(persisted).toEqual(candidate);
    return persisted as LocalEntityEnvelope<WorkoutSessionV1>;
  } finally { raw.close(); }
}

/** Same defensive driver boundary as D0/C14 tests: never stub a repository error,
 * reader result or isolation DTO. Normal compound-key/index routing excludes wrong
 * namespace/generation (proved separately). Inject their READ-BACK persisted candidate
 * into the real request response, before actual repository scope/content validation.
 * null models loss of the enclosing envelope at this boundary, NOT a null physically
 * stored in the compound-key entity store (IDB cannot persist such a value there). */
function faultScan(candidate: LocalEntityEnvelope<WorkoutSessionV1> | null) {
  const original = FakeIDBIndex.prototype.getAll;
  const reached = vi.fn();
  vi.spyOn(FakeIDBIndex.prototype, 'getAll').mockImplementation(function (this: IDBIndex, ...args) {
    const request = original.apply(this, args);
    if (this.objectStore.name === LOCAL_DATABASE_STORES.entities && this.name === 'by_namespace_generation_domain') {
      request.addEventListener('success', () => {
        if (candidate === null) {
          expect(request.result).toHaveLength(1);
          expect(request.result[0].record).toEqual(session());
          request.result.splice(0, 1, null);
        } else request.result.push(structuredClone(candidate));
        reached();
      });
    }
    return request;
  });
  return reached;
}

const scopeCases = [
  ['account', 'ACCOUNT_MISMATCH', 'ACCOUNT_MISMATCH'],
  ['namespace', 'NAMESPACE_MISMATCH', 'NAMESPACE_MISMATCH'],
  ['generation', 'GENERATION_MISMATCH', 'GENERATION_MISMATCH'],
  ['untrusted response envelope', 'UNTRUSTED_SCOPE', 'INVALID_CONTEXT'],
] as const;
type ScopeKind = typeof scopeCases[number][0];

async function contaminate(kind: ScopeKind) {
  if (kind === 'account') {
    // Change ONLY ownership. Requested key/scope/domain/content stay identical.
    await persistPatch({ accountId: FOREIGN });
    return null;
  }
  if (kind === 'untrusted response envelope') return faultScan(null);
  const candidate = await persistPatch(kind === 'namespace'
    ? { namespaceKey: `${db.namespaceKey}:foreign` } : { generationId: 'foreign-generation' });
  return faultScan(candidate);
}

function noPrivate(value: unknown) {
  expect(JSON.stringify(value instanceof Error ? { ...value, message: value.message, stack: value.stack } : value))
    .not.toContain(PRIVATE);
}

async function readerErrors() {
  const selected = await WorkoutSelectedDayReader.open(ACCOUNT, localStorage);
  const range = await WorkoutRangeReader.open(ACCOUNT, localStorage);
  try {
    return [await selected.read(DATE).catch((error: unknown) => error),
      await range.readAllActive().catch((error: unknown) => error)];
  } finally { selected.close(); range.close(); }
}

async function settle() {
  await vi.waitFor(async () => {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
    expect(latest.phase).toBe('settled');
  });
}

async function mount() {
  function Harness() {
    latest = useHealthSelectedDayComposite(true, ACCOUNT, DATE, { managedLifecycle: true });
    publications.push(latest);
    return null;
  }
  await act(async () => { root = createRoot(host); root.render(createElement(Harness)); });
  await settle();
}

const ordinaryCases = ['invalid envelope revision', 'invalid record hash', 'invalid V1 with valid envelope hash'] as const;
async function corruptContent(kind: typeof ordinaryCases[number]) {
  if (kind === 'invalid envelope revision') await persistPatch({ revision: 0 });
  else {
    const invalid = { ...session(), entries: [] };
    await persistPatch({ record: invalid,
      ...(kind === 'invalid V1 with valid envelope hash' ? { contentHash: hashCanonicalPayload(invalid) } : {}) });
  }
}

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('indexedDB', new IDBFactory());
  localStorage.clear(); localStorage.setItem(HEALTH_ROUTINE_DEVICE_ID_KEY, DEVICE);
  db = await openLocalDatabase({ userId: ACCOUNT, deviceId: DEVICE, projectRef: HEALTH_ROUTINE_PROJECT_REF,
    generationId: HEALTH_ROUTINE_GENERATION_ID, schemaVersion: 1 },
  { capability: createDormantLocalDatabaseCapability('test') });
  await db.initializeNamespace();
  await new WorkoutSessionRepository(db).createWorkoutSession(session());
  mocks.legacy.mockReset().mockResolvedValue(healthyLegacy());
  root = null; publications.length = 0;
  host = document.createElement('div'); document.body.appendChild(host);
});
afterEach(() => {
  act(() => root?.unmount()); host.remove(); closeLocalDatabase(db);
  vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear();
});

describe('selected-day real persisted validation and range parity', () => {
  it('reads the valid nonempty persisted session through both real readers', async () => {
    const selected = await WorkoutSelectedDayReader.open(ACCOUNT, localStorage);
    const range = await WorkoutRangeReader.open(ACCOUNT, localStorage);
    try {
      expect((await selected.read(DATE))[0]?.session).toEqual(session());
      expect((await range.readAllActive())[0]?.session).toEqual(session());
    } finally { selected.close(); range.close(); }
  });

  it.each(scopeCases)('promotes %s from actual repository validation in BOTH readers', async (kind, detail, code) => {
    const reached = await contaminate(kind);
    const rawError = await new WorkoutSessionRepository(db).listWorkoutSessions().catch((error: unknown) => error);
    expect(rawError).toBeInstanceOf(LocalDatabaseError);
    expect(rawError).toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD', persistedEntityFailure: detail });
    noPrivate(rawError);
    // These errors arise before the selected-day date filter and manual returned-row checks.
    for (const error of await readerErrors()) {
      expect(error).toBeInstanceOf(CompositeWorkoutReadIsolationError);
      expect(error).toMatchObject({ code }); noPrivate(error);
    }
    if (reached) expect(reached).toHaveBeenCalledTimes(3);
  });

  it.each(['namespace', 'generation'] as const)('normally excludes a physically persisted foreign %s tuple', async kind => {
    await persistPatch(kind === 'namespace'
      ? { namespaceKey: `${db.namespaceKey}:foreign` } : { generationId: 'foreign-generation' });
    // The original valid tuple remains, because patching an indexed key adds another row.
    const selected = await WorkoutSelectedDayReader.open(ACCOUNT, localStorage);
    const range = await WorkoutRangeReader.open(ACCOUNT, localStorage);
    try {
      expect(await selected.read(DATE)).toHaveLength(1);
      expect(await range.readAllActive()).toHaveLength(1);
    } finally { selected.close(); range.close(); }
  });

  it.each(ordinaryCases)('keeps trusted-scope %s ordinary in both readers', async kind => {
    await corruptContent(kind);
    for (const error of await readerErrors()) {
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(CompositeWorkoutReadIsolationError);
      if (kind !== 'invalid V1 with valid envelope hash') expect(error).toMatchObject({
        code: 'CORRUPT_PERSISTED_RECORD', persistedEntityFailure: 'INVALID_ENTITY',
      });
      else expect(error).toMatchObject({ message: 'workout_session_invalid' });
      noPrivate(error);
    }
  });

  // Supplemental passthrough controls ONLY; these injected errors are NOT the
  // persisted-path proof above. Preserve original object identity for ordinary I/O
  // and unclassified corruption, even if an unrelated code carries a scope detail.
  it.each([
    new LocalDatabaseError('CORRUPT_PERSISTED_RECORD', 'test-unclassified'),
    new LocalDatabaseError('CORRUPT_PERSISTED_RECORD', 'test-content', 'INVALID_ENTITY'),
    new LocalDatabaseError('TRANSACTION_FAILED', 'test-io', 'ACCOUNT_MISMATCH'),
    new Error('ordinary-io-failure'),
  ])('passes through ordinary/unclassified error %# unchanged', async error => {
    vi.spyOn(WorkoutSessionRepository.prototype, 'listWorkoutSessions').mockRejectedValue(error);
    for (const result of await readerErrors()) expect(result).toBe(error);
  });
});

describe('B1 actual canonical persistence + controlled healthy legacy', () => {
  it.each(scopeCases)('withholds the whole pair/editor for %s, including retry', async (kind) => {
    await contaminate(kind); await mount();
    expect(mocks.legacy).toHaveBeenCalledWith(ACCOUNT, DATE);
    expect(latest).toMatchObject({ phase: 'settled', result: null, legacyDaily: null, isolationError: true });
    await act(async () => latest.retry()); await settle();
    expect(latest).toMatchObject({ phase: 'settled', result: null, legacyDaily: null, isolationError: true });
    for (const model of publications) {
      expect(model.result).toBeNull(); expect(model.legacyDaily).toBeNull();
      noPrivate(model); expect(JSON.stringify(model)).not.toContain(LEGACY);
    }
  });

  it.each(ordinaryCases)('retains nonempty qualified legacy partial for trusted-scope %s', async kind => {
    await corruptContent(kind); await mount();
    expect(latest).toMatchObject({ phase: 'settled', isolationError: false,
      result: { status: 'partial_data', legacyStatus: 'success', canonicalStatus: 'error' } });
    expect(latest.legacyDaily).toEqual(healthyLegacy().daily);
    expect(latest.result?.records).toHaveLength(1);
    expect(latest.result?.records[0]?.source).toBe('legacy');
    expect(JSON.stringify(latest.result)).toContain(LEGACY);
    publications.forEach(noPrivate);
  });

  it('recovers on manual retry after the persisted ownership is restored by the TEST fixture', async () => {
    await persistPatch({ accountId: FOREIGN }); await mount();
    expect(latest.isolationError).toBe(true);
    await persistPatch({ accountId: ACCOUNT });
    await act(async () => latest.retry()); await settle();
    expect(latest).toMatchObject({ phase: 'settled', isolationError: false,
      result: { status: 'complete', legacyStatus: 'success', canonicalStatus: 'success' } });
    expect(latest.result?.records.map(record => record.source)).toEqual(['canonical', 'legacy']);
    expect(latest.legacyDaily).toEqual(healthyLegacy().daily);
  });
});
