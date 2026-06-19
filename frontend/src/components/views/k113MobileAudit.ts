/** K-113 — Mobile cohesion audit. */
export const K113_MOBILE_WIDTHS = [320, 375, 768] as const;

export const K113_MOBILE_CROSS_LINK_HOOKS = [
  'data-k113-open-related-note',
  'data-k113-open-cooking-note',
  'data-k113-open-workout-note',
  'data-k113-recent-activity-row',
] as const;

export function auditMobile(): readonly string[] {
  return [
    ...K113_MOBILE_WIDTHS.map(String),
    ...K113_MOBILE_CROSS_LINK_HOOKS,
    'min-h-[44px]',
    'min-w-[44px]',
  ];
}
