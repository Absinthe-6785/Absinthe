import { HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED } from '../health/healthSelectedDayCompositeConfig';

/** Private diagnostic child. No environment/runtime rollout switch. */
export const SEARCH_WORKOUT_COMPOSITE_READER_ENABLED = false;

export type SearchHostLifetime = {
  readonly accountId: string;
  mounted: boolean;
  current: SearchActivation | null;
};

export type SearchActivation = Readonly<{
  host: SearchHostLifetime;
  generation: number;
  open: boolean;
  hasQuery: boolean;
}>;

export function isCurrentSearchActivation(
  host: SearchHostLifetime,
  activation: SearchActivation | null,
  accountId: string,
): activation is SearchActivation {
  return Boolean(accountId && host.accountId === accountId && host.mounted
    && activation && activation.host === host && host.current === activation
    && activation.open && activation.hasQuery);
}

export function isSearchWorkoutCompositeEnabled(
  host: SearchHostLifetime,
  activation: SearchActivation | null,
  accountId: string,
  gates: Readonly<{ parentEnabled: boolean; childEnabled: boolean }> = {
    parentEnabled: HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED,
    childEnabled: SEARCH_WORKOUT_COMPOSITE_READER_ENABLED,
  },
): boolean {
  return gates.parentEnabled && gates.childEnabled
    && isCurrentSearchActivation(host, activation, accountId);
}
