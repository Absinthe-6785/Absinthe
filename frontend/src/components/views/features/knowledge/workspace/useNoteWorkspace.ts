import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { NoteBase } from '../../../noteUtils';
import { knowledgeIndexService } from '../KnowledgeIndexService';
import { SMART_COLLECTIONS, findSmartCollection } from '../collections/smartCollections';
import type { SmartCollection } from '../collections/smartCollectionModels';
import { evaluateSmartCollection } from '../collections/evaluateSmartCollection';
import type { RuleCollection } from '../collections/ruleCollectionModels';
import {
  createRuleCollection,
  deleteRuleCollection,
  findRuleCollection,
  isValidRuleCollectionQuery,
  renameRuleCollection,
} from '../collections/ruleCollections';
import { evaluateRuleCollection } from '../collections/evaluateRuleCollection';
import { loadRuleCollections, saveRuleCollections } from '../collections/ruleCollectionsStorage';
import type { DatabaseView, DatabaseViewPresentation } from '../databaseViews/databaseViewModels';
import {
  createDatabaseView,
  deleteDatabaseView,
  findDatabaseView,
  isValidDatabaseViewQuery,
  renameDatabaseView,
} from '../databaseViews/databaseViews';
import { evaluateDatabaseView } from '../databaseViews/evaluateDatabaseView';
import { loadDatabaseViews, saveDatabaseViews } from '../databaseViews/databaseViewsStorage';
import { createDatabaseViewFromTemplate } from '../databaseViews/databaseTemplates';
import { updateDatabaseViewConfig } from '../databaseViews/databaseViewOperations';
import { buildFormulaQueryCatalog } from '../formulas/formulaQueryCatalog';
import type { SavedView } from '../views/savedViewModels';
import {
  createSavedView,
  deleteSavedView,
  findSavedView,
  isValidSavedViewQuery,
  renameSavedView,
} from '../views/savedViews';
import { loadSavedViews, saveSavedViews } from '../views/savedViewsStorage';
import { applyWorkspaceListFilter } from './resolveWorkspaceFilter';
import {
  activateDatabaseViewWorkspace,
  activateRuleCollectionWorkspace,
  activateSavedViewWorkspace,
  activateSmartCollectionWorkspace,
  clearWorkspaceActivation,
  clearWorkspaceActivationForItem,
  clearWorkspaceSearchBinding,
  isWorkspaceKindActive,
  reconcileSavedViewActivation,
} from './workspaceActivation';
import {
  INACTIVE_WORKSPACE,
  type WorkspaceActivation,
  type WorkspaceRef,
} from './workspaceModels';
import {
  loadWorkspaceSession,
  saveWorkspaceSession,
  workspaceSessionFromActivation,
} from './workspaceSessionStorage';
import {
  addPinnedWorkspace,
  clearRecentWork,
  isWorkspacePinned,
  pruneWorkspacePreferences,
  recordRecentWorkspace,
  removePinnedWorkspace,
  reorderPinnedWorkspaces,
  togglePinnedWorkspace,
  type RecentWorkEntry,
  type WorkspacePreferences,
} from './workspacePreferences';
import { loadWorkspacePreferences, saveWorkspacePreferences } from './workspacePreferencesStorage';
import {
  isValidWorkspaceRef,
  resolveWorkspaceRef,
  restoreWorkspaceActivation,
  workspaceRefFromActivation,
  type WorkspaceResolveContext,
} from './resolveWorkspaceRef';

export interface UseNoteWorkspaceOptions {
  notes: readonly NoteBase[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  resetBrowseScope: () => void;
}

export interface UseNoteWorkspaceResult {
  workspaceActivation: WorkspaceActivation;
  setWorkspaceActivation: Dispatch<SetStateAction<WorkspaceActivation>>;
  savedViews: readonly SavedView[];
  ruleCollections: readonly RuleCollection[];
  databaseViews: readonly DatabaseView[];
  activeSavedView: SavedView | undefined;
  activeSmartCollection: SmartCollection | undefined;
  activeRuleCollection: RuleCollection | undefined;
  activeDatabaseView: DatabaseView | undefined;
  isDatabaseViewMode: boolean;
  shouldSkipUserSort: boolean;
  smartCollectionCounts: Readonly<Record<string, number>>;
  ruleCollectionCounts: Readonly<Record<string, number>>;
  databaseViewCounts: Readonly<Record<string, number>>;
  activeDatabaseViewNoteCount: number;
  canSaveCurrentView: boolean;
  canCreateRuleCollection: boolean;
  canCreateDatabaseView: boolean;
  safeNotesForDatabase: readonly NoteBase[];
  applyWorkspaceToNotes: (notes: readonly NoteBase[]) => NoteBase[];
  isWorkspaceKindActive: typeof isWorkspaceKindActive;
  handleActivateSavedView: (view: SavedView) => void;
  handleClearSavedView: () => void;
  handleActivateSmartCollection: (collection: SmartCollection) => void;
  handleClearSmartCollection: () => void;
  handleActivateRuleCollection: (collection: RuleCollection) => void;
  handleClearRuleCollection: () => void;
  handleActivateDatabaseView: (view: DatabaseView) => void;
  handleClearDatabaseView: () => void;
  handleCreateRuleCollection: (name: string, query: string) => void;
  handleRenameRuleCollection: (id: string, name: string) => void;
  handleDeleteRuleCollection: (id: string) => void;
  handleCreateDatabaseView: (
    name: string,
    query: string,
    presentation?: DatabaseViewPresentation,
    groupBy?: string,
    dateProperty?: string,
    startDateProperty?: string,
    endDateProperty?: string,
    coverProperty?: string,
    cardFields?: readonly string[],
  ) => void;
  handleCreateDatabaseViewFromTemplate: (templateId: string) => void;
  handleRenameDatabaseView: (id: string, name: string) => void;
  handleDeleteDatabaseView: (id: string) => void;
  handleCreateSavedView: (name: string) => void;
  handleRenameSavedView: (id: string, name: string) => void;
  handleDeleteSavedView: (id: string) => void;
  patchActiveDatabaseView: (updater: (view: DatabaseView) => DatabaseView) => void;
  clearWorkspace: () => void;
  preferences: WorkspacePreferences;
  pinnedWorkspaces: readonly WorkspaceRef[];
  recentWork: readonly RecentWorkEntry[];
  isWorkspacePinned: (kind: WorkspaceRef['kind'], id: string) => boolean;
  handleActivateWorkspaceRef: (ref: WorkspaceRef) => void;
  handleTogglePinWorkspace: (ref: WorkspaceRef) => void;
  handleUnpinWorkspace: (ref: WorkspaceRef) => void;
  handleMovePinnedWorkspace: (fromIndex: number, toIndex: number) => void;
  handleClearRecentWork: () => void;
}

export function useNoteWorkspace({
  notes,
  searchQuery,
  setSearchQuery,
  resetBrowseScope,
}: UseNoteWorkspaceOptions): UseNoteWorkspaceResult {
  const [savedViews, setSavedViews] = useState(() => loadSavedViews());
  const [ruleCollections, setRuleCollections] = useState(() => loadRuleCollections());
  const [databaseViews, setDatabaseViews] = useState(() => loadDatabaseViews());
  const [preferences, setPreferences] = useState(() => loadWorkspacePreferences());
  const [workspaceActivation, setWorkspaceActivation] = useState<WorkspaceActivation>(INACTIVE_WORKSPACE);
  const hasRestoredSession = useRef(false);

  const resolveContext = useMemo<WorkspaceResolveContext>(() => ({
    savedViews,
    ruleCollections,
    databaseViews,
  }), [savedViews, ruleCollections, databaseViews]);

  useEffect(() => {
    saveSavedViews(savedViews);
  }, [savedViews]);

  useEffect(() => {
    saveRuleCollections(ruleCollections);
  }, [ruleCollections]);

  useEffect(() => {
    saveDatabaseViews(databaseViews);
  }, [databaseViews]);

  useEffect(() => {
    saveWorkspacePreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    saveWorkspaceSession(workspaceSessionFromActivation(workspaceActivation));
  }, [workspaceActivation]);

  useEffect(() => {
    setPreferences(prev => pruneWorkspacePreferences(prev, (kind, id) =>
      isValidWorkspaceRef(kind, id, resolveContext)));
  }, [resolveContext]);

  useEffect(() => {
    if (hasRestoredSession.current) return;
    const session = loadWorkspaceSession();
    if (!session || session.activation.kind === 'none') {
      hasRestoredSession.current = true;
      return;
    }
    const restored = restoreWorkspaceActivation(session.activation, resolveContext);
    hasRestoredSession.current = true;
    if (!restored) return;
    resetBrowseScope();
    setWorkspaceActivation(restored.activation);
    setSearchQuery(restored.searchQuery);
  }, [resolveContext, resetBrowseScope, setSearchQuery]);

  useEffect(() => {
    setWorkspaceActivation(prev => reconcileSavedViewActivation(prev, savedViews, searchQuery));
  }, [searchQuery, savedViews]);

  const formulaQueryCatalog = useMemo(
    () => buildFormulaQueryCatalog(databaseViews),
    [databaseViews],
  );

  const canSaveCurrentView = useMemo(
    () => isValidSavedViewQuery(searchQuery),
    [searchQuery],
  );

  const canCreateRuleCollection = useMemo(
    () => isValidRuleCollectionQuery(searchQuery),
    [searchQuery],
  );

  const canCreateDatabaseView = useMemo(
    () => isValidDatabaseViewQuery(searchQuery),
    [searchQuery],
  );

  const activeRuleCollection = useMemo(
    () => (workspaceActivation.kind === 'rule-collection'
      ? findRuleCollection(ruleCollections, workspaceActivation.id)
      : undefined),
    [workspaceActivation, ruleCollections],
  );

  const activeDatabaseView = useMemo(
    () => (workspaceActivation.kind === 'database-view'
      ? findDatabaseView(databaseViews, workspaceActivation.id)
      : undefined),
    [workspaceActivation, databaseViews],
  );

  const activeSavedView = useMemo(
    () => (workspaceActivation.kind === 'saved-view'
      ? findSavedView(savedViews, workspaceActivation.id)
      : undefined),
    [workspaceActivation, savedViews],
  );

  const activeSmartCollection = useMemo(
    () => (workspaceActivation.kind === 'smart-collection'
      ? findSmartCollection(workspaceActivation.id)
      : undefined),
    [workspaceActivation],
  );

  const isDatabaseViewMode = workspaceActivation.kind === 'database-view';
  const shouldSkipUserSort = workspaceActivation.kind === 'smart-collection';

  const smartCollectionCounts = useMemo(() => {
    const safeNotes = Array.isArray(notes) ? notes : [];
    const counts: Record<string, number> = {};
    for (const collection of SMART_COLLECTIONS) {
      counts[collection.id] = evaluateSmartCollection(collection.id, knowledgeIndexService, safeNotes).length;
    }
    return counts;
  }, [notes]);

  const ruleCollectionCounts = useMemo(() => {
    const safeNotes = Array.isArray(notes) ? notes : [];
    const counts: Record<string, number> = {};
    for (const collection of ruleCollections) {
      counts[collection.id] = evaluateRuleCollection(
        collection,
        knowledgeIndexService,
        safeNotes,
        { formulaColumns: formulaQueryCatalog },
      ).length;
    }
    return counts;
  }, [notes, ruleCollections, formulaQueryCatalog]);

  const databaseViewCounts = useMemo(() => {
    const safeNotes = Array.isArray(notes) ? notes : [];
    const counts: Record<string, number> = {};
    for (const view of databaseViews) {
      counts[view.id] = evaluateDatabaseView(view, knowledgeIndexService, safeNotes).length;
    }
    return counts;
  }, [notes, databaseViews]);

  const activeDatabaseViewNoteCount = useMemo(() => {
    if (!activeDatabaseView) return 0;
    const safeNotes = Array.isArray(notes) ? notes : [];
    return evaluateDatabaseView(activeDatabaseView, knowledgeIndexService, safeNotes).length;
  }, [activeDatabaseView, notes]);

  const safeNotesForDatabase = useMemo(
    () => (Array.isArray(notes) ? notes : []).filter(n => !n.deletedAt),
    [notes],
  );

  const applyWorkspaceToNotes = useCallback((list: readonly NoteBase[]) => {
    const safeNotes = Array.isArray(notes) ? notes : [];
    return applyWorkspaceListFilter(list, workspaceActivation, {
      service: knowledgeIndexService,
      vaultNotes: safeNotes.filter(n => !n.deletedAt),
      ruleCollections,
      formulaColumns: formulaQueryCatalog,
    });
  }, [notes, workspaceActivation, ruleCollections, formulaQueryCatalog]);

  const applyActivationResult = useCallback((
    result: { activation: WorkspaceActivation; searchQuery: string },
    options: { recordRecent?: boolean } = { recordRecent: true },
  ) => {
    setWorkspaceActivation(result.activation);
    setSearchQuery(result.searchQuery);
    if (options.recordRecent !== false && result.activation.kind !== 'none') {
      const ref = workspaceRefFromActivation(result.activation, resolveContext);
      if (ref) {
        setPreferences(prev => recordRecentWorkspace(prev, ref));
      }
    }
  }, [setSearchQuery, resolveContext]);

  const handleActivateSavedView = useCallback((view: SavedView) => {
    resetBrowseScope();
    applyActivationResult(activateSavedViewWorkspace(view));
  }, [resetBrowseScope, applyActivationResult]);

  const handleClearSavedView = useCallback(() => {
    applyActivationResult(clearWorkspaceSearchBinding());
  }, [applyActivationResult]);

  const handleActivateSmartCollection = useCallback((collection: SmartCollection) => {
    resetBrowseScope();
    applyActivationResult(activateSmartCollectionWorkspace(collection));
  }, [resetBrowseScope, applyActivationResult]);

  const handleClearSmartCollection = useCallback(() => {
    setWorkspaceActivation(prev => (prev.kind === 'smart-collection' ? INACTIVE_WORKSPACE : prev));
  }, []);

  const handleActivateRuleCollection = useCallback((collection: RuleCollection) => {
    resetBrowseScope();
    applyActivationResult(activateRuleCollectionWorkspace(collection));
  }, [resetBrowseScope, applyActivationResult]);

  const handleClearRuleCollection = useCallback(() => {
    setWorkspaceActivation(prev => (prev.kind === 'rule-collection' ? INACTIVE_WORKSPACE : prev));
  }, []);

  const handleActivateDatabaseView = useCallback((view: DatabaseView) => {
    resetBrowseScope();
    applyActivationResult(activateDatabaseViewWorkspace(view));
  }, [resetBrowseScope, applyActivationResult]);

  const handleClearDatabaseView = useCallback(() => {
    setWorkspaceActivation(prev => (prev.kind === 'database-view' ? INACTIVE_WORKSPACE : prev));
  }, []);

  const handleCreateRuleCollection = useCallback((name: string, query: string) => {
    setRuleCollections(prev => createRuleCollection(prev, name, query));
  }, []);

  const handleRenameRuleCollection = useCallback((id: string, name: string) => {
    setRuleCollections(prev => renameRuleCollection(prev, id, name));
  }, []);

  const handleDeleteRuleCollection = useCallback((id: string) => {
    setRuleCollections(prev => deleteRuleCollection(prev, id));
    setWorkspaceActivation(prev => clearWorkspaceActivationForItem(prev, 'rule-collection', id));
  }, []);

  const handleCreateDatabaseView = useCallback((
    name: string,
    query: string,
    presentation?: DatabaseViewPresentation,
    groupBy?: string,
    dateProperty?: string,
    startDateProperty?: string,
    endDateProperty?: string,
    coverProperty?: string,
    cardFields?: readonly string[],
  ) => {
    setDatabaseViews(prev => createDatabaseView(prev, name, query, {
      presentation,
      groupBy,
      dateProperty,
      startDateProperty,
      endDateProperty,
      coverProperty,
      cardFields,
    }));
  }, []);

  const handleCreateDatabaseViewFromTemplate = useCallback((templateId: string) => {
    setDatabaseViews(prev => createDatabaseViewFromTemplate(prev, templateId));
  }, []);

  const handleRenameDatabaseView = useCallback((id: string, name: string) => {
    setDatabaseViews(prev => renameDatabaseView(prev, id, name));
  }, []);

  const handleDeleteDatabaseView = useCallback((id: string) => {
    setDatabaseViews(prev => deleteDatabaseView(prev, id));
    setWorkspaceActivation(prev => clearWorkspaceActivationForItem(prev, 'database-view', id));
  }, []);

  const handleCreateSavedView = useCallback((name: string) => {
    setSavedViews(prev => createSavedView(prev, name, searchQuery));
  }, [searchQuery]);

  const handleRenameSavedView = useCallback((id: string, name: string) => {
    setSavedViews(prev => renameSavedView(prev, id, name));
  }, []);

  const handleDeleteSavedView = useCallback((id: string) => {
    setSavedViews(prev => deleteSavedView(prev, id));
    setWorkspaceActivation(prev => clearWorkspaceActivationForItem(prev, 'saved-view', id));
  }, []);

  const patchActiveDatabaseView = useCallback((updater: (view: DatabaseView) => DatabaseView) => {
    if (workspaceActivation.kind !== 'database-view') return;
    setDatabaseViews(prev => updateDatabaseViewConfig(prev, workspaceActivation.id, updater));
  }, [workspaceActivation]);

  const clearWorkspace = useCallback(() => {
    applyActivationResult(clearWorkspaceActivation(), { recordRecent: false });
  }, [applyActivationResult]);

  const attachCount = useCallback((ref: WorkspaceRef): WorkspaceRef => {
    if (ref.kind === 'smart-collection') {
      return { ...ref, count: smartCollectionCounts[ref.id] ?? 0 };
    }
    if (ref.kind === 'rule-collection') {
      return { ...ref, count: ruleCollectionCounts[ref.id] ?? 0 };
    }
    if (ref.kind === 'database-view') {
      return { ...ref, count: databaseViewCounts[ref.id] ?? 0 };
    }
    return ref;
  }, [smartCollectionCounts, ruleCollectionCounts, databaseViewCounts]);

  const pinnedWorkspaces = useMemo(
    () => preferences.pinned
      .map(ref => resolveWorkspaceRef(ref, resolveContext))
      .filter((ref): ref is WorkspaceRef => ref !== null)
      .map(attachCount),
    [preferences.pinned, resolveContext, attachCount],
  );

  const recentWork = useMemo(
    () => preferences.recent
      .map(entry => {
        const resolved = resolveWorkspaceRef(entry.workspace, resolveContext);
        if (!resolved) return null;
        return {
          workspace: attachCount(resolved),
          lastOpenedAt: entry.lastOpenedAt,
        };
      })
      .filter((entry): entry is RecentWorkEntry => entry !== null),
    [preferences.recent, resolveContext, attachCount],
  );

  const checkPinned = useCallback(
    (kind: WorkspaceRef['kind'], id: string) => isWorkspacePinned(preferences, kind, id),
    [preferences],
  );

  const handleActivateWorkspaceRef = useCallback((ref: WorkspaceRef) => {
    const resolved = resolveWorkspaceRef(ref, resolveContext);
    if (!resolved) return;
    resetBrowseScope();
    if (resolved.kind === 'saved-view') {
      const view = findSavedView(savedViews, resolved.id);
      if (view) applyActivationResult(activateSavedViewWorkspace(view));
      return;
    }
    if (resolved.kind === 'rule-collection') {
      const collection = findRuleCollection(ruleCollections, resolved.id);
      if (collection) applyActivationResult(activateRuleCollectionWorkspace(collection));
      return;
    }
    if (resolved.kind === 'database-view') {
      const view = findDatabaseView(databaseViews, resolved.id);
      if (view) applyActivationResult(activateDatabaseViewWorkspace(view));
      return;
    }
    if (resolved.kind === 'smart-collection') {
      const collection = findSmartCollection(resolved.id);
      if (collection) applyActivationResult(activateSmartCollectionWorkspace(collection));
    }
  }, [
    resolveContext,
    resetBrowseScope,
    savedViews,
    ruleCollections,
    databaseViews,
    applyActivationResult,
  ]);

  const handleTogglePinWorkspace = useCallback((ref: WorkspaceRef) => {
    const resolved = resolveWorkspaceRef(ref, resolveContext);
    if (!resolved) return;
    setPreferences(prev => togglePinnedWorkspace(prev, resolved));
  }, [resolveContext]);

  const handleUnpinWorkspace = useCallback((ref: WorkspaceRef) => {
    setPreferences(prev => removePinnedWorkspace(prev, ref.kind, ref.id));
  }, []);

  const handleMovePinnedWorkspace = useCallback((fromIndex: number, toIndex: number) => {
    setPreferences(prev => reorderPinnedWorkspaces(prev, fromIndex, toIndex));
  }, []);

  const handleClearRecentWork = useCallback(() => {
    setPreferences(prev => clearRecentWork(prev));
  }, []);

  return {
    workspaceActivation,
    setWorkspaceActivation,
    savedViews,
    ruleCollections,
    databaseViews,
    activeSavedView,
    activeSmartCollection,
    activeRuleCollection,
    activeDatabaseView,
    isDatabaseViewMode,
    shouldSkipUserSort,
    smartCollectionCounts,
    ruleCollectionCounts,
    databaseViewCounts,
    activeDatabaseViewNoteCount,
    canSaveCurrentView,
    canCreateRuleCollection,
    canCreateDatabaseView,
    safeNotesForDatabase,
    applyWorkspaceToNotes,
    isWorkspaceKindActive,
    handleActivateSavedView,
    handleClearSavedView,
    handleActivateSmartCollection,
    handleClearSmartCollection,
    handleActivateRuleCollection,
    handleClearRuleCollection,
    handleActivateDatabaseView,
    handleClearDatabaseView,
    handleCreateRuleCollection,
    handleRenameRuleCollection,
    handleDeleteRuleCollection,
    handleCreateDatabaseView,
    handleCreateDatabaseViewFromTemplate,
    handleRenameDatabaseView,
    handleDeleteDatabaseView,
    handleCreateSavedView,
    handleRenameSavedView,
    handleDeleteSavedView,
    patchActiveDatabaseView,
    clearWorkspace,
    preferences,
    pinnedWorkspaces,
    recentWork,
    isWorkspacePinned: checkPinned,
    handleActivateWorkspaceRef,
    handleTogglePinWorkspace,
    handleUnpinWorkspace,
    handleMovePinnedWorkspace,
    handleClearRecentWork,
  };
}
