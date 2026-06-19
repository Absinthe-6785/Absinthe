/** K-108A — Image block compact controls audit. */
export const K108A_IMAGE_BLOCK_HOOKS = [
  'data-k108-image-block',
  'data-k108-image-controls',
  'data-k108-image-more',
  'data-k108-image-mobile-menu',
  'data-k108-image-replace-file',
  'data-k108-image-replace-url',
  'data-k108-image-delete',
  'data-k108-image-caption',
] as const;

export const K108A_IMAGE_LAYOUT_MODES = [
  'hover-reveal-desktop',
  'mobile-menu',
] as const;

export function auditImageBlock(): readonly string[] {
  return K108A_IMAGE_BLOCK_HOOKS;
}

export function formatK108aImageBlockReport(hooks: readonly string[]): string {
  return [
    'K-108A image block audit',
    '',
    ...hooks.map(h => `  ${h}`),
    '',
    'Layout modes:',
    ...K108A_IMAGE_LAYOUT_MODES.map(m => `  ${m}`),
  ].join('\n');
}
