import { useState, useCallback, useRef } from 'react';

interface ConfirmOptions {
  /** 확인 버튼 텍스트 (기본값: 'Confirm') */
  confirmLabel?: string;
  /** 버튼 색상 변형 (기본: 'destructive') */
  variant?: 'destructive' | 'primary';
}

interface ConfirmState extends Required<ConfirmOptions> {
  message: string;
  // 개선 전: () => void — async 콜백이 전달되면 Promise가 무시됨
  // 개선 후: () => void | Promise<void> — handleConfirm이 await로 완료 보장
  onConfirm: () => void | Promise<void>;
}

/**
 * useConfirm — ConfirmModal 상태를 캡슐화하는 공유 훅.
 *
 * - confirmLabel과 variant를 showConfirm 호출 시 지정 가능.
 * - onConfirm은 동기/비동기 모두 지원. handleConfirm이 await로 완료를 기다림.
 */
export const useConfirm = () => {
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const confirmRef = useRef<ConfirmState | null>(null);

  const showConfirm = useCallback(
    (
      message: string,
      onConfirm: () => void | Promise<void>,
      options: ConfirmOptions = {},
    ) => {
      const next = {
        message,
        onConfirm,
        confirmLabel: options.confirmLabel ?? 'Confirm',
        variant: options.variant ?? 'destructive',
      };
      confirmRef.current = next;
      setConfirm(next);
    },
    [],
  );

  const clearConfirm = useCallback(() => {
    confirmRef.current = null;
    setConfirm(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    const current = confirmRef.current;
    if (!current) return;
    // Consume before awaiting so repeated click/Enter/callback delivery cannot
    // invoke a destructive authority twice.
    confirmRef.current = null;
    setConfirm(null);
    await current.onConfirm();
  }, []);

  return { confirm, showConfirm, clearConfirm, handleConfirm };
};
