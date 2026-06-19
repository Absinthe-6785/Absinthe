/** K-108 — Month calendar interaction audit. */
export const K108_CALENDAR_FLOW = [
  'month-cell-click-selects-date',
  'schedule-list-via-today-timeline',
  'detail-panel-edit-delete-duplicate',
  'agenda-item-action-menu',
] as const;

export function auditCalendarInteractionFlow(): readonly string[] {
  return K108_CALENDAR_FLOW;
}

export function auditCalendarEmptyHover(): readonly string[] {
  return [
    'data-k108-month-cell-empty',
    'hover:ring-primary/25',
    'aria-label-add-schedule',
  ];
}
