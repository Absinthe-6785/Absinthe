import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from '../../../../lib/i18n';
import { useModalA11y } from '../../../../hooks/useModalA11y';
import {
  PopoverDismiss,
  PopoverPanel,
  PopoverPortal,
  PopoverRoot,
  usePopoverContext,
} from '../../../common/popover/Popover';
import type { PreviousWorkoutViewProps } from './PreviousWorkoutView';
import { PreviousWorkoutView } from './PreviousWorkoutView';

export interface PreviousWorkoutSheetProps extends PreviousWorkoutViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function PreviousWorkoutSheetA11y({ onClose }: { onClose: () => void }) {
  const { open, menuRef } = usePopoverContext();

  useModalA11y({
    open,
    onClose,
    // PopoverRoot owns Escape handling; this hook supplies mobile focus trap
    // and restoration without registering a second Escape listener.
    closeOnEscape: false,
    containerRef: menuRef,
  });

  useEffect(() => {
    const firstFocusable = menuRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]',
    );
    firstFocusable?.focus();
  }, [menuRef, open]);

  return null;
}

/** Mobile-only contextual presentation for the existing Previous authority. */
export function PreviousWorkoutSheet({ open, onOpenChange, ...previousProps }: PreviousWorkoutSheetProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <PopoverRoot open={open} onOpenChange={onOpenChange} isMobile>
      <PopoverPortal>
        <PopoverDismiss variant="sheet" data-hook="data-health-previous-sheet-backdrop">
          <PopoverPanel
            aria-label={t('previousWorkout')}
            className="w-full max-h-[92dvh] bg-background border-t border-border overflow-hidden flex flex-col p-0"
            style={{ padding: 0 }}
            dataHooks={{ 'data-health-previous-sheet': 'true' }}
          >
            <PreviousWorkoutSheetA11y onClose={() => onOpenChange(false)} />
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 shrink-0">
              <h2 className="font-heading text-base font-bold">{t('previousWorkout')}</h2>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/60 abs-focus-ring"
                aria-label={t('close')}
                data-health-previous-sheet-close
              >
                <X size={18} aria-hidden />
              </button>
            </div>
            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
              data-health-previous-sheet-scroll
            >
              <PreviousWorkoutView {...previousProps} scrollMode="inherited" />
            </div>
          </PopoverPanel>
        </PopoverDismiss>
      </PopoverPortal>
    </PopoverRoot>
  );
}
