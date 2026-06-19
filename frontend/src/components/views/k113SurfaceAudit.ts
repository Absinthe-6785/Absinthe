/** K-113 — Surface consistency audit (icons, badges, spacing). */
export const K113_SURFACE_ROW_HOOKS = [
  'data-k113-recent-activity-row',
  'data-k109-history-row',
  'data-k111-search-card',
] as const;

export const K113_TOUCH_TARGET_HOOKS = [
  'data-k113-open-related-note',
  'data-k113-open-cooking-note',
  'data-k113-open-workout-note',
  'data-k113-open-in-notes',
] as const;

export const K113_SECTION_TITLE_KEYS = [
  'k113CrossDomainActivity',
  'k109SectionHistory',
] as const;

export function auditSurfaces(): readonly string[] {
  return [
    ...K113_SURFACE_ROW_HOOKS,
    ...K113_TOUCH_TARGET_HOOKS,
    ...K113_SECTION_TITLE_KEYS,
    'min-h-[44px]',
  ];
}
