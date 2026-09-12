import { Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Theme } from '../../../../types';
import {
  PopoverDismiss,
  PopoverPanel,
  PopoverPortal,
  PopoverRoot,
} from '../../../common/popover/Popover';

export interface HealthSetActionsProps {
  setNumber: number;
  eligible: boolean;
  assistedActive: boolean;
  canDelete: boolean;
  locked: boolean;
  isMobile: boolean;
  theme: Theme;
  labels: {
    trigger: string;
    title: string;
    addAssisted: string;
    removeAssisted: string;
    deleteSet: string;
  };
  onAddAssisted: () => void;
  onRemoveAssisted: () => void;
  onDelete: () => void;
}

export function HealthSetActions({
  setNumber,
  eligible,
  assistedActive,
  canDelete,
  locked,
  isMobile,
  theme,
  labels,
  onAddAssisted,
  onRemoveAssisted,
  onDelete,
}: HealthSetActionsProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hasActions = eligible || canDelete;

  useEffect(() => {
    if (locked) setOpen(false);
  }, [locked]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const choose = (action: () => void, returnFocus: boolean) => {
    setOpen(false);
    action();
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const items = (
    <div className="space-y-1" role="none">
      {eligible && (
        <button
          type="button"
          role="menuitem"
          className={`flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold ${theme.hoverBg}`}
          onClick={() => choose(assistedActive ? onRemoveAssisted : onAddAssisted, assistedActive)}
          data-health-set-assisted-action={assistedActive ? 'remove' : 'add'}
        >
          {assistedActive ? <X size={15} aria-hidden /> : <Plus size={15} aria-hidden />}
          {assistedActive ? labels.removeAssisted : labels.addAssisted}
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          role="menuitem"
          className="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-red-500 hover:bg-red-500/10"
          onClick={() => choose(onDelete, false)}
          data-health-set-delete-action
        >
          <Trash2 size={15} aria-hidden /> {labels.deleteSet}
        </button>
      )}
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={locked || !hasActions}
        aria-label={labels.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        className={`relative h-8 w-8 shrink-0 rounded-lg text-xs font-bold transition-colors after:absolute after:-inset-1.5 after:content-[''] disabled:cursor-default ${
          locked || !hasActions ? theme.textMuted : `${theme.card} ${theme.hoverBg}`
        }`}
        data-health-set-actions-trigger={setNumber}
      >
        {setNumber}
      </button>
      <PopoverRoot open={open && !locked} onOpenChange={handleOpenChange} isMobile={isMobile} anchorRef={triggerRef}>
        <PopoverPortal>
          {isMobile ? (
            <PopoverDismiss variant="sheet" data-hook="data-health-set-actions-backdrop">
              <PopoverPanel
                role="menu"
                aria-label={labels.title}
                className={`w-full border-t ${theme.card} ${theme.border}`}
                dataHooks={{ 'data-health-set-actions-menu': 'true' }}
              >
                <p className={`mb-2 px-2 text-xs font-bold ${theme.textMuted}`}>{labels.title}</p>
                {items}
              </PopoverPanel>
            </PopoverDismiss>
          ) : (
            <>
              <PopoverDismiss />
              <PopoverPanel
                role="menu"
                aria-modal={false}
                aria-label={labels.title}
                className={`rounded-xl border p-1.5 shadow-lg ${theme.card} ${theme.border}`}
                dataHooks={{ 'data-health-set-actions-menu': 'true' }}
              >
                {items}
              </PopoverPanel>
            </>
          )}
        </PopoverPortal>
      </PopoverRoot>
    </>
  );
}
