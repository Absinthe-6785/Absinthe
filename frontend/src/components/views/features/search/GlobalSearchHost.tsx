import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useNotesStore } from '../../../../store/useNotesStore';
import { buildNoteChrome } from '../../noteEditorTheme';
import type { AppSettings, Schedule, Todo, Routine, Workout, WeeklySchedule, ExerciseBlock } from '../../../../types';
import { API_URL } from '../../../../lib/config';
import { accountBoundRemoteFetcher, accountBoundRemoteKey } from '../../../../lib/accountBoundRemote';
import type { Recipe } from '../recipe/recipeTypes';
import { registerWorkspaceSearchOpener } from '../../../../lib/noteNavigation';
import { resolveAppLanguage } from '../../../../lib/i18n';
import { knowledgeIndexService } from '../knowledge/KnowledgeIndexService';
import { buildDiscoveryFeed } from '../knowledge/discovery';
import { readWorkspaceSearchState, writeWorkspaceSearchState } from '../../k101WorkspaceSearchState';
import { useSearchProjection } from './hooks/useSearchProjection';
import { SearchWorkspacePalette } from './components/SearchWorkspacePalette';
import { loadSearchRecent } from './searchRecentStorage';
import { resolveSearchDatasetState, type SearchDatasetState } from '../../../../lib/searchReadiness';
import type { SearchActivation, SearchHostLifetime } from './searchWorkoutCompositeConfig';
import type { WorkoutRangePreviewRead } from '../health/useHealthWorkoutRangeSnapshot';
import type { SearchWorkoutPreviewEvidence } from './searchWorkoutCompositeProjection';

export interface GlobalSearchHostProps {
  accountId?: string;
  appSettings: AppSettings;
  schedules: readonly Schedule[];
  todos: readonly Todo[];
  todosState?: SearchDatasetState;
  routines: readonly Routine[];
  workouts: readonly Workout[];
  healthBlocks: readonly ExerciseBlock[];
  healthBlocksState?: SearchDatasetState;
  weeklySchedules: readonly WeeklySchedule[];
  onSearchHasQueryChange?: (hasQuery: boolean) => void;
  searchHostLifetime?: SearchHostLifetime;
  onSearchActivationChange?: (activation: SearchActivation) => void;
  workoutPreviewRead?: WorkoutRangePreviewRead;
  onOpenWorkoutPreview?: (evidence: SearchWorkoutPreviewEvidence) => boolean;
  onRetryWorkoutPreview?: () => void;
}

/** K-111 — App-level cross-domain search host. */
export function GlobalSearchHost({
  accountId,
  appSettings,
  onSearchHasQueryChange,
  schedules,
  todos,
  todosState,
  routines,
  workouts,
  healthBlocks,
  healthBlocksState,
  weeklySchedules,
  searchHostLifetime,
  onSearchActivationChange,
  workoutPreviewRead,
  onOpenWorkoutPreview,
  onRetryWorkoutPreview,
}: GlobalSearchHostProps) {
  const notes = useNotesStore(s => s.notes);
  const folders = useNotesStore(s => s.folders);
  const [open, setOpen] = useState(false);
  const persisted = useMemo(() => readWorkspaceSearchState(), []);
  const [query, setQuery] = useState(persisted.query);
  const [recentRevision, setRecentRevision] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [activation, setActivation] = useState<SearchActivation | null>(null);
  const reportPresence = useCallback((nextOpen: boolean, hasQuery: boolean) => {
    const host = searchHostLifetime;
    if (!host?.mounted) return;
    const previous = host.current;
    if (previous?.open === nextOpen && previous.hasQuery === hasQuery) return;
    const next = { host, generation: (previous?.generation ?? 0) + 1, open: nextOpen, hasQuery };
    // Revocation is synchronous, before React renders or any source scheduling.
    host.current = next;
    setActivation(next);
    onSearchActivationChange?.(next);
  }, [searchHostLifetime, onSearchActivationChange]);

  const {
    data: recipeData,
    error: recipeError,
    isLoading: recipeLoading,
    isValidating: recipeValidating,
  } = useSWR<Recipe[]>(
    accountBoundRemoteKey(`${API_URL}/api/recipes`, accountId, 'recipes', open),
    accountBoundRemoteFetcher,
    { revalidateOnFocus: false },
  );
  const recipeState = resolveSearchDatasetState({
    enabled: open,
    data: recipeData,
    error: recipeError,
    isLoading: recipeLoading,
    isValidating: recipeValidating,
  });

  useEffect(() => {
    if (searchHostLifetime) searchHostLifetime.mounted = true;
    reportPresence(false, false);
    const unregister = registerWorkspaceSearchOpener(() => {
      if (searchHostLifetime && !searchHostLifetime.mounted) return;
      const saved = readWorkspaceSearchState();
      reportPresence(true, Boolean(saved.query.trim()));
      setQuery(saved.query);
      setOpen(true);
    });
    return () => {
      unregister();
      if (searchHostLifetime) {
        reportPresence(false, false);
        searchHostLifetime.mounted = false;
        searchHostLifetime.current = null;
      }
    };
  }, [searchHostLifetime, reportPresence]);

  useEffect(() => {
    onSearchHasQueryChange?.(open && Boolean(query.trim()));
  }, [onSearchHasQueryChange, open, query]);

  useEffect(() => {
    if (!open) return;
    const saved = readWorkspaceSearchState();
    setQuery(saved.query);
    onSearchHasQueryChange?.(Boolean(saved.query.trim()));
    setRecentRevision(r => r + 1);
  }, [onSearchHasQueryChange, open]);

  useEffect(() => {
    if (!open) return;
    writeWorkspaceSearchState({ query, filter: 'all' });
  }, [open, query]);

  useEffect(() => {
    if (!query.trim()) {
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = window.setTimeout(() => setIsSearching(false), 80);
    return () => window.clearTimeout(timer);
  }, [query]);

  const discoveryFeed = useMemo(
    () => buildDiscoveryFeed(notes, knowledgeIndexService),
    [notes],
  );

  const recentSearches = useMemo(
    () => loadSearchRecent(accountId),
    [accountId, open, recentRevision],
  );

  const projection = useSearchProjection({
    query,
    filter: 'all',
    notes,
    folders,
    schedules,
    todos,
    todosState,
    routines,
    workouts,
    workoutPreviewRead: open && Boolean(query.trim()) && activation
      && searchHostLifetime?.current === activation
      && workoutPreviewRead?.scope.lifetime === activation ? workoutPreviewRead : undefined,
    healthBlocks,
    healthBlocksState,
    weeklySchedules,
    recipes: recipeData ?? [],
    recipeState,
    recentSearches,
    service: knowledgeIndexService,
    discoveryFeed,
    language: resolveAppLanguage(appSettings.language),
    revision: recentRevision,
  });

  const colors = useMemo(() => buildNoteChrome(appSettings.darkMode, appSettings), [appSettings]);

  const bumpRecent = useCallback(() => setRecentRevision(r => r + 1), []);

  const handleClose = useCallback(() => {
    if (searchHostLifetime && (!searchHostLifetime.mounted || searchHostLifetime.current !== activation)) return;
    reportPresence(false, false);
    setOpen(false);
    setQuery('');
  }, [activation, reportPresence, searchHostLifetime]);
  const handleQueryChange = useCallback((nextQuery: string) => {
    if (searchHostLifetime && (!searchHostLifetime.mounted || searchHostLifetime.current !== activation)) return;
    reportPresence(open, Boolean(nextQuery.trim()));
    setQuery(nextQuery);
  }, [activation, open, reportPresence, searchHostLifetime]);
  const handleOpenWorkoutPreview = useCallback((evidence: SearchWorkoutPreviewEvidence) => {
    if (!open || !activation || !activation.hasQuery || searchHostLifetime?.current !== activation
      || evidence.read.scope.lifetime !== activation) return false;
    return onOpenWorkoutPreview?.(evidence) ?? false;
  }, [activation, onOpenWorkoutPreview, open, searchHostLifetime]);
  const handleRetryWorkoutPreview = useCallback(() => {
    if (open && activation?.hasQuery && searchHostLifetime?.current === activation) onRetryWorkoutPreview?.();
  }, [activation, onRetryWorkoutPreview, open, searchHostLifetime]);

  return (
    <SearchWorkspacePalette
      accountId={accountId}
      colors={colors}
      projection={projection}
      open={open}
      query={query}
      onQueryChange={handleQueryChange}
      onClose={handleClose}
      onRecentRevision={bumpRecent}
      isSearching={isSearching}
      onOpenWorkoutPreview={handleOpenWorkoutPreview}
      onRetryWorkoutPreview={handleRetryWorkoutPreview}
    />
  );
}
