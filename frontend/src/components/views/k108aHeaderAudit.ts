/** K-108A — Header clock removal audit. */
export const K108A_HEADER_CLOCK_PATTERNS = [
  'toLocaleTimeString',
  'setInterval',
] as const;

export const K108A_HEADER_RETAINED = [
  'sync-error-indicator',
  'syncing-indicator',
  'data-note-header-actions-row',
] as const;

export function auditHeaderClock(): { removed: readonly string[]; retained: readonly string[] } {
  return {
    removed: ['savedAt-clock-display'],
    retained: K108A_HEADER_RETAINED,
  };
}

export function formatK108aHeaderReport(result: ReturnType<typeof auditHeaderClock>): string {
  return [
    'K-108A header audit',
    '',
    'Decorative clock removed:',
    ...result.removed.map(r => `  ${r}`),
    '',
    'Retained:',
    ...result.retained.map(r => `  ${r}`),
  ].join('\n');
}
