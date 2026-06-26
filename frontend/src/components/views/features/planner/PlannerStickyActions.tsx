import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from '../../../../lib/i18n';
import { UI_INTERACTION } from '../../../../lib/uiInteractionTokens';

export interface PlannerStickyActionsProps {
  onNewEvent: () => void;
  children?: ReactNode;
}

/** K-121 — compact schedule chrome: section nav + single New Event (no full-width bar). */
export function PlannerStickyActions({ onNewEvent, children }: PlannerStickyActionsProps) {
  const { t } = useTranslation();

  return (
    <div
      className="sticky top-0 z-20 flex flex-col gap-2 shrink-0 mb-2 pb-1"
      data-k117-planner-sticky-actions
      data-k121-schedule-toolbar
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex-1 min-w-0">{children}</div>
        <button
          type="button"
          onClick={onNewEvent}
          className="inline-flex items-center justify-center gap-1.5 shrink-0 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          style={{ minHeight: UI_INTERACTION.touchTargetMinPx }}
          data-k117-new-event-btn
          data-k121-schedule-new-event
        >
          <Plus size={UI_INTERACTION.toolbarIconSizePx} strokeWidth={UI_INTERACTION.toolbarIconStroke} />
          <span className="hidden sm:inline">{t('k117NewEvent')}</span>
        </button>
      </div>
    </div>
  );
}
