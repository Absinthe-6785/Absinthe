import { authFetch } from './supabase';
import { assertRuntimeSessionReadOwner, runtimeSessionReadOwner } from './remoteBoundary';

export function isRecipeWorkerQaRequest(url: string): boolean {
  const target = new URL(url);
  return target.origin === 'http://127.0.0.1:5177'
    && /^\/api\/recipes(?:\/|$)/.test(target.pathname);
}

async function withRecipeWorkerQaResponse<T>(
  url: string,
  accountId: string | undefined,
  options: RequestInit,
  consume: (response: Response, requireCurrentSession: () => void) => Promise<T>,
): Promise<T> {
  const owner = runtimeSessionReadOwner();
  if (!accountId || !owner || owner.accountId !== accountId) {
    throw new Error('Recipe QA account is not current');
  }
  const check = () => assertRuntimeSessionReadOwner(owner);
  const response = await authFetch(url, {
    ...options,
    headers: {
      ...Object.fromEntries(new Headers(options.headers)),
      'X-Recipe-QA-Expected-Account': accountId,
    },
    signal: owner.signal,
    redirect: 'error',
  }, { onRequestStart: check });
  check();
  const result = await consume(response, check);
  check();
  return result;
}

type RecipeAccountResponse = { response: Response; requireCurrentSession: () => void };

export const recipeAccountFetch: (url: string, options: RequestInit, accountId?: string) => Promise<RecipeAccountResponse> =
  import.meta.env.DEV && import.meta.env.MODE === 'recipe-worker-qa'
    ? async (url, options, accountId) => {
      if (!isRecipeWorkerQaRequest(url)) throw new Error('Recipe QA endpoint is not local');
      return withRecipeWorkerQaResponse(url, accountId, options,
        async (response, requireCurrentSession) => ({ response, requireCurrentSession }));
    }
    : async (url, options) => ({ response: await authFetch(url, options), requireCurrentSession: () => {} });

export function readRecipeWorkerQa<T>(url: string, accountId: string): Promise<T> {
  return withRecipeWorkerQaResponse(url, accountId, {}, async response => {
    if (!response.ok) throw new Error(`Recipe QA request failed (${response.status})`);
    return await response.json() as T;
  });
}
