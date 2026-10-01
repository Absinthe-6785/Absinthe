import { HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED } from './healthSelectedDayCompositeConfig';

/** Dormant until a separately reviewed product activation changes this value. */
export const HEALTH_WORKOUT_RANGE_COMPOSITE_READER_ENABLED = false;

export function isHealthWorkoutRangeCompositeEnabled({
  parentEnabled = HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED,
  childEnabled = HEALTH_WORKOUT_RANGE_COMPOSITE_READER_ENABLED,
  healthActive,
  accountPresent,
}: Readonly<{
  parentEnabled?: boolean;
  childEnabled?: boolean;
  healthActive: boolean;
  accountPresent: boolean;
}>): boolean {
  return parentEnabled && childEnabled && healthActive && accountPresent;
}
