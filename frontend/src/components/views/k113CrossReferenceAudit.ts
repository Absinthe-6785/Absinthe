/** K-113 — Cross-domain reference surfaces audit. */
export const K113_CROSS_REFERENCE_SURFACES = [
  { domain: 'health', hook: 'data-k113-cross-ref="health"', action: 'data-k113-open-workout-note' },
  { domain: 'archive', hook: 'data-k113-open-in-notes', action: 'openNote' },
] as const;

export function auditCrossReferences(): readonly string[] {
  return K113_CROSS_REFERENCE_SURFACES.flatMap(s => [s.hook, s.action]);
}
