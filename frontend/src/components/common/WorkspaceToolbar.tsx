import type { CSSProperties, ReactNode } from 'react';
import { UI_INTERACTION } from '@/lib/uiInteractionTokens';
import { UI_SPACING } from '@/lib/uiSpacingTokens';
import { WORKSPACE_BTN_PRIMARY_CLASS } from './workspaceCardSizes';

export { NOTE_CHROME_HEADER_BTN_RADIUS_PX } from '@/lib/uiInteractionTokens';

export function noteChromeHeaderButtonStyle(isMobile: boolean): CSSProperties {
  const size = isMobile ? UI_INTERACTION.touchTargetMinPx : UI_INTERACTION.toolbarBtnSizePx;
  return {
    width: size,
    height: size,
    minWidth: size,
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderRadius: UI_INTERACTION.noteChromeBtnRadiusPx,
  };
}

export interface WorkspaceToolbarProps {
  workspace: string;
  children?: ReactNode;
  className?: string;
  /** Legacy audit hook attribute name (boolean). */
  legacyDataHook?: string;
  /** Sticky edge — top (default) or bottom (e.g. Health save). */
  stickyPosition?: 'top' | 'bottom';
}

const STICKY_CLASS = {
  top: 'sticky top-0 bg-gradient-to-b from-background from-80% to-transparent',
  bottom: 'sticky bottom-0 bg-gradient-to-t from-background from-80% to-transparent',
} as const;

/** K-119 / K-120 — consistent sticky workspace action bar. */
export function WorkspaceToolbar({
  workspace,
  children,
  className = '',
  legacyDataHook,
  stickyPosition = 'top',
}: WorkspaceToolbarProps) {
  return (
    <div
      className={`z-20 flex flex-col gap-2 shrink-0 ${STICKY_CLASS[stickyPosition]} mb-2 pb-2 -mx-0.5 px-0.5 ${className}`}
      data-k119-workspace-toolbar={workspace}
      data-k120-toolbar-position={stickyPosition}
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
  disabled?: boolean;
}

export function WorkspaceToolbarPrimary({
  label,
  icon,
  onClick,
  className = '',
  dataHook,
  disabled = false,
}: WorkspaceToolbarPrimaryProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${WORKSPACE_BTN_PRIMARY_CLASS} w-full ${UI_INTERACTION.focusRingClass} ${className}`}
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
      className={`inline-flex items-center justify-center ${UI_INTERACTION.btnRadiusClass} transition-colors hover:bg-muted/60 ${UI_INTERACTION.focusRingClass} ${active ? 'bg-muted' : ''} ${className}`}
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
