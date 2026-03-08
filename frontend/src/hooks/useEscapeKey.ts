import { useEffect, useRef } from 'react';

/**
 * ESC 키 이벤트 리스너를 한 번만 등록하고 항상 최신 콜백을 ref로 참조합니다.
 */
export const useEscapeKey = (callback: () => void) => {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') callbackRef.current();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);
};
