import { TOUCH_TARGET_MIN_PX } from './responsiveLayout';

/** K-119 — shared interaction primitives for popovers, menus, and focus. */
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
  escapeKey: 'Escape',
} as const;

export type UiInteractionToken = keyof typeof UI_INTERACTION;
