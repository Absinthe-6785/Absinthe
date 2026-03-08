import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

/**
 * Supabase SDK가 내부적으로 토큰을 캐싱·갱신하므로
 * 수동 캐싱 로직(_cachedToken, _tokenExpiry)은 불필요합니다.
 * getSession()은 메모리에서 즉시 반환되므로 성능 overhead가 없습니다.
 */
export const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      Authorization: `Bearer ${session.access_token}`,
    },
  });
};
