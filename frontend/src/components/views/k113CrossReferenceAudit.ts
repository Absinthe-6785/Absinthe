/** K-113 — Cross-domain reference surfaces audit. */
export const K113_CROSS_REFERENCE_SURFACES = [
  { domain: 'planner', hook: 'data-k113-cross-ref="planner"', action: 'data-k113-open-related-note' },
  { domain: 'recipe', hook: 'data-k113-cross-ref="recipe"', action: 'data-k113-open-cooking-note' },
  { domain: 'health', hook: 'data-k113-cross-ref="health"', action: 'data-k113-open-workout-note' },
  { domain: 'archive', hook: 'data-k113-open-in-notes', action: 'openNote' },
] as const;

export function auditCrossReferences(): readonly string[] {
  return K113_CROSS_REFERENCE_SURFACES.flatMap(s => [s.hook, s.action]);
}
