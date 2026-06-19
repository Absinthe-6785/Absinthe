import type { WorkspaceSearchResultKind } from '../knowledge/workspace/buildWorkspaceSearch';

/** K-111 cross-domain search domains. */
export type SearchDomain = 'notes' | 'planner' | 'health' | 'recipe' | 'archive';

export const SEARCH_DOMAIN_ORDER: readonly SearchDomain[] = [
  'notes',
  'planner',
  'health',
  'recipe',
  'archive',
] as const;

export interface SearchHighlight {
  /** Character ranges in title to emphasize (query match). */
  titleRanges: readonly { start: number; end: number }[];
  snippet?: string;
}

export interface SearchResultItem {
  id: string;
  domain: SearchDomain;
  kind: WorkspaceSearchResultKind | PlannerSearchKind | HealthSearchKind | RecipeSearchKind | ArchiveSearchKind;
  title: string;
  subtitle?: string;
  categoryLabel?: string;
  relativeDate?: string;
  timestamp?: number;
  score: number;
  noteId?: string;
  folderId?: string;
  tag?: string;
  collectionId?: string;
  pathId?: string;
  plannerItemId?: string;
  recipeId?: string;
  importanceClass?: string;
  tierHint?: string;
  actionsAvailable?: boolean;
  discoveryOpportunity?: boolean;
  weakConnectivity?: boolean;
}

export type PlannerSearchKind = 'schedule' | 'todo' | 'routine' | 'weekly-schedule';
export type HealthSearchKind = 'workout' | 'exercise-block';
export type RecipeSearchKind = 'recipe';
export type ArchiveSearchKind = 'deleted-note' | 'archived-note';

export interface SearchDomainGroup {
  domain: SearchDomain;
  labelKey: string;
  results: SearchResultItem[];
  count: number;
}

export interface SearchRecentItem {
  kind: WorkspaceSearchResultKind | PlannerSearchKind | HealthSearchKind | RecipeSearchKind | ArchiveSearchKind;
  domain: SearchDomain;
  id: string;
  title: string;
  accessedAt: number;
  relativeLabel: string;
}

export interface SearchRecentGroups {
  today: SearchRecentItem[];
  earlier: SearchRecentItem[];
}

export interface SearchCounts {
  notes: number;
  planner: number;
  health: number;
  recipe: number;
  archive: number;
  total: number;
}

export interface SearchEmptyFlags {
  noQuery: boolean;
  noResults: boolean;
  noRecent: boolean;
}

export interface SearchProjection {
  query: string;
  results: SearchResultItem[];
  groupedResults: SearchDomainGroup[];
  counts: SearchCounts;
  highlights: ReadonlyMap<string, SearchHighlight>;
  recentSearches: SearchRecentGroups;
  empty: SearchEmptyFlags;
  generatedAt: string;
}

export const SEARCH_PROJECTION_SLICES = [
  'query',
  'results',
  'groupedResults',
  'counts',
  'highlights',
  'recentSearches',
] as const;

export type SearchProjectionSlice = (typeof SEARCH_PROJECTION_SLICES)[number];

export const SEARCH_DOMAIN_LABEL_KEYS: Record<SearchDomain, string> = {
  notes: 'k111DomainNotes',
  planner: 'k111DomainPlanner',
  health: 'k111DomainHealth',
  recipe: 'k111DomainRecipe',
  archive: 'k111DomainArchive',
};
