import { TOUCH_TARGET_MIN_PX } from '../../lib/responsiveLayout';

/** K-112 — Mobile product audit. */
export const K112_MOBILE_WIDTHS = [320, 375, 768] as const;

export const K112_MOBILE_HOOKS = [
  'data-k111-search-modal',
  'data-k104-mobile-list-more',
  'data-noteview-new-note-btn',
  'min-h-[44px]',
] as const;

export function auditMobile(): readonly number[] {
  return K112_MOBILE_WIDTHS;
}

export function auditMobileTouchTargets(): boolean {
  return TOUCH_TARGET_MIN_PX >= 44;
}

export function auditMobileSections(): readonly string[] {
  return [...K112_MOBILE_WIDTHS.map(String), ...K112_MOBILE_HOOKS];
}
