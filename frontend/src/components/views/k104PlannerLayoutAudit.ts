/** K-104 / K-105 — Planner desktop layout audit. */
export const K104_PLANNER_RIGHT_SECTIONS = [
  'planner-today',
  'todays-note',
  'recent-activity',
  'today-schedule',
  'upcoming-agenda',
] as const;

export function auditPlannerLayout(): string[] {
  return [...K104_PLANNER_RIGHT_SECTIONS];
}

export function formatK104PlannerLayoutReport(sections: readonly string[]): string {
  return ['K-104 planner layout audit', '', ...sections.map(s => `  ${s}`)].join('\n');
}
