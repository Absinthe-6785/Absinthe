import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  message: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  /** @deprecated Theme is resolved from ThemeProvider */
  darkMode?: boolean;
  confirmLabel?: string;
  variant?: 'destructive' | 'primary';
}

export const ConfirmModal = ({
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  variant = 'destructive',
}: ConfirmModalProps) => (
  <div
    className="fixed inset-0 flex items-center justify-center z-[200] p-4 backdrop-blur-sm"
    style={{ background: 'var(--color-overlay)' }}
    onClick={onCancel}
  >
    <div
      className="rounded-absinthe-xl p-7 w-full max-w-[340px] shadow-absinthe-xl flex flex-col gap-5 bg-surface text-foreground"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <div className={`w-12 h-12 rounded-absinthe-full flex items-center justify-center ${
          variant === 'destructive' ? 'bg-red-100' : 'bg-accent-bg'
        }`}>
          <AlertTriangle
            size={24}
            strokeWidth={2.5}
            className={variant === 'destructive' ? 'text-danger' : 'text-primary'}
          />
        </div>
        <p className="text-base font-semibold leading-snug">{message}</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-absinthe-lg font-bold text-sm transition-colors bg-surface-alt hover:bg-border text-muted"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={`flex-1 py-3 rounded-absinthe-lg font-bold text-sm text-primary-foreground transition-colors ${
            variant === 'destructive'
              ? 'bg-danger hover:opacity-90'
              : 'bg-primary hover:bg-primary-hover'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);
