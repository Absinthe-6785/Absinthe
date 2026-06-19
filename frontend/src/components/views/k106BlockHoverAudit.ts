/** K-106 — Block hover simplification audit. */
export const K106_BLOCK_HOVER_RULES = [
  'no-gutter-strip-hover-border',
  'be-block-hover-bg-tint',
  'be-grip-dot-opacity-only',
  'no-handle-btn-hover-background',
] as const;

export function auditBlockHover(): readonly string[] {
  return K106_BLOCK_HOVER_RULES;
}
