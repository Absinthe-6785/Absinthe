/**
 * K-102 — Planner quality audit.
 */
export const K102_PLANNER_FEATURES = [
  'event-chip-overflow',
  'event-hover-state',
  'detail-button-alignment',
  'upcoming-desktop-density',
  'relative-agenda-dates',
] as const;

export interface K102PlannerRow {
  feature: (typeof K102_PLANNER_FEATURES)[number];
  dataHook?: string;
}

export function auditPlannerFeatures(): K102PlannerRow[] {
  return [
    { feature: 'event-chip-overflow', dataHook: 'data-planner-month-event' },
    { feature: 'event-hover-state', dataHook: 'data-k101-planner-chip' },
    { feature: 'detail-button-alignment', dataHook: 'data-k102-schedule-detail-actions' },
    { feature: 'upcoming-desktop-density', dataHook: 'data-k102-upcoming-scroll' },
    { feature: 'relative-agenda-dates', dataHook: 'data-planner-upcoming-date' },
  ];
}

export function formatK102PlannerReport(rows: readonly K102PlannerRow[]): string {
  const lines = ['K-102 planner audit', ''];
  for (const row of rows) {
    lines.push(`  ${row.feature}${row.dataHook ? `: ${row.dataHook}` : ''}`);
  }
  return lines.join('\n');
}
