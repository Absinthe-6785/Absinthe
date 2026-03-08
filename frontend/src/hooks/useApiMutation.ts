import { useCallback } from 'react';
import { authFetch } from '../lib/supabase';
import { API_URL } from '../lib/config';

type MutateTarget = 'daily' | 'static' | 'both' | 'none';

interface MutationOptions {
  /** 성공 시 호출할 SWR mutate 대상 */
  revalidate?: MutateTarget;
  /** 성공 토스트 메시지 (빈 문자열이면 표시 안 함) */
  successMsg?: string;
  /** 실패 토스트 메시지 (기본값: "Operation failed. Check network.") */
  errorMsg?: string;
}

interface ApiMutationResult {
  /**
   * mutate(method, path, body?, options?) → 성공 여부 반환
   *
   * 사용 예시:
   *   await mutate('DELETE', `/api/todos/${id}`, undefined, { revalidate: 'daily', successMsg: 'Deleted' });
   *   await mutate('POST', '/api/routines', { text }, { revalidate: 'daily' });
   *   await mutate('PUT', `/api/schedules/${id}`, payload, { revalidate: 'static', successMsg: 'Saved' });
   */
  mutate: (
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
    options?: MutationOptions,
  ) => Promise<boolean>;
}

/**
 * useApiMutation — API 호출 + 에러 처리 + SWR 재검증을 하나의 훅으로 캡슐화.
 *
 * 개선 전: PlannerView/HealthView 각자에 handleAPI 함수 중복 선언.
 *          AnalyticsView/SettingsView는 try/catch를 수동으로 작성.
 *          총 4곳에서 서로 다른 에러 처리 패턴이 혼재.
 *
 * 개선 후: 이 훅 하나로 전 뷰에서 일관된 패턴 사용.
 *          - 성공/실패 메시지 자동 처리
 *          - revalidate 대상(daily/static/both) 선택 가능
 *          - 각 뷰의 handleAPI 함수 및 수동 try/catch 제거
 */
export const useApiMutation = (
  mutateDaily: (() => void) | null,
  mutateStatic: (() => void) | null,
  showToast: (msg: string, type?: 'success' | 'error') => void,
): ApiMutationResult => {
  const mutate = useCallback(
    async (
      method: 'GET' | 'POST' | 'PUT' | 'DELETE',
      path: string,
      body?: unknown,
      options: MutationOptions = {},
    ): Promise<boolean> => {
      const {
        revalidate = 'none',
        successMsg = '',
        errorMsg = 'Operation failed. Check network.',
      } = options;

      try {
        const res = await authFetch(`${API_URL}${path}`, {
          method,
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`[${res.status}]${text ? ': ' + text.slice(0, 80) : ''}`);
        }

        // 재검증
        if (revalidate === 'daily' || revalidate === 'both') mutateDaily?.();
        if (revalidate === 'static' || revalidate === 'both') mutateStatic?.();

        if (successMsg) showToast(successMsg);
        return true;
      } catch (e) {
        const detail = e instanceof Error ? e.message : '';
        showToast(detail ? `${errorMsg} ${detail}` : errorMsg, 'error');
        return false;
      }
    },
    [mutateDaily, mutateStatic, showToast],
  );

  return { mutate };
};
