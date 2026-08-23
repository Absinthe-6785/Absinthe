import {
  HEALTH_RECOVERY_DATASETS,
  HEALTH_RECOVERY_DATASET_DEFINITIONS,
  orderHealthRecoveryDatasets,
  validateHealthRecoveryDatasets,
  type HealthRecoveryDatasetName,
  type HealthRecoveryDatasets,
  type HealthRecoveryRecord,
  type HealthRecoveryExport,
} from './healthRecoveryExport';
import { stableRecoveryJson } from './recoveryExportPackage';

export const HEALTH_LOCAL_DATABASE_NAME = 'absinthe.health.local';
export const HEALTH_LOCAL_DATABASE_VERSION = 1;
export const HEALTH_LOCAL_IMPORT_STATE_STORE = 'health_recovery_state';
export const HEALTH_LOCAL_SNAPSHOT_STORE = 'health_recovery_snapshots';

const ACCOUNT_INDEX = 'accountId';
const ALL_STORES = [
  ...HEALTH_RECOVERY_DATASETS,
  HEALTH_LOCAL_IMPORT_STATE_STORE,
  HEALTH_LOCAL_SNAPSHOT_STORE,
] as const;

type StoredHealthRecord = {
  storageKey: string;
  accountId: string;
  record: HealthRecoveryRecord;
};

type LocalHealthImportStateBase = {
  accountId: string;
  importedAt: string;
  sourceFileSha256: string;
  sourceContentSha256: string;
  sourceExportedAt: string;
  totalRowCount: number;
  datasetCounts: Record<HealthRecoveryDatasetName, number>;
  diagnostics: HealthRecoveryExport['diagnostics'];
};

export type LocalHealthImportState = LocalHealthImportStateBase & (
  | { status: 'IMPORT_COMMITTED_PENDING_READBACK'; snapshotId: string }
  | { status: 'VERIFIED_IMPORT_COMPLETE'; snapshotId?: string }
);

export type PendingLocalHealthImportState = Extract<
  LocalHealthImportState,
  { status: 'IMPORT_COMMITTED_PENDING_READBACK' }
>;

export type VerifiedLocalHealthImportState = Extract<
  LocalHealthImportState,
  { status: 'VERIFIED_IMPORT_COMPLETE' }
>;

export type LocalHealthAccountSnapshot = {
  datasets: HealthRecoveryDatasets;
  importState: LocalHealthImportState | null;
};

export type LocalHealthConditionalTransitionResult = 'APPLIED' | 'STALE';
export type LocalHealthPendingRecoveryResult = 'NO_PENDING' | 'RESTORED' | 'STALE';

export type LocalWorkoutWriteInput = {
  id?: string;
  date: string;
  blockId: string;
  sets: HealthRecoveryRecord[];
  sortOrder: number;
  expectedVersion: string | null;
};

export type LocalInbodyWriteInput = {
  id?: string;
  date: string;
  weight: number | null;
  smm: number | null;
  pbf: number | null;
  expectedVersion: string | null;
};

export type LocalRoutineWriteInput = {
  id?: string;
  dayName: string;
  blocks: string[];
};

export type LocalRoutineWriteResult = {
  id: string;
  version: string;
};

export type LocalHealthWriteResult = {
  id: string;
  date: string;
  version: string;
};

export class LocalHealthWriteConflictError extends Error {
  readonly code = 'health_local_write_conflict';

  constructor(readonly resource: 'workout' | 'inbody') {
    super(`health_local_${resource}_write_conflict`);
    this.name = 'LocalHealthWriteConflictError';
  }
}

export function isLocalHealthWriteConflict(error: unknown): error is LocalHealthWriteConflictError {
  return error instanceof LocalHealthWriteConflictError;
}

export type LocalHealthSnapshot = {
  snapshotId: string;
  accountId: string;
  createdAt: string;
  payloadSha256: string;
  datasets: HealthRecoveryDatasets;
  priorImportState: LocalHealthImportState | null;
};

export interface LocalHealthDriver {
  readDatasets(accountId: string): Promise<HealthRecoveryDatasets>;
  readAccountSnapshot(accountId: string): Promise<LocalHealthAccountSnapshot>;
  readAuthoritativeDatasets(accountId: string): Promise<HealthRecoveryDatasets>;
  readImportState(accountId: string): Promise<LocalHealthImportState | null>;
  recoverPendingImport(accountId: string, expectedSnapshotId?: string): Promise<LocalHealthPendingRecoveryResult>;
  persistSnapshot(snapshot: LocalHealthSnapshot): Promise<void>;
  readSnapshot(snapshotId: string): Promise<LocalHealthSnapshot | null>;
  commitPendingImportAtomically(input: {
    accountId: string;
    datasets: HealthRecoveryDatasets;
    expectedImportState: LocalHealthImportState | null;
    pendingImportState: PendingLocalHealthImportState;
  }): Promise<void>;
  restorePendingIfStillCurrent(input: {
    accountId: string;
    expectedSnapshotId: string;
    datasets: HealthRecoveryDatasets;
    priorImportState: VerifiedLocalHealthImportState | null;
  }): Promise<LocalHealthConditionalTransitionResult>;
  finalizePendingIfStillCurrent(input: {
    accountId: string;
    expectedSnapshotId: string;
  }): Promise<LocalHealthConditionalTransitionResult>;
  saveWorkouts(accountId: string, inputs: LocalWorkoutWriteInput[]): Promise<LocalHealthWriteResult[]>;
  saveWorkout(input: LocalWorkoutWriteInput & { accountId: string }): Promise<LocalHealthWriteResult>;
  deleteWorkout(accountId: string, workoutId: string, expectedVersion: string): Promise<void>;
  saveInbody(input: LocalInbodyWriteInput & { accountId: string }): Promise<LocalHealthWriteResult>;
  saveRoutine(input: LocalRoutineWriteInput & { accountId: string }): Promise<LocalRoutineWriteResult>;
  putRecord(dataset: HealthRecoveryDatasetName, accountId: string, record: HealthRecoveryRecord): Promise<void>;
  deleteRecord(dataset: HealthRecoveryDatasetName, accountId: string, identity: string): Promise<void>;
  close(): void;
}

export type LocalHealthDriverTestHooks = {
  failSnapshotWrite?: boolean;
  failSnapshotReadback?: boolean;
  failAtomicWriteAt?: { dataset: HealthRecoveryDatasetName; rowIndex: number };
  failSuccessMarkerWrite?: boolean;
  onAuthoritativeReadTransactionCreated?: () => void;
  beforePendingRecoveryTransition?: () => void | Promise<void>;
  beforePendingFinalizeTransition?: () => void | Promise<void>;
  failLocalWriteAfterDelete?: 'workout' | 'workout-delete' | 'inbody' | 'routine';
};

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('health_indexeddb_request_failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('health_indexeddb_transaction_aborted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('health_indexeddb_transaction_failed'));
  });
}

function abortTransactionSafely(transaction: IDBTransaction): void {
  try {
    transaction.abort();
  } catch {
    // The transaction may already have auto-committed after its final request.
  }
}

function openDatabase(factory: IDBFactory, databaseName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(databaseName, HEALTH_LOCAL_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const dataset of HEALTH_RECOVERY_DATASETS) {
        if (db.objectStoreNames.contains(dataset)) continue;
        const store = db.createObjectStore(dataset, { keyPath: 'storageKey' });
        store.createIndex(ACCOUNT_INDEX, ACCOUNT_INDEX, { unique: false });
      }
      if (!db.objectStoreNames.contains(HEALTH_LOCAL_IMPORT_STATE_STORE)) {
        db.createObjectStore(HEALTH_LOCAL_IMPORT_STATE_STORE, { keyPath: 'accountId' });
      }
      if (!db.objectStoreNames.contains(HEALTH_LOCAL_SNAPSHOT_STORE)) {
        const store = db.createObjectStore(HEALTH_LOCAL_SNAPSHOT_STORE, { keyPath: 'snapshotId' });
        store.createIndex(ACCOUNT_INDEX, ACCOUNT_INDEX, { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('health_indexeddb_open_failed'));
    request.onblocked = () => reject(new Error('health_indexeddb_open_blocked'));
  });
}

function cloneRecord<T>(value: T): T {
  return structuredClone(value);
}

function recordIdentity(dataset: HealthRecoveryDatasetName, record: HealthRecoveryRecord): string {
  const field = HEALTH_RECOVERY_DATASET_DEFINITIONS[dataset].identityField;
  const value = record[field];
  if (typeof value !== 'string' || value.length === 0) throw new Error(`health_local_identity_missing:${dataset}:${field}`);
  return value;
}

function storageKey(dataset: HealthRecoveryDatasetName, accountId: string, record: HealthRecoveryRecord): string {
  return `${accountId}:${dataset}:${recordIdentity(dataset, record)}`;
}

function emptyDatasets(): HealthRecoveryDatasets {
  return Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(dataset => [dataset, []])) as unknown as HealthRecoveryDatasets;
}

function countsFor(datasets: HealthRecoveryDatasets): Record<HealthRecoveryDatasetName, number> {
  return Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(dataset => [dataset, datasets[dataset].length])) as Record<HealthRecoveryDatasetName, number>;
}

function totalRows(counts: Record<HealthRecoveryDatasetName, number>): number {
  return HEALTH_RECOVERY_DATASETS.reduce((sum, dataset) => sum + counts[dataset], 0);
}

function hasExactDatasetShape(value: unknown): value is HealthRecoveryDatasets {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const names = Object.keys(value).sort();
  if (stableRecoveryJson(names) !== stableRecoveryJson([...HEALTH_RECOVERY_DATASETS].sort())) return false;
  return HEALTH_RECOVERY_DATASETS.every(dataset => Array.isArray((value as Record<string, unknown>)[dataset]));
}

function isValidImportState(value: unknown, accountId: string): value is LocalHealthImportState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const state = value as Partial<LocalHealthImportState>;
  if (state.accountId !== accountId
    || (state.status !== 'IMPORT_COMMITTED_PENDING_READBACK' && state.status !== 'VERIFIED_IMPORT_COMPLETE')
    || typeof state.importedAt !== 'string'
    || typeof state.sourceFileSha256 !== 'string'
    || typeof state.sourceContentSha256 !== 'string'
    || typeof state.sourceExportedAt !== 'string'
    || !Number.isInteger(state.totalRowCount)
    || !state.datasetCounts
    || typeof state.datasetCounts !== 'object'
    || !state.diagnostics
    || typeof state.diagnostics !== 'object') return false;
  if (state.status === 'IMPORT_COMMITTED_PENDING_READBACK'
    && (typeof state.snapshotId !== 'string' || state.snapshotId.length === 0)) return false;
  const counts = state.datasetCounts as Partial<Record<HealthRecoveryDatasetName, unknown>>;
  return Object.keys(counts).length === HEALTH_RECOVERY_DATASETS.length
    && HEALTH_RECOVERY_DATASETS.every(dataset => Number.isInteger(counts[dataset]) && (counts[dataset] as number) >= 0)
    && totalRows(counts as Record<HealthRecoveryDatasetName, number>) === state.totalRowCount;
}

function isExactPendingState(
  value: unknown,
  accountId: string,
  snapshotId: string,
): value is PendingLocalHealthImportState {
  return isValidImportState(value, accountId)
    && value.status === 'IMPORT_COMMITTED_PENDING_READBACK'
    && value.snapshotId === snapshotId;
}

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isLocalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !LOCAL_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && LOCAL_UUID.test(value);
}

function isFiniteLocalNumber(value: unknown, allowEmpty = false): boolean {
  if (allowEmpty && value === '') return true;
  return (typeof value === 'number' && Number.isFinite(value))
    || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)));
}

function validateLocalWorkoutInput(input: LocalWorkoutWriteInput, accountId: string): void {
  if (!accountId || typeof accountId !== 'string') throw new Error('health_local_write_account_required');
  if (!isLocalDate(input.date)) throw new Error('health_local_workout_date_invalid');
  if (!isUuid(input.blockId)) throw new Error('health_local_workout_block_invalid');
  if (!Array.isArray(input.sets)) throw new Error('health_local_workout_sets_invalid');
  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0) throw new Error('health_local_workout_sort_order_invalid');
  if (input.id !== undefined && !isUuid(input.id)) throw new Error('health_local_workout_id_invalid');
  if (input.expectedVersion !== null
    && (typeof input.expectedVersion !== 'string' || input.expectedVersion.length === 0)) {
    throw new Error('health_local_workout_expected_version_invalid');
  }
  input.sets.forEach((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`health_local_workout_set_invalid:${index}`);
    const set = value as HealthRecoveryRecord;
    if (!Number.isInteger(set.set) || (set.set as number) < 1) throw new Error(`health_local_workout_set_number_invalid:${index}`);
    if (typeof set.done !== 'boolean') throw new Error(`health_local_workout_set_done_invalid:${index}`);
    if (set.type === 'strength' || set.type === 'bodyweight') {
      if (!isFiniteLocalNumber(set.kg, true) || !isFiniteLocalNumber(set.reps, true)) {
        throw new Error(`health_local_workout_set_measurement_invalid:${index}`);
      }
    } else if (set.type === 'cardio') {
      if (typeof set.time !== 'string' || !isFiniteLocalNumber(set.distance, true) || typeof set.pace !== 'string') {
        throw new Error(`health_local_workout_set_cardio_invalid:${index}`);
      }
    } else throw new Error(`health_local_workout_set_type_invalid:${index}`);
  });
}

function validateLocalInbodyInput(input: LocalInbodyWriteInput, accountId: string): void {
  if (!accountId || typeof accountId !== 'string') throw new Error('health_local_write_account_required');
  if (!isLocalDate(input.date)) throw new Error('health_local_inbody_date_invalid');
  if (input.id !== undefined && !isUuid(input.id)) throw new Error('health_local_inbody_id_invalid');
  if (input.expectedVersion !== null
    && (typeof input.expectedVersion !== 'string' || input.expectedVersion.length === 0)) {
    throw new Error('health_local_inbody_expected_version_invalid');
  }
  for (const [field, value] of [['weight', input.weight], ['smm', input.smm], ['pbf', input.pbf] as const]) {
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
      throw new Error(`health_local_inbody_${field}_invalid`);
    }
  }
}

function validateLocalRoutineInput(input: LocalRoutineWriteInput, accountId: string): void {
  if (!accountId || typeof accountId !== 'string') throw new Error('health_local_write_account_required');
  if (typeof input.dayName !== 'string' || input.dayName.trim() === '') {
    throw new Error('health_local_routine_day_invalid');
  }
  if (input.id !== undefined && !isUuid(input.id)) throw new Error('health_local_routine_id_invalid');
  if (!Array.isArray(input.blocks) || !input.blocks.every(isUuid)) {
    throw new Error('health_local_routine_blocks_invalid');
  }
}

export function computeLocalHealthLogicalVersion(records: readonly HealthRecoveryRecord[]): string | null {
  if (records.length === 0) return null;
  const ordered = records
    .map(record => cloneRecord(record))
    .sort((left, right) => {
      const leftJson = stableRecoveryJson(left);
      const rightJson = stableRecoveryJson(right);
      return leftJson < rightJson ? -1 : leftJson > rightJson ? 1 : 0;
    });
  return stableRecoveryJson(ordered);
}

function adjustVerifiedStateCount(
  state: VerifiedLocalHealthImportState,
  dataset: HealthRecoveryDatasetName,
  delta: number,
): VerifiedLocalHealthImportState {
  const nextCount = state.datasetCounts[dataset] + delta;
  if (nextCount < 0) throw new Error('health_local_write_count_underflow');
  return {
    ...state,
    datasetCounts: { ...state.datasetCounts, [dataset]: nextCount },
    totalRowCount: state.totalRowCount + delta,
  };
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function computeLocalHealthSnapshotPayloadSha256(
  value: Omit<LocalHealthSnapshot, 'payloadSha256'>,
): Promise<string> {
  return sha256(stableRecoveryJson(value));
}

function assertDatasetsValid(datasets: unknown, accountId: string, code: string): asserts datasets is HealthRecoveryDatasets {
  if (!hasExactDatasetShape(datasets) || validateHealthRecoveryDatasets(datasets, accountId).length > 0) {
    throw new Error(code);
  }
}

function datasetsEqual(left: HealthRecoveryDatasets, right: HealthRecoveryDatasets): boolean {
  return stableRecoveryJson(orderHealthRecoveryDatasets(left)) === stableRecoveryJson(orderHealthRecoveryDatasets(right));
}

async function deleteAccountRows(store: IDBObjectStore, accountId: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = store.index(ACCOUNT_INDEX).openKeyCursor(IDBKeyRange.only(accountId));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      store.delete(cursor.primaryKey);
      cursor.continue();
    };
    request.onerror = () => reject(request.error ?? new Error('health_indexeddb_account_scan_failed'));
  });
}

export class IndexedDbLocalHealthDriver implements LocalHealthDriver {
  private constructor(
    private readonly db: IDBDatabase,
    private readonly hooks: LocalHealthDriverTestHooks,
  ) {}

  static async open(options: {
    indexedDBFactory?: IDBFactory;
    databaseName?: string;
    testHooks?: LocalHealthDriverTestHooks;
  } = {}): Promise<IndexedDbLocalHealthDriver> {
    const factory = options.indexedDBFactory ?? globalThis.indexedDB;
    if (!factory) throw new Error('health_indexeddb_unavailable');
    const db = await openDatabase(factory, options.databaseName ?? HEALTH_LOCAL_DATABASE_NAME);
    for (const store of ALL_STORES) {
      if (!db.objectStoreNames.contains(store)) {
        db.close();
        throw new Error(`health_indexeddb_store_missing:${store}`);
      }
    }
    return new IndexedDbLocalHealthDriver(db, options.testHooks ?? {});
  }

  async readDatasets(accountId: string): Promise<HealthRecoveryDatasets> {
    const datasets = emptyDatasets();
    const tx = this.db.transaction([...HEALTH_RECOVERY_DATASETS], 'readonly');
    await Promise.all(HEALTH_RECOVERY_DATASETS.map(async dataset => {
      const stored = await requestResult(tx.objectStore(dataset).index(ACCOUNT_INDEX).getAll(accountId)) as StoredHealthRecord[];
      datasets[dataset] = stored.map(item => cloneRecord(item.record));
    }));
    await transactionDone(tx);
    return datasets;
  }

  private async readAccountSnapshotInTransaction(
    accountId: string,
    onTransactionCreated?: () => void,
  ): Promise<LocalHealthAccountSnapshot> {
    const datasets = emptyDatasets();
    const tx = this.db.transaction(
      [...HEALTH_RECOVERY_DATASETS, HEALTH_LOCAL_IMPORT_STATE_STORE],
      'readonly',
    );
    const completion = transactionDone(tx);
    try {
      onTransactionCreated?.();
      const stateRequest = requestResult(tx.objectStore(HEALTH_LOCAL_IMPORT_STATE_STORE).get(accountId));
      await Promise.all([
        stateRequest,
        ...HEALTH_RECOVERY_DATASETS.map(async dataset => {
          const stored = await requestResult(
            tx.objectStore(dataset).index(ACCOUNT_INDEX).getAll(accountId),
          ) as StoredHealthRecord[];
          datasets[dataset] = stored.map(item => cloneRecord(item.record));
        }),
      ]);
      await completion;
      const state = await stateRequest;
      return {
        datasets,
        importState: state ? cloneRecord(state as LocalHealthImportState) : null,
      };
    } catch (error) {
      abortTransactionSafely(tx);
      await completion.catch(() => undefined);
      throw error;
    }
  }

  readAccountSnapshot(accountId: string): Promise<LocalHealthAccountSnapshot> {
    return this.readAccountSnapshotInTransaction(accountId);
  }

  async readImportState(accountId: string): Promise<LocalHealthImportState | null> {
    const tx = this.db.transaction(HEALTH_LOCAL_IMPORT_STATE_STORE, 'readonly');
    const value = await requestResult(tx.objectStore(HEALTH_LOCAL_IMPORT_STATE_STORE).get(accountId));
    await transactionDone(tx);
    return value ? cloneRecord(value as LocalHealthImportState) : null;
  }

  async recoverPendingImport(
    accountId: string,
    expectedSnapshotId?: string,
  ): Promise<LocalHealthPendingRecoveryResult> {
    const state = await this.readImportState(accountId);
    if (state === null) return 'NO_PENDING';
    if (!isValidImportState(state, accountId)) throw new Error('health_import_state_malformed');
    if (state.status === 'VERIFIED_IMPORT_COMPLETE') return 'NO_PENDING';
    if (expectedSnapshotId !== undefined && state.snapshotId !== expectedSnapshotId) return 'STALE';

    const snapshot = await this.readSnapshot(state.snapshotId);
    if (!snapshot) throw new Error('health_pending_snapshot_missing');
    if (snapshot.snapshotId !== state.snapshotId || snapshot.accountId !== accountId) {
      throw new Error('health_pending_snapshot_binding_mismatch');
    }
    const { payloadSha256, ...snapshotWithoutHash } = snapshot;
    if (typeof payloadSha256 !== 'string'
      || await computeLocalHealthSnapshotPayloadSha256(snapshotWithoutHash) !== payloadSha256) {
      throw new Error('health_pending_snapshot_hash_mismatch');
    }
    assertDatasetsValid(snapshot.datasets, accountId, 'health_pending_snapshot_content_malformed');
    if (snapshot.priorImportState !== null
      && (!isValidImportState(snapshot.priorImportState, accountId)
        || snapshot.priorImportState.status !== 'VERIFIED_IMPORT_COMPLETE')) {
      throw new Error('health_pending_snapshot_prior_state_malformed');
    }
    if (snapshot.priorImportState) {
      const snapshotCounts = countsFor(snapshot.datasets);
      if (stableRecoveryJson(snapshotCounts) !== stableRecoveryJson(snapshot.priorImportState.datasetCounts)
        || totalRows(snapshotCounts) !== snapshot.priorImportState.totalRowCount) {
        throw new Error('health_pending_snapshot_prior_state_mismatch');
      }
    }

    const transition = await this.restorePendingIfStillCurrent({
      accountId,
      expectedSnapshotId: state.snapshotId,
      datasets: snapshot.datasets,
      priorImportState: snapshot.priorImportState,
    });
    if (transition === 'STALE') return 'STALE';
    const restored = await this.readAccountSnapshot(accountId);
    if (!datasetsEqual(restored.datasets, snapshot.datasets)
      || stableRecoveryJson(restored.importState) !== stableRecoveryJson(snapshot.priorImportState)) {
      throw new Error('health_pending_snapshot_restore_verification_failed');
    }
    return 'RESTORED';
  }

  async readAuthoritativeDatasets(accountId: string): Promise<HealthRecoveryDatasets> {
    await this.recoverPendingImport(accountId);
    const snapshot = await this.readAccountSnapshotInTransaction(
      accountId,
      this.hooks.onAuthoritativeReadTransactionCreated,
    );
    const state = snapshot.importState;
    if (!isValidImportState(state, accountId) || state.status !== 'VERIFIED_IMPORT_COMPLETE') {
      throw new Error('health_local_data_not_verified');
    }
    const datasets = snapshot.datasets;
    assertDatasetsValid(datasets, accountId, 'health_local_verified_data_malformed');
    const counts = countsFor(datasets);
    if (stableRecoveryJson(counts) !== stableRecoveryJson(state.datasetCounts)
      || totalRows(counts) !== state.totalRowCount) {
      throw new Error('health_local_verified_state_mismatch');
    }
    return orderHealthRecoveryDatasets(datasets);
  }

  async persistSnapshot(snapshot: LocalHealthSnapshot): Promise<void> {
    if (this.hooks.failSnapshotWrite) throw new Error('health_snapshot_persistence_failed');
    const tx = this.db.transaction(HEALTH_LOCAL_SNAPSHOT_STORE, 'readwrite');
    tx.objectStore(HEALTH_LOCAL_SNAPSHOT_STORE).add(cloneRecord(snapshot));
    await transactionDone(tx);
  }

  async readSnapshot(snapshotId: string): Promise<LocalHealthSnapshot | null> {
    if (this.hooks.failSnapshotReadback) throw new Error('health_snapshot_readback_failed');
    const tx = this.db.transaction(HEALTH_LOCAL_SNAPSHOT_STORE, 'readonly');
    const value = await requestResult(tx.objectStore(HEALTH_LOCAL_SNAPSHOT_STORE).get(snapshotId));
    await transactionDone(tx);
    return value ? cloneRecord(value as LocalHealthSnapshot) : null;
  }

  async commitPendingImportAtomically(input: {
    accountId: string;
    datasets: HealthRecoveryDatasets;
    expectedImportState: LocalHealthImportState | null;
    pendingImportState: PendingLocalHealthImportState;
  }): Promise<void> {
    assertDatasetsValid(input.datasets, input.accountId, 'health_pending_import_content_malformed');
    if (input.expectedImportState !== null
      && (!isValidImportState(input.expectedImportState, input.accountId)
        || input.expectedImportState.status !== 'VERIFIED_IMPORT_COMPLETE')) {
      throw new Error('health_import_expected_state_not_stable');
    }
    if (!isExactPendingState(
      input.pendingImportState,
      input.accountId,
      input.pendingImportState.snapshotId,
    )) throw new Error('health_pending_import_state_malformed');
    const tx = this.db.transaction(
      [...HEALTH_RECOVERY_DATASETS, HEALTH_LOCAL_IMPORT_STATE_STORE],
      'readwrite',
    );
    const completion = transactionDone(tx);
    try {
      const stateStore = tx.objectStore(HEALTH_LOCAL_IMPORT_STATE_STORE);
      const currentState = await requestResult(stateStore.get(input.accountId));
      const normalizedCurrent = currentState ? cloneRecord(currentState as LocalHealthImportState) : null;
      if (stableRecoveryJson(normalizedCurrent) !== stableRecoveryJson(input.expectedImportState)) {
        throw new Error('health_import_start_state_changed');
      }
      await Promise.all(HEALTH_RECOVERY_DATASETS.map(dataset => deleteAccountRows(tx.objectStore(dataset), input.accountId)));
      for (const dataset of HEALTH_RECOVERY_DATASETS) {
        const store = tx.objectStore(dataset);
        input.datasets[dataset].forEach((record, rowIndex) => {
          const fail = this.hooks.failAtomicWriteAt;
          if (fail?.dataset === dataset && fail.rowIndex === rowIndex) {
            throw new Error(`health_atomic_import_injected_failure:${dataset}:${rowIndex}`);
          }
          store.add({
            storageKey: storageKey(dataset, input.accountId, record),
            accountId: input.accountId,
            record: cloneRecord(record),
          } satisfies StoredHealthRecord);
        });
      }
      stateStore.put(cloneRecord(input.pendingImportState));
    } catch (error) {
      abortTransactionSafely(tx);
      await completion.catch(() => undefined);
      throw error;
    }
    await completion;
  }

  async restorePendingIfStillCurrent(input: {
    accountId: string;
    expectedSnapshotId: string;
    datasets: HealthRecoveryDatasets;
    priorImportState: VerifiedLocalHealthImportState | null;
  }): Promise<LocalHealthConditionalTransitionResult> {
    assertDatasetsValid(input.datasets, input.accountId, 'health_pending_snapshot_content_malformed');
    if (input.priorImportState !== null
      && (!isValidImportState(input.priorImportState, input.accountId)
        || input.priorImportState.status !== 'VERIFIED_IMPORT_COMPLETE')) {
      throw new Error('health_pending_snapshot_prior_state_malformed');
    }
    if (input.priorImportState) {
      const restoredCounts = countsFor(input.datasets);
      if (stableRecoveryJson(restoredCounts) !== stableRecoveryJson(input.priorImportState.datasetCounts)
        || totalRows(restoredCounts) !== input.priorImportState.totalRowCount) {
        throw new Error('health_pending_snapshot_prior_state_mismatch');
      }
    }
    await this.hooks.beforePendingRecoveryTransition?.();
    const tx = this.db.transaction(
      [...HEALTH_RECOVERY_DATASETS, HEALTH_LOCAL_IMPORT_STATE_STORE],
      'readwrite',
    );
    const completion = transactionDone(tx);
    try {
      const stateStore = tx.objectStore(HEALTH_LOCAL_IMPORT_STATE_STORE);
      const currentState = await requestResult(stateStore.get(input.accountId));
      if (!isExactPendingState(currentState, input.accountId, input.expectedSnapshotId)) {
        await completion;
        return 'STALE';
      }
      await Promise.all(HEALTH_RECOVERY_DATASETS.map(dataset => deleteAccountRows(tx.objectStore(dataset), input.accountId)));
      for (const dataset of HEALTH_RECOVERY_DATASETS) {
        const store = tx.objectStore(dataset);
        input.datasets[dataset].forEach(record => {
          store.add({
            storageKey: storageKey(dataset, input.accountId, record),
            accountId: input.accountId,
            record: cloneRecord(record),
          } satisfies StoredHealthRecord);
        });
      }
      if (input.priorImportState) stateStore.put(cloneRecord(input.priorImportState));
      else stateStore.delete(input.accountId);
    } catch (error) {
      abortTransactionSafely(tx);
      await completion.catch(() => undefined);
      throw error;
    }
    await completion;
    return 'APPLIED';
  }

  async finalizePendingIfStillCurrent(input: {
    accountId: string;
    expectedSnapshotId: string;
  }): Promise<LocalHealthConditionalTransitionResult> {
    if (this.hooks.failSuccessMarkerWrite) throw new Error('health_import_success_marker_write_failed');
    await this.hooks.beforePendingFinalizeTransition?.();
    const tx = this.db.transaction(HEALTH_LOCAL_IMPORT_STATE_STORE, 'readwrite');
    const completion = transactionDone(tx);
    try {
      const stateStore = tx.objectStore(HEALTH_LOCAL_IMPORT_STATE_STORE);
      const currentState = await requestResult(stateStore.get(input.accountId));
      if (!isExactPendingState(currentState, input.accountId, input.expectedSnapshotId)) {
        await completion;
        return 'STALE';
      }
      stateStore.put(cloneRecord({
        ...currentState,
        status: 'VERIFIED_IMPORT_COMPLETE',
      } satisfies VerifiedLocalHealthImportState));
    } catch (error) {
      abortTransactionSafely(tx);
      await completion.catch(() => undefined);
      throw error;
    }
    await completion;
    return 'APPLIED';
  }

  private async assertWritableState(
    tx: IDBTransaction,
    accountId: string,
  ): Promise<{ state: VerifiedLocalHealthImportState; datasets: HealthRecoveryDatasets }> {
    const datasets = emptyDatasets();
    const [current] = await Promise.all([
      requestResult(tx.objectStore(HEALTH_LOCAL_IMPORT_STATE_STORE).get(accountId)),
      ...HEALTH_RECOVERY_DATASETS.map(async dataset => {
        const stored = await requestResult(
          tx.objectStore(dataset).index(ACCOUNT_INDEX).getAll(accountId),
        ) as StoredHealthRecord[];
        datasets[dataset] = stored.map(item => cloneRecord(item.record));
      }),
    ]);
    if (!isValidImportState(current, accountId) || current.status !== 'VERIFIED_IMPORT_COMPLETE') {
      throw new Error('health_local_write_authority_not_verified');
    }
    assertDatasetsValid(datasets, accountId, 'health_local_write_integrity_failed');
    const actualCounts = countsFor(datasets);
    if (stableRecoveryJson(actualCounts) !== stableRecoveryJson(current.datasetCounts)
      || totalRows(actualCounts) !== current.totalRowCount) {
      throw new Error('health_local_write_integrity_failed');
    }
    return { state: current, datasets };
  }

  async saveWorkouts(accountId: string, inputs: LocalWorkoutWriteInput[]): Promise<LocalHealthWriteResult[]> {
    if (inputs.length === 0) throw new Error('health_local_workout_empty');
    inputs.forEach(input => validateLocalWorkoutInput(input, accountId));
    const logicalKeys = new Set<string>();
    for (const input of inputs) {
      const key = `${input.date}:${input.blockId}`;
      if (logicalKeys.has(key)) throw new Error('health_local_workout_duplicate_logical_key');
      logicalKeys.add(key);
    }
    const persistedIds = inputs.map(input => input.id ?? '');
    const persistedVersions = inputs.map(() => '');
    const tx = this.db.transaction(
      [...HEALTH_RECOVERY_DATASETS, HEALTH_LOCAL_IMPORT_STATE_STORE],
      'readwrite',
    );
    const completion = transactionDone(tx);
    try {
      const { state: currentState, datasets } = await this.assertWritableState(tx, accountId);
      const store = tx.objectStore('workout_logs');
      const existing = datasets.workout_logs.map(record => ({
        storageKey: storageKey('workout_logs', accountId, record),
        accountId,
        record,
      } satisfies StoredHealthRecord));
      const blockStore = tx.objectStore('exercise_blocks');
      let delta = 0;
      for (let index = 0; index < inputs.length; index += 1) {
        const input = inputs[index];
        const block = await requestResult(
          blockStore.get(`${accountId}:exercise_blocks:${input.blockId}`),
        ) as StoredHealthRecord | undefined;
        if (!block || block.accountId !== accountId || block.record.user_id !== accountId) {
          throw new Error('health_local_workout_block_not_found');
        }
        const sameLogicalKey = existing.filter(item => item.record.date === input.date && item.record.block_id === input.blockId);
        if (computeLocalHealthLogicalVersion(sameLogicalKey.map(item => item.record)) !== input.expectedVersion) {
          throw new LocalHealthWriteConflictError('workout');
        }
        delta += 1 - sameLogicalKey.length;
        persistedIds[index] = (sameLogicalKey.find(item => item.record.id === input.id)?.record.id as string | undefined)
          ?? (sameLogicalKey[0]?.record.id as string | undefined)
          ?? input.id
          ?? crypto.randomUUID();
        for (const item of sameLogicalKey) store.delete(item.storageKey);
        if (this.hooks.failLocalWriteAfterDelete === 'workout') throw new Error('health_local_workout_write_injected_failure');
        const nextRecord: HealthRecoveryRecord = {
          id: persistedIds[index],
          user_id: accountId,
          date: input.date,
          block_id: input.blockId,
          sets: cloneRecord(input.sets),
          sort_order: input.sortOrder,
        };
        store.put({
          storageKey: storageKey('workout_logs', accountId, { id: persistedIds[index] }),
          accountId,
          record: nextRecord,
        } satisfies StoredHealthRecord);
        persistedVersions[index] = computeLocalHealthLogicalVersion([nextRecord]) as string;
      }
      tx.objectStore(HEALTH_LOCAL_IMPORT_STATE_STORE).put(
        cloneRecord(adjustVerifiedStateCount(currentState, 'workout_logs', delta)),
      );
    } catch (error) {
      abortTransactionSafely(tx);
      await completion.catch(() => undefined);
      throw error;
    }
    await completion;
    return inputs.map((input, index) => ({
      id: persistedIds[index],
      date: input.date,
      version: persistedVersions[index],
    }));
  }

  async saveWorkout(input: LocalWorkoutWriteInput & { accountId: string }): Promise<LocalHealthWriteResult> {
    const [result] = await this.saveWorkouts(input.accountId, [input]);
    return result;
  }

  async deleteWorkout(accountId: string, workoutId: string, expectedVersion: string): Promise<void> {
    if (!accountId || typeof accountId !== 'string') throw new Error('health_local_write_account_required');
    if (!isUuid(workoutId)) throw new Error('health_local_workout_id_invalid');
    if (typeof expectedVersion !== 'string' || expectedVersion.length === 0) {
      throw new Error('health_local_workout_expected_version_invalid');
    }
    const tx = this.db.transaction([...HEALTH_RECOVERY_DATASETS, HEALTH_LOCAL_IMPORT_STATE_STORE], 'readwrite');
    const completion = transactionDone(tx);
    try {
      const { state: currentState } = await this.assertWritableState(tx, accountId);
      const store = tx.objectStore('workout_logs');
      const item = await requestResult(store.get(`${accountId}:workout_logs:${workoutId}`)) as StoredHealthRecord | undefined;
      if (!item || item.accountId !== accountId || item.record.user_id !== accountId) {
        throw new Error('health_local_workout_not_found');
      }
      if (computeLocalHealthLogicalVersion([item.record]) !== expectedVersion) {
        throw new LocalHealthWriteConflictError('workout');
      }
      store.delete(item.storageKey);
      if (this.hooks.failLocalWriteAfterDelete === 'workout-delete') {
        throw new Error('health_local_workout_delete_injected_failure');
      }
      tx.objectStore(HEALTH_LOCAL_IMPORT_STATE_STORE).put(
        cloneRecord(adjustVerifiedStateCount(currentState, 'workout_logs', -1)),
      );
    } catch (error) {
      abortTransactionSafely(tx);
      await completion.catch(() => undefined);
      throw error;
    }
    await completion;
  }

  async saveInbody(input: LocalInbodyWriteInput & { accountId: string }): Promise<LocalHealthWriteResult> {
    validateLocalInbodyInput(input, input.accountId);
    let persistedId = input.id ?? '';
    let persistedVersion = '';
    const tx = this.db.transaction([...HEALTH_RECOVERY_DATASETS, HEALTH_LOCAL_IMPORT_STATE_STORE], 'readwrite');
    const completion = transactionDone(tx);
    try {
      const { state: currentState, datasets } = await this.assertWritableState(tx, input.accountId);
      const store = tx.objectStore('inbody_logs');
      const existing = datasets.inbody_logs.map(record => ({
        storageKey: storageKey('inbody_logs', input.accountId, record),
        accountId: input.accountId,
        record,
      } satisfies StoredHealthRecord));
      const sameDate = existing.filter(item => item.record.date === input.date);
      if (computeLocalHealthLogicalVersion(sameDate.map(item => item.record)) !== input.expectedVersion) {
        throw new LocalHealthWriteConflictError('inbody');
      }
      persistedId = (sameDate.find(item => item.record.id === input.id)?.record.id as string | undefined)
        ?? (sameDate[0]?.record.id as string | undefined)
        ?? input.id
        ?? crypto.randomUUID();
      for (const item of sameDate) store.delete(item.storageKey);
      if (this.hooks.failLocalWriteAfterDelete === 'inbody') throw new Error('health_local_inbody_write_injected_failure');
      const nextRecord: HealthRecoveryRecord = {
        id: persistedId,
        user_id: input.accountId,
        date: input.date,
        weight: input.weight,
        smm: input.smm,
        pbf: input.pbf,
      };
      persistedVersion = computeLocalHealthLogicalVersion([nextRecord]) as string;
      store.put({
        storageKey: storageKey('inbody_logs', input.accountId, { id: persistedId }),
        accountId: input.accountId,
        record: nextRecord,
      } satisfies StoredHealthRecord);
      tx.objectStore(HEALTH_LOCAL_IMPORT_STATE_STORE).put(
        cloneRecord(adjustVerifiedStateCount(currentState, 'inbody_logs', 1 - sameDate.length)),
      );
    } catch (error) {
      abortTransactionSafely(tx);
      await completion.catch(() => undefined);
      throw error;
    }
    await completion;
    return {
      id: persistedId,
      date: input.date,
      version: persistedVersion,
    };
  }

  async saveRoutine(input: LocalRoutineWriteInput & { accountId: string }): Promise<LocalRoutineWriteResult> {
    validateLocalRoutineInput(input, input.accountId);
    let persistedId = input.id ?? '';
    let persistedVersion = '';
    const tx = this.db.transaction([...HEALTH_RECOVERY_DATASETS, HEALTH_LOCAL_IMPORT_STATE_STORE], 'readwrite');
    const completion = transactionDone(tx);
    try {
      const { state: currentState, datasets } = await this.assertWritableState(tx, input.accountId);
      const store = tx.objectStore('health_routines');
      const existing = datasets.health_routines.map(record => ({
        storageKey: storageKey('health_routines', input.accountId, record),
        accountId: input.accountId,
        record,
      } satisfies StoredHealthRecord));
      const existingById = input.id
        ? existing.find(item => item.record.id === input.id)
        : undefined;
      if (input.id && !existingById) throw new Error('health_local_routine_not_found');
      const sameDay = existing.filter(item => item.record.day_name === input.dayName);
      const rowsToReplace = existingById && !sameDay.some(item => item.record.id === existingById.record.id)
        ? [...sameDay, existingById]
        : sameDay;
      persistedId = existingById?.record.id as string | undefined
        ?? sameDay[0]?.record.id as string | undefined
        ?? crypto.randomUUID();
      for (const item of rowsToReplace) store.delete(item.storageKey);
      if (this.hooks.failLocalWriteAfterDelete === 'routine') throw new Error('health_local_routine_write_injected_failure');
      const nextRecord: HealthRecoveryRecord = {
        id: persistedId,
        user_id: input.accountId,
        day_name: input.dayName,
        blocks: [...input.blocks],
      };
      persistedVersion = computeLocalHealthLogicalVersion([nextRecord]) as string;
      store.put({
        storageKey: storageKey('health_routines', input.accountId, nextRecord),
        accountId: input.accountId,
        record: cloneRecord(nextRecord),
      } satisfies StoredHealthRecord);
      tx.objectStore(HEALTH_LOCAL_IMPORT_STATE_STORE).put(
        cloneRecord(adjustVerifiedStateCount(currentState, 'health_routines', 1 - rowsToReplace.length)),
      );
    } catch (error) {
      abortTransactionSafely(tx);
      await completion.catch(() => undefined);
      throw error;
    }
    await completion;
    return { id: persistedId, version: persistedVersion };
  }

  async putRecord(dataset: HealthRecoveryDatasetName, accountId: string, record: HealthRecoveryRecord): Promise<void> {
    if (record.user_id !== accountId) throw new Error('health_local_record_owner_mismatch');
    const tx = this.db.transaction(dataset, 'readwrite');
    tx.objectStore(dataset).put({
      storageKey: storageKey(dataset, accountId, record),
      accountId,
      record: cloneRecord(record),
    } satisfies StoredHealthRecord);
    await transactionDone(tx);
  }

  async deleteRecord(dataset: HealthRecoveryDatasetName, accountId: string, identity: string): Promise<void> {
    const tx = this.db.transaction(dataset, 'readwrite');
    tx.objectStore(dataset).delete(`${accountId}:${dataset}:${identity}`);
    await transactionDone(tx);
  }

  close(): void {
    this.db.close();
  }
}

export class HealthRepository {
  constructor(
    private readonly driver: LocalHealthDriver,
    readonly accountId: string,
  ) {
    if (!accountId) throw new Error('health_repository_account_required');
  }

  readAll(): Promise<HealthRecoveryDatasets> {
    return this.driver.readAuthoritativeDatasets(this.accountId);
  }

  readImportState(): Promise<LocalHealthImportState | null> {
    return this.driver.readImportState(this.accountId);
  }

  createOrUpdate(dataset: HealthRecoveryDatasetName, record: HealthRecoveryRecord): Promise<void> {
    return this.driver.putRecord(dataset, this.accountId, record);
  }

  delete(dataset: HealthRecoveryDatasetName, identity: string): Promise<void> {
    return this.driver.deleteRecord(dataset, this.accountId, identity);
  }

  saveWorkout(input: Omit<LocalWorkoutWriteInput, 'accountId'>): Promise<LocalHealthWriteResult> {
    return this.driver.saveWorkout({ ...input, accountId: this.accountId });
  }

  saveWorkouts(inputs: LocalWorkoutWriteInput[]): Promise<LocalHealthWriteResult[]> {
    return this.driver.saveWorkouts(this.accountId, inputs);
  }

  deleteWorkout(workoutId: string, expectedVersion: string): Promise<void> {
    return this.driver.deleteWorkout(this.accountId, workoutId, expectedVersion);
  }

  saveInbody(input: Omit<LocalInbodyWriteInput, 'accountId'>): Promise<LocalHealthWriteResult> {
    return this.driver.saveInbody({ ...input, accountId: this.accountId });
  }

  saveRoutine(input: LocalRoutineWriteInput): Promise<LocalRoutineWriteResult> {
    return this.driver.saveRoutine({ ...input, accountId: this.accountId });
  }
}

export async function createLocalHealthDriver(options: {
  indexedDBFactory?: IDBFactory;
  databaseName?: string;
  testHooks?: LocalHealthDriverTestHooks;
} = {}): Promise<IndexedDbLocalHealthDriver> {
  return IndexedDbLocalHealthDriver.open(options);
}
