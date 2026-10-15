import type { LocalHealthDailyProjection } from '../../../../lib/healthLocalRuntime';
import type { Workout } from '../../../../types';
import type { SelectedDayCanonicalScope } from '../../../../lib/workoutSelectedDayReader';
import type { CompositeWorkoutReadResult } from './compositeWorkoutReadProjection';
import type { HealthWorkoutOperationScope } from './healthWorkoutOperationScope';
import type { PreviousEvidence } from './legacyPreviousCurrentness';
import type { WorkoutRangeView } from './verifiedWorkoutRangeSnapshot';

/** Slice A snapshots only. No token issuance, owner validation, captures or executable permits.
 * Slice B must supply authoritative current identities; equal values cannot renew them.
 * Policy: #772 sections 10-15; #773 sections 5-10, 18-23. Not runtime acceptance.
 */
export type HealthWorkoutParentScope = HealthWorkoutOperationScope & Readonly<{
  routeLifetime: object;
  shellLifetime: object;
}>;

export type ParentPublication = Readonly<{
  scope: HealthWorkoutParentScope;
  ownerLifetime: object;
  /** B1/range canonical proof; null for D or an ordinary canonical-source failure. */
  canonicalScope: SelectedDayCanonicalScope | null;
}>;

/** The owner supplies one coherent snapshot, not a UI-made proof attached to cached
 * data. The publication object itself is its opaque identity. Producing and revoking
 * these snapshots (including device/generation verification) belongs to Slice B.
 */
export type PublicationSnapshot = Readonly<{
  publication: ParentPublication | null;
  currentPublication: ParentPublication | null;
  currentOwnerLifetime: object | null;
}>;

export type SelectedDayAvailabilityInput = PublicationSnapshot & Readonly<{
  phase: 'loading' | 'settled';
  accountId: string;
  localDate: string;
  isolationError: boolean;
  result: CompositeWorkoutReadResult | null;
  legacyDaily: LocalHealthDailyProjection | null;
}>;

export type RangeAvailabilityInput = PublicationSnapshot & Readonly<{
  phase: 'disabled' | 'loading' | 'settled';
  accountId: string;
  isolationError: boolean;
  previousBounds: Readonly<{ startDate: string; endDate: string }>;
  monthBounds: Readonly<{ startDate: string; endDate: string }>;
  previousView: WorkoutRangeView | null;
  monthView: WorkoutRangeView | null;
}>;

export type HistoryAvailabilityInput = PublicationSnapshot & Readonly<{
  /** Already-effective owner/latch outcome. This model never clears rejection. */
  rejected: boolean;
  authority: 'local' | 'unsupported';
  consumedBlockIds: readonly string[];
  entries: readonly Readonly<{
    evidence: PreviousEvidence;
    currentEvidence: PreviousEvidence | null;
  }>[];
}>;

export type RetryOwner = 'RANGE' | 'B1' | 'D';
export type RetryDisposition =
  | Readonly<{ state: 'UNKNOWN' }>
  | Readonly<{ state: 'RECOVERED' }>
  | Readonly<{ state: 'BLOCKED'; reasonCode: string }>
  | Readonly<{ state: 'IN_FLIGHT'; episode: object }>
  | Readonly<{ state: 'TRANSIENT'; episode: object; permit: object | null; currentPermit: object | null }>;

export type RetrySnapshot = Readonly<{
  scope: HealthWorkoutParentScope | null;
  ownerLifetime: object | null;
  currentOwnerLifetime: object | null;
  currentEpisode: object | null;
  disposition: RetryDisposition;
}>;

export type DraftAvailabilityInput = Readonly<{
  scope: HealthWorkoutParentScope | null;
  lifetime: object | null;
  currentLifetime: object | null;
  isDirty: boolean;
}>;

export type HealthWorkoutParentAvailabilityInput = Readonly<{
  gates: Readonly<{ selectedDay: boolean; range: boolean }>;
  committedHealthRoute: boolean;
  authenticated: boolean;
  boundScope: HealthWorkoutParentScope | null;
  currentScope: HealthWorkoutParentScope | null;
  selectedDay: SelectedDayAvailabilityInput;
  range: RangeAvailabilityInput;
  history: HistoryAvailabilityInput;
  draft: DraftAvailabilityInput;
  workflow: Readonly<{
    locked: boolean;
    saving: boolean;
    hasNonSeparatorWorkout: boolean;
    /** Supplied by the current draft owner, not inferred from canonical records. */
    deleteTarget: Readonly<{
      row: Readonly<Pick<Workout, 'id' | 'local_version'>>;
      currentRow: Readonly<Pick<Workout, 'id' | 'local_version'>> | null;
      workoutId: string;
      expectedVersion: string | null;
    }> | null;
  }>;
  retry: Readonly<Record<RetryOwner, RetrySnapshot>>;
}>;

type SourceState = 'COMPLETE' | 'PARTIAL_LEGACY' | 'PARTIAL_CANONICAL';
export type SelectedDayAvailability =
  | Readonly<{ state: 'DISABLED' | 'LOADING' | 'UNAVAILABLE' | 'ISOLATION'; reason: string }>
  | Readonly<{ state: SourceState | 'VERIFIED_EMPTY'; publication: ParentPublication;
      result: CompositeWorkoutReadResult; legacyDaily: LocalHealthDailyProjection | null }>;

export type RangeAvailability =
  | Readonly<{ state: 'DISABLED' | 'LOADING' | 'UNAVAILABLE' | 'ISOLATION'; reason: string }>
  | Readonly<{ state: SourceState; publication: ParentPublication;
      previousView: WorkoutRangeView; monthView: WorkoutRangeView }>;

export type EditorAvailability =
  | Readonly<{ state: 'EDITOR_INTERACTIVE'; publication: ParentPublication;
      legacyDaily: LocalHealthDailyProjection;
      hydration: 'CLEAN_DRAFT_ONLY' | 'PRESERVE_DIRTY_DRAFT' | 'FENCED_DRAFT_SCOPE' }>
  | Readonly<{ state: 'EDITOR_NONINTERACTIVE_DRAFT_PREVIEW'; draft: DraftAvailabilityInput }>
  | Readonly<{ state: 'EDITOR_HIDDEN' }>;

export type ActionDenial = 'SHELL_DISABLED' | 'SOURCE_ISOLATION' | 'LEGACY_UNQUALIFIED'
  | 'DRAFT_SCOPE_STALE' | 'SAVING' | 'LOCKED' | 'HISTORY_UNQUALIFIED'
  | 'NO_HISTORY_DEPENDENCIES' | 'EMPTY_PAYLOAD' | 'ROW_NOT_CURRENT' | 'VERSION_NOT_CURRENT';
export type ActionPrerequisite =
  | Readonly<{ state: 'FENCED'; reason: ActionDenial }>
  | Readonly<{ state: 'PREREQUISITES_SATISFIED';
      requiredNext: 'EVENT_BOUNDARY_CAPTURE_AND_PREDISPATCH_RECHECK' }>;

export type RetryEligibility =
  | Readonly<{ state: 'ELIGIBLE'; owner: RetryOwner; snapshot: RetrySnapshot;
      requiredNext: 'OWNER_ONE_SHOT_CONSUMPTION_AND_CURRENTNESS_RECHECK' }>
  | Readonly<{ state: 'TEMPORARILY_INELIGIBLE'; owner: RetryOwner;
      reason: 'NOT_ADMITTED' | 'WAITING_FOR_PARENT' | 'NO_DEPENDENCIES' | 'NOT_REQUIRED' | 'PERMIT_EXHAUSTED' }>
  | Readonly<{ state: 'DETERMINISTICALLY_BLOCKED'; owner: RetryOwner; reason: string }>
  | Readonly<{ state: 'ALREADY_IN_FLIGHT'; owner: RetryOwner; episode: object }>
  | Readonly<{ state: 'UNSUPPORTED_CLASSIFICATION'; owner: RetryOwner; reason: 'UNKNOWN' | 'STALE_IDENTITY' }>;

export type RetryTargetEligibility = Readonly<{
  state: 'ELIGIBLE' | 'FENCED';
  /** Semantic owner set, NOT callbacks. Raw range then B1 then D, each at most once. */
  eligibleOwners: readonly RetryOwner[];
  skipped: readonly RetryEligibility[];
}>;

export type HealthWorkoutParentAvailability = Readonly<{
  shell: 'DISABLED' | 'ADMITTED';
  scope: HealthWorkoutParentScope | null;
  selectedDay: SelectedDayAvailability;
  range: RangeAvailability;
  editor: EditorAvailability;
  /** Never an overall-day/history/cloud empty claim, even for a dirty draft. */
  draft: Readonly<{ sameScopeDirty: boolean; isPersistedEvidence: false }>;
  history: 'CURRENT' | 'REFRESHING' | 'UNAVAILABLE' | 'REJECTED';
  actions: Readonly<Record<'editDraft' | 'useHistoricalPlanning' | 'save' | 'deletePersisted', ActionPrerequisite>>;
  retry: Readonly<{
    owners: Readonly<Record<RetryOwner, RetryEligibility>>;
    localParent: RetryTargetEligibility;
    localPairedReaders: RetryTargetEligibility;
    legacyCurrentness: RetryTargetEligibility;
  }>;
}>;

function validDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const leap = year! % 4 === 0 && (year! % 100 !== 0 || year! % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month! >= 1 && month! <= 12 && day! >= 1 && day! <= days[month! - 1]!;
}

function sameScope(a: HealthWorkoutParentScope | null, b: HealthWorkoutParentScope | null): boolean {
  return !!a && !!b && !!a.shellLifetime && !!a.routeLifetime && !!a.dateLifetime
    && a.shellLifetime === b.shellLifetime && a.routeLifetime === b.routeLifetime
    && a.dateLifetime === b.dateLifetime && a.dateKey === b.dateKey
    && a.accountOperation.accountId === b.accountOperation.accountId
    && a.accountOperation.generation === b.accountOperation.generation;
}

function currentPublication(input: PublicationSnapshot, scope: HealthWorkoutParentScope): ParentPublication | null {
  const p = input.publication;
  return p && p === input.currentPublication && !!p.ownerLifetime
    && p.ownerLifetime === input.currentOwnerLifetime && sameScope(p.scope, scope) ? p : null;
}

function sameCanonicalScope(a: SelectedDayCanonicalScope | null, b: SelectedDayCanonicalScope | null): boolean {
  return a === null ? b === null : !!b && a.accountId === b.accountId && a.deviceId === b.deviceId
    && a.namespaceKey === b.namespaceKey && a.generationId === b.generationId;
}

function qualifiedResult(result: CompositeWorkoutReadResult, p: ParentPublication,
  start: string, end: string): boolean {
  const canonical = p.canonicalScope;
  if (result.canonicalStatus === 'success' && (!canonical || !canonical.deviceId
    || !canonical.namespaceKey || !canonical.generationId || canonical.accountId !== p.scope.accountOperation.accountId)) return false;
  return result.records.every(record => {
    if (!validDate(record.localDate) || record.localDate < start || record.localDate > end) return false;
    if (record.source === 'legacy') return result.legacyStatus === 'success'
      && record.legacy.accountId === p.scope.accountOperation.accountId && record.legacy.localDate === record.localDate;
    return result.canonicalStatus === 'success' && !!canonical
      && record.canonical.accountId === canonical.accountId
      && record.canonical.namespaceKey === canonical.namespaceKey
      && record.canonical.generationId === canonical.generationId
      && record.canonical.session.localDate === record.localDate;
  });
}

function sourceState(result: CompositeWorkoutReadResult): SourceState {
  return result.status === 'complete' ? 'COMPLETE'
    : result.legacyStatus === 'success' ? 'PARTIAL_LEGACY' : 'PARTIAL_CANONICAL';
}

function deriveDay(input: SelectedDayAvailabilityInput, scope: HealthWorkoutParentScope | null,
  rejected: boolean): SelectedDayAvailability {
  if (!scope) return Object.freeze({ state: 'DISABLED', reason: 'NOT_ADMITTED' });
  if (rejected || input.isolationError || input.accountId !== scope.accountOperation.accountId
    || input.localDate !== scope.dateKey) return Object.freeze({ state: 'ISOLATION', reason: 'EFFECTIVE_REJECTION_OR_SCOPE_MISMATCH' });
  if (input.phase === 'loading') return Object.freeze({ state: 'LOADING', reason: 'NO_OLD_PUBLICATION' });
  const publication = currentPublication(input, scope);
  if (!publication || !input.result) return Object.freeze({ state: 'UNAVAILABLE', reason: 'NO_CURRENT_PUBLICATION' });
  if (!qualifiedResult(input.result, publication, scope.dateKey, scope.dateKey)) {
    return Object.freeze({ state: 'ISOLATION', reason: 'PUBLICATION_SCOPE_MISMATCH' });
  }
  if (input.result.status === 'error') return Object.freeze({ state: 'UNAVAILABLE', reason: 'BOTH_SOURCES_FAILED' });
  const state = input.result.status === 'complete' && input.result.records.length === 0
    ? 'VERIFIED_EMPTY' : sourceState(input.result);
  return Object.freeze({ state, publication, result: input.result,
    legacyDaily: input.result.legacyStatus === 'success' ? input.legacyDaily : null });
}

function deriveRange(input: RangeAvailabilityInput, scope: HealthWorkoutParentScope | null): RangeAvailability {
  if (!scope || input.phase === 'disabled') return Object.freeze({ state: 'DISABLED', reason: 'NOT_ADMITTED' });
  if (input.isolationError || input.accountId !== scope.accountOperation.accountId) {
    return Object.freeze({ state: 'ISOLATION', reason: 'RANGE_REJECTED' });
  }
  if (input.phase === 'loading') return Object.freeze({ state: 'LOADING', reason: 'NO_OLD_PUBLICATION' });
  const publication = currentPublication(input, scope);
  if (!publication || !input.previousView || !input.monthView) return Object.freeze({ state: 'UNAVAILABLE', reason: 'NO_CURRENT_PUBLICATION' });
  for (const [view, bounds] of [[input.previousView, input.previousBounds], [input.monthView, input.monthBounds]] as const) {
    if (view.accountId !== input.accountId || !validDate(bounds.startDate) || !validDate(bounds.endDate)
      || bounds.startDate > bounds.endDate || view.startDate !== bounds.startDate || view.endDate !== bounds.endDate
      || !sameCanonicalScope(view.scope, publication.canonicalScope)
      || !qualifiedResult(view.result, publication, bounds.startDate, bounds.endDate)) {
      return Object.freeze({ state: 'ISOLATION', reason: 'RANGE_SCOPE_OR_BOUNDS_MISMATCH' });
    }
  }
  if (input.previousView.result.status === 'error' || input.monthView.result.status === 'error') {
    return Object.freeze({ state: 'UNAVAILABLE', reason: 'BOTH_SOURCES_FAILED' });
  }
  return Object.freeze({ state: sourceState(input.previousView.result), publication,
    previousView: input.previousView, monthView: input.monthView });
}

function deriveHistory(input: HistoryAvailabilityInput, scope: HealthWorkoutParentScope | null,
  rejected: boolean): HealthWorkoutParentAvailability['history'] {
  if (rejected) return 'REJECTED';
  if (!scope || input.authority !== 'local' || !currentPublication(input, scope)
    || input.consumedBlockIds.length === 0) return 'UNAVAILABLE';
  const evidence = input.consumedBlockIds.map(id => input.entries.find(row => row.evidence.blockId === id));
  if (evidence.every(row => row && row.evidence === row.currentEvidence
    && (row.evidence.state === 'CURRENT' || row.evidence.state === 'NO_MATCH'))) return 'CURRENT';
  return evidence.some(row => row?.evidence.state === 'REFRESHING') ? 'REFRESHING' : 'UNAVAILABLE';
}

function retryEligibility(owner: RetryOwner, input: RetrySnapshot, scope: HealthWorkoutParentScope | null,
  isolated: boolean, waiting: boolean, loading: boolean, dependencies: boolean): RetryEligibility {
  if (!scope) return Object.freeze({ state: 'TEMPORARILY_INELIGIBLE', owner, reason: 'NOT_ADMITTED' });
  if (isolated) return Object.freeze({ state: 'DETERMINISTICALLY_BLOCKED', owner, reason: 'ISOLATION' });
  if (waiting) return Object.freeze({ state: 'TEMPORARILY_INELIGIBLE', owner, reason: 'WAITING_FOR_PARENT' });
  if (!sameScope(input.scope, scope) || !input.ownerLifetime || input.ownerLifetime !== input.currentOwnerLifetime) {
    return Object.freeze({ state: 'UNSUPPORTED_CLASSIFICATION', owner, reason: 'STALE_IDENTITY' });
  }
  if (!dependencies) return Object.freeze({ state: 'TEMPORARILY_INELIGIBLE', owner, reason: 'NO_DEPENDENCIES' });
  const d = input.disposition;
  if (d.state === 'BLOCKED') return Object.freeze({ state: 'DETERMINISTICALLY_BLOCKED', owner, reason: d.reasonCode });
  if (d.state === 'IN_FLIGHT' || d.state === 'TRANSIENT') {
    if (d.episode !== input.currentEpisode) return Object.freeze({ state: 'UNSUPPORTED_CLASSIFICATION', owner, reason: 'STALE_IDENTITY' });
    if (d.state === 'IN_FLIGHT') return Object.freeze({ state: 'ALREADY_IN_FLIGHT', owner, episode: d.episode });
    if (!loading && d.permit && d.permit === d.currentPermit) return Object.freeze({ state: 'ELIGIBLE', owner,
      snapshot: input, requiredNext: 'OWNER_ONE_SHOT_CONSUMPTION_AND_CURRENTNESS_RECHECK' });
    if (!loading) return Object.freeze({ state: 'TEMPORARILY_INELIGIBLE', owner, reason: 'PERMIT_EXHAUSTED' });
  }
  if (d.state === 'RECOVERED' && !loading) return Object.freeze({ state: 'TEMPORARILY_INELIGIBLE', owner, reason: 'NOT_REQUIRED' });
  return Object.freeze({ state: 'UNSUPPORTED_CLASSIFICATION', owner, reason: 'UNKNOWN' });
}

function retryTarget(owners: Readonly<Record<RetryOwner, RetryEligibility>>, requested: readonly RetryOwner[]): RetryTargetEligibility {
  const eligibleOwners = Object.freeze(requested.filter(owner => owners[owner].state === 'ELIGIBLE'));
  return Object.freeze({ state: eligibleOwners.length ? 'ELIGIBLE' : 'FENCED', eligibleOwners,
    skipped: Object.freeze(requested.filter(owner => owners[owner].state !== 'ELIGIBLE').map(owner => owners[owner])) });
}

/** Pure prerequisites, not action authority. Does not read/call any owner or callback. */
export function deriveHealthWorkoutParentAvailability(input: HealthWorkoutParentAvailabilityInput): HealthWorkoutParentAvailability {
  const candidate = input.boundScope;
  const account = candidate?.accountOperation;
  const scope = input.gates.selectedDay && input.gates.range && input.committedHealthRoute && input.authenticated
    && account?.accountId.trim() && Number.isSafeInteger(account.generation) && account.generation >= 0
    && candidate && validDate(candidate.dateKey) && sameScope(candidate, input.currentScope) ? candidate : null;
  const range = deriveRange(input.range, scope);
  const rejected = input.history.rejected || input.range.isolationError || range.state === 'ISOLATION';
  const selectedDay = deriveDay(input.selectedDay, scope, rejected);
  const effectiveRejection = rejected || selectedDay.state === 'ISOLATION';
  const draftCurrent = !!scope && sameScope(input.draft.scope, scope) && !!input.draft.lifetime
    && input.draft.lifetime === input.draft.currentLifetime;
  const sameScopeDirty = draftCurrent && input.draft.isDirty;
  const editor: EditorAvailability = 'legacyDaily' in selectedDay && selectedDay.legacyDaily
    ? Object.freeze({ state: 'EDITOR_INTERACTIVE', publication: selectedDay.publication,
        legacyDaily: selectedDay.legacyDaily, hydration: !draftCurrent ? 'FENCED_DRAFT_SCOPE'
          : sameScopeDirty ? 'PRESERVE_DIRTY_DRAFT' : 'CLEAN_DRAFT_ONLY' })
    : sameScopeDirty ? Object.freeze({ state: 'EDITOR_NONINTERACTIVE_DRAFT_PREVIEW', draft: input.draft })
      : Object.freeze({ state: 'EDITOR_HIDDEN' });
  const history = deriveHistory(input.history, scope, effectiveRejection);
  const baseDenial: ActionDenial | null = !scope ? 'SHELL_DISABLED' : effectiveRejection ? 'SOURCE_ISOLATION'
    : editor.state !== 'EDITOR_INTERACTIVE' ? 'LEGACY_UNQUALIFIED' : !draftCurrent ? 'DRAFT_SCOPE_STALE'
      : input.workflow.saving ? 'SAVING' : input.workflow.locked ? 'LOCKED' : null;
  const action = (reason: ActionDenial | null): ActionPrerequisite => reason
    ? Object.freeze({ state: 'FENCED', reason })
    : Object.freeze({ state: 'PREREQUISITES_SATISFIED', requiredNext: 'EVENT_BOUNDARY_CAPTURE_AND_PREDISPATCH_RECHECK' });
  const target = input.workflow.deleteTarget;
  const actions = Object.freeze({
    editDraft: action(baseDenial),
    useHistoricalPlanning: action(baseDenial ?? (input.history.consumedBlockIds.length === 0
      ? 'NO_HISTORY_DEPENDENCIES' : history !== 'CURRENT' ? 'HISTORY_UNQUALIFIED' : null)),
    save: action(baseDenial ?? (!input.workflow.hasNonSeparatorWorkout ? 'EMPTY_PAYLOAD' : null)),
    deletePersisted: action(baseDenial ?? (!target || target.row !== target.currentRow
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(target.workoutId)
      || target.workoutId !== target.row.id ? 'ROW_NOT_CURRENT'
      : !target.expectedVersion?.trim() || target.expectedVersion !== target.row.local_version ? 'VERSION_NOT_CURRENT' : null)),
  });
  const owners = Object.freeze({
    RANGE: retryEligibility('RANGE', input.retry.RANGE, scope, range.state === 'ISOLATION', false, input.range.phase === 'loading', true),
    B1: retryEligibility('B1', input.retry.B1, scope,
      deriveDay(input.selectedDay, scope, false).state === 'ISOLATION', false, input.selectedDay.phase === 'loading', true),
    D: retryEligibility('D', input.retry.D, scope, false, effectiveRejection,
      history === 'REFRESHING', input.history.consumedBlockIds.length > 0),
  });
  return Object.freeze({ shell: scope ? 'ADMITTED' : 'DISABLED', scope, selectedDay, range, editor,
    draft: Object.freeze({ sameScopeDirty, isPersistedEvidence: false }), history, actions,
    retry: Object.freeze({ owners, localParent: retryTarget(owners, ['RANGE', 'B1', 'D']),
      localPairedReaders: retryTarget(owners, ['RANGE', 'B1']), legacyCurrentness: retryTarget(owners, ['D']) }) });
}
