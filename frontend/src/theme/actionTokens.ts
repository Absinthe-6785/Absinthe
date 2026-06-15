import { TOUCH_TARGET_MIN_PX } from '../lib/responsiveLayout';

/** Shared icon-action sizing — K-75. */
export const ACTION_SIZE_SM = 32;
export const ACTION_SIZE_MD = 40;
export const ACTION_SIZE_LG = 48;

export const ICON_SIZE_SM = 12;
export const ICON_SIZE_MD = 14;
export const ICON_SIZE_LG = 16;

export const TOOLBAR_HEIGHT = ACTION_SIZE_MD;
export const TOOLBAR_DIVIDER_GAP = 8;
export const CARD_HEADER_ICON_SIZE = ICON_SIZE_MD;

/** Desktop toolbar control height; touch layouts use TOUCH_TARGET_MIN_PX. */
export function toolbarControlHeight(compactChrome: boolean): number {
  return compactChrome ? TOUCH_TARGET_MIN_PX : TOOLBAR_HEIGHT;
}

export function iconButtonSize(compactChrome: boolean): number {
  return compactChrome ? TOUCH_TARGET_MIN_PX : ACTION_SIZE_MD;
}
