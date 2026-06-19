/** K-119 — spacing matrix for workspaces, toolbars, and settings. */
export const UI_SPACING = {
  workspaceGapMobile: 12,
  workspaceGapDesktop: 16,
  toolbarStickyPaddingBottomPx: 8,
  toolbarStickyMarginBottomPx: 8,
  settingsSectionGapPx: 12,
  settingsCardPaddingMobilePx: 16,
  settingsCardPaddingDesktopPx: 20,
  settingsHeaderMarginBottomPx: 12,
  scrollOverscroll: 'overscroll-contain',
  stickyTopClass: 'sticky top-0',
} as const;

export type UiSpacingToken = keyof typeof UI_SPACING;

/** Tailwind gap classes aligned to workspace spacing tokens. */
export const WORKSPACE_GAP_CLASS = 'gap-3 lg:gap-4';
