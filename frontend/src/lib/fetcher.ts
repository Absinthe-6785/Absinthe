import { authFetch } from './supabase';

/**
 * SWR용 공통 fetcher — 인증 헤더 포함, HTTP 오류 시 throw.
 *
 * Render 슬립 해제 직후 동시 요청 폭주로 발생하는
 * 401 + "Errno 11 Resource temporarily unavailable" 대응:
 * - 401 / 503 / 네트워크 오류 시 최대 3회 재시도
 * - 재시도 간격: 600ms → 1200ms → 2400ms (exponential backoff)
 * - 3회 모두 실패하면 마지막 에러를 throw → SWR의 onError 콜백으로 전달
 */

const RETRYABLE_STATUSES = new Set([401, 503, 502, 504]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 600;

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export const fetcher = async (url: string): Promise<unknown> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await authFetch(url);

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        const path = url.replace(/^https?:\/\/[^/]+/, '');
        const err = new Error(`[${res.status}] ${path}${body ? ': ' + body.slice(0, 120) : ''}`);

        // 재시도 가능한 상태코드면 retry, 아니면 즉시 throw
        if (RETRYABLE_STATUSES.has(res.status) && attempt < MAX_RETRIES - 1) {
          lastError = err;
          await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
          continue;
        }
        throw err;
      }

      return res.json();

    } catch (e) {
      // 네트워크 오류 (fetch 자체 실패) — 재시도
      if (e instanceof TypeError && attempt < MAX_RETRIES - 1) {
        lastError = e;
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }
      // 이미 위에서 throw한 HTTP 에러 or 마지막 시도 실패
      throw e;
    }
  }

  // 루프를 다 돌았는데 성공 못한 경우 (이론상 도달 불가지만 TS 안전)
  throw lastError ?? new Error('fetcher: max retries exceeded');
};
