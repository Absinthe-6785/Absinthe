import { authFetch, supabase } from './supabase';
import {
  assertRuntimeSessionReadOwner,
  isLocalOnlyRemoteMutationPausedError,
  type RuntimeSessionReadOwner,
} from './remoteBoundary';

/**
 * SWR용 공통 fetcher — 인증 헤더 포함, HTTP 오류 시 throw.
 *
 * - 502/503/504: 최대 3회 재시도 (exponential backoff)
 * - 401: 토큰 갱신 후 1회 재시도 → 그래도 실패 시 자동 로그아웃
 * - 네트워크 오류: 최대 3회 재시도
 */

const RETRY_STATUSES = new Set([502, 503, 504]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 600;

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export class LocalOnlyRemotePausedError extends Error {
  constructor() {
    super('Remote sync paused in local-only mode');
    this.name = 'LocalOnlyRemotePausedError';
  }
}

export class SessionReadUnauthorizedError extends Error {
  constructor() {
    super('[401] Current session is not authorized for this read');
    this.name = 'SessionReadUnauthorizedError';
  }
}

export function isLocalOnlyRemotePausedError(error: unknown): error is LocalOnlyRemotePausedError {
  return error instanceof LocalOnlyRemotePausedError
    || isLocalOnlyRemoteMutationPausedError(error);
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/** 토큰 갱신 — 동시에 여러 요청이 들어와도 한 번만 갱신 */
async function refreshToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        await supabase.auth.signOut(); // 갱신 실패 → 로그인 화면으로
        return false;
      }
      return true;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export const fetcher = async <T = unknown>(
  url: string,
  readOwner?: RuntimeSessionReadOwner,
  assertReadNeeded?: () => void,
): Promise<T> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // A scoped caller may drop demand while a transient retry is waiting.
      if (readOwner) assertReadNeeded?.();
      const revision = readOwner?.renewal?.revision();
      const res = readOwner ? await authFetch(url, {}, { readOwner }) : await authFetch(url);
      if (readOwner) assertRuntimeSessionReadOwner(readOwner);

      if (!res.ok) {
        if (readOwner && res.status === 401) {
          const needed = () => { assertReadNeeded?.(); assertRuntimeSessionReadOwner(readOwner); };
          needed();
          if (revision && await readOwner.renewal?.wait(revision, needed)) {
            needed();
            // One dispatch only: do not reenter the transient retry loop.
            try {
              const retry = await authFetch(url, {}, { readOwner, onRequestStart: needed });
              needed();
              if (!retry.ok) throw new SessionReadUnauthorizedError();
              const value = await retry.json() as T;
              needed();
              return value;
            } catch {
              needed();
              throw new SessionReadUnauthorizedError();
            }
          }
          needed();
          throw new SessionReadUnauthorizedError();
        }
        const body = await res.text().catch(() => '');
        if (readOwner) assertRuntimeSessionReadOwner(readOwner);
        const path = url.replace(/^https?:\/\/[^/]+/, '');

        // 401: 토큰 갱신 후 즉시 재시도 (1회만)
        // A scoped GET cannot take over the app's mutable refresh/logout path.
        // The SDK's normal auth events publish a new owner when tokens rotate.
        if (!readOwner && res.status === 401 && attempt === 0) {
          const refreshed = await refreshToken();
          if (refreshed) continue; // 갱신 성공 → 재시도
          throw new Error(`[401] Session expired`);
        }

        const err = new Error(`[${res.status}] ${path}${body ? ': ' + body.slice(0, 120) : ''}`);

        // 502/503/504: exponential backoff 재시도
        if (RETRY_STATUSES.has(res.status) && attempt < MAX_RETRIES - 1) {
          lastError = err;
          await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
          continue;
        }
        throw err;
      }

      const decoded = res.json() as Promise<T>;
      return readOwner ? decoded.then(
        value => {
          assertRuntimeSessionReadOwner(readOwner);
          return value;
        },
        error => {
          assertRuntimeSessionReadOwner(readOwner);
          throw error;
        },
      ) : decoded;

    } catch (e) {
      if (readOwner) assertRuntimeSessionReadOwner(readOwner);
      // 네트워크 오류 — 재시도
      if (e instanceof TypeError && attempt < MAX_RETRIES - 1) {
        lastError = e;
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }
      throw e;
    }
  }

  throw lastError ?? new Error('fetcher: max retries exceeded');
};
