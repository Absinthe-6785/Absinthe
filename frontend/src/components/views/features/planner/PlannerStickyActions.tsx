import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from '../../../../lib/i18n';
import { UI_INTERACTION } from '../../../../lib/uiInteractionTokens';
import { WorkspaceToolbar, WorkspaceToolbarPrimary } from '../../../common/WorkspaceToolbar';

export interface PlannerStickyActionsProps {
  onNewEvent: () => void;
  children?: ReactNode;
}

/** K-117 / K-119 — single primary planner action, sticky below section nav. */
export function PlannerStickyActions({ onNewEvent, children }: PlannerStickyActionsProps) {
  const { t } = useTranslation();

  return (
    <WorkspaceToolbar workspace="schedule" legacyDataHook="data-k117-planner-sticky-actions">
      {children}
      <WorkspaceToolbarPrimary
        label={t('k117NewEvent')}
        icon={<Plus size={UI_INTERACTION.toolbarIconSizePx} strokeWidth={UI_INTERACTION.toolbarIconStroke} />}
        onClick={onNewEvent}
        dataHook="data-k117-new-event-btn"
      />
    </WorkspaceToolbar>
  );
}
