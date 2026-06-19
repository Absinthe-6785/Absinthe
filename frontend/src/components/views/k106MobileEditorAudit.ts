/** K-106 — Mobile block editor audit. */
export const K106_MOBILE_EDITOR_HOOKS = [
  'be-grip-hit-slop-coarse',
  'be-gutter-strip-coarse-inset',
  'be-handles-visible-on-selection',
] as const;

export function auditMobileEditor(): readonly string[] {
  return K106_MOBILE_EDITOR_HOOKS;
}
