// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HEALTH_RECOVERY_DATASETS,
  buildHealthRecoveryExport,
  serializeHealthRecoveryExport,
  type HealthRecoveryDatasetName,
  type HealthRecoveryDatasets,
  type HealthRecoveryRecord,
} from './healthRecoveryExport';
import {
  computeLocalHealthSnapshotPayloadSha256,
  computeLocalHealthLogicalVersion,
  createLocalHealthDriver,
  HealthRepository,
  HEALTH_LOCAL_DATABASE_NAME,
  HEALTH_LOCAL_IMPORT_STATE_STORE,
  type IndexedDbLocalHealthDriver,
  type LocalHealthDriverTestHooks,
  type LocalHealthImportState,
  type LocalHealthSnapshot,
  type PendingLocalHealthImportState,
  type VerifiedLocalHealthImportState,
} from './healthLocalRepository';
import {
  importVerifiedHealthRecovery,
  prevalidateHealthRecoveryImport,
  type HealthImportExpectation,
} from './healthRecoveryImport';
import {
  readLocalHealthDaily,
  readLocalHealthProtein,
  readLocalPreviousWorkout,
  readLocalHealthStatic,
  readLocalHealthWorkoutRange,
  projectLocalHealthDaily,
  resetLocalHealthRuntimeForTests,
} from './healthLocalRuntime';
import { remoteSWRKey } from './remoteBoundary';
import { FOLDERS_KEY, NOTES_KEY, type NoteBase } from '@/components/views/noteUtils';
import {
  clearIndexedDbNotes,
  loadNotesFromIndexedDb,
  markIndexedDbMigrationComplete,
  saveNotesToIndexedDb,
} from './noteIndexedDb';
import { initNotesPersistence, resetNotesPersistenceForTests } from './notePersistence';

const OWNER = '18c8ab7d-6ba7-4547-aa55-f254ce900075';
const OTHER = 'a8b5ad76-2d3b-4b6e-8f27-3ae40d2d82b7';
const EMAIL = 'synthetic@example.test';
const MISSING_1 = '47aa723f-48dc-4551-b244-584d48f7a5f8';
const MISSING_2 = 'b7913fe6-2b6c-4cec-b8ac-ee94be4b7230';

function uuid(value: number, prefix = '1'): string {
  const hex = value.toString(16).padStart(12, '0').slice(-12);
  return `${prefix.repeat(8)}-${prefix.repeat(4)}-4${prefix.repeat(3)}-8${prefix.repeat(3)}-${hex}`;
}

function syntheticDatasets(): HealthRecoveryDatasets {
  const blocks = Array.from({ length: 44 }, (_, index) => ({
    id: uuid(index + 1, '1'), user_id: OWNER, name: `Block ${index + 1}`,
    type: 'strength', tags: [], cardio_mode: null,
  }));
  const workouts = Array.from({ length: 328 }, (_, index) => ({
    id: uuid(index + 1, '2'), user_id: OWNER,
    date: `2026-01-${String((index % 28) + 1).padStart(2, '0')}`,
    block_id: blocks[index % blocks.length].id,
    sets: [{ type: 'strength', set: 1, kg: 50 + index % 20, reps: 8, done: true }],
    sort_order: index % 10,
  }));
  const inbody = Array.from({ length: 23 }, (_, index) => ({
    id: uuid(index + 1, '3'), user_id: OWNER,
    date: `2026-02-${String(index + 1).padStart(2, '0')}`,
    weight: 70 + index / 10, smm: 35, pbf: 15,
  }));
  const healthRoutines = Array.from({ length: 4 }, (_, index) => ({
    id: uuid(index + 1, '4'), user_id: OWNER, day_name: index === 2 ? 'Day 3' : `Day ${index + 1}`,
    blocks: index === 2
      ? [...blocks.slice(0, 7).map(row => row.id), MISSING_1, MISSING_2]
      : blocks.slice(index * 10, index * 10 + (index === 3 ? 8 : 10)).map(row => row.id),
  }));
  const routines = Array.from({ length: 14 }, (_, index) => ({
    id: uuid(index + 1, '5'), user_id: OWNER, text: `Routine ${index + 1}`,
    created_at: '2026-01-01T00:00:00.000Z', created_date: '2026-01-01',
    created_timestamp: '2026-01-01T00:00:00.000Z', deleted_at: null, is_active: true,
  }));
  const routineLogs: HealthRecoveryRecord[] = [];
  for (let group = 0; group < 18; group += 1) {
    const size = group < 17 ? 6 : 7;
    for (let offset = 0; offset < size; offset += 1) {
      routineLogs.push({
        id: uuid(routineLogs.length + 1, '6'), user_id: OWNER, routine_id: null,
        date: `2026-03-${String(group + 1).padStart(2, '0')}`,
        done: offset % 2 === 0, is_completed: offset % 3 === 0,
      });
    }
  }
  for (let index = routineLogs.length; index < 763; index += 1) {
    const logDate = new Date(Date.UTC(2024, 0, 1 + index));
    routineLogs.push({
      id: uuid(index + 1, '6'), user_id: OWNER,
      routine_id: routines[index % routines.length].id,
      date: logDate.toISOString().slice(0, 10),
      done: index % 2 === 0, is_completed: index % 2 === 0,
    });
  }
  const sources = Array.from({ length: 23 }, (_, index) => ({
    id: uuid(index + 1, '7'), user_id: OWNER, name: `Source ${index + 1}`,
    source_type: 'fixed', protein_per_serving: 10, protein_per_100g: null,
    category: 'Other', created_at: '2026-01-01T00:00:00.000Z',
  }));
  const intake = Array.from({ length: 174 }, (_, index) => ({
    id: uuid(index + 1, '8'), user_id: OWNER,
    date: `2026-07-${String((index % 28) + 1).padStart(2, '0')}`,
    source_id: index < 149 ? sources[index % sources.length].id : null,
    amount_g: 1, protein_g: 10, note: null, created_at: `2026-07-01T00:${String(index % 60).padStart(2, '0')}:00.000Z`,
  }));
  return {
    exercise_blocks: blocks,
    workout_logs: workouts,
    inbody_logs: inbody,
    health_routines: healthRoutines,
    routines,
    routine_logs: routineLogs,
    protein_profiles: [{ user_id: OWNER, weight: 70, goal: 'maintain', activity: 'mod', daily_target_g: 120, updated_at: '2026-07-01T00:00:00.000Z' }],
    protein_sources: sources,
    protein_intake_logs: intake,
    workout_memos: [],
  };
}

async function fixture() {
  const built = await buildHealthRecoveryExport({
    sourceAccount: { userId: OWNER, email: EMAIL },
    exportedAt: '2026-08-12T00:00:00.000Z',
    datasets: syntheticDatasets(),
  });
  const source = serializeHealthRecoveryExport(built);
  const fileSha256 = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))
    .then(buffer => Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join(''));
  const expectation: HealthImportExpectation = {
    fileBytes: new TextEncoder().encode(source).byteLength,
    fileSha256,
    contentSha256: built.checksum.value,
    sourceAccount: { userId: OWNER, email: EMAIL },
    datasetCounts: Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(dataset => [dataset, built.datasets[dataset].length])) as Record<HealthRecoveryDatasetName, number>,
    totalRows: 1374,
    diagnostics: {
      workoutChecked: 328,
      workoutMissing: 0,
      healthRoutineChecked: 37,
      healthRoutineMissingIds: [MISSING_1, MISSING_2],
      routineChecked: 654,
      routineNullReferences: 109,
      routineMissing: 0,
      proteinChecked: 149,
      proteinMissing: 0,
      routineLogMultirowGroups: 18,
      routineLogAdditionalRows: 91,
    },
  };
  return { built, source, expectation };
}

async function driver(name: string, hooks?: LocalHealthDriverTestHooks): Promise<IndexedDbLocalHealthDriver> {
  return createLocalHealthDriver({ databaseName: `absinthe.health.test.${name}.${crypto.randomUUID()}`, testHooks: hooks });
}

async function overwriteImportStateForCorruptionTest(
  databaseName: string,
  state: LocalHealthImportState,
): Promise<void> {
  const opened = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const tx = opened.transaction(HEALTH_LOCAL_IMPORT_STATE_STORE, 'readwrite');
  tx.objectStore(HEALTH_LOCAL_IMPORT_STATE_STORE).put(structuredClone(state));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  opened.close();
}

function minimalDatasets(accountId: string, name: string): HealthRecoveryDatasets {
  return {
    exercise_blocks: [{
      id: accountId === OWNER ? uuid(900, '9') : uuid(901, 'a'),
      user_id: accountId,
      name,
      type: 'strength',
      tags: [],
      cardio_mode: null,
    }],
    workout_logs: [],
    inbody_logs: [],
    health_routines: [],
    routines: [],
    routine_logs: [],
    protein_profiles: [],
    protein_sources: [],
    protein_intake_logs: [],
    workout_memos: [],
  };
}

function datasetCounts(datasets: HealthRecoveryDatasets): Record<HealthRecoveryDatasetName, number> {
  return Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(dataset => [dataset, datasets[dataset].length])) as Record<HealthRecoveryDatasetName, number>;
}

function localWorkoutInput(
  blockId: string,
  date: string,
  kg = 60,
  id?: string,
  expectedVersion: string | null = null,
) {
  return {
    id,
    date,
    blockId,
    sets: [{ type: 'strength', set: 1, kg, reps: 8, done: true }],
    sortOrder: 0,
    expectedVersion,
  };
}

async function verifiedState(accountId: string, datasets: HealthRecoveryDatasets): Promise<LocalHealthImportState> {
  const built = await buildHealthRecoveryExport({
    sourceAccount: { userId: accountId, email: EMAIL },
    exportedAt: '2026-08-12T00:00:00.000Z',
    datasets,
  });
  const counts = datasetCounts(datasets);
  return {
    accountId,
    status: 'VERIFIED_IMPORT_COMPLETE',
    importedAt: '2026-08-12T00:00:00.000Z',
    sourceFileSha256: '1'.repeat(64),
    sourceContentSha256: built.checksum.value,
    sourceExportedAt: built.exportedAt,
    totalRowCount: HEALTH_RECOVERY_DATASETS.reduce((sum, dataset) => sum + counts[dataset], 0),
    datasetCounts: counts,
    diagnostics: built.diagnostics,
  };
}

async function pendingState(
  accountId: string,
  snapshotId: string,
  datasets: HealthRecoveryDatasets,
): Promise<LocalHealthImportState> {
  const state = await verifiedState(accountId, datasets);
  return { ...state, status: 'IMPORT_COMMITTED_PENDING_READBACK', snapshotId };
}

async function snapshot(
  snapshotId: string,
  accountId: string,
  datasets: HealthRecoveryDatasets,
  priorImportState: LocalHealthImportState | null,
): Promise<LocalHealthSnapshot> {
  const withoutHash = {
    snapshotId,
    accountId,
    createdAt: '2026-08-12T00:01:00.000Z',
    datasets,
    priorImportState,
  };
  return { ...withoutHash, payloadSha256: await computeLocalHealthSnapshotPayloadSha256(withoutHash) };
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

async function seedVerifiedAccount(
  db: IndexedDbLocalHealthDriver,
  accountId: string,
  datasets: HealthRecoveryDatasets,
  label: string,
): Promise<VerifiedLocalHealthImportState> {
  const snapshotId = `${accountId}:${label}:${crypto.randomUUID()}`;
  const pending = await pendingState(accountId, snapshotId, datasets) as PendingLocalHealthImportState;
  await db.commitPendingImportAtomically({
    accountId,
    datasets,
    expectedImportState: null,
    pendingImportState: pending,
  });
  const verified = { ...pending, status: 'VERIFIED_IMPORT_COMPLETE' } as VerifiedLocalHealthImportState;
  expect(await db.finalizePendingIfStillCurrent({
    accountId,
    expectedSnapshotId: snapshotId,
  })).toBe('APPLIED');
  return verified;
}

async function commitPendingCandidate(input: {
  db: IndexedDbLocalHealthDriver;
  accountId: string;
  priorDatasets: HealthRecoveryDatasets;
  priorImportState: VerifiedLocalHealthImportState | null;
  candidate: HealthRecoveryDatasets;
  label: string;
}): Promise<{
  snapshotId: string;
  pending: PendingLocalHealthImportState;
  verified: VerifiedLocalHealthImportState;
}> {
  const snapshotId = `${input.accountId}:${input.label}:${crypto.randomUUID()}`;
  await input.db.persistSnapshot(await snapshot(
    snapshotId,
    input.accountId,
    input.priorDatasets,
    input.priorImportState,
  ));
  const pending = await pendingState(input.accountId, snapshotId, input.candidate) as PendingLocalHealthImportState;
  await input.db.commitPendingImportAtomically({
    accountId: input.accountId,
    datasets: input.candidate,
    expectedImportState: input.priorImportState,
    pendingImportState: pending,
  });
  return {
    snapshotId,
    pending,
    verified: { ...pending, status: 'VERIFIED_IMPORT_COMPLETE' } as VerifiedLocalHealthImportState,
  };
}

async function seedPendingCandidate(input: {
  databaseName: string;
  accountId?: string;
  persistSnapshot?: boolean;
  snapshotAccountId?: string;
  malformedSnapshot?: boolean;
  badSnapshotHash?: boolean;
  missingSnapshotId?: boolean;
  priorVerified?: boolean;
}): Promise<{ snapshotId: string; prior: HealthRecoveryDatasets; candidate: HealthRecoveryDatasets }> {
  const accountId = input.accountId ?? OWNER;
  const snapshotAccountId = input.snapshotAccountId ?? accountId;
  const db = await createLocalHealthDriver({ databaseName: input.databaseName });
  const prior = input.priorVerified === false
    ? { ...minimalDatasets(snapshotAccountId, 'PRIOR VERIFIED'), exercise_blocks: [] }
    : minimalDatasets(snapshotAccountId, 'PRIOR VERIFIED');
  const priorState = input.priorVerified === false ? null : await verifiedState(snapshotAccountId, prior);
  const snapshotId = `${accountId}:pending:${crypto.randomUUID()}`;
  if (input.persistSnapshot !== false) {
    const saved = await snapshot(snapshotId, snapshotAccountId, prior, priorState);
    if (input.malformedSnapshot) {
      saved.datasets.exercise_blocks[0].user_id = OTHER;
      const { payloadSha256: _discarded, ...withoutHash } = saved;
      saved.payloadSha256 = await computeLocalHealthSnapshotPayloadSha256(withoutHash);
    }
    if (input.badSnapshotHash) saved.payloadSha256 = '0'.repeat(64);
    await db.persistSnapshot(saved);
  }
  const candidate = minimalDatasets(accountId, 'PENDING CANDIDATE');
  const pending = await pendingState(accountId, snapshotId, candidate);
  await db.commitPendingImportAtomically({
    accountId,
    datasets: candidate,
    expectedImportState: null,
    pendingImportState: pending as PendingLocalHealthImportState,
  });
  db.close();
  if (input.missingSnapshotId) {
    delete (pending as { snapshotId?: string }).snapshotId;
    await overwriteImportStateForCorruptionTest(input.databaseName, pending);
  }
  return { snapshotId, prior, candidate };
}

afterEach(() => {
  resetLocalHealthRuntimeForTests();
  vi.restoreAllMocks();
});

describe('local durable Health recovery import', () => {
  it('fails closed on file hash, content hash, dataset count, row count, and malformed records', async () => {
    const { source, expectation } = await fixture();
    await expect(prevalidateHealthRecoveryImport(source, { ...expectation, fileSha256: '0'.repeat(64) })).rejects.toThrow('health_import_file_hash_mismatch');
    await expect(prevalidateHealthRecoveryImport(source, { ...expectation, contentSha256: '0'.repeat(64) })).rejects.toThrow('health_import_content_hash_mismatch');
    await expect(prevalidateHealthRecoveryImport(source, { ...expectation, datasetCounts: { ...expectation.datasetCounts, routines: 15 } })).rejects.toThrow('health_import_dataset_row_count_mismatch');

    const parsed = JSON.parse(source);
    delete parsed.datasets.workout_memos;
    const missingDataset = JSON.stringify(parsed);
    const missingHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(missingDataset))
      .then(buffer => Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join(''));
    await expect(prevalidateHealthRecoveryImport(missingDataset, { ...expectation, fileBytes: new TextEncoder().encode(missingDataset).byteLength, fileSha256: missingHash })).rejects.toThrow();

    const malformed = { ...syntheticDatasets() };
    malformed.workout_logs = [...malformed.workout_logs];
    malformed.workout_logs[0] = { ...malformed.workout_logs[0], date: 'not-a-date' };
    await expect(buildHealthRecoveryExport({ sourceAccount: { userId: OWNER, email: EMAIL }, exportedAt: '2026-08-12T00:00:00Z', datasets: malformed })).rejects.toThrow('health_field_validation_failed');
  });

  it('blocks replacement when snapshot persistence or readback fails', async () => {
    const { source, expectation } = await fixture();
    for (const hooks of [{ failSnapshotWrite: true }, { failSnapshotReadback: true }]) {
      const db = await driver('snapshot-failure', hooks);
      await expect(importVerifiedHealthRecovery({ source, expectation, driver: db })).rejects.toThrow(/health_snapshot/);
      expect((await db.readDatasets(OWNER)).workout_logs).toHaveLength(0);
      expect(await db.readImportState(OWNER)).toBeNull();
      db.close();
    }
  });

  it('rejects an authenticated account mismatch before any local persistence', async () => {
    const { source, expectation } = await fixture();
    const db = await driver('account-mismatch');
    await expect(importVerifiedHealthRecovery({
      source,
      expectation,
      driver: db,
      accountId: OTHER,
    })).rejects.toThrow('health_import_authenticated_account_mismatch');
    expect((await db.readDatasets(OWNER)).workout_logs).toHaveLength(0);
    expect(await db.readImportState(OWNER)).toBeNull();
    db.close();
  });

  it('rolls back every store and the success marker on an injected transaction failure', async () => {
    const { source, expectation } = await fixture();
    const db = await driver('atomic-failure', { failAtomicWriteAt: { dataset: 'routine_logs', rowIndex: 400 } });
    const repository = new HealthRepository(db, OWNER);
    await repository.createOrUpdate('exercise_blocks', syntheticDatasets().exercise_blocks[0]);
    await expect(importVerifiedHealthRecovery({ source, expectation, driver: db })).rejects.toThrow('health_atomic_import_injected_failure');
    const after = await db.readDatasets(OWNER);
    expect(after.exercise_blocks).toHaveLength(1);
    expect(after.workout_logs).toHaveLength(0);
    expect(after.routine_logs).toHaveLength(0);
    expect(await db.readImportState(OWNER)).toBeNull();
    db.close();
  });

  it('restores the verified pre-import snapshot if final success marking fails', async () => {
    const { source, expectation } = await fixture();
    const db = await driver('success-marker-failure', { failSuccessMarkerWrite: true });
    const repository = new HealthRepository(db, OWNER);
    const original = syntheticDatasets().exercise_blocks[0];
    await repository.createOrUpdate('exercise_blocks', original);
    await expect(importVerifiedHealthRecovery({ source, expectation, driver: db })).rejects.toThrow('health_import_success_marker_write_failed');
    const restored = await db.readDatasets(OWNER);
    expect(restored.exercise_blocks).toEqual([original]);
    for (const dataset of HEALTH_RECOVERY_DATASETS.filter(name => name !== 'exercise_blocks')) {
      expect(restored[dataset]).toEqual([]);
    }
    expect(await db.readImportState(OWNER)).toBeNull();
    db.close();
  });

  it('imports all ten datasets, preserves anomalies, relationships, and source fidelity', async () => {
    const { source, expectation } = await fixture();
    const db = await driver('success');
    const result = await importVerifiedHealthRecovery({ source, expectation, driver: db, now: () => '2026-08-12T01:00:00.000Z' });
    expect(Object.keys(result.datasetCounts)).toEqual(HEALTH_RECOVERY_DATASETS);
    expect(result.totalRows).toBe(1374);
    expect(result.datasetCounts.routine_logs).toBe(763);
    expect(result.relationships.healthRoutineBlockReferences.missing.map(row => row.blockId).sort()).toEqual([MISSING_1, MISSING_2].sort());
    expect(result.relationships.routineLogRoutineReferences.nullReferences).toHaveLength(109);
    expect(result.sourceFidelity).toBe('PASS');
    expect(result.remoteMutationCount).toBe(0);
    expect(await db.readImportState(OWNER)).toMatchObject({
      status: 'VERIFIED_IMPORT_COMPLETE',
      snapshotId: result.snapshotId,
      accountId: OWNER,
      totalRowCount: 1374,
    });
    db.close();
  });

  it('keeps restored Notes and Folders unchanged across Health import and Notes reopen', async () => {
    const { source, expectation } = await fixture();
    const notes: NoteBase[] = Array.from({ length: 103 }, (_, index) => ({
      id: `restored-note-${index + 1}`,
      title: `Restored ${index + 1}`,
      body: `Body ${index + 1}`,
      updatedAt: index + 1,
      folderId: `restored-folder-${index % 8}`,
      deletedAt: null,
    }));
    const folders = Array.from({ length: 8 }, (_, index) => ({
      id: `restored-folder-${index}`,
      name: `Folder ${index + 1}`,
      createdAt: index + 1,
    }));
    localStorage.removeItem(NOTES_KEY);
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    await clearIndexedDbNotes();
    markIndexedDbMigrationComplete();
    await saveNotesToIndexedDb(notes);
    resetNotesPersistenceForTests();

    const before = await initNotesPersistence();
    expect(before.notes).toHaveLength(103);
    expect((await loadNotesFromIndexedDb())).toHaveLength(103);

    const db = await driver('notes-domain-isolation');
    await importVerifiedHealthRecovery({ source, expectation, driver: db });
    expect((await db.readDatasets(OWNER)).routine_logs).toHaveLength(763);
    db.close();

    resetNotesPersistenceForTests();
    const after = await initNotesPersistence();
    expect(after.notes.map(note => note.id).sort()).toEqual(notes.map(note => note.id).sort());
    expect(JSON.parse(localStorage.getItem(FOLDERS_KEY) ?? '[]')).toEqual(folders);
    await clearIndexedDbNotes();
    localStorage.removeItem(FOLDERS_KEY);
    resetNotesPersistenceForTests();
  });

  it('survives two repository reopen cycles and keeps another account isolated', async () => {
    const { source, expectation } = await fixture();
    const databaseName = `absinthe.health.reload.${crypto.randomUUID()}`;
    const first = await createLocalHealthDriver({ databaseName });
    await importVerifiedHealthRecovery({ source, expectation, driver: first });
    first.close();
    const second = await createLocalHealthDriver({ databaseName });
    expect((await new HealthRepository(second, OWNER).readAll()).routine_logs).toHaveLength(763);
    expect((await second.readDatasets(OTHER)).routine_logs).toHaveLength(0);
    second.close();
    const third = await createLocalHealthDriver({ databaseName });
    expect((await new HealthRepository(third, OWNER).readAll()).workout_logs).toHaveLength(328);
    expect(await third.readImportState(OTHER)).toBeNull();
    third.close();
  });

  it('hydrates local runtime projections without fetch or Supabase mutation', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { source, expectation } = await fixture();
    const db = await createLocalHealthDriver();
    await importVerifiedHealthRecovery({ source, expectation, driver: db });
    db.close();
    const daily = await readLocalHealthDaily(OWNER, '2026-01-01');
    const staticData = await readLocalHealthStatic(OWNER);
    const range = await readLocalHealthWorkoutRange(OWNER, '2026-01-01', '2026-01-31');
    const protein = await readLocalHealthProtein(OWNER, '2026-07-01', '2026-07-01', '2026-07-31');
    expect(daily.workouts.length).toBeGreaterThan(0);
    expect(staticData.healthBlocks).toHaveLength(44);
    expect(staticData.healthRoutines).toHaveLength(4);
    expect(range).toHaveLength(328);
    expect(protein.sources).toHaveLength(23);
    expect(protein.rangeLogs).toHaveLength(174);
    await expect(readLocalHealthStatic(OTHER)).rejects.toThrow('health_local_data_not_verified');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    'immediately after candidate commit',
    'during candidate readback',
    'before the verified-complete marker',
  ])('restores the exact bound verified snapshot after reopen when interrupted %s', async () => {
    const databaseName = `absinthe.health.pending-reopen.${crypto.randomUUID()}`;
    const seeded = await seedPendingCandidate({ databaseName });
    const reopened = await createLocalHealthDriver({ databaseName });
    const pending = await reopened.readImportState(OWNER);
    expect(pending).toMatchObject({
      status: 'IMPORT_COMMITTED_PENDING_READBACK',
      snapshotId: seeded.snapshotId,
      accountId: OWNER,
    });
    const authoritative = await new HealthRepository(reopened, OWNER).readAll();
    expect(authoritative.exercise_blocks[0].name).toBe('PRIOR VERIFIED');
    expect((await reopened.readDatasets(OWNER)).exercise_blocks[0].name).toBe('PRIOR VERIFIED');
    expect(await reopened.readImportState(OWNER)).toMatchObject({ status: 'VERIFIED_IMPORT_COMPLETE', accountId: OWNER });
    reopened.close();
  });

  it('fails closed for missing IDs, missing snapshots, malformed snapshots, and cross-account snapshots', async () => {
    const cases = [
      { name: 'missing-id', options: { missingSnapshotId: true }, error: 'health_import_state_malformed' },
      { name: 'missing-snapshot', options: { persistSnapshot: false }, error: 'health_pending_snapshot_missing' },
      { name: 'malformed-snapshot', options: { malformedSnapshot: true }, error: 'health_pending_snapshot_content_malformed' },
      { name: 'bad-snapshot-hash', options: { badSnapshotHash: true }, error: 'health_pending_snapshot_hash_mismatch' },
      { name: 'cross-account', options: { snapshotAccountId: OTHER }, error: 'health_pending_snapshot_binding_mismatch' },
    ] as const;
    for (const testCase of cases) {
      const databaseName = `absinthe.health.${testCase.name}.${crypto.randomUUID()}`;
      await seedPendingCandidate({ databaseName, ...testCase.options });
      const reopened = await createLocalHealthDriver({ databaseName });
      await expect(new HealthRepository(reopened, OWNER).readAll()).rejects.toThrow(testCase.error);
      expect((await reopened.readDatasets(OWNER)).exercise_blocks[0].name).toBe('PENDING CANDIDATE');
      reopened.close();
    }
  });

  it('restores an empty pre-import state but never exposes it as verified after a first-import crash', async () => {
    const databaseName = `absinthe.health.pending-empty.${crypto.randomUUID()}`;
    await seedPendingCandidate({ databaseName, priorVerified: false });
    const reopened = await createLocalHealthDriver({ databaseName });
    await expect(new HealthRepository(reopened, OWNER).readAll()).rejects.toThrow('health_local_data_not_verified');
    expect((await reopened.readDatasets(OWNER)).exercise_blocks).toEqual([]);
    expect(await reopened.readImportState(OWNER)).toBeNull();
    reopened.close();
  });

  it('gates every local runtime read entrypoint and performs no remote mutation while pending', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await seedPendingCandidate({ databaseName: HEALTH_LOCAL_DATABASE_NAME, accountId: OTHER, priorVerified: false });
    const calls = [
      () => readLocalHealthDaily(OTHER, '2026-01-01'),
      () => readLocalHealthStatic(OTHER),
      () => readLocalHealthWorkoutRange(OTHER, '2026-01-01', '2026-01-31'),
      () => readLocalPreviousWorkout(OTHER, [], '2026-01-01'),
      () => readLocalHealthProtein(OTHER, '2026-01-01', '2026-01-01', '2026-01-31'),
    ];
    for (const call of calls) await expect(call()).rejects.toThrow('health_local_data_not_verified');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('local Health concurrent authority transitions', () => {
  it('reads authority and all ten datasets from one snapshot before, during, and after a pending commit', async () => {
    const databaseName = `absinthe.health.atomic-read.${crypto.randomUUID()}`;
    const setup = await createLocalHealthDriver({ databaseName });
    const prior = minimalDatasets(OWNER, 'OLD VERIFIED');
    const priorState = await seedVerifiedAccount(setup, OWNER, prior, 'old');
    const candidate = minimalDatasets(OWNER, 'NEW CANDIDATE');
    const snapshotId = `${OWNER}:atomic-read:${crypto.randomUUID()}`;
    await setup.persistSnapshot(await snapshot(snapshotId, OWNER, prior, priorState));
    const pending = await pendingState(OWNER, snapshotId, candidate) as PendingLocalHealthImportState;

    const writer = await createLocalHealthDriver({ databaseName });
    let candidateCommit: Promise<void> | undefined;
    const reader = await createLocalHealthDriver({
      databaseName,
      testHooks: {
        onAuthoritativeReadTransactionCreated: () => {
          candidateCommit = writer.commitPendingImportAtomically({
            accountId: OWNER,
            datasets: candidate,
            expectedImportState: priorState,
            pendingImportState: pending,
          });
        },
      },
    });

    const oldSnapshot = await new HealthRepository(reader, OWNER).readAll();
    expect(oldSnapshot.exercise_blocks[0].name).toBe('OLD VERIFIED');
    await candidateCommit;
    expect(await writer.readImportState(OWNER)).toMatchObject({
      status: 'IMPORT_COMMITTED_PENDING_READBACK',
      snapshotId,
    });

    const pendingReader = await createLocalHealthDriver({ databaseName });
    const recoveredSnapshot = await new HealthRepository(pendingReader, OWNER).readAll();
    expect(recoveredSnapshot.exercise_blocks[0].name).toBe('OLD VERIFIED');
    expect(await pendingReader.readImportState(OWNER)).toEqual(priorState);

    await writer.commitPendingImportAtomically({
      accountId: OWNER,
      datasets: candidate,
      expectedImportState: priorState,
      pendingImportState: pending,
    });
    expect(await writer.finalizePendingIfStillCurrent({
      accountId: OWNER,
      expectedSnapshotId: snapshotId,
    })).toBe('APPLIED');
    const newSnapshot = await new HealthRepository(pendingReader, OWNER).readAll();
    expect(newSnapshot.exercise_blocks[0].name).toBe('NEW CANDIDATE');

    reader.close();
    writer.close();
    pendingReader.close();
    setup.close();
  });

  it('prevents a stale recovery from restoring over an import that already finalized', async () => {
    const databaseName = `absinthe.health.stale-recovery.${crypto.randomUUID()}`;
    const setup = await createLocalHealthDriver({ databaseName });
    const prior = minimalDatasets(OWNER, 'PRIOR');
    const priorState = await seedVerifiedAccount(setup, OWNER, prior, 'prior');
    const candidate = minimalDatasets(OWNER, 'COMPLETED CANDIDATE');
    const transition = await commitPendingCandidate({
      db: setup,
      accountId: OWNER,
      priorDatasets: prior,
      priorImportState: priorState,
      candidate,
      label: 'stale-recovery',
    });
    const recoveryReachedBarrier = deferred();
    const releaseRecovery = deferred();
    const recovering = await createLocalHealthDriver({
      databaseName,
      testHooks: {
        beforePendingRecoveryTransition: async () => {
          recoveryReachedBarrier.resolve();
          await releaseRecovery.promise;
        },
      },
    });
    const finalizer = await createLocalHealthDriver({ databaseName });

    const recovery = recovering.recoverPendingImport(OWNER, transition.snapshotId);
    await recoveryReachedBarrier.promise;
    expect(await finalizer.finalizePendingIfStillCurrent({
      accountId: OWNER,
      expectedSnapshotId: transition.snapshotId,
    })).toBe('APPLIED');
    releaseRecovery.resolve();
    await expect(recovery).resolves.toBe('STALE');

    const current = await finalizer.readAccountSnapshot(OWNER);
    expect(current.datasets.exercise_blocks[0].name).toBe('COMPLETED CANDIDATE');
    expect(current.importState).toEqual(transition.verified);
    recovering.close();
    finalizer.close();
    setup.close();
  });

  it('prevents a stale finalizer from marking a recovered prior state as verified', async () => {
    const databaseName = `absinthe.health.stale-finalize.${crypto.randomUUID()}`;
    const setup = await createLocalHealthDriver({ databaseName });
    const prior = minimalDatasets(OWNER, 'RESTORED PRIOR');
    const priorState = await seedVerifiedAccount(setup, OWNER, prior, 'prior');
    const candidate = minimalDatasets(OWNER, 'STALE CANDIDATE');
    const transition = await commitPendingCandidate({
      db: setup,
      accountId: OWNER,
      priorDatasets: prior,
      priorImportState: priorState,
      candidate,
      label: 'stale-finalize',
    });
    const finalizeReachedBarrier = deferred();
    const releaseFinalize = deferred();
    const finalizing = await createLocalHealthDriver({
      databaseName,
      testHooks: {
        beforePendingFinalizeTransition: async () => {
          finalizeReachedBarrier.resolve();
          await releaseFinalize.promise;
        },
      },
    });
    const recovering = await createLocalHealthDriver({ databaseName });

    const finalize = finalizing.finalizePendingIfStillCurrent({
      accountId: OWNER,
      expectedSnapshotId: transition.snapshotId,
    });
    await finalizeReachedBarrier.promise;
    await expect(recovering.recoverPendingImport(OWNER, transition.snapshotId)).resolves.toBe('RESTORED');
    releaseFinalize.resolve();
    await expect(finalize).resolves.toBe('STALE');

    const current = await recovering.readAccountSnapshot(OWNER);
    expect(current.datasets.exercise_blocks[0].name).toBe('RESTORED PRIOR');
    expect(current.importState).toEqual(priorState);
    finalizing.close();
    recovering.close();
    setup.close();
  });

  it('compares account, status, and snapshot ID for both recovery and finalize transitions', async () => {
    const databaseName = `absinthe.health.transition-tuples.${crypto.randomUUID()}`;
    const db = await createLocalHealthDriver({ databaseName });
    const prior = minimalDatasets(OWNER, 'PRIOR');
    const priorState = await seedVerifiedAccount(db, OWNER, prior, 'prior');
    const candidate = minimalDatasets(OWNER, 'PENDING');
    const transition = await commitPendingCandidate({
      db,
      accountId: OWNER,
      priorDatasets: prior,
      priorImportState: priorState,
      candidate,
      label: 'tuple',
    });
    const otherDatasets = minimalDatasets(OTHER, 'OTHER');

    await expect(db.restorePendingIfStillCurrent({
      accountId: OTHER,
      expectedSnapshotId: transition.snapshotId,
      datasets: otherDatasets,
      priorImportState: null,
    })).resolves.toBe('STALE');
    await expect(db.restorePendingIfStillCurrent({
      accountId: OWNER,
      expectedSnapshotId: `${transition.snapshotId}:wrong`,
      datasets: prior,
      priorImportState: priorState,
    })).resolves.toBe('STALE');
    await expect(db.finalizePendingIfStillCurrent({
      accountId: OTHER,
      expectedSnapshotId: transition.snapshotId,
    })).resolves.toBe('STALE');
    await expect(db.finalizePendingIfStillCurrent({
      accountId: OWNER,
      expectedSnapshotId: `${transition.snapshotId}:wrong`,
    })).resolves.toBe('STALE');

    expect(await db.finalizePendingIfStillCurrent({
      accountId: OWNER,
      expectedSnapshotId: transition.snapshotId,
    })).toBe('APPLIED');
    await expect(db.restorePendingIfStillCurrent({
      accountId: OWNER,
      expectedSnapshotId: transition.snapshotId,
      datasets: prior,
      priorImportState: priorState,
    })).resolves.toBe('STALE');
    await expect(db.finalizePendingIfStillCurrent({
      accountId: OWNER,
      expectedSnapshotId: transition.snapshotId,
    })).resolves.toBe('STALE');
    expect((await db.readDatasets(OWNER)).exercise_blocks[0].name).toBe('PENDING');
    db.close();
  });

  it('does not cross-finalize or cross-recover same-account imports and rejects a stale start state', async () => {
    const databaseName = `absinthe.health.same-account.${crypto.randomUUID()}`;
    const db = await createLocalHealthDriver({ databaseName });
    const prior = minimalDatasets(OWNER, 'PRIOR');
    const priorState = await seedVerifiedAccount(db, OWNER, prior, 'prior');
    const candidateA = minimalDatasets(OWNER, 'CANDIDATE A');
    const transitionA = await commitPendingCandidate({
      db,
      accountId: OWNER,
      priorDatasets: prior,
      priorImportState: priorState,
      candidate: candidateA,
      label: 'A',
    });
    const candidateB = minimalDatasets(OWNER, 'CANDIDATE B');
    const snapshotB = `${OWNER}:B:${crypto.randomUUID()}`;
    const pendingB = await pendingState(OWNER, snapshotB, candidateB) as PendingLocalHealthImportState;

    await expect(db.finalizePendingIfStillCurrent({
      accountId: OWNER,
      expectedSnapshotId: snapshotB,
    })).resolves.toBe('STALE');
    await expect(db.restorePendingIfStillCurrent({
      accountId: OWNER,
      expectedSnapshotId: snapshotB,
      datasets: prior,
      priorImportState: priorState,
    })).resolves.toBe('STALE');
    await expect(db.commitPendingImportAtomically({
      accountId: OWNER,
      datasets: candidateB,
      expectedImportState: priorState,
      pendingImportState: pendingB,
    })).rejects.toThrow('health_import_start_state_changed');
    expect(await db.finalizePendingIfStillCurrent({
      accountId: OWNER,
      expectedSnapshotId: transitionA.snapshotId,
    })).toBe('APPLIED');
    await expect(db.restorePendingIfStillCurrent({
      accountId: OWNER,
      expectedSnapshotId: snapshotB,
      datasets: prior,
      priorImportState: priorState,
    })).resolves.toBe('STALE');
    expect((await db.readDatasets(OWNER)).exercise_blocks[0].name).toBe('CANDIDATE A');
    db.close();
  });

  it('keeps conditional transitions isolated across account namespaces', async () => {
    const databaseName = `absinthe.health.cross-account.${crypto.randomUUID()}`;
    const db = await createLocalHealthDriver({ databaseName });
    const priorA = minimalDatasets(OWNER, 'PRIOR A');
    const priorB = minimalDatasets(OTHER, 'PRIOR B');
    const stateA = await seedVerifiedAccount(db, OWNER, priorA, 'prior-a');
    const stateB = await seedVerifiedAccount(db, OTHER, priorB, 'prior-b');
    const transitionA = await commitPendingCandidate({
      db,
      accountId: OWNER,
      priorDatasets: priorA,
      priorImportState: stateA,
      candidate: minimalDatasets(OWNER, 'CANDIDATE A'),
      label: 'A',
    });
    const transitionB = await commitPendingCandidate({
      db,
      accountId: OTHER,
      priorDatasets: priorB,
      priorImportState: stateB,
      candidate: minimalDatasets(OTHER, 'CANDIDATE B'),
      label: 'B',
    });

    expect(await db.finalizePendingIfStillCurrent({
      accountId: OWNER,
      expectedSnapshotId: transitionA.snapshotId,
    })).toBe('APPLIED');
    await expect(db.recoverPendingImport(OTHER, transitionB.snapshotId)).resolves.toBe('RESTORED');
    const currentA = await db.readAccountSnapshot(OWNER);
    const currentB = await db.readAccountSnapshot(OTHER);
    expect(currentA.datasets.exercise_blocks[0].name).toBe('CANDIDATE A');
    expect(currentA.importState).toEqual(transitionA.verified);
    expect(currentB.datasets.exercise_blocks[0].name).toBe('PRIOR B');
    expect(currentB.importState).toEqual(stateB);
    db.close();
  });
});

describe('local Health backfill writes', () => {
  it('creates a historical workout, keeps its date, and survives reload', async () => {
    const databaseName = `absinthe.health.backfill-workout.${crypto.randomUUID()}`;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const first = await createLocalHealthDriver({ databaseName });
    const datasets = minimalDatasets(OWNER, 'BACKFILL BLOCK');
    await seedVerifiedAccount(first, OWNER, datasets, 'backfill');
    const blockId = datasets.exercise_blocks[0].id as string;
    const result = await new HealthRepository(first, OWNER).saveWorkout(localWorkoutInput(blockId, '2024-04-12'));
    expect(result.date).toBe('2024-04-12');
    expect((await first.readAccountSnapshot(OWNER)).datasets.workout_logs).toHaveLength(1);
    expect((await first.readAccountSnapshot(OWNER)).datasets.workout_logs[0]).toMatchObject({ date: '2024-04-12', block_id: blockId });
    expect(fetchSpy).not.toHaveBeenCalled();
    first.close();
    const reopened = await createLocalHealthDriver({ databaseName });
    expect((await new HealthRepository(reopened, OWNER).readAll()).workout_logs).toHaveLength(1);
    expect((await reopened.readDatasets(OWNER)).workout_logs[0].date).toBe('2024-04-12');
    reopened.close();
  });

  it('replaces the same date/block logical workout without duplicating and preserves identity', async () => {
    const databaseName = `absinthe.health.backfill-workout-update.${crypto.randomUUID()}`;
    const db = await createLocalHealthDriver({ databaseName });
    const datasets = minimalDatasets(OWNER, 'BLOCK');
    await seedVerifiedAccount(db, OWNER, datasets, 'backfill');
    const blockId = datasets.exercise_blocks[0].id as string;
    const repository = new HealthRepository(db, OWNER);
    const first = await repository.saveWorkout(localWorkoutInput(blockId, '2024-04-12', 60));
    const second = await repository.saveWorkout(localWorkoutInput(blockId, '2024-04-12', 75, first.id, first.version));
    expect(second.id).toBe(first.id);
    const snapshot = await db.readAccountSnapshot(OWNER);
    expect(snapshot.datasets.workout_logs).toHaveLength(1);
    expect(snapshot.datasets.workout_logs[0].sets).toEqual([{ type: 'strength', set: 1, kg: 75, reps: 8, done: true }]);
    db.close();
  });

  it('aborts a failed workout replacement without deleting the durable prior row', async () => {
    const databaseName = `absinthe.health.backfill-workout-failure.${crypto.randomUUID()}`;
    const seed = await createLocalHealthDriver({ databaseName });
    const datasets = minimalDatasets(OWNER, 'BLOCK');
    await seedVerifiedAccount(seed, OWNER, datasets, 'backfill');
    const blockId = datasets.exercise_blocks[0].id as string;
    const repository = new HealthRepository(seed, OWNER);
    const original = await repository.saveWorkout(localWorkoutInput(blockId, '2024-04-12', 60));
    seed.close();
    const failing = await createLocalHealthDriver({ databaseName, testHooks: { failLocalWriteAfterDelete: 'workout' } });
    await expect(new HealthRepository(failing, OWNER).saveWorkout(
      localWorkoutInput(blockId, '2024-04-12', 90, original.id, original.version),
    )).rejects.toThrow('health_local_workout_write_injected_failure');
    const snapshot = await failing.readAccountSnapshot(OWNER);
    expect(snapshot.datasets.workout_logs[0].sets).toEqual([{ type: 'strength', set: 1, kg: 60, reps: 8, done: true }]);
    failing.close();
  });

  it('deletes only the exact local workout and persists deletion across reload', async () => {
    const databaseName = `absinthe.health.backfill-workout-delete.${crypto.randomUUID()}`;
    const db = await createLocalHealthDriver({ databaseName });
    const datasets = minimalDatasets(OWNER, 'BLOCK');
    await seedVerifiedAccount(db, OWNER, datasets, 'backfill');
    const repository = new HealthRepository(db, OWNER);
    const saved = await repository.saveWorkout(localWorkoutInput(datasets.exercise_blocks[0].id as string, '2024-04-12'));
    await repository.deleteWorkout(saved.id, saved.version);
    expect((await db.readAccountSnapshot(OWNER)).datasets.workout_logs).toHaveLength(0);
    db.close();
    const reopened = await createLocalHealthDriver({ databaseName });
    expect((await reopened.readDatasets(OWNER)).workout_logs).toHaveLength(0);
    reopened.close();
  });

  it('supports InBody create, same-date update, distinct historical date, and reload', async () => {
    const databaseName = `absinthe.health.backfill-inbody.${crypto.randomUUID()}`;
    const db = await createLocalHealthDriver({ databaseName });
    const datasets = minimalDatasets(OWNER, 'BLOCK');
    await seedVerifiedAccount(db, OWNER, datasets, 'backfill');
    const repository = new HealthRepository(db, OWNER);
    const first = await repository.saveInbody({
      date: '2024-04-12', weight: 70, smm: 35, pbf: 15, expectedVersion: null,
    });
    const updated = await repository.saveInbody({
      id: first.id,
      date: '2024-04-12',
      weight: 69,
      smm: 35.5,
      pbf: 14.5,
      expectedVersion: first.version,
    });
    expect(updated.id).toBe(first.id);
    await repository.saveInbody({
      date: '2024-04-13', weight: 68, smm: 35.2, pbf: 14, expectedVersion: null,
    });
    const current = (await db.readAccountSnapshot(OWNER)).datasets.inbody_logs;
    expect(current).toHaveLength(2);
    expect(current.find(row => row.date === '2024-04-12')).toMatchObject({ weight: 69, smm: 35.5, pbf: 14.5 });
    const updatedState = await db.readImportState(OWNER);
    expect(updatedState?.datasetCounts.inbody_logs).toBe(2);
    expect(updatedState?.totalRowCount).toBe(3);
    db.close();
    const reopened = await createLocalHealthDriver({ databaseName });
    const reloaded = (await new HealthRepository(reopened, OWNER).readAll()).inbody_logs;
    expect(reloaded).toHaveLength(2);
    expect(reloaded.find(row => row.date === '2024-04-12')).toMatchObject({
      weight: 69, smm: 35.5, pbf: 14.5,
    });
    reopened.close();
  });

  it('rejects malformed writes, pending authority, wrong account, and preserves prior state on InBody failure', async () => {
    const databaseName = `absinthe.health.backfill-gates.${crypto.randomUUID()}`;
    const db = await createLocalHealthDriver({ databaseName });
    const datasets = minimalDatasets(OWNER, 'BLOCK');
    await seedVerifiedAccount(db, OWNER, datasets, 'backfill');
    const blockId = datasets.exercise_blocks[0].id as string;
    const repository = new HealthRepository(db, OWNER);
    await expect(repository.saveWorkout(localWorkoutInput(blockId, 'not-a-date'))).rejects.toThrow('health_local_workout_date_invalid');
    await expect(repository.saveInbody({
      date: '2024-04-12', weight: Number.NaN, smm: 35, pbf: 15, expectedVersion: null,
    })).rejects.toThrow('health_local_inbody_weight_invalid');
    const other = new HealthRepository(db, OTHER);
    await expect(other.saveWorkout(localWorkoutInput(blockId, '2024-04-12'))).rejects.toThrow('health_local_write_authority_not_verified');
    const saved = await repository.saveInbody({
      date: '2024-04-12', weight: 70, smm: 35, pbf: 15, expectedVersion: null,
    });
    db.close();
    const failing = await createLocalHealthDriver({ databaseName, testHooks: { failLocalWriteAfterDelete: 'inbody' } });
    await expect(new HealthRepository(failing, OWNER).saveInbody({
      id: saved.id,
      date: '2024-04-12',
      weight: 60,
      smm: 30,
      pbf: 20,
      expectedVersion: saved.version,
    })).rejects.toThrow('health_local_inbody_write_injected_failure');
    expect((await failing.readDatasets(OWNER)).inbody_logs[0]).toMatchObject({ weight: 70, smm: 35, pbf: 15 });
    failing.close();

    const pendingDatabase = `absinthe.health.backfill-pending.${crypto.randomUUID()}`;
    await seedPendingCandidate({ databaseName: pendingDatabase });
    const pending = await createLocalHealthDriver({ databaseName: pendingDatabase });
    await expect(new HealthRepository(pending, OWNER).saveWorkout(localWorkoutInput(blockId, '2024-04-12'))).rejects.toThrow('health_local_write_authority_not_verified');
    pending.close();
  });

  it('rejects deterministic stale workout writers in both commit orders', async () => {
    const databaseName = `absinthe.health.backfill-concurrent.${crypto.randomUUID()}`;
    const seed = await createLocalHealthDriver({ databaseName });
    const datasets = minimalDatasets(OWNER, 'BLOCK');
    await seedVerifiedAccount(seed, OWNER, datasets, 'backfill');
    const first = await createLocalHealthDriver({ databaseName });
    const second = await createLocalHealthDriver({ databaseName });
    const blockId = datasets.exercise_blocks[0].id as string;
    const seedRepository = new HealthRepository(seed, OWNER);
    const originalA = await seedRepository.saveWorkout(localWorkoutInput(blockId, '2024-04-12', 50));
    const originalB = await seedRepository.saveWorkout(localWorkoutInput(blockId, '2024-04-13', 50));
    const writerA = new HealthRepository(first, OWNER);
    const writerB = new HealthRepository(second, OWNER);

    const aWinner = await writerA.saveWorkout(
      localWorkoutInput(blockId, '2024-04-12', 60, originalA.id, originalA.version),
    );
    await expect(writerB.saveWorkout(
      localWorkoutInput(blockId, '2024-04-12', 70, originalA.id, originalA.version),
    )).rejects.toMatchObject({ code: 'health_local_write_conflict' });

    const bWinner = await writerB.saveWorkout(
      localWorkoutInput(blockId, '2024-04-13', 80, originalB.id, originalB.version),
    );
    await expect(writerA.saveWorkout(
      localWorkoutInput(blockId, '2024-04-13', 90, originalB.id, originalB.version),
    )).rejects.toMatchObject({ code: 'health_local_write_conflict' });

    const current = await first.readAccountSnapshot(OWNER);
    expect(current.datasets.workout_logs).toHaveLength(2);
    expect(current.datasets.workout_logs.find(row => row.date === '2024-04-12')?.sets[0].kg).toBe(60);
    expect(current.datasets.workout_logs.find(row => row.date === '2024-04-13')?.sets[0].kg).toBe(80);
    expect(aWinner.version).not.toBe(originalA.version);
    expect(bWinner.version).not.toBe(originalB.version);
    seed.close();
    first.close();
    second.close();
  });

  it('rejects deterministic stale InBody writers and preserves the committed winner', async () => {
    const databaseName = `absinthe.health.backfill-inbody-concurrent.${crypto.randomUUID()}`;
    const seed = await createLocalHealthDriver({ databaseName });
    await seedVerifiedAccount(seed, OWNER, minimalDatasets(OWNER, 'BLOCK'), 'backfill');
    const repository = new HealthRepository(seed, OWNER);
    const original = await repository.saveInbody({
      date: '2024-04-12', weight: 70, smm: 35, pbf: 15, expectedVersion: null,
    });
    const reverseOriginal = await repository.saveInbody({
      date: '2024-04-13', weight: 70, smm: 35, pbf: 15, expectedVersion: null,
    });
    const writerA = new HealthRepository(await createLocalHealthDriver({ databaseName }), OWNER);
    const writerB = new HealthRepository(await createLocalHealthDriver({ databaseName }), OWNER);

    const winner = await writerA.saveInbody({
      id: original.id,
      date: '2024-04-12',
      weight: 69,
      smm: 36,
      pbf: 14,
      expectedVersion: original.version,
    });
    await expect(writerB.saveInbody({
      id: original.id,
      date: '2024-04-12',
      weight: 68,
      smm: 37,
      pbf: 13,
      expectedVersion: original.version,
    })).rejects.toMatchObject({ code: 'health_local_write_conflict' });

    const reverseWinner = await writerB.saveInbody({
      id: reverseOriginal.id,
      date: '2024-04-13',
      weight: 68,
      smm: 37,
      pbf: 13,
      expectedVersion: reverseOriginal.version,
    });
    await expect(writerA.saveInbody({
      id: reverseOriginal.id,
      date: '2024-04-13',
      weight: 67,
      smm: 38,
      pbf: 12,
      expectedVersion: reverseOriginal.version,
    })).rejects.toMatchObject({ code: 'health_local_write_conflict' });

    const current = await seed.readAccountSnapshot(OWNER);
    expect(current.datasets.inbody_logs).toHaveLength(2);
    const currentWinner = current.datasets.inbody_logs.filter(row => row.date === '2024-04-12');
    const currentReverseWinner = current.datasets.inbody_logs.filter(row => row.date === '2024-04-13');
    expect(currentWinner[0]).toMatchObject({ weight: 69, smm: 36, pbf: 14 });
    expect(currentReverseWinner[0]).toMatchObject({ weight: 68, smm: 37, pbf: 13 });
    expect(computeLocalHealthLogicalVersion(currentWinner)).toBe(winner.version);
    expect(computeLocalHealthLogicalVersion(currentReverseWinner)).toBe(reverseWinner.version);
    seed.close();
  });

  it('updates record/count/total atomically and rolls back a failed delete', async () => {
    const databaseName = `absinthe.health.backfill-counts.${crypto.randomUUID()}`;
    const db = await createLocalHealthDriver({ databaseName });
    const datasets = minimalDatasets(OWNER, 'BLOCK');
    const initialState = await seedVerifiedAccount(db, OWNER, datasets, 'backfill');
    const repository = new HealthRepository(db, OWNER);
    const blockId = datasets.exercise_blocks[0].id as string;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const created = await repository.saveWorkout(localWorkoutInput(blockId, '2024-04-12', 60));
    const createdSnapshot = await db.readAccountSnapshot(OWNER);
    expect(createdSnapshot.datasets.workout_logs).toHaveLength(1);
    expect(createdSnapshot.importState?.datasetCounts.workout_logs).toBe(1);
    expect(createdSnapshot.importState?.totalRowCount).toBe(initialState.totalRowCount + 1);

    const updated = await repository.saveWorkout(
      localWorkoutInput(blockId, '2024-04-12', 75, created.id, created.version),
    );
    const updatedSnapshot = await db.readAccountSnapshot(OWNER);
    expect(updatedSnapshot.datasets.workout_logs).toHaveLength(1);
    expect(updatedSnapshot.datasets.workout_logs[0].sets[0].kg).toBe(75);
    expect(updatedSnapshot.importState?.datasetCounts.workout_logs).toBe(1);
    expect(updatedSnapshot.importState?.totalRowCount).toBe(initialState.totalRowCount + 1);
    db.close();

    const failing = await createLocalHealthDriver({
      databaseName,
      testHooks: { failLocalWriteAfterDelete: 'workout-delete' },
    });
    await expect(new HealthRepository(failing, OWNER).deleteWorkout(updated.id, updated.version))
      .rejects.toThrow('health_local_workout_delete_injected_failure');
    const rolledBack = await failing.readAccountSnapshot(OWNER);
    expect(rolledBack.datasets.workout_logs).toEqual(updatedSnapshot.datasets.workout_logs);
    expect(rolledBack.importState).toEqual(updatedSnapshot.importState);
    failing.close();

    const reopened = await createLocalHealthDriver({ databaseName });
    expect((await reopened.readAuthoritativeDatasets(OWNER)).workout_logs[0].sets[0].kg).toBe(75);
    await new HealthRepository(reopened, OWNER).deleteWorkout(updated.id, updated.version);
    const deleted = await reopened.readAccountSnapshot(OWNER);
    expect(deleted.datasets.workout_logs).toHaveLength(0);
    expect(deleted.importState?.datasetCounts.workout_logs).toBe(0);
    expect(deleted.importState?.totalRowCount).toBe(initialState.totalRowCount);
    expect(fetchSpy).not.toHaveBeenCalled();
    reopened.close();
  });

  it('blocks writes against mismatched or malformed durable authority metadata without repair', async () => {
    const cases: Array<{
      label: string;
      corrupt: (state: VerifiedLocalHealthImportState) => LocalHealthImportState;
      operation: 'workout' | 'inbody';
    }> = [
      {
        label: 'workout-count',
        corrupt: state => ({
          ...state,
          datasetCounts: { ...state.datasetCounts, workout_logs: state.datasetCounts.workout_logs + 1 },
          totalRowCount: state.totalRowCount + 1,
        }),
        operation: 'workout',
      },
      {
        label: 'inbody-count',
        corrupt: state => ({
          ...state,
          datasetCounts: { ...state.datasetCounts, inbody_logs: state.datasetCounts.inbody_logs + 1 },
          totalRowCount: state.totalRowCount + 1,
        }),
        operation: 'inbody',
      },
      {
        label: 'total',
        corrupt: state => ({ ...state, totalRowCount: state.totalRowCount + 1 }),
        operation: 'workout',
      },
      {
        label: 'dataset-shape',
        corrupt: state => {
          const malformed = structuredClone(state) as LocalHealthImportState;
          delete (malformed.datasetCounts as Partial<Record<HealthRecoveryDatasetName, number>>).workout_memos;
          return malformed;
        },
        operation: 'inbody',
      },
    ];

    for (const testCase of cases) {
      const databaseName = `absinthe.health.backfill-integrity.${testCase.label}.${crypto.randomUUID()}`;
      const db = await createLocalHealthDriver({ databaseName });
      const datasets = minimalDatasets(OWNER, 'BLOCK');
      const state = await seedVerifiedAccount(db, OWNER, datasets, 'backfill');
      const corrupted = testCase.corrupt(state);
      await overwriteImportStateForCorruptionTest(databaseName, corrupted);
      const before = await db.readAccountSnapshot(OWNER);
      const repository = new HealthRepository(db, OWNER);
      const operation = testCase.operation === 'workout'
        ? repository.saveWorkout(localWorkoutInput(datasets.exercise_blocks[0].id as string, '2024-04-12'))
        : repository.saveInbody({
            date: '2024-04-12', weight: 70, smm: 35, pbf: 15, expectedVersion: null,
          });
      await expect(operation).rejects.toThrow(/health_local_write_(?:authority_not_verified|integrity_failed)/);
      const after = await db.readAccountSnapshot(OWNER);
      expect(after.datasets).toEqual(before.datasets);
      expect(after.importState).toEqual(before.importState);
      db.close();
    }
  });

  it('preserves nullable InBody values through projection, edit, explicit zero, and reload', async () => {
    const databaseName = `absinthe.health.backfill-inbody-null.${crypto.randomUUID()}`;
    const db = await createLocalHealthDriver({ databaseName });
    const datasets = minimalDatasets(OWNER, 'BLOCK');
    const inbodyId = uuid(777, '3');
    datasets.inbody_logs.push({
      id: inbodyId,
      user_id: OWNER,
      date: '2024-04-12',
      weight: null,
      smm: 35,
      pbf: 15,
    });
    await seedVerifiedAccount(db, OWNER, datasets, 'backfill');
    const initialProjection = projectLocalHealthDaily(await db.readAuthoritativeDatasets(OWNER), '2024-04-12');
    expect(initialProjection.inbody).toMatchObject({ weight: null, smm: 35, pbf: 15 });

    const repository = new HealthRepository(db, OWNER);
    const edited = await repository.saveInbody({
      id: inbodyId,
      date: '2024-04-12',
      weight: null,
      smm: 36,
      pbf: 15,
      expectedVersion: initialProjection.inbody.local_version ?? null,
    });
    expect((await db.readAuthoritativeDatasets(OWNER)).inbody_logs[0]).toMatchObject({
      weight: null, smm: 36, pbf: 15,
    });

    await repository.saveInbody({
      id: inbodyId,
      date: '2024-04-12',
      weight: 0,
      smm: 36,
      pbf: 15,
      expectedVersion: edited.version,
    });
    db.close();
    const reopened = await createLocalHealthDriver({ databaseName });
    const reloaded = projectLocalHealthDaily(await reopened.readAuthoritativeDatasets(OWNER), '2024-04-12');
    expect(reloaded.inbody).toMatchObject({ weight: 0, smm: 36, pbf: 15 });
    reopened.close();
  });

  it('preserves every unrelated dataset, historical row, and anomaly fixture during backfill', async () => {
    const databaseName = `absinthe.health.backfill-history.${crypto.randomUUID()}`;
    const db = await createLocalHealthDriver({ databaseName });
    const datasets = syntheticDatasets();
    await seedVerifiedAccount(db, OWNER, datasets, 'backfill');
    const before = await db.readAuthoritativeDatasets(OWNER);
    const repository = new HealthRepository(db, OWNER);
    const blockId = before.exercise_blocks[0].id as string;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await repository.saveWorkout(localWorkoutInput(blockId, '2023-12-31', 77));
    await repository.saveInbody({
      date: '2023-12-31', weight: null, smm: 34.5, pbf: 16, expectedVersion: null,
    });
    const after = await db.readAuthoritativeDatasets(OWNER);
    for (const dataset of HEALTH_RECOVERY_DATASETS.filter(
      name => name !== 'workout_logs' && name !== 'inbody_logs',
    )) {
      expect(after[dataset]).toEqual(before[dataset]);
    }
    expect(after.workout_logs.filter(row => row.date !== '2023-12-31')).toEqual(before.workout_logs);
    expect(after.inbody_logs.filter(row => row.date !== '2023-12-31')).toEqual(before.inbody_logs);
    expect(after.health_routines[2].blocks).toEqual(expect.arrayContaining([MISSING_1, MISSING_2]));
    expect(after.routine_logs.filter(row => row.routine_id === null)).toHaveLength(109);
    expect(fetchSpy).not.toHaveBeenCalled();
    db.close();
  });

  it('keeps all local operations remote-free and local-visible when the remote key is empty', async () => {
    const databaseName = `absinthe.health.backfill-remote-free.${crypto.randomUUID()}`;
    const db = await createLocalHealthDriver({ databaseName });
    const datasets = minimalDatasets(OWNER, 'BLOCK');
    await seedVerifiedAccount(db, OWNER, datasets, 'backfill');
    const repository = new HealthRepository(db, OWNER);
    const blockId = datasets.exercise_blocks[0].id as string;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const workout = await repository.saveWorkout(localWorkoutInput(blockId, '2024-04-12', 60));
    await expect(repository.saveWorkout(localWorkoutInput(blockId, '2024-04-12', 61)))
      .rejects.toMatchObject({ code: 'health_local_write_conflict' });
    const updatedWorkout = await repository.saveWorkout(
      localWorkoutInput(blockId, '2024-04-12', 65, workout.id, workout.version),
    );
    await expect(repository.saveWorkout(
      localWorkoutInput(blockId, '2024-04-12', 70, workout.id, workout.version),
    )).rejects.toMatchObject({ code: 'health_local_write_conflict' });
    await expect(repository.saveWorkout(localWorkoutInput(blockId, 'invalid')))
      .rejects.toThrow('health_local_workout_date_invalid');

    const inbody = await repository.saveInbody({
      date: '2024-04-12', weight: null, smm: 35, pbf: 15, expectedVersion: null,
    });
    await expect(repository.saveInbody({
      date: '2024-04-12', weight: 71, smm: 35, pbf: 15, expectedVersion: null,
    })).rejects.toMatchObject({ code: 'health_local_write_conflict' });
    await repository.saveInbody({
      id: inbody.id,
      date: '2024-04-12',
      weight: 0,
      smm: 35,
      pbf: 15,
      expectedVersion: inbody.version,
    });
    await expect(repository.saveInbody({
      id: inbody.id,
      date: '2024-04-12',
      weight: 71,
      smm: 35,
      pbf: 15,
      expectedVersion: inbody.version,
    })).rejects.toMatchObject({ code: 'health_local_write_conflict' });

    expect(remoteSWRKey('/api/health')).toBeNull();
    const localProjection = projectLocalHealthDaily(
      await db.readAuthoritativeDatasets(OWNER),
      '2024-04-12',
    );
    expect(localProjection.workouts[0].sets[0].kg).toBe(65);
    expect(localProjection.inbody.weight).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();

    await repository.deleteWorkout(updatedWorkout.id, updatedWorkout.version);
    expect(fetchSpy).not.toHaveBeenCalled();
    db.close();
  });

  it('keeps independently verified account namespaces isolated during local writes', async () => {
    const databaseName = `absinthe.health.backfill-account-isolation.${crypto.randomUUID()}`;
    const db = await createLocalHealthDriver({ databaseName });
    const accountA = minimalDatasets(OWNER, 'A BLOCK');
    const accountB = minimalDatasets(OTHER, 'B BLOCK');
    await seedVerifiedAccount(db, OWNER, accountA, 'account-a');
    await seedVerifiedAccount(db, OTHER, accountB, 'account-b');
    const beforeB = await db.readAccountSnapshot(OTHER);

    await new HealthRepository(db, OWNER).saveWorkout(
      localWorkoutInput(accountA.exercise_blocks[0].id as string, '2024-04-12', 60),
    );
    await expect(new HealthRepository(db, OTHER).saveWorkout(
      localWorkoutInput(accountA.exercise_blocks[0].id as string, '2024-04-12', 70),
    )).rejects.toThrow('health_local_workout_block_not_found');

    expect(await db.readAccountSnapshot(OTHER)).toEqual(beforeB);
    expect((await db.readAccountSnapshot(OWNER)).datasets.workout_logs).toHaveLength(1);
    db.close();
  });
});

describe('local Health runtime projection helpers', () => {
  it('export account binding does not clear or expose history on an empty/other-account read', async () => {
    const { source, expectation } = await fixture();
    const db = await driver('empty-overwrite');
    await importVerifiedHealthRecovery({ source, expectation, driver: db });
    expect((await db.readDatasets(OTHER)).exercise_blocks).toEqual([]);
    expect((await db.readDatasets(OWNER)).exercise_blocks).toHaveLength(44);
    db.close();
  });
});
