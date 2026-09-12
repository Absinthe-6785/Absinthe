import type { ReactNode } from 'react';

import {
  WORKSPACE_SCROLL_MODE,
  WORKSPACE_VIEWPORT_CLASS,
  WORKSPACE_ZONE,
} from '../../../../common/workspaceLayout';
import { WORKSPACE_GAP_CLASS } from '../../../../../lib/uiSpacingTokens';

interface RecipeCompositionLayoutProps {
  header: ReactNode;
  primary: ReactNode;
  supporting: ReactNode;
}

/**
 * Recipe owns one natural page scroller below the header through the narrow
 * layouts. At the shared xl boundary it becomes a bounded two-pane workspace:
 * the Recipe list owns the dominant pane and support gets a narrow side pane.
 */
export function RecipeCompositionLayout({
  header,
  primary,
  supporting,
}: RecipeCompositionLayoutProps) {
  return (
    <div
      className={`${WORKSPACE_VIEWPORT_CLASS} flex flex-col ${WORKSPACE_GAP_CLASS}`}
      data-workspace="recipe"
      data-workspace-scroll-mode={WORKSPACE_SCROLL_MODE.pane}
      data-recipe-composition="list-first"
    >
      <div className="abs-cosmos-recipe-header shrink-0" data-workspace-zone={WORKSPACE_ZONE.header}>
        {header}
      </div>

      <div
        className={`flex flex-1 min-h-0 min-w-0 flex-col ${WORKSPACE_GAP_CLASS} overflow-y-auto overscroll-contain xl:flex-row xl:overflow-hidden`}
        data-recipe-composition-content
        data-recipe-scroll-owner-pre-wide="workspace"
      >
        <main
          className="abs-cosmos-recipe-primary flex min-h-0 min-w-0 shrink-0 flex-col xl:flex-1"
          data-workspace-zone={WORKSPACE_ZONE.primary}
          data-recipe-composition-role="primary-list"
          data-recipe-hierarchy-level="primary"
        >
          {primary}
        </main>

        <aside
          className="abs-cosmos-recipe-support-rail flex min-h-0 shrink-0 flex-col xl:w-[320px] 2xl:w-[360px]"
          data-workspace-zone={WORKSPACE_ZONE.supporting}
          data-recipe-composition-role="support"
          data-recipe-hierarchy-level="tertiary"
        >
          <div
            className={`flex flex-col ${WORKSPACE_GAP_CLASS} xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain`}
            data-k110-recipe-sidebar
            data-k120-scroll-recipe
            data-recipe-scroll-owner-wide="support"
          >
            {supporting}
          </div>
        </aside>
      </div>
    </div>
  );
}
