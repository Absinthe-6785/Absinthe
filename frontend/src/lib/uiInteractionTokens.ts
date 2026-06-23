import { TOUCH_TARGET_MIN_PX } from './responsiveLayout';
import { UI_DENSITY } from './uiDensityTokens';

/** K-119 / K-127 — shared interaction primitives for popovers, menus, and focus. */
export const UI_INTERACTION = {
  popoverMaxWidthPx: 220,
  popoverZIndex: 300,
  popoverBackdropZIndex: 299,
  popoverSheetZIndex: 200,
  popoverViewportPaddingPx: 8,
  popoverAnchorGapPx: 4,
  popoverMaxHeightPx: 320,
  focusRingClass: 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
  touchTargetMinPx: TOUCH_TARGET_MIN_PX,
  toolbarIconSizePx: 16,
  toolbarIconStroke: 2.5,
  toolbarActionGapPx: 8,
  toolbarBtnSizePx: 24,
  btnRadiusPx: 12,
  btnRadiusClass: 'rounded-xl',
  sectionChipRadiusClass: 'rounded-xl',
  noteChromeBtnRadiusPx: 6,
  escapeKey: 'Escape',
  editorMenuMinWidthPx: 210,
  editorMenuMaxWidthPx: 240,
  editorMenuItemPaddingPx: 12,
  editorMenuItemGapPx: 8,
  editorMenuZIndex: 400,
  /** Note-chrome header row padding (matches K-126C). */
  noteChromeHeaderRowPaddingMobile: '4px 10px',
  noteChromeHeaderRowPaddingDesktop: '4px 12px',
} as const;

export type UiInteractionToken = keyof typeof UI_INTERACTION;

/** Note-chrome button metrics derived from interaction tokens. */
export const NOTE_CHROME_HEADER_BTN_RADIUS_PX = UI_INTERACTION.noteChromeBtnRadiusPx;
