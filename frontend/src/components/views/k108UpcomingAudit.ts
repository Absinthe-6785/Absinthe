/** K-108 — Upcoming tier grouping audit. */
export const K108_UPCOMING_TIERS = ['today', 'tomorrow', 'later'] as const;

export function auditUpcomingTiers(): readonly string[] {
  return K108_UPCOMING_TIERS;
}

export function auditUpcomingHooks(): readonly string[] {
  return [
    'data-k108-planner-upcoming-tier',
    'data-k108-upcoming-tier',
    'data-planner-upcoming-date',
  ];
}

export function auditUpcomingRelativeLabels(): readonly string[] {
  return ['nvToday', 'k101Tomorrow', 'k108InDays'];
}
