import type { ReactNode } from 'react';
import { WORKSPACE_GAP_CLASS } from '../../lib/uiSpacingTokens';

/** K-72 shared workspace zones — Header → Primary → Secondary → Supporting */
export const WORKSPACE_ZONE = {
  header: 'workspace-zone-header',
  primary: 'workspace-zone-primary',
  secondary: 'workspace-zone-secondary',
  supporting: 'workspace-zone-supporting',
} as const;

export type WorkspaceZone = keyof typeof WORKSPACE_ZONE;

/**
 * Structural scroll modes for a workspace bounded by AppContent.
 *
 * page: one page-level owner scrolls below the workspace header.
 * pane: the workspace stays bounded and named child panes own scrolling.
 * delegated: a specialized child application owns all scroll behavior.
 *
 * The contract deliberately contains no visual theme values.
 */
export const WORKSPACE_SCROLL_MODE = {
  page: 'page',
  pane: 'pane',
  delegated: 'delegated',
} as const;

export type WorkspaceScrollMode = typeof WORKSPACE_SCROLL_MODE[keyof typeof WORKSPACE_SCROLL_MODE];

export const WORKSPACE_VIEWPORT_CLASS = 'flex-1 min-h-0 min-w-0 overflow-hidden';
export const WORKSPACE_PAGE_SCROLL_CLASS = 'flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-contain';
export const WORKSPACE_PANE_ROOT_CLASS = WORKSPACE_VIEWPORT_CLASS;

export interface WorkspaceLayoutProps {
  /** Workspace identifier for tests and analytics */
  workspace: string;
  header?: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
  supporting?: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Horizontal split when secondary + primary sit side-by-side */
  split?: boolean;
  /** Explicit page or pane scroll ownership inside the bounded app viewport. */
  scrollMode: Exclude<WorkspaceScrollMode, 'delegated'>;
}

export function WorkspaceLayout({
  workspace,
  header,
  primary,
  secondary,
  supporting,
  className = '',
  contentClassName = '',
  split = false,
  scrollMode,
}: WorkspaceLayoutProps) {
  const pageScroll = scrollMode === WORKSPACE_SCROLL_MODE.page;

  return (
    <div
      className={`flex flex-col ${WORKSPACE_VIEWPORT_CLASS} ${WORKSPACE_GAP_CLASS} ${className}`}
      data-workspace={workspace}
      data-workspace-scroll-mode={scrollMode}
      data-k119-workspace-layout
    >
      {header ? (
        <div className="shrink-0" data-workspace-zone={WORKSPACE_ZONE.header}>
          {header}
        </div>
      ) : null}

      <div
        className={`${pageScroll ? WORKSPACE_PAGE_SCROLL_CLASS : WORKSPACE_PANE_ROOT_CLASS} flex flex-col ${WORKSPACE_GAP_CLASS} ${
          split ? 'lg:flex-row' : ''
        } ${contentClassName}`}
        data-workspace-scroll-owner={pageScroll ? 'page' : undefined}
        data-k119-scroll-primary
      >
        {secondary ? (
          <div
            className="lg:w-[32%] lg:max-w-[360px] lg:flex-none flex flex-col gap-3 lg:gap-4 shrink-0 min-h-0"
            data-workspace-zone={WORKSPACE_ZONE.secondary}
          >
            {secondary}
          </div>
        ) : null}

        <div
          className={`flex flex-col gap-3 lg:gap-4 min-h-0 ${
            split ? 'lg:flex-1 lg:min-w-0' : 'flex-1'
          }`}
          data-workspace-zone={WORKSPACE_ZONE.primary}
        >
          {primary}
        </div>
      </div>

      {supporting ? (
        <div className="shrink-0 flex flex-col gap-3 lg:gap-4" data-workspace-zone={WORKSPACE_ZONE.supporting}>
          {supporting}
        </div>
      ) : null}
    </div>
  );
}
