import type { NoteBase } from '../../noteUtils';
import type { NoteFolder } from '../../../../store/useNotesStore';
import type { Schedule, Todo, Routine, Workout, WeeklySchedule, ExerciseBlock } from '../../../../types';
import type { Recipe } from '../recipe/recipeTypes';
import type { Language } from '../../../../lib/i18n';
import type { KnowledgeIndexService } from '../knowledge/KnowledgeIndexService';
import type { DiscoveryFeed } from '../knowledge/discovery';
import {
  buildWorkspaceSearch,
  type WorkspaceSearchFilter,
  type WorkspaceSearchResult,
} from '../knowledge/workspace/buildWorkspaceSearch';
import type { SearchRecentEntry } from './searchRecentStorage';
import {
  type SearchProjection,
  type SearchResultItem,
  type SearchDomain,
  SEARCH_DOMAIN_ORDER,
  SEARCH_DOMAIN_LABEL_KEYS,
  SEARCH_PROJECTION_SLICES,
} from './searchProjectionModels';
import {
  buildPlannerSearchResults,
  buildHealthSearchResults,
  buildRecipeSearchResults,
  buildArchiveSearchResults,
} from './buildSearchDomainResults';
import { buildHighlightsForResults } from './searchHighlight';
import { buildSearchRecentGroups } from './searchRecentStorage';

export interface SearchProjectionInput {
  query: string;
  filter?: WorkspaceSearchFilter;
  notes: readonly NoteBase[];
  folders: readonly NoteFolder[];
  schedules: readonly Schedule[];
  todos: readonly Todo[];
  routines: readonly Routine[];
  workouts: readonly Workout[];
  healthBlocks: readonly ExerciseBlock[];
  weeklySchedules: readonly WeeklySchedule[];
  recipes: readonly Recipe[];
  recentSearches: readonly SearchRecentEntry[];
  now: Date;
  service?: KnowledgeIndexService;
  discoveryFeed?: DiscoveryFeed;
  language?: Language;
}

function mapWorkspaceResult(r: WorkspaceSearchResult): SearchResultItem {
  return {
    id: `notes-${r.kind}-${r.id}`,
    domain: 'notes',
    kind: r.kind,
    title: r.title,
    subtitle: r.subtitle,
    categoryLabel: r.areaLabel ?? r.galaxyLabel ?? r.kind,
    score: r.score,
    noteId: r.noteId,
    folderId: r.folderId,
    tag: r.tag,
    collectionId: r.collectionId,
    pathId: r.pathId,
    importanceClass: r.importanceClass,
    tierHint: r.tierHint,
    actionsAvailable: r.actionsAvailable,
    discoveryOpportunity: r.discoveryOpportunity,
    weakConnectivity: r.weakConnectivity,
  };
}

function groupByDomain(results: readonly SearchResultItem[]): SearchProjection['groupedResults'] {
  return SEARCH_DOMAIN_ORDER.map(domain => {
    const domainResults = results.filter(r => r.domain === domain);
    return {
      domain,
      labelKey: SEARCH_DOMAIN_LABEL_KEYS[domain],
      results: domainResults,
      count: domainResults.length,
    };
  }).filter(g => g.count > 0);
}

function buildCounts(results: readonly SearchResultItem[]): SearchProjection['counts'] {
  const count = (d: SearchDomain) => results.filter(r => r.domain === d).length;
  return {
    notes: count('notes'),
    planner: count('planner'),
    health: count('health'),
    recipe: count('recipe'),
    archive: count('archive'),
    total: results.length,
  };
}

/**
 * K-111 — single-pass Search projection for cross-domain workspace cohesion.
 */
export function buildSearchProjection(input: SearchProjectionInput): SearchProjection {
  const { query, notes, folders, now, recentSearches } = input;
  const trimmed = query.trim();

  const noteGroups = trimmed
    ? buildWorkspaceSearch(trimmed, notes, folders, {
      filter: input.filter ?? 'all',
      service: input.service,
      discoveryFeed: input.discoveryFeed,
      language: input.language,
    })
    : [];

  const noteResults = noteGroups.flatMap(g => g.results.map(mapWorkspaceResult));

  const plannerResults = trimmed
    ? buildPlannerSearchResults(trimmed, input.schedules, input.todos, input.routines, input.weeklySchedules, now)
    : [];

  const healthResults = trimmed
    ? buildHealthSearchResults(trimmed, input.workouts, input.healthBlocks, now)
    : [];

  const recipeResults = trimmed
    ? buildRecipeSearchResults(trimmed, input.recipes, now)
    : [];

  const archiveResults = trimmed
    ? buildArchiveSearchResults(trimmed, notes, now)
    : [];

  const results = [...noteResults, ...plannerResults, ...healthResults, ...recipeResults, ...archiveResults];
  const groupedResults = groupByDomain(results);
  const counts = buildCounts(results);
  const highlights = buildHighlightsForResults(results, trimmed);
  const recentSearchesGrouped = buildSearchRecentGroups(recentSearches, now);

  const empty = {
    noQuery: !trimmed,
    noResults: trimmed.length > 0 && results.length === 0,
    noRecent: recentSearchesGrouped.today.length + recentSearchesGrouped.earlier.length === 0,
  };

  return {
    query: trimmed,
    results,
    groupedResults,
    counts,
    highlights,
    recentSearches: recentSearchesGrouped,
    empty,
    generatedAt: now.toISOString(),
  };
}

export { SEARCH_PROJECTION_SLICES };
