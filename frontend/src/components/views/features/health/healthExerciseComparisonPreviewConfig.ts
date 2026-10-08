/** Read-only QA preview; public activation requires a separate reviewed decision. */
export const HEALTH_EXERCISE_COMPARISON_PREVIEW_ENABLED = false;

export function isHealthExerciseComparisonPreviewEnabled(
  rangeOwnerEnabled: boolean,
  childEnabled: boolean = HEALTH_EXERCISE_COMPARISON_PREVIEW_ENABLED,
): boolean {
  // Search's shared range lifetime alone is not a Health parent activation.
  return rangeOwnerEnabled && childEnabled;
}
