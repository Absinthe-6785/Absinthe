/** K-108 — Planner information architecture audit. */
export const K108_PLANNER_IA_SECTIONS = [
  'today-heading',
  'todays-note',
  'today-schedule',
  'routine-today',
  'weekly-timetable',
  'month-calendar',
] as const;

export function auditPlannerIa(): readonly string[] {
  return K108_PLANNER_IA_SECTIONS;
}

export function auditPlannerIaHooks(): readonly string[] {
  return [
    'data-k108-planner-layout',
    'data-k108-planner-today',
    'data-k108-planner-routine-today',
    'data-k108-planner-month-lazy',
    'data-k117-timetable-section',
  ];
}
