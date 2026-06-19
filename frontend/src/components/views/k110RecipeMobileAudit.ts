import { TOUCH_TARGET_MIN_PX } from '../../lib/responsiveLayout';

/** K-110 — Mobile Recipe Studio audit. */
export const K110_MOBILE_WIDTHS = [320, 375, 768] as const;

export function auditRecipeMobile(): readonly number[] {
  return K110_MOBILE_WIDTHS;
}

export function auditRecipeMobileTouchTargets(): boolean {
  return TOUCH_TARGET_MIN_PX >= 44;
}

export const K110_MOBILE_HOOKS = [
  'data-k110-recipe-card',
  'data-k110-ingredient-explorer',
  'data-k110-collection-list',
  'data-k110-history-list',
] as const;

export function auditRecipeMobileSections(): readonly string[] {
  return [...K110_MOBILE_WIDTHS.map(String), ...K110_MOBILE_HOOKS];
}
