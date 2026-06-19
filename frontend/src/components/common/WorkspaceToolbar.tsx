import type { ReactNode } from 'react';
import { UI_INTERACTION } from '@/lib/uiInteractionTokens';
import { UI_SPACING } from '@/lib/uiSpacingTokens';

export interface WorkspaceToolbarProps {
  workspace: string;
  children?: ReactNode;
  className?: string;
  /** Legacy audit hook attribute name (boolean). */
  legacyDataHook?: string;
}

/** K-119 — consistent sticky workspace action bar. */
export function WorkspaceToolbar({ workspace, children, className = '', legacyDataHook }: WorkspaceToolbarProps) {
  return (
    <div
      className={`${UI_SPACING.stickyTopClass} z-20 flex flex-col gap-2 shrink-0 mb-2 pb-2 -mx-0.5 px-0.5 bg-gradient-to-b from-background from-80% to-transparent ${className}`}
      data-k119-workspace-toolbar={workspace}
      {...(legacyDataHook ? { [legacyDataHook]: 'true' } : {})}
      style={{ paddingBottom: UI_SPACING.toolbarStickyPaddingBottomPx, marginBottom: UI_SPACING.toolbarStickyMarginBottomPx }}
    >
      {children}
    </div>
  );
}

export interface WorkspaceToolbarPrimaryProps {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  className?: string;
  dataHook?: string;
}

export function WorkspaceToolbarPrimary({
  label,
  icon,
  onClick,
  className = '',
  dataHook,
}: WorkspaceToolbarPrimaryProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 w-full min-h-[44px] rounded-xl font-bold text-sm shadow-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${className}`}
      style={{ minHeight: UI_INTERACTION.touchTargetMinPx }}
      {...(dataHook ? { [dataHook]: 'true' } : {})}
      data-k119-toolbar-primary
    >
      {icon}
      {label}
    </button>
  );
}

export interface WorkspaceToolbarIconButtonProps {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
  className?: string;
}

export function WorkspaceToolbarIconButton({
  label,
  icon,
  onClick,
  active = false,
  className = '',
}: WorkspaceToolbarIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-lg transition-colors hover:bg-muted/60 ${UI_INTERACTION.focusRingClass} ${active ? 'bg-muted' : ''} ${className}`}
      style={{
        width: UI_INTERACTION.toolbarBtnSizePx,
        height: UI_INTERACTION.toolbarBtnSizePx,
        minWidth: UI_INTERACTION.touchTargetMinPx,
        minHeight: UI_INTERACTION.touchTargetMinPx,
      }}
      data-k119-toolbar-icon
    >
      {icon}
    </button>
  );
}
