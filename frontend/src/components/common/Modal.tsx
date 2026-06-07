import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  onClose: () => void;
  /** @deprecated Theme is resolved from ThemeProvider */
  darkMode?: boolean;
  children: ReactNode;
  maxWidth?: string;
}

/** 앱 전역 공통 모달 래퍼 — Absinthe Design System tokens */
export const Modal = ({ title, onClose, children, maxWidth = 'max-w-[400px]' }: ModalProps) => (
  <div
    className="fixed inset-0 flex items-center justify-center z-[100] p-4 backdrop-blur-sm"
    style={{ background: 'var(--color-overlay)' }}
    onClick={onClose}
  >
    <div
      className={`rounded-absinthe-2xl p-6 lg:p-8 w-full ${maxWidth} shadow-absinthe-xl bg-surface text-foreground`}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-heading text-xl lg:text-2xl font-bold">{title}</h3>
        <button
          onClick={onClose}
          className="p-2 rounded-absinthe-full transition-colors hover:bg-surface-alt"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </div>
  </div>
);
