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

export interface WorkspaceLayoutProps {
  /** Workspace identifier for tests and analytics */
  workspace: string;
  header?: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
  supporting?: ReactNode;
  className?: string;
  /** Horizontal split when secondary + primary sit side-by-side */
  split?: boolean;
}

export function WorkspaceLayout({
  workspace,
  header,
  primary,
  secondary,
  supporting,
  className = '',
  split = false,
}: WorkspaceLayoutProps) {
  return (
    <div
      className={`flex flex-col min-h-0 flex-1 ${WORKSPACE_GAP_CLASS} ${className}`}
      data-workspace={workspace}
      data-k119-workspace-layout
    >
      {header ? (
        <div className="shrink-0" data-workspace-zone={WORKSPACE_ZONE.header}>
          {header}
        </div>
      ) : null}

      <div
        className={`flex-1 min-h-0 flex flex-col ${WORKSPACE_GAP_CLASS} ${
          split ? 'lg:flex-row' : ''
        }`}
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
