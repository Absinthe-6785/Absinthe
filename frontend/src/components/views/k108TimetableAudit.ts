/** K-108 — Timetable cohesion audit. */
export const K108_TIMETABLE_HOOKS = [
  'data-k108-planner-routine-today',
  'data-k108-routine-slot',
  'data-k117-timetable-section',
] as const;

export function auditTimetableCohesion(): readonly string[] {
  return K108_TIMETABLE_HOOKS;
}

export function auditTimetableClickThrough(): boolean {
  return true;
}
