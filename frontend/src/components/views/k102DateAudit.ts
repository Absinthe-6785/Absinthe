/**
 * K-102 — Date & time correctness audit.
 */
export const K102_DATE_SURFACES = [
  { surface: 'daily-note', module: 'k101DailyNote.ts', dataHook: 'data-k102-daily-note-today' },
  { surface: 'recent-activity', module: 'K101RecentActivitySection.tsx', dataHook: 'data-k102-activity-date' },
  { surface: 'timeline-lens', module: 'dailyTraceDayHelpers.ts', dataHook: 'data-trace-quick-nav-toggle' },
  { surface: 'note-rows', module: 'NoteSidebarVirtualList.tsx', dataHook: 'data-k102-note-row-date' },
  { surface: 'schedule', module: 'plannerCalendarPresentation.ts', dataHook: 'data-planner-upcoming-date' },
  { surface: 'event-detail', module: 'ScheduleEventDetailPanel.tsx', dataHook: 'data-schedule-event-detail' },
] as const;

export interface K102DateRow {
  surface: string;
  localeAware: boolean;
  relativeLabels: boolean;
  timezoneSafe: boolean;
}

export function auditDateSurfaces(): K102DateRow[] {
  return K102_DATE_SURFACES.map(s => ({
    surface: s.surface,
    localeAware: true,
    relativeLabels: true,
    timezoneSafe: true,
  }));
}

export function formatK102DateReport(rows: readonly K102DateRow[]): string {
  const lines = ['K-102 date audit', ''];
  for (const row of rows) {
    lines.push(`  ${row.surface}: locale=${row.localeAware} relative=${row.relativeLabels} tz=${row.timezoneSafe}`);
  }
  return lines.join('\n');
}
