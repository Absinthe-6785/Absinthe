import type { LocalHealthDailyProjection } from '../../../../lib/healthLocalRuntime';
import type { SelectedDayCanonicalScope } from '../../../../lib/workoutSelectedDayReader';
import { CompositeWorkoutReadIsolationError, type CompositeWorkoutReadResult } from './compositeWorkoutReadProjection';
import { LocalDatabaseError, type LocalDatabaseErrorCode } from '../../../../lib/localDatabase/errors';
import type { PreviousEvidence, PreviousScope } from './legacyPreviousCurrentness';
import type { WorkoutRangeView } from './verifiedWorkoutRangeSnapshot';
import type {
  HealthWorkoutParentScope, HistoryAvailabilityInput, ParentPublication,
  RangeAvailabilityInput, RetryOwner, RetrySnapshot, SelectedDayAvailabilityInput,
} from './healthWorkoutParentAvailability';

/** Observations of EXISTING owners, not another lifecycle, reader or retry permit.
 * Only the owner supplies captureOwnerEvidence. Adapters consume its captured data,
 * never data/flags copied onto a public read model by a consumer.
 */
export type WorkoutOwnerEvidence<K extends RetryOwner, T> = Readonly<{
  owner: K;
  lifetime: object;
  publication: object;
  request: object | null;
  inFlight: boolean;
  isCurrent: () => boolean;
  data: T;
}>;
export type WorkoutOwnerPort<K extends RetryOwner, T> = Readonly<{
  captureOwnerEvidence?: () => WorkoutOwnerEvidence<K, T> | null;
}>;
export type OwnerFailureDisposition = Readonly<{
  kind: 'ISOLATION' | 'DETERMINISTIC' | 'UNCLASSIFIED';
  reasonCode: string;
}>;
const deterministicCodes = new Set<LocalDatabaseErrorCode>([
  'CAPABILITY_REQUIRED', 'INVALID_NAMESPACE', 'UNSAFE_NAMESPACE', 'UNSUPPORTED_SCHEMA_VERSION',
  'MALFORMED_METADATA', 'NAMESPACE_MISMATCH', 'GENERATION_NOT_FOUND', 'GENERATION_NOT_ACTIVE',
  'INVALID_GENERATION_TRANSITION', 'CORRUPT_PERSISTED_RECORD', 'INVALID_ENTITY',
  'INVALID_LEGACY_MIGRATION', 'LEGACY_SOURCE_AUTHORITY_REQUIRED', 'LEGACY_SOURCE_AUTHORITY_CONFLICT',
  'LEGACY_SOURCE_AUTHORITY_REVOKED', 'LEGACY_SOURCE_IDENTITY_MISMATCH',
]);
/** Retain codes only at an existing catch boundary. No message, payload, storage
 * probe or transient inference. Codes outside this narrow allowlist stay unknown.
 */
export function observeOwnerFailure(error: unknown): OwnerFailureDisposition {
  return Object.freeze(error instanceof CompositeWorkoutReadIsolationError
    ? { kind: 'ISOLATION', reasonCode: error.code }
    : error instanceof LocalDatabaseError
      ? { kind: deterministicCodes.has(error.code) ? 'DETERMINISTIC' : 'UNCLASSIFIED', reasonCode: error.code }
      : { kind: 'UNCLASSIFIED', reasonCode: 'UNKNOWN' });
}
export type SelectedDayOwnerData = Readonly<{
  phase: 'loading' | 'settled'; accountId: string; localDate: string;
  canonicalScope: SelectedDayCanonicalScope | null;
  result: CompositeWorkoutReadResult | null;
  legacyDaily: LocalHealthDailyProjection | null;
  isolationError: boolean;
  failures: readonly OwnerFailureDisposition[];
}>;
export type RangeOwnerData = Readonly<{
  phase: 'disabled' | 'loading' | 'settled'; accountId: string;
  previousBounds: Readonly<{ startDate: string; endDate: string }>;
  monthBounds: Readonly<{ startDate: string; endDate: string }>;
  previousView: WorkoutRangeView | null; monthView: WorkoutRangeView | null;
  isolationError: boolean;
  failures: readonly OwnerFailureDisposition[];
}>;
export type PreviousOwnerData = Readonly<{
  scope: PreviousScope;
  rejected: boolean;
  consumedBlockIds: readonly string[];
  entries: readonly PreviousEvidence[];
  failures: readonly OwnerFailureDisposition[];
}>;

/** Parent proof must come from its committed owner. No adapter creates a parent,
 * date lifetime, shell lifetime or route lifetime from a child's payload.
 */
export type WorkoutAdapterContext = Readonly<{
  boundScope: HealthWorkoutParentScope | null;
  getCurrentScope: () => HealthWorkoutParentScope | null;
}>;
export type RangeAdapterContext = WorkoutAdapterContext & Readonly<{
  previousBounds: RangeOwnerData['previousBounds'];
  monthBounds: RangeOwnerData['monthBounds'];
}>;
export type OwnerRetryClassification =
  | Readonly<{ state: 'CURRENT_FLIGHT_ACTIVE' }>
  | Readonly<{ state: 'RECOVERED' }>
  | Readonly<{ state: 'ISOLATION_BLOCKED' }>
  | Readonly<{ state: 'DETERMINISTICALLY_BLOCKED'; reasonCode: string }>
  | Readonly<{ state: 'RETIRED_SCOPE' | 'OWNER_MISMATCH' | 'MISSING_OWNER_PROOF' }>
  | Readonly<{ state: 'UNKNOWN'; reason: 'FINITE_PERMIT_NOT_EXPOSED' }>;

export type WorkoutOwnerAdapter<I> = Readonly<{
  /** Borrowed coherent owner INPUT for Slice A, not a UI-published data snapshot.
   * Slice A supplies the detached/deeply immutable public payload boundary.
   * Read-only currentness accessors revoke held inputs without another capture;
   * copying their values is not a way to renew owner authority.
   */
  input: I;
  retry: RetrySnapshot;
  retryClassification: OwnerRetryClassification;
  ownerPublication: object | null;
  isCurrent: () => boolean;
}>;

function sameParent(a: HealthWorkoutParentScope | null, b: HealthWorkoutParentScope | null): boolean {
  return !!a && !!b && !!a.dateLifetime && !!a.routeLifetime && !!a.shellLifetime
    && a.dateLifetime === b.dateLifetime && a.routeLifetime === b.routeLifetime
    && a.shellLifetime === b.shellLifetime && a.dateKey === b.dateKey
    && a.accountOperation.accountId === b.accountOperation.accountId
    && a.accountOperation.generation === b.accountOperation.generation;
}

function capture<K extends RetryOwner, T>(owner: K, port: WorkoutOwnerPort<K, T> | null,
  context: WorkoutAdapterContext) {
  const evidence = port?.captureOwnerEvidence?.() ?? null;
  const isCurrent = () => !!evidence && evidence.owner === owner && evidence.isCurrent()
    && sameParent(context.boundScope, context.getCurrentScope());
  const classification: OwnerRetryClassification | null = !evidence ? { state: 'MISSING_OWNER_PROOF' }
    : evidence.owner !== owner ? { state: 'OWNER_MISMATCH' }
      : !isCurrent() ? { state: 'RETIRED_SCOPE' } : null;
  return { evidence, isCurrent, classification };
}

function publication(context: WorkoutAdapterContext, lifetime: object,
  canonicalScope: SelectedDayCanonicalScope | null): ParentPublication {
  return Object.freeze({ scope: context.boundScope!, ownerLifetime: lifetime, canonicalScope });
}

function sameCanonical(a: SelectedDayCanonicalScope | null, b: SelectedDayCanonicalScope | null): boolean {
  return a === null ? b === null : !!b && a.accountId === b.accountId && a.deviceId === b.deviceId
    && a.namespaceKey === b.namespaceKey && a.generationId === b.generationId;
}
function qualified(result: CompositeWorkoutReadResult | null, scope: SelectedDayCanonicalScope | null,
  accountId: string, startDate: string, endDate: string): boolean {
  if (!result) return true; // Missing is unavailable, never success/absence.
  if (result.canonicalStatus === 'success' && (!scope || scope.accountId !== accountId
    || !scope.deviceId || !scope.namespaceKey || !scope.generationId)) return false;
  return result.records.every(row => row.localDate >= startDate && row.localDate <= endDate
    && (row.source === 'legacy' ? result.legacyStatus === 'success'
      && row.legacy.accountId === accountId && row.legacy.localDate === row.localDate
      : result.canonicalStatus === 'success' && !!scope && row.canonical.accountId === accountId
        && row.canonical.namespaceKey === scope.namespaceKey && row.canonical.generationId === scope.generationId
        && row.canonical.session.localDate === row.localDate));
}

function retry(context: WorkoutAdapterContext, evidence: WorkoutOwnerEvidence<RetryOwner, unknown> | null,
  valid: boolean, isCurrent: () => boolean, denied: OwnerRetryClassification | null,
  isolation: boolean, recovered: boolean, failures: readonly OwnerFailureDisposition[]) {
  // Current APIs have no consumed/remaining finite USER permit. Their raw retry
  // callbacks are not proof of one. A request token is never an execution permit.
  const deterministic = failures.find(failure => failure.kind === 'DETERMINISTIC');
  const classification: OwnerRetryClassification = denied ?? (!valid ? { state: 'RETIRED_SCOPE' }
    : isolation ? { state: 'ISOLATION_BLOCKED' }
      : deterministic ? { state: 'DETERMINISTICALLY_BLOCKED', reasonCode: deterministic.reasonCode }
        : evidence?.inFlight ? { state: 'CURRENT_FLIGHT_ACTIVE' }
        : recovered ? { state: 'RECOVERED' }
          : { state: 'UNKNOWN', reason: 'FINITE_PERMIT_NOT_EXPOSED' });
  const snapshot: RetrySnapshot = Object.freeze({
    scope: context.boundScope,
    ownerLifetime: valid ? evidence?.lifetime ?? null : null,
    get currentOwnerLifetime() { return valid && isCurrent() ? evidence?.lifetime ?? null : null; },
    currentEpisode: valid ? evidence?.request ?? null : null,
    disposition: classification.state === 'ISOLATION_BLOCKED' ? { state: 'BLOCKED' as const, reasonCode: 'ISOLATION' }
      : classification.state === 'DETERMINISTICALLY_BLOCKED' ? { state: 'BLOCKED' as const, reasonCode: classification.reasonCode }
      : classification.state === 'CURRENT_FLIGHT_ACTIVE' && evidence?.request
        ? { state: 'IN_FLIGHT' as const, episode: evidence.request }
        : classification.state === 'RECOVERED' ? { state: 'RECOVERED' as const } : { state: 'UNKNOWN' as const },
  });
  return { retry: snapshot, retryClassification: Object.freeze(classification) };
}

export function adaptSelectedDayOwner(port: WorkoutOwnerPort<'B1', SelectedDayOwnerData> | null,
  context: WorkoutAdapterContext): WorkoutOwnerAdapter<SelectedDayAvailabilityInput> {
  const c = capture('B1', port, context), e = c.evidence, parent = context.boundScope;
  const scopeMismatch = c.isCurrent() && !!e && (e.data.accountId !== parent!.accountOperation.accountId
    || e.data.localDate !== parent!.dateKey);
  const valid = c.isCurrent() && !!e && e.data.accountId === parent!.accountOperation.accountId
    && e.data.localDate === parent!.dateKey;
  const data = valid ? e!.data : null;
  const isolation = scopeMismatch || !!data?.isolationError || !!data && data.phase === 'settled'
    && !qualified(data.result, data.canonicalScope, data.accountId, data.localDate, data.localDate);
  const p = valid ? publication(context, e!.lifetime, data!.canonicalScope) : null;
  const input: SelectedDayAvailabilityInput = Object.freeze({
    phase: data?.phase ?? 'settled', accountId: data?.accountId ?? parent?.accountOperation.accountId ?? '',
    localDate: data?.localDate ?? parent?.dateKey ?? '',
    publication: p,
    get currentPublication() { return valid && c.isCurrent() ? p : null; },
    get currentOwnerLifetime() { return valid && c.isCurrent() ? p?.ownerLifetime ?? null : null; },
    isolationError: isolation,
    result: data?.phase === 'settled' && !isolation ? data.result : null,
    legacyDaily: data?.phase === 'settled' && !isolation && data.result?.legacyStatus === 'success' ? data.legacyDaily : null,
  });
  return Object.freeze({ input, ...retry(context, e, valid, c.isCurrent, c.classification,
    isolation, data?.result?.status === 'complete', data?.failures ?? []),
    ownerPublication: valid ? e!.publication : null,
    isCurrent: () => valid && c.isCurrent(),
  });
}

function sameBounds(a: RangeOwnerData['previousBounds'], b: RangeOwnerData['previousBounds']) {
  return a.startDate === b.startDate && a.endDate === b.endDate;
}
export function adaptRangeOwner(port: WorkoutOwnerPort<'RANGE', RangeOwnerData> | null,
  context: RangeAdapterContext): WorkoutOwnerAdapter<RangeAvailabilityInput> {
  const c = capture('RANGE', port, context), e = c.evidence, parent = context.boundScope;
  const valid = c.isCurrent() && !!e && e.data.accountId === parent!.accountOperation.accountId
    && sameBounds(e.data.previousBounds, context.previousBounds) && sameBounds(e.data.monthBounds, context.monthBounds);
  const data = valid ? e!.data : null;
  const canonicalScope = data?.previousView?.scope ?? null;
  const isolation = !!data?.isolationError || c.isCurrent() && !!e && e.data.accountId !== parent!.accountOperation.accountId
    || !!data && data.phase === 'settled' && [data.previousView, data.monthView].some((view, index) => {
      const bounds = index === 0 ? context.previousBounds : context.monthBounds;
      return !!view && (view.accountId !== data.accountId || !sameCanonical(view.scope, canonicalScope)
        || view.startDate !== bounds.startDate || view.endDate !== bounds.endDate
        || !qualified(view.result, canonicalScope, data.accountId, bounds.startDate, bounds.endDate));
    });
  const p = valid ? publication(context, e!.lifetime, data!.previousView?.scope ?? null) : null;
  const input: RangeAvailabilityInput = Object.freeze({
    phase: data?.phase ?? (parent ? 'settled' : 'disabled'),
    accountId: data?.accountId ?? parent?.accountOperation.accountId ?? '',
    previousBounds: context.previousBounds, monthBounds: context.monthBounds,
    publication: p,
    get currentPublication() { return valid && c.isCurrent() ? p : null; },
    get currentOwnerLifetime() { return valid && c.isCurrent() ? p?.ownerLifetime ?? null : null; },
    isolationError: isolation,
    previousView: data?.phase === 'settled' && !isolation ? data.previousView : null,
    monthView: data?.phase === 'settled' && !isolation ? data.monthView : null,
  });
  return Object.freeze({ input, ...retry(context, e, valid, c.isCurrent, c.classification, isolation,
    data?.previousView?.result.status === 'complete' && data?.monthView?.result.status === 'complete', data?.failures ?? []),
    ownerPublication: valid ? e!.publication : null, isCurrent: () => valid && c.isCurrent(),
  });
}

export function adaptPreviousOwner(port: (WorkoutOwnerPort<'D', PreviousOwnerData>
  & Readonly<{ isEffectivelyRejected?: () => boolean }>) | null,
  context: WorkoutAdapterContext): WorkoutOwnerAdapter<HistoryAvailabilityInput> {
  const c = capture('D', port, context), e = c.evidence, parent = context.boundScope;
  const valid = c.isCurrent() && !!e && e.data.scope.accountId === parent!.accountOperation.accountId
    && e.data.scope.beforeDate === parent!.dateKey;
  const data = valid ? e!.data : null;
  const rejected = !!data?.rejected || port?.isEffectivelyRejected?.() === true;
  const p = valid ? publication(context, e!.lifetime, null) : null;
  const input: HistoryAvailabilityInput = Object.freeze({
    publication: p,
    get currentPublication() { return valid && c.isCurrent() ? p : null; },
    get currentOwnerLifetime() { return valid && c.isCurrent() ? p?.ownerLifetime ?? null : null; },
    get rejected() { return rejected || port?.isEffectivelyRejected?.() === true; },
    authority: data?.scope.authority ?? 'unsupported',
    consumedBlockIds: data && !rejected ? data.consumedBlockIds : [],
    entries: data && !rejected ? data.entries.map(evidence => Object.freeze({ evidence, currentEvidence: evidence })) : [],
  });
  return Object.freeze({ input, ...retry(context, e, valid, c.isCurrent, c.classification, rejected,
    !!data?.consumedBlockIds.length && data.entries.every(row => row.state === 'CURRENT' || row.state === 'NO_MATCH'), data?.failures ?? []),
    ownerPublication: valid ? e!.publication : null, isCurrent: () => valid && c.isCurrent(),
  });
}
