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
export { BacklinkPanel, type BacklinkPanelProps } from './components/BacklinkPanel';
export { ReferenceExplorerPanel, type ReferenceExplorerPanelProps } from './components/ReferenceExplorerPanel';
export { KnowledgeReviewPanel, type KnowledgeReviewPanelProps } from './components/KnowledgeReviewPanel';
export { KnowledgeMaintenancePanel, type KnowledgeMaintenancePanelProps, type KnowledgeMaintenanceData } from './components/KnowledgeMaintenancePanel';
export { StaleNotesPanel, type StaleNotesPanelProps } from './components/StaleNotesPanel';
export { OrphanNotesPanel, type OrphanNotesPanelProps } from './components/OrphanNotesPanel';
export { KnowledgeHealthPanel, type KnowledgeHealthPanelProps } from './components/KnowledgeHealthPanel';
export { ReviewQueuePanel, type ReviewQueuePanelProps } from './components/ReviewQueuePanel';
export { SavedViewsSection, type SavedViewsSectionProps } from './components/SavedViewsSection';
export { SmartCollectionsSection, type SmartCollectionsSectionProps } from './components/SmartCollectionsSection';
export { RuleCollectionsSection, type RuleCollectionsSectionProps } from './components/RuleCollectionsSection';
export { PinnedWorkspacesSection, type PinnedWorkspacesSectionProps } from './components/PinnedWorkspacesSection';
export { RecentWorkSection, type RecentWorkSectionProps } from './components/RecentWorkSection';
export {
  WorkspaceDashboardView,
  type WorkspaceDashboardViewProps,
  type WorkspaceDashboardQuickActions,
  type WorkspaceDashboardFocusProps,
  type WorkspaceDashboardQuickCaptureProps,
  type WorkspaceDashboardProductivityProps,
  type WorkspaceDashboardReviewProps,
  type WorkspaceDashboardMaintenanceProps,
  type WorkspaceDashboardResearchProps,
  type WorkspaceDashboardStudyProps,
  type WorkspaceDashboardKnowledgeMapsProps,
  type WorkspaceDashboardProjectProps,
  type WorkspaceDashboardAcademicProps,
  type WorkspaceDashboardAcademicInsightsProps,
  type WorkspaceDashboardUnifiedProps,
  type WorkspaceDashboardLearningPathProps,
  type WorkspaceDashboardSubjectWorkspacesProps,
} from './components/WorkspaceDashboardView';
export { UnifiedWorkspaceDashboard, type UnifiedWorkspaceDashboardProps, type UnifiedDashboardSection } from './components/UnifiedWorkspaceDashboard';
export { ProjectQuickActions, type ProjectQuickActionsProps } from './components/ProjectQuickActions';
export { LearningPathOverviewPanel, type LearningPathOverviewPanelProps } from './components/LearningPathOverviewPanel';
export { ProjectEditorPanel, type ProjectEditorPanelProps } from './components/ProjectEditorPanel';
export { MilestoneEditorPanel, type MilestoneEditorPanelProps } from './components/MilestoneEditorPanel';
export { LearningPathEditorPanel, type LearningPathEditorPanelProps } from './components/LearningPathEditorPanel';
export { SubjectWorkspacePanel, type SubjectWorkspacePanelProps } from './components/SubjectWorkspacePanel';
export { SubjectWorkspacesPanel, type SubjectWorkspacesPanelProps } from './components/SubjectWorkspacesPanel';
export { WorkspacePinToggle, type WorkspacePinToggleProps } from './components/WorkspacePinToggle';
export { DatabaseTableView, getDatabaseCellValue, getDatabaseRollupCellValue, type DatabaseTableViewProps } from './components/DatabaseTableView';
export { DatabaseBoardView, type DatabaseBoardViewProps } from './components/DatabaseBoardView';
export { DatabaseCalendarView, type DatabaseCalendarViewProps } from './components/DatabaseCalendarView';
export { DatabaseTimelineView, type DatabaseTimelineViewProps } from './components/DatabaseTimelineView';
export { DatabaseGalleryView, type DatabaseGalleryViewProps } from './components/DatabaseGalleryView';
export { DatabaseNoteCard, type DatabaseNoteCardProps } from './components/DatabaseNoteCard';
export { DatabasePresentationSwitcher, type DatabasePresentationSwitcherProps } from './components/DatabasePresentationSwitcher';
export { DatabasePropertyKeyField, type DatabasePropertyKeyFieldProps } from './components/DatabasePropertyKeyField';
export {
  DatabaseViewControls,
  DatabaseViewPanel,
  type DatabaseViewControlsProps,
  type DatabaseViewPanelProps,
} from './components/DatabaseViewControls';
export { DatabaseViewsSection, type DatabaseViewsSectionProps } from './components/DatabaseViewsSection';
export { NotePropertiesPanel, type NotePropertiesPanelProps } from './components/NotePropertiesPanel';
export { NoteRelationsPanel, type NoteRelationsPanelProps, type IncomingRelationDisplay } from './components/NoteRelationsPanel';
export { RelatedNotesPanel, type RelatedNotesPanelProps } from './components/RelatedNotesPanel';
export { NoteTagsPanel, type NoteTagsPanelProps } from './components/NoteTagsPanel';
export { NoteClassificationSelector, LiteratureWorkflowIndicator, type NoteClassificationSelectorProps, type LiteratureWorkflowIndicatorProps } from './components/NoteClassificationSelector';
export { BibliographyPanel, type BibliographyPanelProps } from './components/BibliographyPanel';
export { ReadingSourceLinkPanel, type ReadingSourceLinkPanelProps } from './components/ReadingSourceLinkPanel';
export { ResearchDashboardPanel, type ResearchDashboardPanelProps } from './components/ResearchDashboardPanel';
export { StudyDashboardPanel, type StudyDashboardPanelProps } from './components/StudyDashboardPanel';
export { WeakTopicToggle, type WeakTopicToggleProps } from './components/WeakTopicToggle';

export {
  CONCEPT_RELATION_TYPES,
  CONCEPT_RELATION_LABELS,
  CONCEPT_RELATION_LABELS_KO,
  isConceptRelationType,
  normalizeConceptRelationType,
  listConceptRelations,
  getConceptRelationTargets,
  countConceptRelationsByType,
  filterConceptNotes,
  type ConceptRelationType,
} from './maps/conceptRelations';

export {
  buildConceptHub,
  type ConceptHubEntry,
  type ConceptHubData,
  type BuildConceptHubInput,
} from './maps/buildConceptHub';

export {
  LEARNING_PATH_PROPERTY,
  LEARNING_PATH_STEP_PROPERTY,
  getLearningPathId,
  getLearningPathStep,
  setLearningPathStep,
  clearLearningPath,
  buildLearningPath,
  listLearningPathIds,
  SUBJECT_DASHBOARDS,
  SUBJECT_WORKSPACE_COLLECTION_IDS,
  getSubjectWorkspaceCollectionId,
  findSubjectByWorkspaceCollectionId,
  buildSubjectDashboard,
  type LearningPathStep,
  type LearningPath,
  type SubjectDashboardDefinition,
  type SubjectDashboardEntry,
  type SubjectDashboardData,
} from './maps/subjectDashboards';

export {
  buildSubjectWorkspace,
  buildAllSubjectWorkspaces,
  type SubjectWorkspaceData,
  type BuildSubjectWorkspaceOptions,
} from './maps/buildSubjectWorkspace';

export {
  buildLearningPathOverview,
  type LearningPathOverviewData,
  type LearningPathOverviewEntry,
  type BuildLearningPathOverviewOptions,
} from './maps/buildLearningPathOverview';

export {
  slugifyLearningPathId,
  formatLearningPathLabel,
  learningPathIdExists,
  buildLearningPathRenamePatches,
  buildLearningPathNormalizePatches,
  buildLearningPathMovePatches,
  buildAddNoteToLearningPathProperties,
  buildRemoveNoteFromLearningPathProperties,
  nextLearningPathStep,
  buildLearningPathEditorModel,
} from './maps/learningPathEditor';

export {
  buildKnowledgeClusters,
  type ClusterEntry,
  type TagCluster,
  type KnowledgeClusterData,
  type BuildKnowledgeClusterOptions,
} from './maps/buildKnowledgeClusters';

export { ConceptHubPanel, type ConceptHubPanelProps } from './components/ConceptHubPanel';
export { ConceptRelationsPanel, type ConceptRelationsPanelProps } from './components/ConceptRelationsPanel';
export { LearningPathPanel, type LearningPathPanelProps } from './components/LearningPathPanel';
export { KnowledgeClusterPanel, type KnowledgeClusterPanelProps } from './components/KnowledgeClusterPanel';
export { SubjectMapsDashboardPanel, type SubjectMapsDashboardPanelProps } from './components/SubjectMapsDashboardPanel';
export { ProjectDashboardPanel, type ProjectDashboardPanelProps } from './components/ProjectDashboardPanel';
export { AcademicDashboardPanel, type AcademicDashboardPanelProps } from './components/AcademicDashboardPanel';
export { AcademicInsightsPanel, type AcademicInsightsPanelProps } from './components/AcademicInsightsPanel';
export { SubjectProgressPanel, type SubjectProgressPanelProps } from './components/SubjectProgressPanel';
export { ProjectHealthPanel, type ProjectHealthPanelProps } from './components/ProjectHealthPanel';
export { LearningActivityPanel, type LearningActivityPanelProps } from './components/LearningActivityPanel';
export { WeakTopicInsightsPanel, type WeakTopicInsightsPanelProps } from './components/WeakTopicInsightsPanel';

export {
  STUDY_PROJECT_MARKER,
  STUDY_PROJECT_STATUS_PROPERTY,
  STUDY_PROJECT_DESCRIPTION_PROPERTY,
  STUDY_PROJECT_LINK_PROPERTY,
  STUDY_PROJECT_STATUSES,
  STUDY_PROJECT_STATUS_LABELS,
  STUDY_PROJECT_STATUS_LABELS_KO,
  isStudyProjectStatus,
  isStudyProjectContainer,
  getStudyProjectStatus,
  getStudyProjectDescription,
  getLinkedStudyProjectId,
  setStudyProjectContainer,
  linkNoteToStudyProject,
  unlinkNoteFromStudyProject,
  filterStudyProjectContainers,
  filterNotesLinkedToProject,
  buildStudyProjectSummary,
  type StudyProjectStatus,
  type StudyProjectSummary,
} from './academic/studyProjectModels';

export {
  buildProjectEditorData,
  type ProjectEditorData,
  type ProjectEditorEntry,
  type BuildProjectEditorDataOptions,
} from './academic/buildProjectEditorData';

export {
  PROJECT_MILESTONE_MARKER,
  MILESTONE_STATUS_PROPERTY,
  MILESTONE_TARGET_DATE_PROPERTY,
  MILESTONE_STATUSES,
  MILESTONE_STATUS_LABELS_KO,
  isMilestoneStatus,
  isProjectMilestone,
  getMilestoneStatus,
  getMilestoneTargetDate,
  getMilestoneProjectId,
  setProjectMilestone,
  filterProjectMilestones,
  buildProjectMilestoneEntry,
  buildUpcomingMilestones,
  type MilestoneStatus,
  type ProjectMilestoneEntry,
} from './academic/projectMilestoneModels';

export {
  buildProjectDashboard,
  formatProjectStatusLabel,
  type ProjectDashboardData,
  type ProjectDashboardEntry,
  type ProjectNoteEntry,
  type BuildProjectDashboardOptions,
} from './academic/buildProjectDashboard';

export {
  buildAcademicDashboard,
  type AcademicDashboardData,
  type BuildAcademicDashboardOptions,
} from './academic/buildAcademicDashboard';

export {
  buildSubjectProgress,
  type SubjectProgressEntry,
  type SubjectProgressData,
  type BuildSubjectProgressOptions,
} from './analytics/buildSubjectProgress';

export {
  buildProjectHealth,
  STALLED_PROJECT_DAYS,
  type ProjectHealthIndicator,
  type ProjectHealthEntry,
  type ProjectHealthData,
  type BuildProjectHealthOptions,
} from './analytics/buildProjectHealth';

export {
  buildLearningActivity,
  type LearningActivityKind,
  type LearningActivityEntry,
  type LearningActivityData,
  type BuildLearningActivityOptions,
} from './analytics/buildLearningActivity';

export {
  buildWeakTopicInsights,
  type WeakTopicSubjectCount,
  type WeakTopicInsightEntry,
  type WeakTopicInsightsData,
  type BuildWeakTopicInsightsOptions,
} from './analytics/buildWeakTopicInsights';

export {
  buildAcademicInsights,
  type AcademicInsightsData,
  type BuildAcademicInsightsOptions,
} from './analytics/buildAcademicInsights';

export {
  NOTE_KIND_PROPERTY,
  NOTE_KIND_PROMOTED_AT_PROPERTY,
  NOTE_KINDS,
  NOTE_KIND_LABELS,
  NOTE_KIND_LABELS_KO,
  getNoteKind,
  setNoteKind,
  filterNotesByKind,
  noteKindWorkflowStep,
  nextNoteKind,
  canPromoteNoteKind,
  canPromoteKind,
  getNoteKindPromotedAt,
  promoteNoteKind,
  promoteNoteKindLabel,
  isNoteKind,
  isConceptNote,
  type NoteKind,
} from './research/noteClassification';

export {
  buildResearchDashboard,
  type ResearchDashboardData,
  type ResearchNoteEntry,
  type SourcePipelineOverview,
  type BuildResearchDashboardOptions,
} from './research/buildResearchDashboard';

export {
  READING_NOTE_TAG,
  READING_NOTE_TEMPLATE_BODY,
  buildReadingNote,
  type BuildReadingNoteOptions,
} from './research/readingNoteTemplate';

export {
  READING_SOURCE_RELATION,
  SOURCE_READING_NOTES_RELATION,
  isReadingNote,
  isSourceNote,
  getLinkedSourceNoteId,
  getLinkedReadingNoteIds,
  linkReadingNoteToSource,
  unlinkReadingNoteFromSource,
  type LinkReadingSourceResult,
} from './research/readingSourceLink';

export {
  STUDY_NOTE_TAG,
  REVIEW_NOTE_TAG,
  EXAM_PREP_TAG,
  STUDY_NOTE_TEMPLATE_BODY,
  buildStudyNote,
  isStudyNote,
  type BuildStudyNoteOptions,
} from './study/studyNoteTemplate';

export {
  WEAK_TOPIC_PROPERTY,
  WEAK_TOPIC_TAG,
  isWeakTopic,
  setWeakTopic,
  filterWeakTopicNotes,
} from './study/weakTopicTracking';

export {
  buildStudyDashboard,
  type StudyDashboardData,
  type StudyNoteEntry,
  type BuildStudyDashboardOptions,
} from './study/buildStudyDashboard';

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
  type LocalGraphRelationshipFilter,
  type LocalGraphViewProps,
} from './graph';

export {
  computeRelatedScore,
  formatRelatedReasons,
  RELATED_REASON_LABELS,
  RELATED_SCORE,
  type RelatedReason,
  type RelatedScoreBreakdown,
  type RelatedScoreInput,
} from './related';

export {
  buildKnowledgeReviewLists,
  type BuildKnowledgeReviewOptions,
  type KnowledgeReviewLists,
  type ReviewNoteEntry,
} from './review/buildKnowledgeReview';

export {
  buildKnowledgeMaintenanceData,
  type BuildKnowledgeMaintenanceOptions,
} from './review/buildKnowledgeMaintenance';

export {
  buildStaleNotesBuckets,
  countStaleNotes,
  daysSince,
  isStaleNote,
  noteLastOpenedAt,
  staleTierForNote,
  STALE_DAY_THRESHOLDS,
  type BuildStaleNotesOptions,
  type StaleDayTier,
  type StaleNotesBuckets,
} from './review/staleNotes';

export {
  buildOrphanNotes,
  countOrphanNotes,
  isOrphanNote,
  type BuildOrphanNotesOptions,
} from './review/orphanNotes';

export {
  buildKnowledgeHealthMetrics,
  type KnowledgeHealthMetrics,
} from './review/knowledgeHealth';

export {
  buildReviewQueue,
  reviewQueueReasonLabel,
  type BuildReviewQueueOptions,
  type ReviewQueueEntry,
  type ReviewQueueReason,
} from './review/reviewQueue';

export {
  extractFootnoteDefinitions,
  extractInlineFootnoteRefs,
  extractNoteReferenceSummary,
  type FootnoteDefinition,
  type NoteReferenceSummary,
} from './references/extractNoteReferenceSummary';

export {
  evaluateQuery,
  evaluateQueryString,
  filterNotes,
  filterNotesByFormulaClauses,
  formatParsedQuery,
  compileVisualFilters,
  mergeQueryWithVisualFilter,
  hasKnowledgeQuerySyntax,
  isFormulaQueryClause,
  isKnowledgeQuery,
  normalizeQueryValue,
  parseQuery,
  splitQueryClauses,
  type FilterNotesOptions,
  type FilterNotesResult,
  type FormulaQueryClause,
  type FormulaQueryOperator,
  type ParsedQuery,
  type QueryClause,
  type QueryEvaluation,
  type QueryEvaluationContext,
  type FilterCondition,
  type VisualFilterModel,
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
  SMART_COLLECTION_GROUPS,
  getSmartCollectionIcon,
  getSmartCollectionGroup,
  isPrimarySmartCollection,
  isSecondarySmartCollection,
  PRIMARY_COLLECTION_GROUP_IDS,
  type SmartCollectionGroup,
} from './collections/smartCollectionGroups';

export {
  activateDatabaseView,
  addDatabaseViewColumn,
  addDatabaseViewRollupColumn,
  addDatabaseViewRollupDefinition,
  BUILTIN_COLUMN_KEYS,
  createDatabaseView,
  createDatabaseViewFromTemplate,
  DATABASE_TEMPLATES,
  findDatabaseTemplate,
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
  prepareDatabaseBoardLanes,
  prepareDatabaseCalendarBuckets,
  prepareDatabaseTimelineItems,
  prepareDatabaseGalleryItems,
  prepareDatabaseViewPresentation,
  removeDatabaseViewColumn,
  removeDatabaseViewRollupColumn,
  renameDatabaseView,
  resolveVisibleColumns,
  resolveVisibleRollupColumns,
  saveDatabaseViews,
  setDatabaseViewColumnVisibility,
  setDatabaseViewRollupColumnVisibility,
  setDatabaseViewGroupBy,
  setDatabaseViewDateProperty,
  setDatabaseViewPresentation,
  setDatabaseViewSort,
  setDatabaseViewSortRules,
  addDatabaseViewSortRule,
  removeDatabaseViewSortRule,
  moveDatabaseViewSortRule,
  setDatabaseViewTimelineEndProperty,
  setDatabaseViewTimelineStartProperty,
  setDatabaseViewGalleryCoverProperty,
  setDatabaseViewGalleryCardFields,
  showDatabaseViewColumn,
  sortDatabaseViewRows,
  resolveDatabaseViewSortRules,
  normalizeTableConfig,
  updateDatabaseViewConfig,
  withDatabaseViewDefaults,
  withPresentationDefaults,
  getBoardConfig,
  getCalendarConfig,
  getTableConfig,
  getTimelineConfig,
  getGalleryConfig,
  groupNotesByProperty,
  bucketNotesByDate,
  parseDatabaseDate,
  toDateKey,
  getNoteDateValue,
  getDatabaseFieldValue,
  getNoteGroupValue,
  DEFAULT_BOARD_GROUP_BY,
  DEFAULT_CALENDAR_DATE_PROPERTY,
  DEFAULT_NO_DATE_LABEL,
  NO_DATE_KEY,
  UNASSIGNED_LANE_KEY,
  UNASSIGNED_LANE_LABEL,
  buildCalendarMonthGrid,
  addMonths,
  DATABASE_PRESENTATION_OPTIONS,
  DATABASE_EMPTY_MESSAGE,
  presentationLabel,
  BOARD_GROUP_BY_FIELD,
  CALENDAR_DATE_PROPERTY_FIELD,
  TIMELINE_START_DATE_FIELD,
  TIMELINE_END_DATE_FIELD,
  GALLERY_COVER_PROPERTY_FIELD,
  GALLERY_CARD_FIELDS_FIELD,
  SUGGESTED_PROPERTY_KEYS,
  type DatabaseViewPresentationData,
  isDatabaseBoardConfig,
  isDatabaseCalendarConfig,
  isDatabaseGalleryConfig,
  isDatabasePresentationConfigFuture,
  isDatabaseTableConfig,
  isDatabaseTimelineConfig,
  normalizeGalleryConfig,
  normalizeTimelineConfigFuture as normalizeTimelineConfig,
  presentationConfigForType,
  presentationConfigTypeForPresentation,
  type DatabaseViewSortRule,
  type DatabaseGalleryCardSize,
  type DatabaseGalleryConfig,
  type DatabasePresentationConfigFuture,
  type DatabaseTableGroupConfig,
  type DatabaseTimelineConfig,
  type DatabaseTimelineSortBy,
  type DatabaseViewPresentationFuture,
  type ImplementedPresentationConfigMap,
  type DatabaseBoardConfig,
  type DatabaseCalendarConfig,
  type DatabaseColumn,
  type DatabasePresentationConfig,
  type DatabaseTableConfig,
  type DatabaseViewColumnEntry,
  type DatabaseViewRecord,
  type DatabaseViewSort,
  type DatabaseSortDirection,
  type BoardLane,
  type CalendarDateBucket,
  type TimelineItem,
  type GalleryField,
  type GalleryItem,
  type CreateDatabaseViewOptions,
  type CreateDatabaseViewFromTemplateOptions,
  type DatabaseTemplateDefinition,
} from './databaseViews';

export {
  buildDailyTraceProjection,
  collectNoteActivityDateKeys,
  buildRangeLensProjection,
  buildMonthTraceProjection,
  buildQuarterTraceProjection,
  buildRangeTraceProjection,
  buildYearTraceProjection,
  currentTraceMonth,
  currentTraceQuarter,
  currentTraceYear,
  DailyTraceDayView,
  RangeTraceLensView,
  AreaTraceView,
  AreaDiscoveryView,
  EventNoteDialog,
  MilestoneNoteDialog,
  EVENT_TYPE_VALUE,
  AREA_TYPE_VALUE,
  applyAreaToNote,
  applyEventToNote,
  applyMilestoneToNote,
  areaTraceMarkCount,
  areaRangeTraceMarkCount,
  areaDiscoveryObservationCount,
  buildAreaDiscoveryProjection,
  buildAreaTraceProjection,
  buildAreaRangeLensProjection,
  buildAreaRangeTraceProjection,
  canMarkAsArea,
  clearAreaFromNote,
  clearEventFromNote,
  clearMilestoneFromNote,
  eventFormValuesFromNote,
  findDailyAnchorNote,
  formatAreaRangeHeading,
  formatRangeLensHeading,
  formatTraceDayHeading,
  formatTraceMonthHeading,
  hasAreaTraceMarks,
  hasAreaRangeTraceMarks,
  hasAreaDiscoveryObservations,
  hasDailyTraceMarks,
  hasMonthTraceMarks,
  hasRangeTraceMarks,
  isAreaNote,
  isEventNote,
  isMilestoneNote,
  listAreaNotes,
  milestoneFormValuesFromNote,
  monthTraceMarkCount,
  rangeTraceMarkCount,
  readEventFromNote,
  readMilestoneFromNote,
  shiftDateKey,
  shiftTraceMonth,
  toMonthKey,
  validateEventForm,
  validateMilestoneForm,
  TRACE_PROPERTY_KEYS,
  type AreaDiscoveryViewProps,
  type AreaDiscoveryProjection,
  type AreaTraceViewProps,
  type AreaTraceProjection,
  type AreaRangeTraceProjection,
  type DailyTraceDayViewProps,
  type DailyTraceProjection,
  type EventFormValues,
  type EventNoteDialogProps,
  type MilestoneFormValues,
  type MilestoneNoteDialogProps,
  type RangeTraceEventRef,
  type RangeTraceLensViewProps,
  type RangeTraceProjection,
  type TraceActivity,
  type TraceActivityKind,
  type TraceEventRef,
  type TraceMilestoneRef,
  type TraceMonthKey,
  type TraceQuarterKey,
  type TraceRangeLens,
} from './trace';

export {
  DEFAULT_ARCHIVE_HOME_OPTIONS,
  archiveCalendarBounds,
  archivePeriodRefFromDateKey,
  archivePeriodRefFromMonth,
  archivePeriodRefFromQuarter,
  archivePeriodRefFromYear,
  archivePeriodRefToTraceRangeLens,
  buildArchiveAreaPills,
  buildArchiveBrowseLinks,
  buildArchiveHomeProjection,
  buildArchiveMarkCalendarProjection,
  buildArchiveRecentMilestones,
  buildArchiveYouAreHere,
  buildNoteMarkIndex,
  computeMarkDensity,
  domainMarkDayToTypes,
  resolveArchivePeriodBounds,
  traceRangeLensToArchivePeriodRef,
  type ArchiveAreaPill,
  type ArchiveAreaRef,
  type ArchiveBrowseProjection,
  type ArchiveDomainMarkDay,
  type ArchiveHomeEmptyFlags,
  type ArchiveHomeFrame,
  type ArchiveHomeProjection,
  type ArchiveHomeProjectionInput,
  type ArchiveHomeProjectionOptions,
  type ArchiveMarkCalendarProjection,
  type ArchiveMarkDay,
  type ArchiveMarkType,
  type ArchiveMilestoneEntry,
  type ArchiveMonthLabel,
  type ArchivePeriodKind,
  type ArchivePeriodRef,
  type ArchiveYouAreHere,
} from './archive';

export {
  isRelationEdge,
  isRelationRecord,
  type ExplicitGraphRelationshipType,
  type RelationAuthoringInput,
  type RelationEdge,
  type RelationQueryClause,
  type RelationRecord,
  type ResolvedRelationTarget,
  addRelationTarget,
  getRelationTargets,
  hasRelations,
  listRelationKeys,
  listRelationRecords,
  normalizeNoteRelations,
  normalizeRelationPropertyKey,
  parseRelationsFrontmatter,
  relationEdgeKey,
  removeRelationTarget,
  serializeRelationsFrontmatter,
  setRelationTargets,
  toRelationEdges,
} from './relations';

export {
  computeRollup,
  resolveRollupLinkedNotes,
  isRollupColumnDefinition,
  isRollupDefinition,
  isRollupFunctionPhase1,
  normalizeRollupColumns,
  normalizeRollupDefinition,
  rollupColumnLabel,
  rollupDefinitionFromLegacy,
  ROLLUP_FUNCTIONS_PHASE1,
  type RelationRollupAggregate,
  type RelationRollupConfig,
  type RollupColumnDefinition,
  type RollupComputeInput,
  type RollupDefinition,
  type RollupDirection,
  type RollupFunction,
  type RollupFunctionPhase1,
  type RollupFunctionPhase2,
  type RollupSortKey,
  type RollupValue,
} from './rollups';

export {
  buildFormulaDependencyGraph,
  buildFormulaQueryCatalog,
  computeFormula,
  computeFormulasForNote,
  createFormulaComputeMemo,
  formulaColumnLabel,
  formulaColumnsForKeys,
  formulaMemoKey,
  getFormulaColumnValue,
  isFormulaColumnDefinition,
  isFormulaDefinition,
  isFormulaFieldInput,
  isFormulaFormulaInput,
  isFormulaInput,
  isFormulaMetadataInput,
  isFormulaRollupInput,
  normalizeFormulaColumns,
  normalizeFormulaDefinition,
  type FormulaColumnDefinition,
  type FormulaComputeMemo,
  type FormulaDefinition,
  type FormulaDependencyGraph,
  type FormulaDependencyNode,
  type FormulaErrorCode,
  type FormulaEvalContext,
  type FormulaFieldInput,
  type FormulaFormulaInput,
  type FormulaInput,
  type FormulaMetadataInput,
  type FormulaMetadataKey,
  type FormulaReturnType,
  type FormulaRollupInput,
  type FormulaValue,
  type FormulaValueRaw,
} from './formulas';

export {
  INACTIVE_WORKSPACE,
  activateDashboardWorkspace,
  activateDatabaseViewWorkspace,
  activateRuleCollectionWorkspace,
  activateSavedViewWorkspace,
  activateSmartCollectionWorkspace,
  applyWorkspaceListFilter,
  clearWorkspaceActivation,
  clearWorkspaceActivationForItem,
  clearWorkspaceSearchBinding,
  clearWorkspaceSession,
  getWorkspaceFilterSource,
  isActiveWorkspaceActivation,
  isDatabaseViewActive,
  isDashboardActive,
  isSameWorkspaceActivation,
  isWorkspaceActivation,
  isWorkspaceItemKind,
  isWorkspaceKindActive,
  isValidWorkspaceRef,
  loadWorkspacePreferences,
  loadWorkspaceSession,
  normalizeWorkspaceActivation,
  normalizeWorkspacePreferences,
  normalizeWorkspaceSession,
  pruneWorkspacePreferences,
  reconcileSavedViewActivation,
  recordRecentWorkspace,
  removePinnedWorkspace,
  reorderPinnedWorkspaces,
  resolveWorkspaceRef,
  restoreWorkspaceActivation,
  saveWorkspacePreferences,
  saveWorkspaceSession,
  togglePinnedWorkspace,
  createInboxNote,
  buildTaskNote,
  buildJournalNote,
  buildUnifiedWorkspaceDashboard,
  createFocusPreset,
  deleteFocusPreset,
  findFocusPreset,
  FOCUS_PRESETS_KEY,
  focusUiFromPreset,
  getCaptureTypeTag,
  getJournalDatabaseTemplateId,
  getTaskDatabaseTemplateId,
  INACTIVE_FOCUS_SESSION,
  INBOX_TAG,
  JOURNAL_TEMPLATES,
  JOURNAL_TAG,
  loadFocusPresets,
  normalizeFocusPreset,
  pruneFocusPresets,
  QUICK_CAPTURE_TYPES,
  resolveJournalTemplateId,
  resolveTaskTemplateId,
  saveFocusPresets,
  TASK_TEMPLATES,
  useNoteWorkspace,
  WORKSPACE_FILTER_SOURCE,
  WORKSPACE_PREFS_KEY,
  WORKSPACE_SESSION_KEY,
  workspaceRefFromActivation,
  workspaceSessionFromActivation,
  type DatabaseView,
  type DatabaseViewPresentation,
  type PinnedWorkspaceRef,
  type RecentWorkEntry,
  type UseNoteWorkspaceOptions,
  type UseNoteWorkspaceResult,
  type QuickCaptureInput,
  type CreateTaskInput,
  type CreateJournalInput,
  type QuickCaptureModel,
  type QuickCaptureType,
  type JournalTemplateDefinition,
  type TaskTemplateDefinition,
  type FocusPreset,
  type FocusSessionState,
  type FocusUiPreferences,
  DEFAULT_QUICK_CAPTURE_MODEL,
  DEFAULT_RECENT_NOTES_LIMIT,
  DEFAULT_WORKSPACE_DASHBOARD,
  formatRecentTimestamp,
  isDashboardActivation,
  workspaceKindLabel,
  type WorkspaceDashboardModel,
  type WorkspaceDashboardWidget,
  type WorkspaceDashboardWidgetId,
  type UnifiedWorkspaceDashboardData,
  type BuildUnifiedWorkspaceDashboardOptions,
  type WorkspaceActivation,
  type WorkspaceFilterSource,
  type WorkspaceItemKind,
  type WorkspaceItemRef,
  type WorkspacePreferences,
  type WorkspaceRef,
  type WorkspaceResolveContext,
  type WorkspaceSessionState,
} from './workspace';

export {
  evaluateKnowledgeImportance,
  buildNoteIntelligenceSnapshot,
  buildCosmosVaultAnalysis,
  buildKnowledgeOpportunities,
  buildSuggestedConnections,
  buildAreaHealthSummaries,
  buildKnowledgeGaps,
  buildImportanceInputForNote,
  type ImportanceClassification,
  type NoteIntelligenceSnapshot,
  type CosmosVaultAnalysis,
  type KnowledgeOpportunity,
  type SuggestedConnection,
  type AreaHealthSummary,
  type KnowledgeGap,
} from './cosmos/intelligence';

export { CosmosInsightsPanel, type CosmosInsightsPanelProps } from './components/CosmosInsightsPanel';

export {
  CosmosActionsPanel,
  buildCosmosActionPlan,
  countActionsForNote,
  enrichConnectionRecommendations,
  formatConnectionReasons,
  suggestAreaForNote,
  buildAreaAssignmentPatch,
  buildConnectPatch,
  buildHubCreationPatch,
  buildHubNoteTemplate,
  type CosmosActionsPanelProps,
  type CosmosActionItem,
  type CosmosActionPlan,
  type EnrichedConnectionRecommendation,
} from './cosmos/actions';

export {
  buildDiscoveryFeed,
  countDiscoveriesForNote,
  isDiscoveryOpportunityNote,
  DISCOVERY_WEIGHTS,
  type DiscoveryFeed,
  type DiscoveryItem,
  type DiscoveryKind,
  type DiscoverySummary,
} from './discovery';

export {
  buildKnowledgeTimeline,
  type KnowledgeTimeline,
  type TimelinePeriodMode,
  type RecentEvolutionSummary,
} from './timeline';

export { TimelinePanel, type TimelinePanelProps, type TimelineSection } from './components/TimelinePanel';
export { TimelineActivityFeed, type TimelineActivityFeedProps } from './components/TimelineActivityFeed';
export { KnowledgeEvolutionSummary, type KnowledgeEvolutionSummaryProps } from './components/KnowledgeEvolutionSummary';
export { CosmosEvolutionStory, type CosmosEvolutionStoryProps } from './components/CosmosEvolutionStory';
export { DiscoveryProgressSection, type DiscoveryProgressSectionProps } from './components/DiscoveryProgressSection';
export { AreaEvolutionPanel, type AreaEvolutionPanelProps } from './components/AreaEvolutionPanel';
export { KnowledgeJourneyPanel, type KnowledgeJourneyPanelProps } from './components/KnowledgeJourneyPanel';
export { KnowledgeEvolutionCard, type KnowledgeEvolutionCardProps } from './components/KnowledgeEvolutionCard';
export { AreaComparisonPanel, type AreaComparisonPanelProps } from './components/AreaComparisonPanel';
export { DormantAreasSection, type DormantAreasSectionProps } from './components/DormantAreasSection';
export { TimelineExportMenu, type TimelineExportMenuProps } from './components/TimelineExportMenu';
export { BootstrapImportSummaryCard, type BootstrapImportSummaryCardProps } from './components/BootstrapImportSummaryCard';
export { TimelineDashboardCard, type TimelineDashboardCardProps } from './components/TimelineDashboardCard';
export { KnowledgeActivityCard, type KnowledgeActivityCardProps } from './components/KnowledgeActivityCard';

export {
  loadKnowledgeHistoryEvents,
  getActivitySummary,
  getNoteHistoryContext,
  getRecentEvents,
  getGrowthMetrics,
  recordDiscoveryResolved,
  subscribeKnowledgeHistory,
  clearKnowledgeHistory,
  maybeBootstrapKnowledgeHistory,
  bootstrapKnowledgeHistory,
  presentHistoryEvent,
  groupEventsByDate,
  buildCosmosEvolutionSummary,
  buildCosmosEvolutionStory,
  buildExpandedCosmosEvolutionStory,
  buildDiscoveryProgressSummary,
  buildAreaEvolutionDetail,
  buildEvolutionInsightsSummary,
  buildKnowledgeMomentumSnapshot,
  buildAreaComparison,
  analyzeDormantAreas,
  generateKnowledgeEvolutionReport,
  exportMarkdownByKind,
  downloadMarkdownFile,
  copyMarkdownToClipboard,
  getMilestoneNoteId,
  latestAchievedMilestone,
  loadBootstrapImportSummary,
  dismissBootstrapSummary,
  MAX_HISTORY_EVENTS,
  MOMENTUM_WEIGHTS,
  DORMANT_THRESHOLD_DAYS,
  type KnowledgeHistoryEvent,
  type KnowledgeHistoryEventType,
  type KnowledgeActivitySummary,
  type NoteHistoryContext,
  type CosmosEvolutionSummary,
  type CosmosEvolutionStory as CosmosEvolutionStoryData,
  type ExpandedCosmosEvolutionStory,
  type DiscoveryProgressSummary,
  type AreaEvolutionDetail,
  type KnowledgeJourney,
  type EvolutionInsightsSummary,
  type KnowledgeMomentumSnapshot,
  type DormantAreaInsight,
  type ExportKind,
} from './history';

export {
  resolveCosmosVaultPhase,
  countActiveNotes,
  countVaultLinks,
  CosmosProductTour,
  CosmosStartDashboard,
  WhyThisRecommendation,
  WhyThisTier,
  CosmosTermTooltip,
  type CosmosVaultPhase,
} from './cosmos/onboarding';

export { buildNoteGalaxyMap } from './graph/knowledgeUniverse/galaxyClustering';

export { DiscoveryPanel, type DiscoveryPanelProps } from './components/DiscoveryPanel';
export { DiscoveryDashboardCard, type DiscoveryDashboardCardProps } from './components/DiscoveryDashboardCard';
