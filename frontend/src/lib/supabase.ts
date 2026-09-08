import { createClient } from '@supabase/supabase-js';
import { LocalOnlyRemoteMutationPausedError, shouldUseRemoteData } from './remoteBoundary';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export interface AuthenticatedFetchControl {
  /** Runs after auth succeeds and immediately before the network request starts. */
  onRequestStart?: () => void;
}

/**
 * Supabase SDK가 내부적으로 토큰을 캐싱·갱신하므로
 * 수동 캐싱 로직(_cachedToken, _tokenExpiry)은 불필요합니다.
 * getSession()은 메모리에서 즉시 반환되므로 성능 overhead가 없습니다.
 */
export const authFetch = async (
  url: string,
  options: RequestInit = {},
  control: AuthenticatedFetchControl = {},
): Promise<Response> => {
  if (!shouldUseRemoteData()) {
    throw new LocalOnlyRemoteMutationPausedError();
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const request: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      Authorization: `Bearer ${session.access_token}`,
    },
  };
  control.onRequestStart?.();
  return fetch(url, request);
};

/**
 * Temporary RTU bootstrap boundary.  This helper is deliberately read-only:
 * it is allowed to run while the normal remote-sync/mutation mode is paused,
 * but rejects every method other than GET/HEAD before a request is sent.
 */
export const authReadFetch = async (
  url: string,
  options: RequestInit = {},
  control: AuthenticatedFetchControl = {},
): Promise<Response> => {
  const method = (options.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') throw new Error('read_only_bootstrap_method_rejected');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  const request: RequestInit = {
    ...options,
    method,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      Authorization: `Bearer ${session.access_token}`,
    },
  };
  control.onRequestStart?.();
  return fetch(url, request);
};
