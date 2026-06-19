/** K-108A — Timeline Lens collapse simplification audit. */
export const K108A_TIMELINE_SECTION_HOOK = 'data-k108-timeline-section' as const;

export const K108A_TIMELINE_ROW_HOOKS = [
  'data-k108-timeline-today',
  'data-k108-timeline-yesterday',
  'data-k108-timeline-month',
  'data-k108-timeline-week',
  'data-k108-timeline-quarter',
  'data-k108-timeline-year',
  'data-k108-timeline-custom',
] as const;

/** Removed in K-108A — THIS WEEK sub-collapse. */
export const K108A_TIMELINE_REMOVED_HOOKS = [
  'data-k101-week-section-toggle',
] as const;

export function auditTimeLens(): readonly string[] {
  return [K108A_TIMELINE_SECTION_HOOK, ...K108A_TIMELINE_ROW_HOOKS];
}

export function formatK108aTimeLensReport(hooks: readonly string[]): string {
  return [
    'K-108A timeline lens audit',
    '',
    'Section collapse only (no THIS WEEK sub-collapse):',
    ...hooks.map(h => `  ${h}`),
    '',
    'Removed:',
    ...K108A_TIMELINE_REMOVED_HOOKS.map(h => `  ${h}`),
  ].join('\n');
}
