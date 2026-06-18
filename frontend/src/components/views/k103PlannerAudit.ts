/**
 * K-103 — Planner workflow audit.
 */
export const K103_PLANNER_FEATURES = [
  { feature: 'month-chip-spacing', dataHook: 'data-planner-month-block' },
  { feature: 'selected-day-contrast', dataHook: 'data-planner-month-cell' },
  { feature: 'detail-actions', dataHook: 'data-k103-schedule-detail-actions' },
  { feature: 'delete-confirm', dataHook: 'data-k103-schedule-delete-confirm' },
  { feature: 'timetable-presets', dataHook: 'data-k103-timetable-presets' },
  { feature: 'upcoming-empty', dataHook: 'data-k103-planner-agenda-empty' },
] as const;

export interface K103PlannerRow {
  feature: string;
  dataHook: string;
}

export function auditPlannerWorkflow(): K103PlannerRow[] {
  return K103_PLANNER_FEATURES.map(f => ({ feature: f.feature, dataHook: f.dataHook }));
}

export function formatK103PlannerReport(rows: readonly K103PlannerRow[]): string {
  const lines = ['K-103 planner audit', ''];
  for (const row of rows) {
    lines.push(`  ${row.feature}: ${row.dataHook}`);
  }
  return lines.join('\n');
}
