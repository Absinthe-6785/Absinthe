import { isLocalOnlyRuntime } from './localAuth';

export class LocalOnlyRemoteMutationPausedError extends Error {
  constructor(message = 'Remote writes are paused in local-only mode') {
    super(message);
    this.name = 'LocalOnlyRemoteMutationPausedError';
  }
}

export function shouldUseRemoteData(): boolean {
  return !isLocalOnlyRuntime();
}

export function remoteSWRKey<T extends string>(key: T): T | null {
  return shouldUseRemoteData() ? key : null;
}

export function isLocalOnlyRemoteMutationPausedError(
  error: unknown,
): error is LocalOnlyRemoteMutationPausedError {
  return error instanceof LocalOnlyRemoteMutationPausedError;
}

export function assertRemoteMutationAllowed(): void {
  if (!shouldUseRemoteData()) {
    throw new LocalOnlyRemoteMutationPausedError();
  }
}
