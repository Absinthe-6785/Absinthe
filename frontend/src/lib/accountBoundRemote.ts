import { fetcher } from './fetcher';
import { remoteSWRKey } from './remoteBoundary';
import type { SyncDomain } from './syncAuthority';
import { isRecipeWorkerQaRequest, readRecipeWorkerQa } from './recipeWorkerQa';

/**
 * Cache-only separator. The marker is stripped before a request is sent, so
 * account identity never changes the backend URL or request contract.
 */
export const ACCOUNT_BOUND_REMOTE_SEPARATOR = '\u0000';
const ACCOUNT_MARKER = ACCOUNT_BOUND_REMOTE_SEPARATOR + 'absinthe-account=';

export type AccountBoundRemoteKey = string;

/** Cache identity is also needed to invalidate a source with no live subscription. */
export function accountBoundCacheKey(url: string, accountId?: string): AccountBoundRemoteKey | null {
  return accountId ? `${url}${ACCOUNT_MARKER}${encodeURIComponent(accountId)}` : null;
}

export function accountBoundRemoteKey(
  url: string,
  accountId: string | undefined,
  domain: SyncDomain,
  enabled = true,
): AccountBoundRemoteKey | null {
  const remoteKey = remoteSWRKey(url, domain);
  return enabled && remoteKey ? accountBoundCacheKey(remoteKey, accountId) : null;
}

export function accountBoundRemoteUrl(key: AccountBoundRemoteKey): string {
  const separator = key.indexOf(ACCOUNT_BOUND_REMOTE_SEPARATOR);
  return separator >= 0 ? key.slice(0, separator) : key;
}

export const accountBoundRemoteFetcher = <T>(key: AccountBoundRemoteKey): Promise<T> => {
  const url = accountBoundRemoteUrl(key);
  if (import.meta.env.DEV && import.meta.env.MODE === 'recipe-worker-qa' && isRecipeWorkerQaRequest(url)) {
    const suffix = key.slice(url.length);
    return readRecipeWorkerQa<T>(url, suffix.startsWith(ACCOUNT_MARKER)
      ? decodeURIComponent(suffix.slice(ACCOUNT_MARKER.length)) : '');
  }
  return fetcher<T>(url);
};
