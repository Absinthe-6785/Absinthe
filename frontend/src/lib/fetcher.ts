import { authFetch } from './supabase';

/**
 * SWR용 공통 fetcher — 인증 헤더 포함, HTTP 오류 시 throw.
 *
 * 개선 전: useDaily.ts / useStatic.ts 양쪽에 완전히 동일한 fetcher가 각각 선언됨.
 *          한 곳을 수정하면 다른 곳도 수동으로 맞춰야 하는 중복 유지보수 부채.
 * 개선 후: 단일 파일로 추출 → 변경 시 한 곳만 수정하면 됨.
 */
export const fetcher = async (url: string): Promise<unknown> => {
  const res = await authFetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    throw new Error(`[${res.status}] ${path}${body ? ': ' + body.slice(0, 80) : ''}`);
  }
  return res.json();
};
