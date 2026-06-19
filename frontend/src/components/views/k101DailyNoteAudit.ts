/**
 * K-101 — Daily note workflow audit.
 */
export const K101_DAILY_NOTE_FEATURES = [
  'planner-todays-note',
  'natural-date-label',
  'open-or-create',
  'duplicate-prevention',
] as const;

export interface K101DailyNoteRow {
  feature: (typeof K101_DAILY_NOTE_FEATURES)[number];
  dataHook?: string;
}

export function auditDailyNoteFeatures(): K101DailyNoteRow[] {
  return [
    { feature: 'planner-todays-note', dataHook: 'data-k105-planner-todays-note' },
    { feature: 'natural-date-label', dataHook: 'data-k105-planner-today' },
    { feature: 'open-or-create', dataHook: 'data-k105-planner-todays-note' },
    { feature: 'duplicate-prevention' },
  ];
}

export function formatK101DailyNoteReport(rows: readonly K101DailyNoteRow[]): string {
  const lines = ['K-101 daily note audit', ''];
  for (const row of rows) {
    lines.push(`  ${row.feature}${row.dataHook ? `: ${row.dataHook}` : ''}`);
  }
  return lines.join('\n');
}
