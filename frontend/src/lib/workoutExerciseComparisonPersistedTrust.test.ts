import 'fake-indexeddb/auto';
import { IDBFactory, IDBIndex as FakeIDBIndex } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HEALTH_RECOVERY_DATASETS, buildHealthRecoveryExport, validateHealthRecoveryDatasets,
  type HealthRecoveryDatasets, type HealthRecoveryRecord,
} from './healthRecoveryExport';
import {
  createLocalHealthDriver, HealthRepository, IndexedDbLocalHealthDriver, HEALTH_LOCAL_DATABASE_NAME,
  type PendingLocalHealthImportState,
} from './healthLocalRepository';
import { createLocalHealthRepository, resetLocalHealthRuntimeForTests } from './healthLocalRuntime';
import {
  closeLocalDatabase, createDormantLocalDatabaseCapability, openLocalDatabase,
  LocalDatabaseError, LOCAL_DATABASE_NAME, LOCAL_DATABASE_STORES,
  type LocalDatabaseRepository, type LocalEntityEnvelope,
} from './localDatabase';
import {
  HEALTH_ROUTINE_DEVICE_ID_KEY, HEALTH_ROUTINE_GENERATION_ID, HEALTH_ROUTINE_PROJECT_REF,
} from './workoutLocalReaderAuthority';
import { WorkoutSessionRepository, WORKOUT_SESSION_DOMAIN } from './workoutSessionRepository';
import type { WorkoutSessionV1 } from './workoutSessionV1';
import { WorkoutRangeReader } from './workoutRangeReader';
import { WorkoutReadSnapshotCoordinator } from '../components/views/features/health/verifiedWorkoutRangeSnapshot';
import * as composite from '../components/views/features/health/compositeWorkoutReadProjection';
import * as projection from './workoutExerciseComparisonProjection';
import { WorkoutExerciseComparisonOwner, type WorkoutExerciseComparisonPublication } from './workoutExerciseComparisonOwner';

// EXCOMP-C14: both sources cross real IDB/repository/reader boundaries. No mocked
// Health adapter, fabricated source status, or injected post-read comparison DTO.
// This proves the approved source-qualified partial contract, NOT a repair of the
// unresolved LEGACY_VERIFIED_OWNER_CLASSIFICATION_GAP or mounted/public acceptance.
const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const FOREIGN = '22222222-2222-4222-8222-222222222222';
const DEVICE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const uuid = (n: number) => `${n.toString(16).padStart(8, '0')}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;
const KEY = { id: uuid(10), name: 'Squat', type: 'strength' } as const;
const DATE = '2026-10-02';
const PRIVATE = 'FOREIGN_PRIVATE_WORKOUT_PAYLOAD_C14';
const storage = new Map<string, string>();
const adapter = { getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v); } } as Storage;
const databases: LocalDatabaseRepository[] = [];
const coordinators: WorkoutReadSnapshotCoordinator[] = [];
const views: WorkoutExerciseComparisonOwner[] = [];

function datasets(empty = false): HealthRecoveryDatasets {
  const value = Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(name => [name, []])) as HealthRecoveryDatasets;
  if (!empty) {
    value.exercise_blocks.push({ id: KEY.id, user_id: ACCOUNT, name: KEY.name,
      type: KEY.type, tags: [], cardio_mode: null });
    value.workout_logs.push({ id: uuid(11), user_id: ACCOUNT, date: '2026-09-30',
      block_id: KEY.id, sort_order: 0,
      sets: [{ type: 'strength', set: 1, kg: 20, reps: 8, done: true }] });
  }
  return value;
}

function session(): WorkoutSessionV1 {
  return { version: 1, id: uuid(1), localDate: '2026-09-30', entries: [{ id: uuid(2),
    exercise: { ...KEY, tags: [], cardioMode: null },
    sets: [{ id: uuid(3), ordinal: 1, kind: 'strength', loadKind: 'external_weight',
      weightKg: '20', sourceValue: '20', sourceUnit: 'kg', reps: 8, assistedReps: null,
      dropset: false, done: true }],
  }] };
}

async function seedLegacy(empty = false): Promise<void> {
  const source = datasets(empty);
  const built = await buildHealthRecoveryExport({ sourceAccount: { userId: ACCOUNT, email: 'c14@example.test' },
    exportedAt: '2026-10-01T00:00:00.000Z', datasets: source });
  const counts = Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(name => [name, source[name].length])) as
    PendingLocalHealthImportState['datasetCounts'];
  const pending: PendingLocalHealthImportState = { accountId: ACCOUNT, status: 'IMPORT_COMMITTED_PENDING_READBACK',
    snapshotId: 'c14-fixture', importedAt: built.exportedAt, sourceExportedAt: built.exportedAt,
    sourceFileSha256: '1'.repeat(64), sourceContentSha256: built.checksum.value,
    totalRowCount: Object.values(counts).reduce((a, b) => a + b, 0), datasetCounts: counts,
    diagnostics: built.diagnostics };
  const driver = await createLocalHealthDriver();
  try {
    await driver.commitPendingImportAtomically({ accountId: ACCOUNT, datasets: source,
      expectedImportState: null, pendingImportState: pending });
    expect(await driver.finalizePendingIfStillCurrent({ accountId: ACCOUNT, expectedSnapshotId: pending.snapshotId }))
      .toBe('APPLIED');
    expect(await new HealthRepository(driver, ACCOUNT).readAll()).toEqual(built.datasets);
  } finally { driver.close(); }
  // Subsequent reads reopen persisted storage through the actual shared runtime.
}

async function seedCanonical(empty = false): Promise<LocalDatabaseRepository> {
  const db = await openLocalDatabase({ userId: ACCOUNT, deviceId: DEVICE,
    projectRef: HEALTH_ROUTINE_PROJECT_REF, generationId: HEALTH_ROUTINE_GENERATION_ID, schemaVersion: 1 },
  { capability: createDormantLocalDatabaseCapability('c14-persisted-acceptance-test') });
  databases.push(db);
  await db.initializeNamespace();
  if (!empty) await new WorkoutSessionRepository(db).createWorkoutSession(session());
  return db;
}

async function openRaw(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
}

async function corruptLegacy(patch: HealthRecoveryRecord): Promise<void> {
  const raw = await openRaw(HEALTH_LOCAL_DATABASE_NAME);
  try {
    const tx = raw.transaction('workout_logs', 'readwrite');
    const done = transactionDone(tx);
    const store = tx.objectStore('workout_logs');
    const request = store.index('accountId').getAll(ACCOUNT);
    request.onsuccess = () => {
      expect(request.result).toHaveLength(1);
      // Keep the routing wrapper/account index intact. The REAL owner validator
      // must reject the inner record, not merely omit another account's index rows.
      const row = request.result[0];
      store.put({ ...row, record: { ...row.record, ...patch, exercise_name: PRIVATE } });
    };
    await done;
  } finally { raw.close(); }
}

async function persistCanonicalPatch(db: LocalDatabaseRepository,
  patch: Partial<LocalEntityEnvelope<WorkoutSessionV1>>): Promise<LocalEntityEnvelope<WorkoutSessionV1>> {
  const raw = await openRaw(LOCAL_DATABASE_NAME);
  try {
    const tx = raw.transaction(LOCAL_DATABASE_STORES.entities, 'readwrite');
    const done = transactionDone(tx);
    const store = tx.objectStore(LOCAL_DATABASE_STORES.entities);
    const request = store.get([db.namespaceKey, db.namespace.generationId, WORKOUT_SESSION_DOMAIN, uuid(1)]);
    let persisted!: LocalEntityEnvelope<WorkoutSessionV1>;
    request.onsuccess = () => { persisted = { ...request.result, ...patch }; store.put(persisted); };
    await done;
    // Read back from a separate transaction: the fault candidate is actually persisted.
    const read = raw.transaction(LOCAL_DATABASE_STORES.entities, 'readonly');
    const readDone = transactionDone(read);
    const found = read.objectStore(LOCAL_DATABASE_STORES.entities).get([
      persisted.namespaceKey, persisted.generationId, persisted.domain, persisted.entityId,
    ]);
    const result = await new Promise<LocalEntityEnvelope<WorkoutSessionV1>>((resolve, reject) => {
      found.onsuccess = () => resolve(found.result); found.onerror = () => reject(found.error);
    });
    await readDone;
    expect(result).toEqual(persisted);
    return result;
  } finally { raw.close(); }
}

function privateSession(): WorkoutSessionV1 {
  const value = session();
  // Would be excluded by date, exercise association AND eligibility if filtering
  // were incorrectly done before persisted scope validation.
  value.localDate = '2027-01-01';
  value.entries[0]!.exercise = { ...value.entries[0]!.exercise, id: uuid(99), name: PRIVATE };
  value.entries[0]!.sets[0]!.done = false;
  return value;
}

/** Namespace/generation are primary-key AND index dimensions: normal IDB excludes
 * foreign tuples. For defensive mismatch classification, fault only the real
 * index request's cloned response using a read-back persisted foreign candidate,
 * BEFORE LocalDatabaseRepository validation. No error/reader result is fabricated. */
function includePersistedScopeFault(candidate: LocalEntityEnvelope<WorkoutSessionV1>) {
  const original = FakeIDBIndex.prototype.getAll;
  const reached = vi.fn();
  vi.spyOn(FakeIDBIndex.prototype, 'getAll').mockImplementation(function (this: IDBIndex, ...args) {
    const request = original.apply(this, args);
    if (this.objectStore.name === LOCAL_DATABASE_STORES.entities && this.name === 'by_namespace_generation_domain') {
      request.addEventListener('success', () => { reached(); request.result.push(structuredClone(candidate)); });
    }
    return request;
  });
  return reached;
}

function pair() {
  const coordinator = new WorkoutReadSnapshotCoordinator(ACCOUNT, adapter); coordinators.push(coordinator);
  const view = new WorkoutExerciseComparisonOwner(coordinator); views.push(view);
  view.setContext({ enabled: true, selectedDate: DATE });
  return { coordinator, view };
}

async function publish(publication: WorkoutExerciseComparisonPublication | null) {
  expect(publication).not.toBeNull();
  const consume = vi.fn<(result: projection.WorkoutExerciseComparisonResult) => void>();
  expect(await publication!.publish(consume)).toBe(true);
  expect(consume).toHaveBeenCalledTimes(1);
  return consume.mock.calls[0]![0];
}

function noPrivate(value: unknown) {
  const text = value instanceof Error ? JSON.stringify({ ...value, message: value.message, stack: value.stack })
    : JSON.stringify(value);
  expect(text).not.toContain(PRIVATE);
}

async function expectLegacyFailure() {
  const error = await (await createLocalHealthRepository(ACCOUNT)).readAll().catch((error: unknown) => error);
  expect(error).toBeInstanceOf(Error);
  expect(error).not.toBeInstanceOf(composite.CompositeWorkoutReadIsolationError);
  expect(error).toMatchObject({ message: 'health_local_verified_data_malformed' });
  noPrivate(error);
}

beforeEach(() => {
  resetLocalHealthRuntimeForTests();
  vi.stubGlobal('indexedDB', new IDBFactory());
  storage.clear(); storage.set(HEALTH_ROUTINE_DEVICE_ID_KEY, DEVICE);
});
afterEach(() => {
  views.splice(0).forEach(view => view.close());
  coordinators.splice(0).forEach(coordinator => coordinator.close());
  databases.splice(0).forEach(closeLocalDatabase);
  resetLocalHealthRuntimeForTests();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe('EXCOMP-C14 real persisted source-qualified trust acceptance', () => {
  it('A: valid authoritative legacy and canonical repositories publish separate evidence', async () => {
    await seedLegacy(); await seedCanonical();
    const { coordinator, view } = pair();
    expect((await coordinator.load())?.result.status).toBe('complete');
    expect(await publish(await view.derive(KEY))).toMatchObject({ status: 'complete',
      scope: { accountId: ACCOUNT, selectedDate: DATE, horizon: 'all_local_active_prior' },
      legacy: { source: 'legacy', status: 'success', evidence: 'eligible_evidence',
        observations: [{ origin: { source: 'legacy', rowId: uuid(11), blockId: KEY.id } }] },
      canonical: { source: 'canonical', status: 'success', evidence: 'eligible_evidence',
        observations: [{ origin: { source: 'canonical', sessionId: uuid(1), entryId: uuid(2), setId: uuid(3) } }] } });
  });

  it.each([
    ['foreign owner', { user_id: FOREIGN }, 'source_owner_mismatch'],
    ['malformed owner', { user_id: null }, 'source_owner_mismatch'],
    ['ordinary content error', { sets: 'invalid persisted sets' }, 'array_required'],
  ])('B: real legacy %s is generic failure, never verified absence or a complete pair', async (_label, patch, code) => {
    await seedLegacy(); await seedCanonical(); await corruptLegacy(patch);
    const driver = await createLocalHealthDriver();
    try {
      const raw = await driver.readDatasets(ACCOUNT);
      const issues = validateHealthRecoveryDatasets(raw, ACCOUNT);
      // Documentary taxonomy proof only; raw rejected DTO NEVER enters the coordinator.
      expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
      noPrivate(issues);
    } finally { driver.close(); }
    await expectLegacyFailure();
    const { coordinator, view } = pair();
    expect((await coordinator.load())?.result).toMatchObject({ status: 'partial_data',
      legacyStatus: 'error', canonicalStatus: 'success' });
    const result = await publish(await view.derive(KEY));
    expect(result).toMatchObject({ status: 'partial_data', legacy: { source: 'legacy', status: 'unavailable' },
      canonical: { status: 'success', evidence: 'eligible_evidence' } });
    expect(result.legacy).toEqual({ source: 'legacy', status: 'unavailable' });
    expect(result.legacy).not.toHaveProperty('observations');
    expect(result.legacy).not.toHaveProperty('evidence');
    noPrivate(result); noPrivate(coordinator.currentSnapshot);
  });

  it.each([
    ['account', 'ACCOUNT_MISMATCH'], ['namespace', 'NAMESPACE_MISMATCH'],
    ['generation', 'GENERATION_MISMATCH'], ['missing V5 account', 'ACCOUNT_MISMATCH'],
  ] as const)('C/D: persisted %s distrust suppresses both sources before projection (including failing legacy)', async (kind, code) => {
    await seedLegacy(); const db = await seedCanonical();
    const patch = kind === 'account' ? { accountId: FOREIGN }
      : kind === 'namespace' ? { namespaceKey: `${db.namespaceKey}:foreign` }
        : kind === 'generation' ? { generationId: 'foreign-generation' } : { accountId: undefined };
    const candidate = await persistCanonicalPatch(db, { ...patch, record: privateSession() });
    const reached = kind === 'namespace' || kind === 'generation' ? includePersistedScopeFault(candidate) : null;
    const repositoryError = await db.listEntities({ domain: WORKOUT_SESSION_DOMAIN }).catch(error => error);
    expect(repositoryError).toBeInstanceOf(LocalDatabaseError);
    expect(repositoryError).toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD', persistedEntityFailure: code });
    noPrivate(repositoryError);
    const reader = await WorkoutRangeReader.open(ACCOUNT, adapter);
    try {
      const error = await reader.readAllActive().catch(error => error);
      expect(error).toBeInstanceOf(composite.CompositeWorkoutReadIsolationError);
      expect(error).toMatchObject({ code }); noPrivate(error);
    } finally { reader.close(); }
    const projectPair = vi.spyOn(composite, 'projectCompositeWorkoutRead');
    const projectComparison = vi.spyOn(projection, 'projectWorkoutExerciseComparison');
    const { coordinator, view } = pair();
    for (const legacyFails of [false, true]) {
      if (legacyFails) { await corruptLegacy({ user_id: FOREIGN }); await expectLegacyFailure(); }
      await expect(coordinator.load()).rejects.toMatchObject({ code });
      expect(coordinator.currentSnapshot).toBeNull();
      expect(await view.derive(KEY)).toBeNull();
    }
    expect(projectPair).not.toHaveBeenCalled(); expect(projectComparison).not.toHaveBeenCalled();
    if (reached) expect(reached).toHaveBeenCalledTimes(4);
  });

  it.each(['namespace', 'generation'] as const)('normal IDB index excludes physically persisted foreign %s tuples', async kind => {
    await seedLegacy(); const db = await seedCanonical();
    await persistCanonicalPatch(db, { record: privateSession(), ...(kind === 'namespace'
      ? { namespaceKey: `${db.namespaceKey}:foreign` } : { generationId: 'foreign-generation' }) });
    const { coordinator, view } = pair();
    await coordinator.load();
    const result = await publish(await view.derive(KEY));
    expect(result).toMatchObject({ status: 'complete', canonical: { status: 'success',
      observations: [{ origin: { sessionId: uuid(1), frozenName: KEY.name } }] } });
    noPrivate(result); noPrivate(coordinator.currentSnapshot);
  });

  it('trusted scope with invalid persisted content stays ordinary partial, not typed isolation', async () => {
    await seedLegacy(); const db = await seedCanonical();
    await persistCanonicalPatch(db, { revision: 0 });
    const error = await db.listEntities({ domain: WORKOUT_SESSION_DOMAIN }).catch(error => error);
    expect(error).toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD', persistedEntityFailure: 'INVALID_ENTITY' });
    const { coordinator, view } = pair(); await coordinator.load();
    expect(await publish(await view.derive(KEY))).toMatchObject({ status: 'partial_data',
      legacy: { status: 'success', evidence: 'eligible_evidence' }, canonical: { status: 'unavailable' } });
  });

  it('E: both real ordinary persisted failures are unavailable, not complete empty', async () => {
    await seedLegacy(); const db = await seedCanonical();
    await corruptLegacy({ sets: 'malformed' }); await persistCanonicalPatch(db, { revision: 0 });
    await expectLegacyFailure();
    const { coordinator, view } = pair();
    expect((await coordinator.load())?.result).toMatchObject({ status: 'error', legacyStatus: 'error', canonicalStatus: 'error' });
    const result = await publish(await view.derive(KEY));
    expect(result).toMatchObject({ status: 'unavailable', legacy: { status: 'unavailable' }, canonical: { status: 'unavailable' } });
    expect(result.legacy).not.toHaveProperty('evidence'); expect(result.canonical).not.toHaveProperty('evidence');
    noPrivate(result);
  });

  it('F: two verified empty source reads alone permit complete scoped empty evidence', async () => {
    await seedLegacy(true); await seedCanonical(true);
    const { coordinator, view } = pair(); await coordinator.load();
    expect(await publish(await view.derive(KEY))).toMatchObject({ status: 'complete',
      legacy: { status: 'success', evidence: 'no_eligible_evidence', observations: [], latestEligibleDate: null },
      canonical: { status: 'success', evidence: 'no_eligible_evidence', observations: [], latestEligibleDate: null } });
  });

  it.each(['G: legacy fails/canonical empty', 'H: legacy empty/canonical fails'] as const)
  ('%s is partial, never complete empty', async label => {
    const legacyFails = label.startsWith('G:');
    await seedLegacy(!legacyFails); const db = await seedCanonical(legacyFails);
    if (legacyFails) await corruptLegacy({ user_id: FOREIGN });
    else await persistCanonicalPatch(db, { revision: 0 });
    const { coordinator, view } = pair(); await coordinator.load();
    const result = await publish(await view.derive(KEY));
    expect(result.status).toBe('partial_data');
    const failed = legacyFails ? result.legacy : result.canonical;
    const empty = legacyFails ? result.canonical : result.legacy;
    expect(failed).toMatchObject({ status: 'unavailable' });
    expect(failed).not.toHaveProperty('evidence'); expect(failed).not.toHaveProperty('observations');
    expect(empty).toMatchObject({ status: 'success', evidence: 'no_eligible_evidence', observations: [] });
    noPrivate(result);
  });

  it.each(['account ABA', 'generation', 'invalidate/reload', 'owner close', 'reload into typed isolation'] as const)
  ('real owner-mismatch partial continuation cannot publish after %s', async action => {
    await seedLegacy(); const db = await seedCanonical(); await corruptLegacy({ user_id: FOREIGN });
    const { coordinator, view } = pair(); await coordinator.load();
    const old = (await view.derive(KEY))!;
    expect(old).not.toBeNull();
    let enter!: () => void; let release!: () => void;
    const entered = new Promise<void>(resolve => { enter = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const realVerify = coordinator.verifyCurrentScope.bind(coordinator);
    // Timing seam only: all currentness/classification still executes the real path.
    vi.spyOn(coordinator, 'verifyCurrentScope').mockImplementationOnce(async () => {
      enter(); await gate; return realVerify();
    });
    const consume = vi.fn();
    const pending = old.publish(consume); await entered;
    if (action === 'account ABA') { coordinator.setAccount(FOREIGN); coordinator.setAccount(ACCOUNT); await coordinator.load(); }
    if (action === 'generation') { await db.createGeneration('c14-next', 'test'); await db.activateGeneration('c14-next'); }
    if (action === 'invalidate/reload') { coordinator.invalidate(); await coordinator.load(); }
    if (action === 'owner close') view.close();
    if (action === 'reload into typed isolation') {
      coordinator.invalidate(); await persistCanonicalPatch(db, { accountId: FOREIGN, record: privateSession() });
      await expect(coordinator.load()).rejects.toMatchObject({ code: 'ACCOUNT_MISMATCH' });
    }
    release(); expect(await pending).toBe(false); expect(consume).not.toHaveBeenCalled();
    expect(old.isCurrent()).toBe(false);
    if (action === 'generation') await coordinator.load();
    if (action === 'owner close' || action === 'reload into typed isolation') expect(await view.derive(KEY)).toBeNull();
    else expect((await publish(await view.derive(KEY))).status).toBe('partial_data');
  });

  it.each([false, true])('one real paired load, zero additional full reads/scans per derive (legacy failure=%s)', async failing => {
    await seedLegacy(); await seedCanonical(); if (failing) await corruptLegacy({ user_id: FOREIGN });
    const legacy = vi.spyOn(IndexedDbLocalHealthDriver.prototype, 'readAuthoritativeDatasets');
    const readAll = vi.spyOn(HealthRepository.prototype, 'readAll');
    const canonical = vi.spyOn(WorkoutSessionRepository.prototype, 'listWorkoutSessions');
    const scans = vi.spyOn(FakeIDBIndex.prototype, 'getAll');
    const { coordinator, view } = pair(); await coordinator.load();
    for (const selectedDate of [DATE, '2026-10-03']) {
      view.setContext({ enabled: true, selectedDate });
      for (const exercise of [KEY, { ...KEY, id: uuid(90) }]) {
        const publication = await view.derive(exercise);
        await publish(publication); await publish(publication);
      }
    }
    expect(legacy).toHaveBeenCalledTimes(1); expect(readAll).toHaveBeenCalledTimes(1);
    expect(canonical).toHaveBeenCalledTimes(1);
    expect(scans.mock.contexts.filter(index => index.objectStore.name === LOCAL_DATABASE_STORES.entities
      && index.name === 'by_namespace_generation_domain')).toHaveLength(1);
  });
});
