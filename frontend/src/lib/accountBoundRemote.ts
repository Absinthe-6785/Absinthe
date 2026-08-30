import { fetcher } from './fetcher';
import { remoteSWRKey } from './remoteBoundary';

/**
 * Cache-only separator. The marker is stripped before a request is sent, so
 * account identity never changes the backend URL or request contract.
 */
export const ACCOUNT_BOUND_REMOTE_SEPARATOR = '\u0000';

export type AccountBoundRemoteKey = string;

export function accountBoundRemoteKey(
  url: string,
  accountId?: string,
  enabled = true,
): AccountBoundRemoteKey | null {
  const remoteKey = remoteSWRKey(url);
  return enabled && accountId && remoteKey
    ? `${remoteKey}${ACCOUNT_BOUND_REMOTE_SEPARATOR}absinthe-account=${encodeURIComponent(accountId)}`
    : null;
}

export function accountBoundRemoteUrl(key: AccountBoundRemoteKey): string {
  const separator = key.indexOf(ACCOUNT_BOUND_REMOTE_SEPARATOR);
  return separator >= 0 ? key.slice(0, separator) : key;
}

export const accountBoundRemoteFetcher = <T>(key: AccountBoundRemoteKey): Promise<T> =>
  fetcher<T>(accountBoundRemoteUrl(key));
