/**
 * K-102 — Trash UI audit.
 */
export const K102_TRASH_FEATURES = [
  'icon-restore',
  'icon-permanent-delete',
  'no-text-overflow',
  'touch-targets',
] as const;

export interface K102TrashRow {
  feature: (typeof K102_TRASH_FEATURES)[number];
  dataHook?: string;
}

export function auditTrashUi(): K102TrashRow[] {
  return [
    { feature: 'icon-restore', dataHook: 'data-k102-trash-restore' },
    { feature: 'icon-permanent-delete', dataHook: 'data-k102-trash-delete' },
    { feature: 'no-text-overflow', dataHook: 'data-k102-trash-actions' },
    { feature: 'touch-targets', dataHook: 'data-note-editor-header-actions' },
  ];
}

export function formatK102TrashReport(rows: readonly K102TrashRow[]): string {
  const lines = ['K-102 trash audit', ''];
  for (const row of rows) {
    lines.push(`  ${row.feature}${row.dataHook ? `: ${row.dataHook}` : ''}`);
  }
  return lines.join('\n');
}
