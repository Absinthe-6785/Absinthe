import type { RefObject } from 'react';
import { useMemo } from 'react';
import { useNotesStore } from '../../../store/useNotesStore';
import type { NoteChromeColors } from '../noteEditorTheme';
import type { NoteBase as Note, TocItem } from '../noteUtils';
import { displayNoteTitle } from '../noteDisplayTitle';
import { extractLinks } from '../noteUtils';
import { findNoteByTitle } from '../noteUtils';
import type { KnowledgeContextTab } from '../features/knowledge/components/KnowledgeContextPanel';
import { KnowledgePanelEmpty } from '../features/knowledge/components/KnowledgePanelSection';
import { OutlinePanel } from '../features/knowledge/components/OutlinePanel';
import { LinksContextPanel, CosmosContextFooter } from '../features/knowledge/components/LinksContextPanel';
import { DiscoveryPanel } from '../features/knowledge/components/DiscoveryPanel';
import { TimelinePanel } from '../features/knowledge/components/TimelinePanel';
import {
  BacklinkPanel,
  ReferenceExplorerPanel,
  BibliographyPanel,
  ReadingSourceLinkPanel,
  ConceptHubPanel,
  ConceptRelationsPanel,
  LearningPathPanel,
  LocalGraphView,
  RelatedNotesPanel,
  CosmosInsightsPanel,
  CosmosActionsPanel,
  ProjectEditorPanel,
  MilestoneEditorPanel,
  NotePropertiesPanel,
  NoteTagsPanel,
  NoteRelationsPanel,
  knowledgeIndexService,
  isStudyProjectContainer,
  isProjectMilestone,
  getMilestoneStatus,
  getMilestoneTargetDate,
  getMilestoneProjectId,
  type DiscoveryFeed,
  type CosmosVaultPhase,
  type KnowledgeTimeline,
  type TimelinePeriodMode,
  type NoteIntelligenceSnapshot,
} from '../features/knowledge';
import type { KnowledgeImportanceInput } from '../features/knowledge/cosmos/intelligence';
import type { NoteHistoryContext } from '../features/knowledge/history';
import type {
  KnowledgeHistoryEvent,
  CosmosEvolutionSummary,
  ExpandedCosmosEvolutionStory,
  DiscoveryProgressSummary,
  KnowledgeJourney,
  EvolutionInsightsSummary,
} from '../features/knowledge/history';
import type { BootstrapImportSummary } from '../features/knowledge/history/bootstrapSummaryStorage';
import type { EditorMode } from '../editorMode';
import { useTranslation } from '@/lib/i18n';
import type { GroupedRelatedNotes } from '../features/knowledge/related/groupRelatedNotes';
import { buildVaultHealthMetrics } from '../features/knowledge/health/vaultHealthMetrics';
import type { NoteNavigationSource } from '@/lib/noteNavigationStack';
import type { NoteBreadcrumbSegment } from '@/lib/noteBreadcrumb';

const NOTE_REQUIRED_CONTEXT_TABS: ReadonlySet<KnowledgeContextTab> = new Set([
  'toc', 'links', 'graph', 'insights', 'actions', 'properties', 'tags', 'relations', 'stats',
]);

export interface NoteContextPanelData {
  pageReferences: ReturnType<typeof knowledgeIndexService.getPageReferences> | null;
  noteReferenceSummary: ReturnType<typeof import('../features/knowledge').extractNoteReferenceSummary> | null;
  linksStructureCount: number;
  linksConnectionsCount: number;
  linksSourcesCount: number;
  conceptHub: ReturnType<typeof import('../features/knowledge').buildConceptHub> | null;
  learningPath: ReturnType<typeof import('../features/knowledge').buildLearningPath> | null;
  notes: Note[];
  wikiTargets: string[];
  backlinkContexts: ReturnType<typeof import('../noteUtils').extractLinkContexts>;
  mentioningNotes: ReturnType<typeof knowledgeIndexService.getMentioningNotes>;
  relatedNotes: GroupedRelatedNotes;
  sourceNoteCandidates: Note[];
  noteBibliography: ReturnType<typeof import('../citationUtils').collectCitationsFromMarkdown>;
  localGraphData: ReturnType<typeof import('../features/knowledge').buildExpandedGraphData> | null;
  noteIntelligenceSnapshot: NoteIntelligenceSnapshot | null;
  noteTierInput: KnowledgeImportanceInput | null;
  noteHistoryContext: NoteHistoryContext | null;
  discoveryFeed: DiscoveryFeed;
  cosmosVaultPhase: CosmosVaultPhase;
  projectEditorData: ReturnType<typeof import('../features/knowledge').buildProjectEditorData> | null;
  milestoneProjectTitle: string;
  allTags: { tag: string; count: number }[];
  activeTag: string | null;
  resolvedOutgoingRelations: ReturnType<typeof knowledgeIndexService.resolveRelationTargets>;
  incomingRelationDisplays: {
    edge: ReturnType<typeof knowledgeIndexService.getIncomingRelations>[number];
    sourceTitle: string;
    missing: boolean;
  }[];
  noteTags: string[];
}

export interface NoteContextPanelHandlers {
  createNote: (initial?: Partial<Pick<Note, 'title' | 'body' | 'folderId'>>) => string;
  noteUpdate: (id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'folderId' | 'starred' | 'properties' | 'relations'>>) => void;
  setActiveNoteId: (id: string) => void;
  openNoteById: (id: string, source?: NoteNavigationSource, breadcrumb?: readonly NoteBreadcrumbSegment[]) => void;
  navigateToWiki: (title: string, opts?: { preferReading?: boolean }) => void;
  handleLinkRelatedNote: (noteId: string, noteTitle: string) => void;
  handleOpenCosmosGraph: () => void;
  handleStartWikiLink: () => void;
  handleCreateRelatedNote: () => void;
  handleLinkReadingSource: (sourceNoteId: string) => void;
  handleUnlinkReadingSource: () => void;
  handleExpandGraphNode: (noteId: string) => void;
  handleCollapseGraphNode: (noteId: string) => void;
  setViewMode: (mode: EditorMode | ((prev: EditorMode) => EditorMode)) => void;
  openContextPanel: (tab: KnowledgeContextTab) => void;
  handleOpenDiscover: () => void;
  handleCosmosConnect: (targetTitle: string) => void;
  handleCosmosAssignArea: (areaLabel: string, areaNoteId?: string) => void;
  handleCosmosCreateHub: (areaLabel: string) => void;
  handleCosmosCreateRelation: (targetNoteId: string) => void;
  handleDiscoveryCreateRelation: (sourceNoteId: string, targetNoteId: string) => void;
  handleUpdateProjectDescription: (description: string) => void;
  handleUpdateProjectStatus: (status: 'planned' | 'active' | 'completed') => void;
  handleCreateProjectMilestone: () => void;
  handleUpdateMilestoneStatus: (status: 'planned' | 'active' | 'completed') => void;
  handleUpdateMilestoneTargetDate: (targetDate: string | null) => void;
  setActiveFolderId: (id: string | null | 'trash' | 'starred' | ((prev: string | null | 'trash' | 'starred') => string | null | 'trash' | 'starred')) => void;
  setSearchQuery: (query: string | ((prev: string) => string)) => void;
  setActiveTag: (tag: string | null | ((prev: string | null) => string | null)) => void;
}

export interface NoteContextEditorContext {
  tocPanelRef: RefObject<HTMLDivElement | null>;
  visibleToc: (TocItem & { idx: number; hasChildren: boolean })[];
  highlightedTocIdx: number | null;
  tocCollapsed: Record<number, boolean>;
  handleTocKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  toggleTocCollapse: (idx: number) => void;
  scrollToHeading: (headingIdx: number) => void;
}

export interface NoteContextDashboardContext {
  knowledgeTimeline: KnowledgeTimeline;
  timelineMode: TimelinePeriodMode;
  setTimelineMode: (mode: TimelinePeriodMode) => void;
  historyEvents: KnowledgeHistoryEvent[];
  cosmosEvolutionSummary: CosmosEvolutionSummary | null;
  cosmosEvolutionStory: ExpandedCosmosEvolutionStory | null;
  discoveryProgress: DiscoveryProgressSummary;
  knowledgeJourney: KnowledgeJourney | null;
  evolutionInsights: EvolutionInsightsSummary | null;
  bootstrapImportSummary: BootstrapImportSummary | null;
  timelineInitialArea: string | null;
  handleDismissBootstrapSummary: () => void;
  handleExportHistory: (kind: import('../features/knowledge/history').ExportKind, mode: 'copy' | 'download') => void | Promise<void>;
}

export interface NoteContextPanelBodyProps {
  colors: NoteChromeColors;
  rightPanel: KnowledgeContextTab;
  activeNote: Note | null;
  panelData: NoteContextPanelData;
  panelHandlers: NoteContextPanelHandlers;
  editorContext: NoteContextEditorContext;
  dashboardContext: NoteContextDashboardContext;
}

export function NoteContextPanelBody({
  colors: c,
  rightPanel,
  activeNote,
  panelData,
  panelHandlers,
  editorContext,
  dashboardContext,
}: NoteContextPanelBodyProps) {
  const { t } = useTranslation();
  const vaultStructureVersion = useNotesStore(s => s.vaultStructureVersion);
  const {
    pageReferences,
    noteReferenceSummary,
    linksStructureCount,
    linksConnectionsCount,
    linksSourcesCount,
    conceptHub,
    learningPath,
    notes,
    wikiTargets,
    backlinkContexts,
    mentioningNotes,
    relatedNotes,
    sourceNoteCandidates,
    noteBibliography,
    localGraphData,
    noteIntelligenceSnapshot,
    noteTierInput,
    noteHistoryContext,
    discoveryFeed,
    cosmosVaultPhase,
    projectEditorData,
    milestoneProjectTitle,
    allTags,
    activeTag,
    resolvedOutgoingRelations,
    incomingRelationDisplays,
    noteTags,
  } = panelData;

  const vaultHealth = useMemo(
    () => (rightPanel === 'stats'
      ? buildVaultHealthMetrics(useNotesStore.getState().notes, knowledgeIndexService)
      : undefined),
    [rightPanel, vaultStructureVersion],
  );
  const {
    createNote,
    noteUpdate,
    setActiveNoteId,
    openNoteById,
    navigateToWiki,
    handleLinkRelatedNote,
    handleOpenCosmosGraph,
    handleStartWikiLink,
    handleCreateRelatedNote,
    handleLinkReadingSource,
    handleUnlinkReadingSource,
    handleExpandGraphNode,
    handleCollapseGraphNode,
    setViewMode,
    openContextPanel,
    handleOpenDiscover,
    handleCosmosConnect,
    handleCosmosAssignArea,
    handleCosmosCreateHub,
    handleCosmosCreateRelation,
    handleDiscoveryCreateRelation,
    handleUpdateProjectDescription,
    handleUpdateProjectStatus,
    handleCreateProjectMilestone,
    handleUpdateMilestoneStatus,
    handleUpdateMilestoneTargetDate,
    setActiveFolderId,
    setSearchQuery,
    setActiveTag,
  } = panelHandlers;
  const {
    tocPanelRef,
    visibleToc,
    highlightedTocIdx,
    tocCollapsed,
    handleTocKeyDown,
    toggleTocCollapse,
    scrollToHeading,
  } = editorContext;
  const {
    knowledgeTimeline,
    timelineMode,
    setTimelineMode,
    historyEvents,
    cosmosEvolutionSummary,
    cosmosEvolutionStory,
    discoveryProgress,
    knowledgeJourney,
    evolutionInsights,
    bootstrapImportSummary,
    timelineInitialArea,
    handleDismissBootstrapSummary,
    handleExportHistory,
  } = dashboardContext;

  return (
    <>
      {!activeNote && NOTE_REQUIRED_CONTEXT_TABS.has(rightPanel) ? (
        <KnowledgePanelEmpty
          colors={c}
          actionLabel={t('k53ContextCreateNote')}
          onAction={() => createNote()}
        >
          {t('k43ContextPanelSelectNote')}
        </KnowledgePanelEmpty>
      ) : (
        <>
          {rightPanel === 'toc' && (
            <OutlinePanel
              colors={c}
              panelRef={tocPanelRef}
              items={visibleToc}
              highlightedIdx={highlightedTocIdx}
              collapsed={tocCollapsed}
              onKeyDown={handleTocKeyDown}
              onToggleCollapse={toggleTocCollapse}
              onNavigate={scrollToHeading}
            />
          )}

          {rightPanel === 'links' && activeNote && pageReferences && noteReferenceSummary && (
            <LinksContextPanel
              colors={c}
              structureCount={linksStructureCount}
              connectionsCount={linksConnectionsCount}
              sourcesCount={linksSourcesCount}
              structure={(
                <>
                  {conceptHub && (
                    <ConceptHubPanel
                      colors={c}
                      data={conceptHub}
                      onNavigateToNote={id => openNoteById(id, 'panel')}
                    />
                  )}
                  <ConceptRelationsPanel
                    colors={c}
                    note={activeNote}
                    notes={notes}
                    wikiTargets={wikiTargets}
                    onUpdateRelations={relations => noteUpdate(activeNote.id, { relations })}
                    onNavigateToNote={id => openNoteById(id, 'panel')}
                    onResolveTargetId={title =>
                      knowledgeIndexService.resolveNoteId(title)
                      ?? findNoteByTitle(title, notes)?.id
                    }
                  />
                  {learningPath && (
                    <LearningPathPanel
                      colors={c}
                      path={learningPath}
                      onNavigateToNote={id => openNoteById(id, 'panel')}
                    />
                  )}
                </>
              )}
              connections={(
                <>
                  <RelatedNotesPanel
                    colors={c}
                    grouped={relatedNotes}
                    onNavigateToNote={id => openNoteById(id, 'panel')}
                    onLinkToNote={handleLinkRelatedNote}
                    onOpenGraph={handleOpenCosmosGraph}
                    onLearnLinking={handleStartWikiLink}
                    onCreateRelatedNote={handleCreateRelatedNote}
                  />
                  <BacklinkPanel
                    colors={c}
                    activeNoteTitle={activeNote.title ?? ''}
                    incoming={pageReferences.incoming}
                    contexts={backlinkContexts}
                    onNavigateToNote={id => openNoteById(id, 'backlink')}
                  />
                  <ReferenceExplorerPanel
                    colors={c}
                    summary={noteReferenceSummary}
                    mentioning={mentioningNotes}
                    onNavigateToNote={id => openNoteById(id, 'panel')}
                    onNavigateToWiki={navigateToWiki}
                  />
                </>
              )}
              sources={(
                <>
                  <ReadingSourceLinkPanel
                    colors={c}
                    note={activeNote}
                    notes={notes}
                    sourceNoteCandidates={sourceNoteCandidates}
                    onNavigateToNote={id => openNoteById(id, 'panel')}
                    onLinkSource={handleLinkReadingSource}
                    onUnlinkSource={handleUnlinkReadingSource}
                  />
                  <BibliographyPanel colors={c} citations={noteBibliography} />
                </>
              )}
            />
          )}

          {rightPanel === 'links' && activeNote && (!pageReferences || !noteReferenceSummary) && (
            <KnowledgePanelEmpty
              colors={c}
              actionLabel={t('k53ContextCreateWikiLink')}
              onAction={handleStartWikiLink}
              secondaryActionLabel={t('k53ContextLinkingGuide')}
              onSecondaryAction={() => openContextPanel('links')}
            >
              {t('k52ContextLinksEmpty')}
            </KnowledgePanelEmpty>
          )}

          {rightPanel === 'graph' && !localGraphData && activeNote && (
            <KnowledgePanelEmpty
              colors={c}
              actionLabel={t('k53ContextCreateWikiLink')}
              onAction={handleStartWikiLink}
              secondaryActionLabel={t('k64OpenFullCosmos')}
              onSecondaryAction={() => setViewMode('graph')}
            >
              {t('graphNoConnectedNotes')}
            </KnowledgePanelEmpty>
          )}

          {rightPanel === 'graph' && localGraphData && (
            <>
              <div style={{ flex: 1, minHeight: 180, display: 'flex', flexDirection: 'column' }}>
                <LocalGraphView
                  colors={c}
                  graphData={localGraphData}
                  onNavigate={id => openNoteById(id, 'panel')}
                  onExpandNode={handleExpandGraphNode}
                  onCollapseNode={handleCollapseGraphNode}
                />
              </div>
              <CosmosContextFooter
                colors={c}
                onOpenFullCosmos={() => setViewMode('graph')}
              />
            </>
          )}

          {rightPanel === 'insights' && noteIntelligenceSnapshot && noteTierInput && (
            <CosmosInsightsPanel
              colors={c}
              snapshot={noteIntelligenceSnapshot}
              tierInput={noteTierInput}
              noteHistory={noteHistoryContext}
              onNavigateToNote={id => openNoteById(id, 'panel')}
              onOpenLinks={() => openContextPanel('links')}
              onOpenDiscover={handleOpenDiscover}
            />
          )}

          {rightPanel === 'insights' && activeNote && (!noteIntelligenceSnapshot || !noteTierInput) && (
            <KnowledgePanelEmpty
              colors={c}
              actionLabel={t('k53ContextOpenCosmos')}
              onAction={handleOpenCosmosGraph}
              secondaryActionLabel={t('k53ContextCreateWikiLink')}
              onSecondaryAction={handleStartWikiLink}
            >
              {t('k52ContextInsightsEmpty')}
            </KnowledgePanelEmpty>
          )}

          {rightPanel === 'actions' && activeNote && noteIntelligenceSnapshot && (
            <CosmosActionsPanel
              colors={c}
              note={activeNote}
              snapshot={noteIntelligenceSnapshot}
              notes={notes}
              service={knowledgeIndexService}
              onConnect={handleCosmosConnect}
              onViewCandidates={() => openContextPanel('links')}
              onAssignArea={handleCosmosAssignArea}
              onCreateHub={handleCosmosCreateHub}
              onCreateRelation={handleCosmosCreateRelation}
              onNavigateToNote={id => openNoteById(id, 'panel')}
              onOpenDiscover={handleOpenDiscover}
            />
          )}

          {rightPanel === 'actions' && activeNote && !noteIntelligenceSnapshot && (
            <KnowledgePanelEmpty
              colors={c}
              actionLabel={t('k52ContextOpenLinks')}
              onAction={() => openContextPanel('links')}
              secondaryActionLabel={t('k53ContextOpenDiscover')}
              onSecondaryAction={handleOpenDiscover}
            >
              {t('k52ContextActionsEmpty')}
            </KnowledgePanelEmpty>
          )}

          {rightPanel === 'discover' && (
            <DiscoveryPanel
              colors={c}
              feed={discoveryFeed}
              vaultHealth={vaultHealth}
              vaultPhase={cosmosVaultPhase}
              onNavigateToNote={id => openNoteById(id, 'discovery', [
                { type: 'key', key: 'k38DashboardTitle' },
              ])}
              onCreateRelation={handleDiscoveryCreateRelation}
              onCreateHub={handleCosmosCreateHub}
              onLearnLinking={handleStartWikiLink}
              onOpenGraph={handleOpenCosmosGraph}
            />
          )}

          {rightPanel === 'timeline' && cosmosEvolutionSummary && cosmosEvolutionStory && knowledgeJourney && evolutionInsights && (
            <TimelinePanel
              colors={c}
              timeline={knowledgeTimeline}
              mode={timelineMode}
              onModeChange={setTimelineMode}
              historyEvents={historyEvents}
              notes={notes}
              evolutionSummary={cosmosEvolutionSummary}
              evolutionStory={cosmosEvolutionStory}
              discoveryProgress={discoveryProgress}
              knowledgeJourney={knowledgeJourney}
              evolutionInsights={evolutionInsights}
              bootstrapSummary={bootstrapImportSummary}
              initialSelectedArea={timelineInitialArea}
              onDismissBootstrap={handleDismissBootstrapSummary}
              onExport={handleExportHistory}
              onNavigateToNote={id => openNoteById(id, 'timeline', [
                { type: 'key', key: 'k42PanelTimeline' },
              ])}
              onCreateNote={() => createNote()}
            />
          )}

          {rightPanel === 'properties' && activeNote && (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {projectEditorData && (
                <ProjectEditorPanel
                  colors={c}
                  data={projectEditorData}
                  onUpdateDescription={handleUpdateProjectDescription}
                  onUpdateStatus={handleUpdateProjectStatus}
                  onNavigateToNote={id => openNoteById(id, 'panel')}
                  onCreateMilestone={handleCreateProjectMilestone}
                />
              )}
              {isProjectMilestone(activeNote) && (
                <MilestoneEditorPanel
                  colors={c}
                  title={displayNoteTitle(activeNote.title)}
                  status={getMilestoneStatus(activeNote) ?? 'planned'}
                  targetDate={getMilestoneTargetDate(activeNote)}
                  projectId={getMilestoneProjectId(activeNote)}
                  projectTitle={milestoneProjectTitle}
                  onUpdateStatus={handleUpdateMilestoneStatus}
                  onUpdateTargetDate={handleUpdateMilestoneTargetDate}
                  onNavigateToProject={
                    getMilestoneProjectId(activeNote)
                      ? () => {
                        const pid = getMilestoneProjectId(activeNote)!;
                        setActiveNoteId(pid);
                      }
                      : undefined
                  }
                />
              )}
              <NotePropertiesPanel
                colors={c}
                note={activeNote}
                onUpdateProperties={properties => noteUpdate(activeNote.id, { properties })}
                activeTag={activeTag}
                onSelectTag={tag => {
                  setActiveFolderId(null);
                  setSearchQuery('');
                  setActiveTag(tag);
                }}
              />
            </div>
          )}

          {rightPanel === 'tags' && activeNote && (
            <NoteTagsPanel
              colors={c}
              note={activeNote}
              allTags={allTags}
              activeTag={activeTag}
              onUpdateTags={properties => noteUpdate(activeNote.id, { properties })}
              onSelectTag={tag => {
                setActiveFolderId(null);
                setSearchQuery('');
                setActiveTag(tag);
              }}
            />
          )}

          {rightPanel === 'relations' && activeNote && (
            <NoteRelationsPanel
              colors={c}
              note={activeNote}
              wikiTargets={wikiTargets}
              outgoing={resolvedOutgoingRelations}
              incoming={incomingRelationDisplays}
              onUpdateRelations={relations => noteUpdate(activeNote.id, { relations })}
              onNavigateToNote={id => openNoteById(id, 'relation')}
              onResolveTargetId={title =>
                knowledgeIndexService.resolveNoteId(title)
                ?? findNoteByTitle(title, notes)?.id
              }
              onStartWikiLink={handleStartWikiLink}
            />
          )}

          {rightPanel === 'stats' && activeNote && (() => {
            const body = activeNote.body;
            const words = body.trim() ? body.trim().split(/\s+/).length : 0;
            const chars = body.length;
            const lines = body.split('\n').length;
            const readMin = Math.max(1, Math.ceil(words / 200));
            const linkCount = extractLinks(body).length;
            const tagCount = noteTags.length;
            const headings = (body.match(/^#{1,3} /gm) || []).length;
            const codeBlocks = (body.match(/```/g) || []).length / 2;
            const created = Number(activeNote.id.split('-')[1] || 0);
            return (
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: c.textMuted, fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{t('nvNoteStats')}</div>
                {[
                  [t('nvStatWords'), words],
                  [t('nvStatChars'), chars],
                  [t('nvStatLines'), lines],
                  [t('nvStatReadTime'), t('nvStatReadMin').replace('{min}', String(readMin))],
                  [t('nvStatHeadings'), headings],
                  [t('nvStatWikiLinks'), linkCount],
                  [t('nvStatTags'), tagCount],
                  [t('nvStatCodeBlocks'), Math.floor(codeBlocks)],
                ].map(([label, val]) => (
                  <div key={label as string} className="bstat-row">
                    <span style={{ color: c.textMuted }}>{label}</span>
                    <span className="bstat-val">{val}</span>
                  </div>
                ))}
                {created > 0 && (
                  <div style={{ marginTop: 10, fontSize: 10, color: c.textFaint }}>
                    {t('nvCreated')} {new Date(created).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                )}
                {allTags.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, color: c.textMuted, fontWeight: 700, margin: '14px 0 8px', textTransform: 'uppercase', letterSpacing: 1 }}>{t('nvTagCloud')}</div>
                    <div className="btag-cloud" style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {allTags.slice(0, 20).map(({ tag, count }) => {
                        const maxCount = allTags[0]?.count ?? 1;
                        const size = 9 + Math.round((count / maxCount) * 8);
                        const opacity = 0.5 + (count / maxCount) * 0.5;
                        return (
                          <span key={tag}
                            style={{ fontSize: size, color: c.tagTxt, background: c.tag, padding: '2px 7px', borderRadius: 999, opacity, border: activeTag?.toLowerCase() === tag.toLowerCase() ? `1px solid ${c.tagTxt}` : '1px solid transparent' }}
                            onClick={() => { setActiveFolderId(null); setSearchQuery(''); setActiveTag(prev => prev?.toLowerCase() === tag.toLowerCase() ? null : tag); }}>
                            #{tag}
                          </span>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </>
      )}
    </>
  );
}
