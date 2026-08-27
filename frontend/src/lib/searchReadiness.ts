/**
 * The small readiness contract shared by deferred Global Search datasets.
 *
 * `NOT_READY` is deliberately distinct from `READY_EMPTY`: an empty array is
 * only authoritative after the source has actually produced a response.
 * `validating` lets a warm SWR value remain visible while it is revalidated.
 */
export type SearchDatasetStatus =
  | 'NOT_READY'
  | 'LOADING'
  | 'READY_EMPTY'
  | 'READY_WITH_RESULTS'
  | 'ERROR';

export interface SearchDatasetState {
  status: SearchDatasetStatus;
  validating: boolean;
  error?: unknown;
}

export interface SearchDatasetStateInput<T> {
  enabled: boolean;
  data?: readonly T[];
  isLoading?: boolean;
  isValidating?: boolean;
  error?: unknown;
}

/** Resolve SWR state without treating an inactive/unknown source as empty. */
export function resolveSearchDatasetState<T>(
  input: SearchDatasetStateInput<T>,
): SearchDatasetState {
  if (!input.enabled) {
    return { status: 'NOT_READY', validating: false };
  }

  const hasData = input.data !== undefined;
  if (input.error !== undefined && !hasData) {
    return { status: 'ERROR', validating: false, error: input.error };
  }

  if (!hasData) {
    return {
      status: 'LOADING',
      validating: Boolean(input.isLoading || input.isValidating),
      ...(input.error !== undefined ? { error: input.error } : {}),
    };
  }

  const status = input.data && input.data.length > 0
    ? 'READY_WITH_RESULTS'
    : 'READY_EMPTY';
  return {
    status,
    validating: Boolean(input.isValidating),
    ...(input.error !== undefined ? { error: input.error } : {}),
  };
}

export function searchDatasetStateFromData<T>(data: readonly T[]): SearchDatasetState {
  return {
    status: data.length > 0 ? 'READY_WITH_RESULTS' : 'READY_EMPTY',
    validating: false,
  };
}
