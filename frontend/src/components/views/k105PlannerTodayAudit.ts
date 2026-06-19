/** K-105 — Planner Today column audit. */
export const K105_PLANNER_TODAY_SECTIONS = [
  'today-heading',
  'todays-note',
  'recent-activity',
  'today-schedule',
  'upcoming',
] as const;

export function auditPlannerToday(): readonly string[] {
  return K105_PLANNER_TODAY_SECTIONS;
}

export function formatK105PlannerTodayReport(sections: readonly string[]): string {
  return [
    'K-105 planner today audit',
    '',
    ...sections.map(s => `  ${s}`),
  ].join('\n');
}
