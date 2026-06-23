/** K-119 / K-127 — density scale for cards, empty states, and sidebars. */
export const UI_DENSITY = {
  emptyStatePaddingPx: 16,
  emptyStateGapPx: 8,
  emptyStateIconSizePx: 28,
  emptyStateTitleFontPx: 13,
  emptyStateDescFontPx: 11,
  emptyStateDescMaxWidthPx: 240,
  cardPaddingMobilePx: 16,
  cardPaddingDesktopPx: 20,
  cardRadiusMobilePx: 20,
  cardRadiusDesktopPx: 24,
  sectionTitleFontPx: 18,
  sectionLabelFontPx: 12,
  bodyFontPx: 14,
  sidebarRowPaddingPx: 8,
  tableCellPaddingPx: 8,
  calloutPaddingPx: 12,
  editorMenuItemFontPx: 13,
  editorMenuSectionFontPx: 9,
} as const;

export type UiDensityToken = keyof typeof UI_DENSITY;
