import { authFetch, supabase } from './supabase';

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

export const fetcher = async <T = unknown>(url: string): Promise<T> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await authFetch(url);

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        const path = url.replace(/^https?:\/\/[^/]+/, '');

        // 401: 토큰 갱신 후 즉시 재시도 (1회만)
        if (res.status === 401 && attempt === 0) {
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

      return res.json() as Promise<T>;

    } catch (e) {
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
