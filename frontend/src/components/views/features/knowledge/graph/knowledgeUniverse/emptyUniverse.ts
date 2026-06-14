export interface EmptyUniverseInput {
  nodeCount: number;
  linkCount: number;
  hasSearchFilter: boolean;
  searchHasMatches: boolean;
}

/** Intentional empty state — not a broken graph. */
export function shouldShowEmptyUniverse(input: EmptyUniverseInput): boolean {
  if (input.hasSearchFilter && !input.searchHasMatches) return false;
  if (input.nodeCount === 0) return true;
  return input.linkCount === 0;
}

export const EMPTY_UNIVERSE_HEADLINE = 'Your knowledge universe will appear here.';
export const EMPTY_UNIVERSE_SUBLINE = 'Create notes and connect ideas to grow constellations.';
