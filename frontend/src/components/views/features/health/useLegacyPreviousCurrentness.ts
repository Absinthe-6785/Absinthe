import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT } from '../../../../lib/healthSupabaseBootstrap';
import { fetchPrevWorkoutForBlocks } from './prevWorkoutFetch';
import { LegacyPreviousCurrentness, type PreviousScope } from './legacyPreviousCurrentness';
import { subscribeLegacyWorkoutMutations } from './legacyWorkoutMutationCoverage';

/** Reuses Health/B1 eligibility; enabled is not a new rollout flag. */
export function useLegacyPreviousCurrentness(enabled: boolean, scope: PreviousScope) {
  const [owner] = useState(() => new LegacyPreviousCurrentness((ids, query) =>
    fetchPrevWorkoutForBlocks(ids, query.beforeDate, 'HealthView.qualifiedPrevious', query.accountId)));
  useSyncExternalStore(owner.subscribe, owner.snapshot, owner.snapshot);
  const account = useRef(scope.accountId);
  useLayoutEffect(() => {
    account.current = scope.accountId;
    if (enabled) owner.configure(scope); else owner.close();
  }, [owner, enabled, scope.accountId, scope.beforeDate, scope.authority, scope.parentIdentity, scope.rejected]);
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
  return { owner, current: enabled && owner.matches(scope) && !scope.rejected };
}
