import type { ExerciseBlock, WorkoutSet } from '../../../../types';
import { validateWorkoutSessionV1, type WorkoutSessionV1 } from '../../../../lib/workoutSessionV1';

type DeepReadonly<T> = T extends readonly (infer Item)[]
  ? readonly DeepReadonly<Item>[]
  : T extends object ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> } : T;

export type SourceRead<T> =
  | Readonly<{ status: 'success'; records: readonly T[] }>
  | Readonly<{ status: 'error' }>;

/** The loader supplies persisted legacy rows, never transient Workout[] drafts. */
export interface LegacyWorkoutReadInput {
  readonly accountId: string;
  readonly rowId: string;
  readonly localDate: string;
  readonly blockId: string;
  readonly sortOrder: number;
  readonly exerciseDisplay:
    | Readonly<{ kind: 'current_catalog'; block: DeepReadonly<ExerciseBlock> }>
    | Readonly<{ kind: 'historical_fallback'; name: string }>;
  readonly sets: readonly DeepReadonly<WorkoutSet>[];
}

/** Only a loader/repository may construct this active-only, validated read view. */
export interface ActiveCanonicalWorkoutReadInput {
  readonly accountId: string;
  readonly namespaceKey: string;
  readonly generationId: string;
  readonly entityId: string;
  readonly localRevision: number;
  readonly session: DeepReadonly<WorkoutSessionV1>;
}

export interface CompositeWorkoutReadContext {
  readonly accountId: string;
  readonly namespaceKey: string;
  readonly generationId: string;
}

export type CompositeWorkoutReadIsolationCode =
  | 'INVALID_CONTEXT'
  | 'ACCOUNT_MISMATCH'
  | 'NAMESPACE_MISMATCH'
  | 'GENERATION_MISMATCH';

/** Isolation failure is never a partial source read; details contain no workout data. */
export class CompositeWorkoutReadIsolationError extends Error {
  constructor(readonly code: CompositeWorkoutReadIsolationCode) {
    super(code);
    this.name = 'CompositeWorkoutReadIsolationError';
  }
}

export type CompositeWorkoutRecord =
  | Readonly<{
      source: 'legacy';
      readId: string;
      localDate: string;
      legacy: LegacyWorkoutReadInput;
      capability: 'read_only';
    }>
  | Readonly<{
      source: 'canonical';
      readId: string;
      localDate: string;
      canonical: ActiveCanonicalWorkoutReadInput;
      capability: 'read_only_in_G5B2';
    }>;

export type CompositeWorkoutReadResult =
  | Readonly<{
      status: 'complete';
      legacyStatus: 'success';
      canonicalStatus: 'success';
      records: readonly CompositeWorkoutRecord[];
    }>
  | Readonly<{
      status: 'partial_data';
      legacyStatus: 'success';
      canonicalStatus: 'error';
      records: readonly CompositeWorkoutRecord[];
    }>
  | Readonly<{
      status: 'partial_data';
      legacyStatus: 'error';
      canonicalStatus: 'success';
      records: readonly CompositeWorkoutRecord[];
    }>
  | Readonly<{
      status: 'error';
      legacyStatus: 'error';
      canonicalStatus: 'error';
      records: readonly [];
    }>;

export interface CompositeWorkoutReadInput {
  readonly context: CompositeWorkoutReadContext;
  readonly legacy: SourceRead<LegacyWorkoutReadInput>;
  readonly canonical: SourceRead<ActiveCanonicalWorkoutReadInput>;
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month! < 1 || month! > 12) return false;
  const leap = year! % 4 === 0 && (year! % 100 !== 0 || year! % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day! >= 1 && day! <= days[month! - 1]!;
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertContext(context: CompositeWorkoutReadContext): void {
  if (!context || !nonempty(context.accountId) || !nonempty(context.namespaceKey)
    || !nonempty(context.generationId)) {
    throw new CompositeWorkoutReadIsolationError('INVALID_CONTEXT');
  }
}

function validLegacyRow(row: LegacyWorkoutReadInput): boolean {
  if (!nonempty(row.rowId) || !validDate(row.localDate) || !nonempty(row.blockId)
    || row.blockId === '__session__' || !Number.isSafeInteger(row.sortOrder)
    || row.sortOrder < 0 || !Array.isArray(row.sets)) return false;
  const display = row.exerciseDisplay;
  if (!display || typeof display !== 'object') return false;
  if (display.kind === 'historical_fallback') return nonempty(display.name);
  if (display.kind !== 'current_catalog') return false;
  const block = display.block;
  return !!block && block.id === row.blockId && nonempty(block.name)
    && nonempty(block.type) && (block.tags === undefined || Array.isArray(block.tags));
}

function validCanonicalRow(row: ActiveCanonicalWorkoutReadInput): boolean {
  if (typeof row.entityId !== 'string' || !UUID_V4.test(row.entityId)
    || !Number.isSafeInteger(row.localRevision) || row.localRevision < 1) return false;
  try {
    validateWorkoutSessionV1(row.session);
    return row.session.id.toLowerCase() === row.entityId.toLowerCase();
  } catch {
    return false;
  }
}

/** Check all rows before publishing any records, including after an ordinary identity error. */
function projectLegacySource(
  source: SourceRead<LegacyWorkoutReadInput>, accountId: string,
): SourceRead<Extract<CompositeWorkoutRecord, { source: 'legacy' }>> {
  if (source.status === 'error') return { status: 'error' };
  if (!Array.isArray(source.records)) return { status: 'error' };
  const records: Extract<CompositeWorkoutRecord, { source: 'legacy' }>[] = [];
  const identities = new Set<string>();
  let invalid = false;
  for (const row of source.records) {
    if (!row || typeof row !== 'object') { invalid = true; continue; }
    if (row.accountId !== accountId) throw new CompositeWorkoutReadIsolationError('ACCOUNT_MISMATCH');
    if (!validLegacyRow(row)) { invalid = true; continue; }
    const readId = JSON.stringify(['legacy', row.accountId, row.rowId]);
    if (identities.has(readId)) { invalid = true; continue; }
    identities.add(readId);
    records.push({ source: 'legacy', readId, localDate: row.localDate,
      legacy: row, capability: 'read_only' });
  }
  return invalid ? { status: 'error' } : { status: 'success', records };
}

function projectCanonicalSource(
  source: SourceRead<ActiveCanonicalWorkoutReadInput>, context: CompositeWorkoutReadContext,
): SourceRead<Extract<CompositeWorkoutRecord, { source: 'canonical' }>> {
  if (source.status === 'error') return { status: 'error' };
  if (!Array.isArray(source.records)) return { status: 'error' };
  const records: Extract<CompositeWorkoutRecord, { source: 'canonical' }>[] = [];
  const identities = new Set<string>();
  let invalid = false;
  for (const row of source.records) {
    if (!row || typeof row !== 'object') { invalid = true; continue; }
    if (row.accountId !== context.accountId) throw new CompositeWorkoutReadIsolationError('ACCOUNT_MISMATCH');
    if (row.namespaceKey !== context.namespaceKey) throw new CompositeWorkoutReadIsolationError('NAMESPACE_MISMATCH');
    if (row.generationId !== context.generationId) throw new CompositeWorkoutReadIsolationError('GENERATION_MISMATCH');
    if (!validCanonicalRow(row)) { invalid = true; continue; }
    const readId = JSON.stringify(['canonical', row.namespaceKey, row.generationId,
      row.entityId.toLowerCase()]);
    if (identities.has(readId)) { invalid = true; continue; }
    identities.add(readId);
    records.push({ source: 'canonical', readId, localDate: row.session.localDate,
      canonical: row, capability: 'read_only_in_G5B2' });
  }
  return invalid ? { status: 'error' } : { status: 'success', records };
}

/** Technical fallback only: this order does not represent workout chronology. */
function compareRecords(left: CompositeWorkoutRecord, right: CompositeWorkoutRecord): number {
  const dateOrder = compare(right.localDate, left.localDate);
  if (dateOrder !== 0) return dateOrder;
  if (left.source !== right.source) return left.source === 'canonical' ? -1 : 1;
  if (left.source === 'canonical' && right.source === 'canonical') {
    return compare(left.canonical.entityId.toLowerCase(), right.canonical.entityId.toLowerCase())
      || compare(left.canonical.entityId, right.canonical.entityId);
  }
  if (left.source === 'legacy' && right.source === 'legacy') {
    return left.legacy.sortOrder - right.legacy.sortOrder
      || compare(left.legacy.rowId, right.legacy.rowId);
  }
  return 0;
}

export function projectCompositeWorkoutRead(input: CompositeWorkoutReadInput): CompositeWorkoutReadResult {
  assertContext(input.context);
  // Validate both sources before composing; an isolation failure overrides any partial result.
  const legacy = projectLegacySource(input.legacy, input.context.accountId);
  const canonical = projectCanonicalSource(input.canonical, input.context);
  if (legacy.status === 'error' && canonical.status === 'error') {
    return { status: 'error', legacyStatus: 'error', canonicalStatus: 'error', records: [] };
  }
  const records = [
    ...(legacy.status === 'success' ? legacy.records : []),
    ...(canonical.status === 'success' ? canonical.records : []),
  ].sort(compareRecords);
  if (legacy.status === 'success' && canonical.status === 'success') {
    return { status: 'complete', legacyStatus: 'success', canonicalStatus: 'success', records };
  }
  if (legacy.status === 'success') {
    return { status: 'partial_data', legacyStatus: 'success', canonicalStatus: 'error', records };
  }
  return { status: 'partial_data', legacyStatus: 'error', canonicalStatus: 'success', records };
}
