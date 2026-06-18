/**
 * K-102 — Read mode audit.
 */
export const K102_READ_MODE_FEATURES = [
  'search-toolbar-spacing',
  'highlight-visibility',
  'double-click-edit',
  'ctrl-f-focus',
  'esc-close-search',
] as const;

export interface K102ReadModeRow {
  feature: (typeof K102_READ_MODE_FEATURES)[number];
  dataHook?: string;
}

export function auditReadModeFeatures(): K102ReadModeRow[] {
  return [
    { feature: 'search-toolbar-spacing', dataHook: 'data-document-search-toolbar' },
    { feature: 'highlight-visibility', dataHook: 'bshl' },
    { feature: 'double-click-edit' },
    { feature: 'ctrl-f-focus', dataHook: 'data-read-mode-search-btn' },
    { feature: 'esc-close-search', dataHook: 'data-read-mode-search-toolbar' },
  ];
}

export function formatK102ReadModeReport(rows: readonly K102ReadModeRow[]): string {
  const lines = ['K-102 read mode audit', ''];
  for (const row of rows) {
    lines.push(`  ${row.feature}${row.dataHook ? `: ${row.dataHook}` : ''}`);
  }
  return lines.join('\n');
}
