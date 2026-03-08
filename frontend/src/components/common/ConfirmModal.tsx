import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  message: string;
  // useConfirm의 handleConfirm이 async이므로 타입을 일치시킴.
  // onClick이 Promise를 무시하므로 런타임 영향은 없지만,
  // 잘못된 시그니처 함수를 전달해도 컴파일 오류가 나지 않는 문제를 방지.
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  darkMode: boolean;
  /**
   * 확인 버튼 텍스트 (기본값: 'Confirm')
   * 삭제 시 'Delete', 저장 시 'Save', 초기화 시 'Reset' 등 상황에 맞게 지정.
   *
   * 개선 전: 버튼이 항상 "Delete" 하드코딩 →
   *   'This schedule overlaps. Save anyway?' 같은 비파괴 확인에도 "Delete" 표시.
   * 개선 후: 호출부에서 의미에 맞는 레이블을 지정 가능.
   */
  confirmLabel?: string;
  /** 확인 버튼 색상 변형 (기본: destructive 빨간색) */
  variant?: 'destructive' | 'primary';
}

export const ConfirmModal = ({
  message,
  onConfirm,
  onCancel,
  darkMode,
  confirmLabel = 'Confirm',
  variant = 'destructive',
}: ConfirmModalProps) => (
  <div
    className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4 backdrop-blur-sm"
    onClick={onCancel}
  >
    <div
      className={`rounded-[28px] p-7 w-full max-w-[340px] shadow-2xl flex flex-col gap-5 ${
        darkMode ? 'bg-[#2C2C2E] text-gray-100' : 'bg-white text-gray-800'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
          variant === 'destructive' ? 'bg-red-100' : 'bg-yellow-100'
        }`}>
          <AlertTriangle
            size={24}
            strokeWidth={2.5}
            className={variant === 'destructive' ? 'text-red-500' : 'text-yellow-500'}
          />
        </div>
        <p className="text-base font-semibold leading-snug">{message}</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-colors ${
            darkMode
              ? 'bg-[#3A3A3C] hover:bg-[#48484A] text-gray-300'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={`flex-1 py-3 rounded-2xl font-bold text-sm text-white transition-colors ${
            variant === 'destructive'
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-[#1C1C1E] hover:bg-gray-700'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);
