import { useState, useCallback, useRef, useEffect } from 'react';

export interface Toast {
  msg: string;
  type: 'success' | 'error';
}

const TOAST_DURATION_MS = 3000;

/**
 * useToast — 자동 소멸 토스트 상태를 캡슐화한 훅.
 *
 * 개선: unmount 시 타이머 cleanup useEffect 추가.
 * 현재 AppContent는 앱 라이프사이클 동안 unmount되지 않아 실제 문제는 없지만,
 * 훅이 범용으로 설계되어 있으므로 어디서 사용해도 타이머 누수가 없도록 보장.
 */
export const useToast = () => {
  const [toast, setToast] = useState<Toast | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // unmount 시 dangling 타이머 정리
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ msg, type });
    timerRef.current = setTimeout(() => {
      setToast(null);
      timerRef.current = null;
    }, TOAST_DURATION_MS);
  }, []);

  return { toast, showToast };
};
