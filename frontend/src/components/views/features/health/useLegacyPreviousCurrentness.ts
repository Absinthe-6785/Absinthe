import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT } from '../../../../lib/healthSupabaseBootstrap';
import { fetchPrevWorkoutForBlocks } from './prevWorkoutFetch';
import { LegacyPreviousCurrentness, type PreviousScope } from './legacyPreviousCurrentness';
import { subscribeLegacyWorkoutMutations } from './legacyWorkoutMutationCoverage';

type TrustState = 'unknown' | 'rejected' | 'recovered';
export type PreviousParentTrust = Readonly<{
  selectedDay: TrustState;
  range: TrustState;
  /** Established identity of a successfully verified pair, not a revision. */
  rangeIdentity: string | null;
}>;
type TrustLatch = Readonly<{
  query: string;
  parentIdentity: string | null;
  selectedDay: boolean;
  range: boolean;
}>;

/** Pure render guard; only the layout effect commits rejection provenance. */
function nextTrustLatch(previous: TrustLatch | null, scope: PreviousScope, trust: PreviousParentTrust): TrustLatch {
  const query = JSON.stringify([scope.accountId, scope.beforeDate, scope.authority]);
  const changed = !!previous && (previous.query !== query || (!!previous.parentIdentity
    && !!scope.parentIdentity && previous.parentIdentity !== scope.parentIdentity));
  const newAdmission = changed && trust.selectedDay === 'recovered' && !!scope.parentIdentity;
  // A new query's transient loading model cannot erase an old trust rejection.
  // An affirmatively admitted new scope can, without importing its old evidence.
  const keepOrigin = changed && !newAdmission && !!(previous?.selectedDay || previous?.range);
  const parentIdentity = keepOrigin ? previous!.parentIdentity
    : scope.parentIdentity ?? (previous?.query === query ? previous.parentIdentity : null);
  const prior = newAdmission ? null : previous;
  return {
    query: keepOrigin ? previous!.query : query,
    parentIdentity,
    selectedDay: trust.selectedDay === 'rejected' || (!!prior?.selectedDay
      && (keepOrigin || trust.selectedDay !== 'recovered')),
    range: trust.range === 'rejected' || (!!prior?.range && (keepOrigin
      || trust.range !== 'recovered' || !parentIdentity || trust.rangeIdentity !== parentIdentity)),
  };
}

/** Reuses Health/B1 eligibility; enabled is not a new rollout flag. */
export function useLegacyPreviousCurrentness(enabled: boolean, scope: PreviousScope, trust?: PreviousParentTrust) {
  const [owner] = useState(() => new LegacyPreviousCurrentness((ids, query) =>
    fetchPrevWorkoutForBlocks(ids, query.beforeDate, 'HealthView.qualifiedPrevious', query.accountId)));
  const revision = useSyncExternalStore(owner.subscribe, owner.snapshot, owner.snapshot);
  const [committedTrust, setCommittedTrust] = useState<TrustLatch | null>(null);
  const latch = enabled && trust ? nextTrustLatch(committedTrust, scope, trust) : null;
  const rejected = scope.rejected || !!(latch?.selectedDay || latch?.range);
  const query = JSON.stringify([scope.accountId, scope.beforeDate, scope.authority]);
  const effectiveScope = { ...scope,
    parentIdentity: latch?.query === query ? latch.parentIdentity : scope.parentIdentity, rejected };
  const account = useRef(scope.accountId);
  useLayoutEffect(() => {
    account.current = scope.accountId;
    if (enabled) owner.configure(effectiveScope); else owner.close();
    setCommittedTrust(previous => previous?.query === latch?.query && previous?.parentIdentity === latch?.parentIdentity
      && previous?.selectedDay === latch?.selectedDay && previous?.range === latch?.range ? previous : latch);
  }, [owner, enabled, scope.accountId, scope.beforeDate, scope.authority, effectiveScope.parentIdentity, rejected,
    latch?.query, latch?.parentIdentity, latch?.selectedDay, latch?.range]);
  useLayoutEffect(() => () => owner.close(), [owner]);
  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = subscribeLegacyWorkoutMutations((phase, mutation) => {
      if (phase === 'end') owner.endMutation(mutation.token);
      else if (mutation.accountId === account.current) owner.beginMutation(mutation.token, mutation.impact, mutation.accountId);
    });
    return unsubscribe;
  }, [owner, enabled, scope.accountId]);
  useEffect(() => {
    if (!enabled) return;
    let lastRecovery = -Infinity;
    const recover = () => {
      if (document.visibilityState === 'hidden') {
        lastRecovery = -Infinity;
        owner.invalidate('unknown', false); return;
      }
      const now = Date.now();
      if (now - lastRecovery < 250) return;
      lastRecovery = now;
      owner.invalidate();
    };
    const bootstrap = () => owner.invalidate();
    window.addEventListener('focus', recover);
    document.addEventListener('visibilitychange', recover);
    window.addEventListener(HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT, bootstrap);
    return () => {
      window.removeEventListener('focus', recover);
      document.removeEventListener('visibilitychange', recover);
      window.removeEventListener(HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT, bootstrap);
    };
  }, [owner, enabled]);
  const boundEvidence = enabled && owner.matches(effectiveScope) ? owner.captureOwnerEvidence() : null;
  const captureOwnerEvidence = () => boundEvidence?.isCurrent() ? boundEvidence : null;
  return { owner, revision, rejected: enabled && (rejected || owner.isRejected()),
    current: enabled && owner.matches(effectiveScope) && !rejected,
    captureOwnerEvidence,
    // Denial-only observation: a held port cannot clear a later committed latch.
    isEffectivelyRejected: () => rejected || owner.isRejected(),
  };
}
