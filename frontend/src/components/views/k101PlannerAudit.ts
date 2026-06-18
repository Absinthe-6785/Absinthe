/**
 * K-101 — Planner completion audit.
 */
export const K101_PLANNER_FEATURES = [
  'event-category-color',
  'event-hover-selection',
  'upcoming-edit-duplicate-delete',
  'upcoming-jump-to-day',
  'timetable-weekday-grouping',
  'timetable-duplicate-day-indicator',
  'timetable-mobile-spacing',
] as const;

export interface K101PlannerRow {
  feature: (typeof K101_PLANNER_FEATURES)[number];
  dataHook?: string;
}

export function auditPlannerFeatures(): K101PlannerRow[] {
  return [
    { feature: 'event-category-color', dataHook: 'data-planner-month-block-category' },
    { feature: 'event-hover-selection', dataHook: 'data-planner-month-event' },
    { feature: 'upcoming-edit-duplicate-delete', dataHook: 'data-planner-upcoming-item' },
    { feature: 'upcoming-jump-to-day', dataHook: 'data-planner-agenda-jump-day' },
    { feature: 'timetable-weekday-grouping', dataHook: 'data-planner-weekly-weekday-header' },
    { feature: 'timetable-duplicate-day-indicator', dataHook: 'data-planner-weekly-block-duplicated' },
    { feature: 'timetable-mobile-spacing', dataHook: 'data-planner-weekly-timetable-mobile' },
  ];
}

export function formatK101PlannerReport(rows: readonly K101PlannerRow[]): string {
  const lines = ['K-101 planner audit', ''];
  for (const row of rows) {
    lines.push(`  ${row.feature}${row.dataHook ? `: ${row.dataHook}` : ''}`);
  }
  return lines.join('\n');
}
