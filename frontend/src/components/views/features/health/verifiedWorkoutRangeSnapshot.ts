import type { ExerciseBlock, WorkoutSet } from '../../../../types';
import type { HealthRecoveryDatasets, HealthRecoveryRecord } from '../../../../lib/healthRecoveryExport';
import { createLocalHealthRepository } from '../../../../lib/healthLocalRuntime';
import {
  HEALTH_ROUTINE_DEVICE_ID_KEY, readEstablishedWorkoutDeviceId,
} from '../../../../lib/workoutLocalReaderAuthority';
import { WorkoutRangeReader } from '../../../../lib/workoutRangeReader';
import type { SelectedDayCanonicalScope } from '../../../../lib/workoutSelectedDayReader';
import { LocalDatabaseError } from '../../../../lib/localDatabase/errors';
import {
  CompositeWorkoutReadIsolationError, projectCompositeWorkoutRead,
  type ActiveCanonicalWorkoutReadInput, type CompositeWorkoutReadResult,
  type CompositeWorkoutRecord, type LegacyWorkoutReadInput,
} from './compositeWorkoutReadProjection';

type DateBucket = Readonly<{
  localDate: string;
  legacyRows: readonly Extract<CompositeWorkoutRecord, { source: 'legacy' }>[];
  canonicalSessions: readonly Extract<CompositeWorkoutRecord, { source: 'canonical' }>[];
}>;

export type WorkoutReadSourceSnapshot = Readonly<{
  accountId: string;
  /** Null only when the canonical database could not be opened; never a fabricated namespace. */
  scope: SelectedDayCanonicalScope | null;
  result: CompositeWorkoutReadResult;
}>;

/** Borrowed read evidence, never a repository or an independently renewable lifetime. */
export type WorkoutReadSnapshotPublication = Readonly<{
  snapshot: WorkoutReadSourceSnapshot;
  /** Synchronous owner/device fence only; scope verification is also required before use. */
  isCurrent: () => boolean;
  verifyCurrent: () => Promise<boolean>;
}>;

export type WorkoutRangeView = Readonly<{
  accountId: string;
  scope: SelectedDayCanonicalScope | null;
  startDate: string;
  endDate: string;
  result: CompositeWorkoutReadResult;
  dates: readonly DateBucket[];
}>;

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month! < 1 || month! > 12) return false;
  const leap = year! % 4 === 0 && (year! % 100 !== 0 || year! % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day! >= 1 && day! <= days[month! - 1]!;
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

function catalogBlock(row: HealthRecoveryRecord): ExerciseBlock {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as string,
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    cardio_mode: row.cardio_mode === 'time' || row.cardio_mode === 'distance' || row.cardio_mode === 'both'
      ? row.cardio_mode : undefined,
  };
}

function historicalName(row: HealthRecoveryRecord, blockId: string): string {
  return ['exercise_name', 'block_name', 'exercise_block_name']
    .map(key => row[key])
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0)
    ?.trim() ?? `Historical exercise (${blockId.slice(0, 8)})`;
}

/** Adapt every persisted workout row before a date projection can drop its real identity. */
export function projectVerifiedWorkoutRangeLegacyRows(
  datasets: HealthRecoveryDatasets, accountId: string,
): readonly LegacyWorkoutReadInput[] {
  const catalog = new Map<string, ExerciseBlock>();
  for (const row of datasets.exercise_blocks) {
    if (row.user_id !== accountId) throw new CompositeWorkoutReadIsolationError('ACCOUNT_MISMATCH');
    if (typeof row.id !== 'string' || !row.id.trim() || catalog.has(row.id)
      || typeof row.name !== 'string' || !row.name.trim()
      || typeof row.type !== 'string' || !row.type.trim()) {
      throw new Error('workout_range_legacy_catalog_invalid');
    }
    catalog.set(row.id, catalogBlock(row));
  }

  const identities = new Set<string>();
  const records: LegacyWorkoutReadInput[] = [];
  for (const row of datasets.workout_logs) {
    if (row.user_id !== accountId) throw new CompositeWorkoutReadIsolationError('ACCOUNT_MISMATCH');
    if (typeof row.id !== 'string' || !row.id.trim() || !validDate(row.date)
      || typeof row.block_id !== 'string' || !row.block_id.trim() || row.block_id === '__session__'
      || !Number.isSafeInteger(row.sort_order) || (row.sort_order as number) < 0
      || !Array.isArray(row.sets)
      || row.sets.some(set => !set || typeof set !== 'object' || Array.isArray(set))) {
      throw new Error('workout_range_legacy_row_invalid');
    }
    const identity = JSON.stringify(['legacy', accountId, row.id]);
    if (identities.has(identity)) throw new Error('workout_range_legacy_duplicate_identity');
    identities.add(identity);
    const block = catalog.get(row.block_id);
    records.push({
      accountId, rowId: row.id, localDate: row.date, blockId: row.block_id,
      sortOrder: row.sort_order as number,
      exerciseDisplay: block
        ? { kind: 'current_catalog', block: structuredClone(block) }
        : { kind: 'historical_fallback', name: historicalName(row, row.block_id) },
      sets: structuredClone(row.sets) as WorkoutSet[],
    });
  }
  return records;
}

/** Pure inclusive derivation. The same frozen source snapshot can serve many ranges. */
export function deriveWorkoutRange(
  snapshot: WorkoutReadSourceSnapshot, startDate: string, endDate: string,
): WorkoutRangeView {
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) {
    throw new Error('workout_range_bounds_invalid');
  }
  const records = snapshot.result.records
    .filter(record => record.localDate >= startDate && record.localDate <= endDate)
    .map(record => structuredClone(record));
  const result = { ...snapshot.result, records } as CompositeWorkoutReadResult;
  const buckets = new Map<string, {
    legacyRows: Extract<CompositeWorkoutRecord, { source: 'legacy' }>[];
    canonicalSessions: Extract<CompositeWorkoutRecord, { source: 'canonical' }>[];
  }>();
  for (const record of records) {
    const bucket = buckets.get(record.localDate) ?? { legacyRows: [], canonicalSessions: [] };
    if (record.source === 'legacy') bucket.legacyRows.push(record);
    else bucket.canonicalSessions.push(record);
    buckets.set(record.localDate, bucket);
  }
  const dates = [...buckets].map(([localDate, bucket]) => ({ localDate, ...bucket }));
  return freezeDeep({
    accountId: snapshot.accountId, scope: snapshot.scope,
    startDate, endDate, result, dates,
  });
}

/** Explicitly invoked only; importing this dormant module does not read IDB or install listeners. */
export class WorkoutReadSnapshotCoordinator {
  private accountId: string;
  private sequence = 0;
  private closed = false;
  private snapshot: WorkoutReadSourceSnapshot | null = null;
  private reader: WorkoutRangeReader | null = null;
  private deviceAtPublication: string | null = null;
  private readonly inFlight = new Set<WorkoutRangeReader>();

  constructor(accountId: string, private readonly deviceStorage: Storage) {
    this.accountId = accountId.toLowerCase();
  }

  /** Loaded evidence; a future publisher must call verifyCurrentScope before exposing a derived view. */
  get currentSnapshot(): WorkoutReadSourceSnapshot | null { return this.snapshot; }

  /**
   * Capture THIS publication, not whichever snapshot happens to be current later.
   * Existing save/delete invalidation, load/retry, account changes and close all revoke it.
   * No domain scan is added; verifyCurrent reuses the reader's active-scope metadata fence.
   */
  captureCurrentSnapshot(): WorkoutReadSnapshotPublication | null {
    const snapshot = this.snapshot;
    const sequence = this.sequence;
    const accountId = this.accountId;
    const deviceId = this.deviceAtPublication;
    const isCurrent = () => {
      if (this.closed || !snapshot || this.sequence !== sequence || this.snapshot !== snapshot
        || this.accountId !== accountId || snapshot.accountId !== accountId) return false;
      if (this.deviceStorage.getItem(HEALTH_ROUTINE_DEVICE_ID_KEY) !== deviceId) {
        // Observe a device transition synchronously; restoring its string must not revive this token.
        this.invalidate();
        return false;
      }
      return true;
    };
    if (!snapshot || !isCurrent()) return null;
    return Object.freeze({
      snapshot,
      isCurrent,
      verifyCurrent: async () => {
        if (!isCurrent() || !await this.verifyCurrentScope()) return false;
        // An older continuation cannot borrow a newer publication (including account ABA).
        return isCurrent();
      },
    });
  }

  setAccount(accountId: string): void {
    if (this.closed) throw new Error('workout_range_coordinator_closed');
    this.invalidate();
    this.accountId = accountId.toLowerCase();
  }

  invalidate(): void {
    this.sequence += 1;
    this.snapshot = null;
    this.deviceAtPublication = null;
    this.reader?.close();
    this.reader = null;
    for (const reader of this.inFlight) reader.close();
    this.inFlight.clear();
  }

  retry(): Promise<WorkoutReadSourceSnapshot | null> { return this.load(); }

  async load(): Promise<WorkoutReadSourceSnapshot | null> {
    if (this.closed) throw new Error('workout_range_coordinator_closed');
    this.invalidate();
    const sequence = this.sequence;
    const accountId = this.accountId;
    // A first local open creates the shared device ID. Capture the post-creation value.
    // A malformed established ID is left untouched so the canonical source can fail closed.
    try { readEstablishedWorkoutDeviceId(this.deviceStorage); } catch { /* canonical open reports the error */ }
    const deviceAtStart = this.deviceStorage.getItem(HEALTH_ROUTINE_DEVICE_ID_KEY);
    const current = () => !this.closed && this.sequence === sequence
      && this.accountId === accountId
      && this.deviceStorage.getItem(HEALTH_ROUTINE_DEVICE_ID_KEY) === deviceAtStart;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      let reader: WorkoutRangeReader | null = null;
      try {
        const canonicalPromise = (async (): Promise<readonly ActiveCanonicalWorkoutReadInput[]> => {
          reader = await WorkoutRangeReader.open(accountId, this.deviceStorage);
          if (!current()) { reader.close(); throw new Error('workout_range_load_superseded'); }
          this.inFlight.add(reader);
          return reader.readAllActive();
        })();
        const legacyPromise = (async (): Promise<readonly LegacyWorkoutReadInput[]> => {
          const datasets = await (await createLocalHealthRepository(accountId)).readAll();
          return projectVerifiedWorkoutRangeLegacyRows(datasets, accountId);
        })();
        const [legacy, canonical] = await Promise.allSettled([legacyPromise, canonicalPromise]);
        if (!current()) return null;
        for (const source of [legacy, canonical]) {
          if (source.status === 'rejected' && source.reason instanceof CompositeWorkoutReadIsolationError) {
            throw source.reason;
          }
        }
        if (reader) await (reader as WorkoutRangeReader).verifyCurrentScope();
        if (!current()) return null;
        if (canonical.status === 'rejected' && canonical.reason instanceof LocalDatabaseError
          && canonical.reason.code === 'STALE_GENERATION' && attempt === 0) continue;
        const scope = reader ? (reader as WorkoutRangeReader).scope : null;
        const result = projectCompositeWorkoutRead({
          context: {
            accountId,
            // No canonical rows exist if open failed; these internal sentinels are never published as a scope.
            namespaceKey: scope?.namespaceKey ?? 'canonical-unavailable',
            generationId: scope?.generationId ?? 'canonical-unavailable',
          },
          legacy: legacy.status === 'fulfilled'
            ? { status: 'success', records: legacy.value } : { status: 'error' },
          canonical: canonical.status === 'fulfilled'
            ? { status: 'success', records: canonical.value } : { status: 'error' },
        });
        if (!current()) return null;
        const snapshot = freezeDeep({ accountId, scope, result });
        this.snapshot = snapshot;
        this.deviceAtPublication = deviceAtStart;
        this.reader = reader;
        if (reader) this.inFlight.delete(reader);
        return snapshot;
      } catch (error) {
        if (!current()) return null;
        if (error instanceof LocalDatabaseError && error.code === 'STALE_GENERATION' && attempt === 0) {
          continue;
        }
        throw error;
      } finally {
        const openedReader = reader as WorkoutRangeReader | null;
        if (openedReader && openedReader !== this.reader) {
          openedReader.close();
          this.inFlight.delete(openedReader);
        }
      }
    }
    throw new LocalDatabaseError('STALE_GENERATION', 'load_workout_range_snapshot');
  }

  async deriveRange(startDate: string, endDate: string): Promise<WorkoutRangeView | null> {
    const snapshot = this.snapshot;
    const sequence = this.sequence;
    const accountId = this.accountId;
    const deviceId = this.deviceAtPublication;
    if (this.closed || !snapshot || snapshot.accountId !== accountId) return null;
    if (!await this.verifyCurrentScope()) return null;
    // This is the final publication fence, including the reader-less partial path.
    if (this.closed || this.sequence !== sequence || this.snapshot !== snapshot
      || this.accountId !== accountId || snapshot.accountId !== accountId
      || this.deviceAtPublication !== deviceId
      || this.deviceStorage.getItem(HEALTH_ROUTINE_DEVICE_ID_KEY) !== deviceId) {
      // A stale continuation must never invalidate a newer snapshot.
      if (this.sequence === sequence && this.snapshot === snapshot) this.invalidate();
      return null;
    }
    return deriveWorkoutRange(snapshot, startDate, endDate);
  }

  /** A future owner can fence a loaded snapshot before publishing a derived view. */
  async verifyCurrentScope(): Promise<boolean> {
    const snapshot = this.snapshot;
    const reader = this.reader;
    const sequence = this.sequence;
    if (this.closed || !snapshot) return false;
    if (this.deviceStorage.getItem(HEALTH_ROUTINE_DEVICE_ID_KEY) !== this.deviceAtPublication) {
      this.invalidate();
      return false;
    }
    if (!reader) return this.sequence === sequence && this.snapshot === snapshot;
    try {
      await reader.verifyCurrentScope();
      return !this.closed && this.sequence === sequence && this.snapshot === snapshot;
    } catch {
      if (this.sequence === sequence && this.snapshot === snapshot) this.invalidate();
      return false;
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.invalidate();
  }
}
