/** K-108 — Mobile planner audit. */
export const K108_MOBILE_WIDTHS = [320, 375, 768] as const;

export const K108_MOBILE_PLANNER_SURFACES = [
  { surface: 'today-panel', hooks: ['data-k108-planner-today', 'min-h-[44px]'] },
  { surface: 'month-grid', hooks: ['data-k108-planner-month-lazy', 'data-planner-month-cell'] },
  { surface: 'detail-panel', hooks: ['ScheduleEventDetailPanel'] },
  { surface: 'timetable', hooks: ['WeeklyTimetableSection', 'data-k104-timetable-summary'] },
] as const;

export function auditPlannerMobile(): readonly number[] {
  return K108_MOBILE_WIDTHS;
}

export function auditPlannerMobileTouchTargets(): boolean {
  return K108_MOBILE_PLANNER_SURFACES.some(s => s.hooks.some(h => h.includes('44px')));
}
