import { observe } from './observability';
import { CrossContextHandoffError, type DerivedPhysicalSourceIdentityV1, type HandoffObserver } from './types';

export interface ExclusiveLockAdapter {
  request<T>(
    name: string,
    options: { mode: 'exclusive'; signal?: AbortSignal },
    callback: (lock: Lock | null) => Promise<T> | T,
  ): Promise<T>;
}

export type LockOutcome<T> =
  | { readonly status: 'acquired'; readonly value: T }
  | { readonly status: 'unsupported' }
  | { readonly status: 'aborted' }
  | { readonly status: 'lock_failed' }
  | { readonly status: 'operation_failed'; readonly error: CrossContextHandoffError };

class OperationFailure {
  constructor(readonly error: CrossContextHandoffError) {}
}

function boundedOperationError(error: unknown): CrossContextHandoffError {
  return error instanceof CrossContextHandoffError
    ? error
    : new CrossContextHandoffError('LOCK_OPERATION_FAILED', 'locked_operation');
}

export async function withPhysicalSourceLock<T>(input: {
  physicalSource: DerivedPhysicalSourceIdentityV1;
  operation: () => Promise<T> | T;
  locks?: ExclusiveLockAdapter | null;
  signal?: AbortSignal;
  observer?: HandoffObserver;
}): Promise<LockOutcome<T>> {
  observe(input.observer, 'coordinator_attempt');
  if (typeof globalThis.isSecureContext === 'boolean' && !globalThis.isSecureContext) {
    return Object.freeze({ status: 'unsupported' });
  }
  const locks = input.locks === undefined
    ? (typeof navigator !== 'undefined' && 'locks' in navigator
      ? navigator.locks as unknown as ExclusiveLockAdapter : null)
    : input.locks;
  if (!locks) return Object.freeze({ status: 'unsupported' });
  if (input.signal?.aborted) return Object.freeze({ status: 'aborted' });
  let callbackCount = 0;
  try {
    observe(input.observer, 'lock_request');
    const value = await locks.request(
      input.physicalSource.lockName,
      { mode: 'exclusive', ...(input.signal ? { signal: input.signal } : {}) },
      async lock => {
        callbackCount += 1;
        if (callbackCount !== 1 || lock === null) {
          throw new OperationFailure(new CrossContextHandoffError('LOCK_ACQUISITION_FAILED', 'lock_callback'));
        }
        observe(input.observer, 'lock_acquired');
        try { return await input.operation(); } catch (error) {
          throw new OperationFailure(boundedOperationError(error));
        }
      },
    );
    return Object.freeze({ status: 'acquired', value });
  } catch (error) {
    if (error instanceof OperationFailure) {
      return Object.freeze({ status: 'operation_failed', error: error.error });
    }
    if (input.signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      return Object.freeze({ status: 'aborted' });
    }
    return Object.freeze({ status: 'lock_failed' });
  }
}
