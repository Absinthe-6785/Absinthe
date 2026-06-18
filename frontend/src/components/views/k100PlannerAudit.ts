/**
 * K-100 — Planner UX audit.
 */
export const K100_PLANNER_FEATURES = [
  'agenda-on-view',
  'event-duplicate',
  'event-quick-edit',
  'event-keyboard-shortcuts',
  'calendar-density-desktop',
  'timetable-weekday-presets',
] as const;

export interface K100PlannerRow {
  feature: (typeof K100_PLANNER_FEATURES)[number];
  dataHook?: string;
}

export function auditPlannerFeatures(): K100PlannerRow[] {
  return [
    { feature: 'agenda-on-view', dataHook: 'data-planner-unified-agenda' },
    { feature: 'event-duplicate', dataHook: 'data-schedule-event-duplicate' },
    { feature: 'event-quick-edit', dataHook: 'data-schedule-event-edit' },
    { feature: 'event-keyboard-shortcuts', dataHook: 'data-schedule-event-detail' },
    { feature: 'calendar-density-desktop', dataHook: 'data-planner-calendar-month' },
    { feature: 'timetable-weekday-presets', dataHook: 'data-timetable-weekday-presets' },
  ];
}

export function formatK100PlannerReport(rows: readonly K100PlannerRow[]): string {
  const lines = ['K-100 planner audit', ''];
  for (const row of rows) {
    lines.push(`  ${row.feature}${row.dataHook ? `: ${row.dataHook}` : ''}`);
  }
  return lines.join('\n');
}
