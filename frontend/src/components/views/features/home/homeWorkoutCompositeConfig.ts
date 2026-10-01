import { HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED } from '../health/healthSelectedDayCompositeConfig';

/** Read-only preview. Public activation requires a separate reviewed decision. */
export const HOME_WORKOUT_COMPOSITE_READER_ENABLED = false;

export function isHomeWorkoutCompositeEnabled({
  parentEnabled = HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED,
  childEnabled = HOME_WORKOUT_COMPOSITE_READER_ENABLED,
  homeActive, accountPresent,
}: Readonly<{ parentEnabled?: boolean; childEnabled?: boolean;
  homeActive: boolean; accountPresent: boolean }>): boolean {
  return parentEnabled && childEnabled && homeActive && accountPresent;
}
