export interface PlannerRestoreRevalidationContext {
  cloudApplied?: boolean;
  initiatingAccountId?: string;
  currentAccountId?: string;
  initiatingGeneration: number;
  currentGeneration: number;
}

/**
 * A cloud restore may invalidate Planner data only when it completed for the
 * account that initiated it and that account is still current.
 */
export function shouldRevalidatePlannerAfterRestore({
  cloudApplied,
  initiatingAccountId,
  currentAccountId,
  initiatingGeneration,
  currentGeneration,
}: PlannerRestoreRevalidationContext): boolean {
  return Boolean(
    cloudApplied
      && initiatingAccountId
      && currentAccountId === initiatingAccountId
      && currentGeneration === initiatingGeneration,
  );
}
