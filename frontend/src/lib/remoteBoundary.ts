import {
  canUseDomainRemoteTransport,
  deriveAccountSyncAvailability,
  type AccountSyncAvailability,
  type SyncDomain,
} from './syncAuthority';

export class LocalOnlyRemoteMutationPausedError extends Error {
  constructor(message = 'Remote writes are paused in local-only mode') {
    super(message);
    this.name = 'LocalOnlyRemoteMutationPausedError';
  }
}

function runtimeCapabilityEnabled(): boolean {
  const disabled = import.meta.env.VITE_ABSINTHE_ACCOUNT_SYNC_DISABLED;
  return disabled !== true && disabled !== 'true' && disabled !== '1';
}

/**
 * The authenticated app shell and authFetch own session validation. This
 * synchronous boundary supplies rollout capability to render-time callers;
 * REL-05D can inject live connectivity/session state without changing domain
 * persistence policy.
 */
export function runtimeAccountSyncAvailability(): AccountSyncAvailability {
  return deriveAccountSyncAvailability({
    authenticated: true,
    capabilityEnabled: runtimeCapabilityEnabled(),
    online: true,
  });
}

export function shouldUseRemoteData(
  availability: AccountSyncAvailability = runtimeAccountSyncAvailability(),
): boolean {
  return availability.transportAvailable;
}

export function shouldUseDomainRemoteData(
  domain: SyncDomain,
  availability: AccountSyncAvailability = runtimeAccountSyncAvailability(),
): boolean {
  return canUseDomainRemoteTransport(domain, availability);
}

export function remoteSWRKey<T extends string>(
  key: T,
  domain?: SyncDomain,
  availability: AccountSyncAvailability = runtimeAccountSyncAvailability(),
): T | null {
  const allowed = domain
    ? shouldUseDomainRemoteData(domain, availability)
    : shouldUseRemoteData(availability);
  return allowed ? key : null;
}

export function isLocalOnlyRemoteMutationPausedError(
  error: unknown,
): error is LocalOnlyRemoteMutationPausedError {
  return error instanceof LocalOnlyRemoteMutationPausedError;
}

export function assertRemoteMutationAllowed(
  availability: AccountSyncAvailability = runtimeAccountSyncAvailability(),
): void {
  if (!shouldUseRemoteData(availability)) {
    throw new LocalOnlyRemoteMutationPausedError();
  }
}
