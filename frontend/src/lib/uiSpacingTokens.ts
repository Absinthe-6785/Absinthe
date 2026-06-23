import { UI_DENSITY } from './uiDensityTokens';

/** K-119 / K-127 — spacing matrix for workspaces, toolbars, and settings. */
export const UI_SPACING = {
  workspaceGapMobile: 12,
  workspaceGapDesktop: 16,
  pageHeaderGapPx: 12,
  pageHeaderSubtitleGapPx: 2,
  sectionNavGapPx: 6,
  toolbarStickyPaddingBottomPx: 8,
  toolbarStickyMarginBottomPx: 8,
  settingsSectionGapPx: 12,
  /** Mirrors UI_DENSITY.cardPadding*Px — use tokens in JS; class string for Tailwind cards. */
  settingsCardPaddingMobilePx: UI_DENSITY.cardPaddingMobilePx,
  settingsCardPaddingDesktopPx: UI_DENSITY.cardPaddingDesktopPx,
  settingsHeaderMarginBottomPx: 12,
  scrollOverscroll: 'overscroll-contain',
  stickyTopClass: 'sticky top-0',
} as const;

export type UiSpacingToken = keyof typeof UI_SPACING;

/** Tailwind gap classes aligned to workspace spacing tokens. */
export const WORKSPACE_GAP_CLASS = 'gap-3 lg:gap-4';
