import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Theme } from '../../../../types';
import { useTranslation } from '../../../../lib/i18n';

export interface PlannerStickyActionsProps {
  theme: Theme;
  onNewEvent: () => void;
  children?: ReactNode;
}

/** K-117 — single primary planner action, sticky below section nav. */
export function PlannerStickyActions({ theme, onNewEvent, children }: PlannerStickyActionsProps) {
  const { t } = useTranslation();

  return (
    <div
      className="sticky top-0 z-20 flex flex-col gap-2 shrink-0 mb-2 pb-2 -mx-0.5 px-0.5 bg-gradient-to-b from-background from-80% to-transparent"
      data-k117-planner-sticky-actions
    >
      {children}
      <button
        type="button"
        onClick={onNewEvent}
        className={`flex items-center justify-center gap-1.5 w-full min-h-[44px] rounded-xl font-bold text-sm shadow-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity ${theme.card}`}
        data-k117-new-event-btn
      >
        <Plus size={16} strokeWidth={2.5} />
        {t('k117NewEvent')}
      </button>
    </div>
  );
}
