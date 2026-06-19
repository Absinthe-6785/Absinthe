import { TOUCH_TARGET_MIN_PX } from '../../lib/responsiveLayout';

/** K-111 — Mobile search audit. */
export const K111_MOBILE_WIDTHS = [320, 375, 768] as const;

export const K111_MOBILE_HOOKS = [
  'data-k111-search-modal',
  'data-k111-search-input',
  'data-k111-search-card',
] as const;

export function auditSearchMobile(): readonly number[] {
  return K111_MOBILE_WIDTHS;
}

export function auditSearchMobileTouchTargets(): boolean {
  return TOUCH_TARGET_MIN_PX >= 44;
}

export function auditSearchMobileSections(): readonly string[] {
  return [...K111_MOBILE_WIDTHS.map(String), ...K111_MOBILE_HOOKS];
}
