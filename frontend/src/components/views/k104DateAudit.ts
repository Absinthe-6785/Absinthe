/**
 * K-104 — Locale-aware date formatting audit.
 */
export const K104_DATE_SURFACES = [
  { surface: 'note-rows', util: 'formatNoteRowDate' },
  { surface: 'daily-note', util: 'formatDailyNoteLabel' },
  { surface: 'recent-activity', util: 'formatActivityTimestamp' },
  { surface: 'timeline-lens', util: 'formatTraceDayHeadingLocalized' },
  { surface: 'planner-headers', util: 'formatLongDate' },
  { surface: 'agenda-sections', util: 'formatAgendaDateHeader' },
] as const;

export interface K104DateRow {
  surface: string;
  util: string;
}

export function auditDateSurfaces(): K104DateRow[] {
  return K104_DATE_SURFACES.map(s => ({ surface: s.surface, util: s.util }));
}

export function formatK104DateReport(rows: readonly K104DateRow[]): string {
  const lines = ['K-104 date audit', ''];
  for (const row of rows) {
    lines.push(`  ${row.surface}: ${row.util}`);
  }
  return lines.join('\n');
}
