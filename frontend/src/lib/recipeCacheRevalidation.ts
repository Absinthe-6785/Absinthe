import type { ScopedMutator } from 'swr';

import {
  accountBoundRemoteFetcher,
  accountBoundRemoteKey,
} from './accountBoundRemote';
import { API_URL } from './config';

export interface RecipeRestoreCacheAuthority {
  accountId: string;
  isCurrentAccount: () => boolean;
}

export type RecipeRestoreCacheRefreshResult =
  | 'refreshed'
  | 'failed'
  | 'stale-account';

class StaleRecipeRestoreAuthorityError extends Error {
  constructor() {
    super('Recipe restore cache authority is stale');
    this.name = 'StaleRecipeRestoreAuthorityError';
  }
}

/**
 * Fetch authoritative active Recipes for the account that completed a Vault
 * restore. Supplying the GET as an async SWR mutation updater makes the fetch
 * independent of RecipeView mounting while retaining SWR's mutation fencing
 * against older in-flight reads.
 */
export async function revalidateRecipeAccountCacheAfterRestore(
  globalMutate: ScopedMutator,
  authority: RecipeRestoreCacheAuthority,
): Promise<RecipeRestoreCacheRefreshResult> {
  if (!authority.isCurrentAccount()) return 'stale-account';

  const activeKey = accountBoundRemoteKey(
    `${API_URL}/api/recipes`,
    authority.accountId,
  );
  if (!activeKey) return 'stale-account';

  try {
    await globalMutate(
      activeKey,
      async () => {
        if (!authority.isCurrentAccount()) {
          throw new StaleRecipeRestoreAuthorityError();
        }
        const rows = await accountBoundRemoteFetcher<unknown[]>(activeKey);
        if (!authority.isCurrentAccount()) {
          throw new StaleRecipeRestoreAuthorityError();
        }
        return rows;
      },
      {
        populateCache: true,
        revalidate: false,
        throwOnError: true,
      },
    );
    return 'refreshed';
  } catch (error) {
    return error instanceof StaleRecipeRestoreAuthorityError
      ? 'stale-account'
      : 'failed';
  }
}
