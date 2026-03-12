import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  onClose: () => void;
  darkMode: boolean;
  children: ReactNode;
  /** 최대 너비 (기본 max-w-[400px]) */
  maxWidth?: string;
}

/** 앱 전역 공통 모달 래퍼
 *  - 배경 클릭으로 닫힘
 *  - 상단 타이틀 + X 버튼
 *  - darkMode 기반 card 색상 적용
 */
export const Modal = ({ title, onClose, darkMode, children, maxWidth = 'max-w-[400px]' }: ModalProps) => {
  const card = darkMode ? 'bg-[#2C2C2E] text-gray-100' : 'bg-[#FAFAF8] text-[#1C1C1E]';
  const hoverBg = darkMode ? 'hover:bg-[#3A3A3C]' : 'hover:bg-[#F0EDE5]';

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`rounded-[32px] p-6 lg:p-8 w-full ${maxWidth} shadow-2xl ${card}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-heading text-xl lg:text-2xl font-bold">{title}</h3>
          <button
            onClick={onClose}
            className={`p-2 rounded-full transition-colors ${hoverBg}`}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
