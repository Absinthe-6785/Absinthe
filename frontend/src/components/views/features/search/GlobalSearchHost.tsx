import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useNotesStore } from '../../../../store/useNotesStore';
import { buildNoteChrome } from '../../noteEditorTheme';
import type { AppSettings, Schedule, Todo, Routine, Workout, WeeklySchedule, ExerciseBlock } from '../../../../types';
import { fetcher } from '../../../../lib/fetcher';
import { API_URL } from '../../../../lib/config';
import type { Recipe } from '../recipe/recipeTypes';
import { registerWorkspaceSearchOpener } from '../../../../lib/noteNavigation';
import { resolveAppLanguage } from '../../../../lib/i18n';
import { knowledgeIndexService } from '../knowledge/KnowledgeIndexService';
import { buildDiscoveryFeed } from '../knowledge/discovery';
import { readWorkspaceSearchState, writeWorkspaceSearchState } from '../../k101WorkspaceSearchState';
import { useSearchProjection } from './hooks/useSearchProjection';
import { SearchWorkspacePalette } from './components/SearchWorkspacePalette';
import { loadSearchRecent } from './searchRecentStorage';

export interface GlobalSearchHostProps {
  appSettings: AppSettings;
  schedules: readonly Schedule[];
  todos: readonly Todo[];
  routines: readonly Routine[];
  workouts: readonly Workout[];
  healthBlocks: readonly ExerciseBlock[];
  weeklySchedules: readonly WeeklySchedule[];
}

/** K-111 — App-level cross-domain search host. */
export function GlobalSearchHost({
  appSettings,
  schedules,
  todos,
  routines,
  workouts,
  healthBlocks,
  weeklySchedules,
}: GlobalSearchHostProps) {
  const notes = useNotesStore(s => s.notes);
  const folders = useNotesStore(s => s.folders);
  const [open, setOpen] = useState(false);
  const persisted = useMemo(() => readWorkspaceSearchState(), []);
  const [query, setQuery] = useState(persisted.query);
  const [recentRevision, setRecentRevision] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  const { data: recipes = [] } = useSWR<Recipe[]>(
    open ? `${API_URL}/api/recipes` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    return registerWorkspaceSearchOpener(() => setOpen(true));
  }, []);

  useEffect(() => {
    if (!open) return;
    const saved = readWorkspaceSearchState();
    setQuery(saved.query);
    setRecentRevision(r => r + 1);
  }, [open]);

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
    () => loadSearchRecent(),
    [open, recentRevision],
  );

  const projection = useSearchProjection({
    query,
    filter: 'all',
    notes,
    folders,
    schedules,
    todos,
    routines,
    workouts,
    healthBlocks,
    weeklySchedules,
    recipes,
    recentSearches,
    service: knowledgeIndexService,
    discoveryFeed,
    language: resolveAppLanguage(appSettings.language),
    revision: recentRevision,
  });

  const colors = useMemo(() => buildNoteChrome(appSettings.darkMode, appSettings), [appSettings]);

  const bumpRecent = useCallback(() => setRecentRevision(r => r + 1), []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  return (
    <SearchWorkspacePalette
      colors={colors}
      projection={projection}
      open={open}
      query={query}
      onQueryChange={setQuery}
      onClose={handleClose}
      onRecentRevision={bumpRecent}
      isSearching={isSearching}
    />
  );
}
