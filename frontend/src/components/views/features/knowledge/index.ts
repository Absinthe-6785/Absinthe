export {
  buildBacklinkIndex,
  getBacklinkCount,
  getIncomingLinks,
  getOutgoingLinks,
  getPageReferences,
  resolveBacklinkNavigation,
  type BacklinkIndex,
  type IncomingLinksOptions,
  type OutgoingReference,
  type PageReference,
} from './backlinks';

export {
  bodyHasWikiLinkToTitle,
  bodyTextWithoutWikiLinks,
  buildTitleMentionRegex,
  containsWholeWordMention,
  extractMentionContexts,
  findMentionInText,
  hasUnlinkedMention,
} from './mentions';

export type { MentionLookupOptions, RelatedNote } from './KnowledgeIndexService';

export {
  KnowledgeIndexService,
  knowledgeIndexService,
} from './KnowledgeIndexService';

export {
  getProperty,
  listProperties,
  listUserProperties,
  normalizeNoteProperties,
  normalizePropertyKey,
  parseNoteMarkdown,
  removeProperty,
  serializeNoteMarkdown,
  setProperty,
} from './properties';

export {
  addTag,
  hasTag,
  listTags,
  noteMatchesPageTag,
  normalizeTagName,
  removeTag,
  renameTag,
  setTags,
  TAGS_PROPERTY_KEY,
} from './tags';

export { LinkedReferencesPanel, type LinkedReferencesPanelProps } from './components/LinkedReferencesPanel';
export { SavedViewsSection, type SavedViewsSectionProps } from './components/SavedViewsSection';
export { SmartCollectionsSection, type SmartCollectionsSectionProps } from './components/SmartCollectionsSection';
export { RuleCollectionsSection, type RuleCollectionsSectionProps } from './components/RuleCollectionsSection';
export { DatabaseTableView, getDatabaseCellValue, type DatabaseTableViewProps } from './components/DatabaseTableView';
export { DatabaseViewControls, type DatabaseViewControlsProps } from './components/DatabaseViewControls';
export { DatabaseViewsSection, type DatabaseViewsSectionProps } from './components/DatabaseViewsSection';
export { NotePropertiesPanel, type NotePropertiesPanelProps } from './components/NotePropertiesPanel';
export { RelatedNotesPanel, type RelatedNotesPanelProps } from './components/RelatedNotesPanel';
export { NoteTagsPanel, type NoteTagsPanelProps } from './components/NoteTagsPanel';

export {
  buildExpandedGraphData,
  buildGlobalGraphData,
  buildLocalGraphData,
  collapseNode,
  DEFAULT_MAX_VISIBLE_GRAPH_NODES,
  expandNode,
  LocalGraphView,
  type BuildExpandedGraphInput,
  type BuildGlobalGraphInput,
  type BuildGlobalGraphOptions,
  type BuildLocalGraphInput,
  type ExpandedGraphMeta,
  type GlobalGraphRelationshipFilter,
  type GraphData,
  type GraphEdge,
  type GraphNode,
  type GraphNodeType,
  type GraphRelationshipType,
  type GraphScope,
  type LocalGraphViewProps,
} from './graph';

export {
  computeRelatedScore,
  formatRelatedReasons,
  RELATED_SCORE,
  type RelatedReason,
  type RelatedScoreBreakdown,
  type RelatedScoreInput,
} from './related';

export {
  evaluateQuery,
  evaluateQueryString,
  filterNotes,
  formatParsedQuery,
  hasKnowledgeQuerySyntax,
  isKnowledgeQuery,
  normalizeQueryValue,
  parseQuery,
  type FilterNotesResult,
  type ParsedQuery,
  type QueryClause,
  type QueryEvaluation,
} from './query';

export {
  activateSavedView,
  createSavedView,
  deleteSavedView,
  findSavedView,
  isValidSavedViewQuery,
  loadSavedViews,
  normalizeSavedViews,
  renameSavedView,
  saveSavedViews,
  SAVED_VIEWS_KEY,
  type SavedView,
} from './views';

export {
  activateSmartCollection,
  evaluateSmartCollection,
  filterBySmartCollection,
  findSmartCollection,
  isSmartCollectionId,
  SMART_COLLECTIONS,
  activateRuleCollection,
  createRuleCollection,
  deleteRuleCollection,
  evaluateRuleCollection,
  filterByRuleCollection,
  findRuleCollection,
  isValidRuleCollectionQuery,
  loadRuleCollections,
  normalizeRuleCollections,
  renameRuleCollection,
  saveRuleCollections,
  RULE_COLLECTIONS_KEY,
  type FilterSmartCollectionResult,
  type RuleCollection,
  type SmartCollection,
  type SmartCollectionId,
} from './collections';

export {
  activateDatabaseView,
  addDatabaseViewColumn,
  BUILTIN_COLUMN_KEYS,
  createDatabaseView,
  DATABASE_VIEWS_KEY,
  DEFAULT_DATABASE_VIEW_SORT,
  DEFAULT_TABLE_COLUMNS,
  deleteDatabaseView,
  evaluateDatabaseView,
  filterByDatabaseView,
  findDatabaseView,
  hideDatabaseViewColumn,
  isBuiltinColumnKey,
  isValidDatabaseViewQuery,
  loadDatabaseViews,
  normalizeDatabaseViews,
  prepareDatabaseViewRows,
  removeDatabaseViewColumn,
  renameDatabaseView,
  resolveVisibleColumns,
  saveDatabaseViews,
  setDatabaseViewColumnVisibility,
  setDatabaseViewSort,
  showDatabaseViewColumn,
  sortDatabaseViewRows,
  updateDatabaseViewConfig,
  withDatabaseViewDefaults,
  type DatabaseColumn,
  type DatabaseViewColumnEntry,
  type DatabaseViewSort,
  type DatabaseSortDirection,
} from './databaseViews';

export {
  INACTIVE_WORKSPACE,
  activateDatabaseViewWorkspace,
  activateRuleCollectionWorkspace,
  activateSavedViewWorkspace,
  activateSmartCollectionWorkspace,
  applyWorkspaceListFilter,
  clearWorkspaceActivation,
  clearWorkspaceSearchBinding,
  isDatabaseViewActive,
  isSameWorkspaceActivation,
  isWorkspaceKindActive,
  WORKSPACE_FILTER_SOURCE,
  type DatabaseView,
  type DatabaseViewPresentation,
  type WorkspaceActivation,
  type WorkspaceFilterSource,
  type WorkspaceItemKind,
  type WorkspaceItemRef,
} from './workspace';
