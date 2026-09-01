export type RecipeAvailability =
  | 'LOADING'
  | 'READY_WITH_DATA'
  | 'READY_EMPTY'
  | 'UNAVAILABLE_NO_DATA'
  | 'STALE_WITH_DATA';

export interface RecipeAvailabilityInput<T> {
  data?: readonly T[];
  error?: unknown;
  isLoading: boolean;
  isValidating: boolean;
}

/** Keep unknown, unavailable, and stale Recipe authority distinct from confirmed empty data. */
export function resolveRecipeAvailability<T>({
  data,
  error,
  isLoading,
  isValidating,
}: RecipeAvailabilityInput<T>): RecipeAvailability {
  if (error !== undefined) {
    return data === undefined ? 'UNAVAILABLE_NO_DATA' : 'STALE_WITH_DATA';
  }
  if (data === undefined || isLoading) return 'LOADING';
  if (data.length === 0 && isValidating) return 'LOADING';
  return data.length > 0 ? 'READY_WITH_DATA' : 'READY_EMPTY';
}

export function recipeAuthorityIsReady(availability: RecipeAvailability): boolean {
  return availability === 'READY_WITH_DATA' || availability === 'READY_EMPTY';
}

export function recipeAuthorityIsUnavailable(availability: RecipeAvailability): boolean {
  return availability === 'UNAVAILABLE_NO_DATA' || availability === 'STALE_WITH_DATA';
}
