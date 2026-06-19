/** K-113 — Open-in-domain navigation audit. */
export const K113_NAVIGATION_ACTIONS = [
  { source: 'search', domain: 'notes', labelKey: 'cosmosPreviewOpenNote', handler: 'searchNavigation' },
  { source: 'search', domain: 'planner', labelKey: 'k113OpenPlannerEvent', handler: 'searchDomainNavigation' },
  { source: 'search', domain: 'health', labelKey: 'k113OpenWorkoutNote', handler: 'searchDomainNavigation' },
  { source: 'search', domain: 'recipe', labelKey: 'k113OpenRecipe', handler: 'searchDomainNavigation' },
  { source: 'search', domain: 'archive', labelKey: 'k113OpenArchiveItem', handler: 'searchNavigation+switchToTab' },
  { source: 'archive', domain: 'notes', labelKey: 'k113OpenInNotes', handler: 'openNote' },
  { source: 'planner', domain: 'notes', labelKey: 'k113OpenRelatedNote', handler: 'crossDomainReferences' },
  { source: 'recipe', domain: 'notes', labelKey: 'k113OpenCookingNote', handler: 'crossDomainReferences' },
  { source: 'health', domain: 'notes', labelKey: 'k113OpenWorkoutNote', handler: 'openHealthDayNote' },
] as const;

export function auditNavigation(): readonly string[] {
  return K113_NAVIGATION_ACTIONS.map(a => `${a.source}:${a.domain}:${a.labelKey}`);
}
