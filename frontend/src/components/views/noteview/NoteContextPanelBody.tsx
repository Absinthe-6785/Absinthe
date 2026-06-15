import type { RefObject } from 'react';
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
  CosmosEvolutionStoryData,
  ExpandedCosmosEvolutionStory,
  DiscoveryProgressSummary,
  KnowledgeJourney,
  EvolutionInsightsSummary,
} from '../features/knowledge/history';
import type { BootstrapImportSummary } from '../features/knowledge/history/bootstrapSummaryStorage';
import type { EditorMode } from '../editorMode';
import { useTranslation } from '../../../lib/i18n';

const NOTE_REQUIRED_CONTEXT_TABS: ReadonlySet<KnowledgeContextTab> = new Set([
  'toc', 'links', 'graph', 'insights', 'actions', 'properties', 'tags', 'relations', 'stats',
]);

export interface NoteContextPanelBodyProps {
  colors: NoteChromeColors;
  rightPanel: KnowledgeContextTab;
  activeNote: Note | null;
  createNote: (initial?: Partial<Pick<Note, 'title' | 'body' | 'folderId'>>) => string;
  tocPanelRef: RefObject<HTMLDivElement | null>;
  visibleToc: (TocItem & { idx: number; hasChildren: boolean })[];
  highlightedTocIdx: number | null;
  tocCollapsed: Record<number, boolean>;
  handleTocKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  toggleTocCollapse: (idx: number) => void;
  scrollToHeading: (headingIdx: number) => void;
  pageReferences: ReturnType<typeof knowledgeIndexService.getPageReferences> | null;
  noteReferenceSummary: ReturnType<typeof import('../features/knowledge').extractNoteReferenceSummary> | null;
  linksStructureCount: number;
  linksConnectionsCount: number;
  linksSourcesCount: number;
  conceptHub: ReturnType<typeof import('../features/knowledge').buildConceptHub> | null;
  learningPath: ReturnType<typeof import('../features/knowledge').buildLearningPath> | null;
  notes: Note[];
  wikiTargets: string[];
  noteUpdate: (id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'folderId' | 'starred' | 'properties' | 'relations'>>) => void;
  setActiveNoteId: (id: string) => void;
  backlinkContexts: ReturnType<typeof import('../noteUtils').extractLinkContexts>;
  mentioningNotes: ReturnType<typeof knowledgeIndexService.getMentioningNotes>;
  relatedNotes: ReturnType<typeof knowledgeIndexService.getRelatedNotes>;
  navigateToWiki: (title: string, opts?: { preferReading?: boolean }) => void;
  handleLinkRelatedNote: (noteId: string, noteTitle: string) => void;
  handleOpenCosmosGraph: () => void;
  handleStartWikiLink: () => void;
  handleCreateRelatedNote: () => void;
  sourceNoteCandidates: Note[];
  handleLinkReadingSource: (sourceNoteId: string) => void;
  handleUnlinkReadingSource: () => void;
  noteBibliography: ReturnType<typeof import('../citationUtils').collectCitationsFromMarkdown>;
  localGraphData: ReturnType<typeof import('../features/knowledge').buildExpandedGraphData> | null;
  handleExpandGraphNode: (noteId: string) => void;
  handleCollapseGraphNode: (noteId: string) => void;
  setViewMode: (mode: EditorMode | ((prev: EditorMode) => EditorMode)) => void;
  noteIntelligenceSnapshot: NoteIntelligenceSnapshot | null;
  noteTierInput: KnowledgeImportanceInput | null;
  noteHistoryContext: NoteHistoryContext | null;
  openContextPanel: (tab: KnowledgeContextTab) => void;
  handleOpenDiscover: () => void;
  handleCosmosConnect: (targetTitle: string) => void;
  handleCosmosAssignArea: (areaLabel: string, areaNoteId?: string) => void;
  handleCosmosCreateHub: (areaLabel: string) => void;
  handleCosmosCreateRelation: (targetNoteId: string) => void;
  handleDiscoveryCreateRelation: (sourceNoteId: string, targetNoteId: string) => void;
  discoveryFeed: DiscoveryFeed;
  cosmosVaultPhase: CosmosVaultPhase;
  knowledgeTimeline: KnowledgeTimeline;
  timelineMode: TimelinePeriodMode;
  setTimelineMode: (mode: TimelinePeriodMode) => void;
  historyEvents: KnowledgeHistoryEvent[];
  cosmosEvolutionSummary: CosmosEvolutionSummary;
  cosmosEvolutionStory: ExpandedCosmosEvolutionStory;
  discoveryProgress: DiscoveryProgressSummary;
  knowledgeJourney: KnowledgeJourney;
  evolutionInsights: EvolutionInsightsSummary;
  bootstrapImportSummary: BootstrapImportSummary | null;
  timelineInitialArea: string | null;
  handleDismissBootstrapSummary: () => void;
  handleExportHistory: (kind: import('../features/knowledge/history').ExportKind, mode: 'copy' | 'download') => void | Promise<void>;
  projectEditorData: ReturnType<typeof import('../features/knowledge').buildProjectEditorData> | null;
  handleUpdateProjectDescription: (description: string) => void;
  handleUpdateProjectStatus: (status: 'planned' | 'active' | 'completed') => void;
  handleCreateProjectMilestone: () => void;
  milestoneProjectTitle: string;
  handleUpdateMilestoneStatus: (status: 'planned' | 'active' | 'completed') => void;
  handleUpdateMilestoneTargetDate: (targetDate: string | null) => void;
  allTags: { tag: string; count: number }[];
  activeTag: string | null;
  setActiveFolderId: (id: string | null | 'trash' | 'starred' | ((prev: string | null | 'trash' | 'starred') => string | null | 'trash' | 'starred')) => void;
  setSearchQuery: (query: string | ((prev: string) => string)) => void;
  setActiveTag: (tag: string | null | ((prev: string | null) => string | null)) => void;
  resolvedOutgoingRelations: ReturnType<typeof knowledgeIndexService.resolveRelationTargets>;
  incomingRelationDisplays: {
    edge: ReturnType<typeof knowledgeIndexService.getIncomingRelations>[number];
    sourceTitle: string;
    missing: boolean;
  }[];
  noteTags: string[];
}

export function NoteContextPanelBody(props: NoteContextPanelBodyProps) {
  const { t } = useTranslation();
  const {
    colors: c,
    rightPanel,
    activeNote,
    createNote,
    tocPanelRef,
    visibleToc,
    highlightedTocIdx,
    tocCollapsed,
    handleTocKeyDown,
    toggleTocCollapse,
    scrollToHeading,
    pageReferences,
    noteReferenceSummary,
    linksStructureCount,
    linksConnectionsCount,
    linksSourcesCount,
    conceptHub,
    learningPath,
    notes,
    wikiTargets,
    noteUpdate,
    setActiveNoteId,
    backlinkContexts,
    mentioningNotes,
    relatedNotes,
    navigateToWiki,
    handleLinkRelatedNote,
    handleOpenCosmosGraph,
    handleStartWikiLink,
    handleCreateRelatedNote,
    sourceNoteCandidates,
    handleLinkReadingSource,
    handleUnlinkReadingSource,
    noteBibliography,
    localGraphData,
    handleExpandGraphNode,
    handleCollapseGraphNode,
    setViewMode,
    noteIntelligenceSnapshot,
    noteTierInput,
    noteHistoryContext,
    openContextPanel,
    handleOpenDiscover,
    handleCosmosConnect,
    handleCosmosAssignArea,
    handleCosmosCreateHub,
    handleCosmosCreateRelation,
    handleDiscoveryCreateRelation,
    discoveryFeed,
    cosmosVaultPhase,
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
    projectEditorData,
    handleUpdateProjectDescription,
    handleUpdateProjectStatus,
    handleCreateProjectMilestone,
    milestoneProjectTitle,
    handleUpdateMilestoneStatus,
    handleUpdateMilestoneTargetDate,
    allTags,
    activeTag,
    setActiveFolderId,
    setSearchQuery,
    setActiveTag,
    resolvedOutgoingRelations,
    incomingRelationDisplays,
    noteTags,
  } = props;

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
                      onNavigateToNote={setActiveNoteId}
                    />
                  )}
                  <ConceptRelationsPanel
                    colors={c}
                    note={activeNote}
                    notes={notes}
                    wikiTargets={wikiTargets}
                    onUpdateRelations={relations => noteUpdate(activeNote.id, { relations })}
                    onNavigateToNote={setActiveNoteId}
                    onResolveTargetId={title =>
                      knowledgeIndexService.resolveNoteId(title)
                      ?? findNoteByTitle(title, notes)?.id
                    }
                  />
                  {learningPath && (
                    <LearningPathPanel
                      colors={c}
                      path={learningPath}
                      onNavigateToNote={setActiveNoteId}
                    />
                  )}
                </>
              )}
              connections={(
                <>
                  <BacklinkPanel
                    colors={c}
                    activeNoteTitle={activeNote.title ?? ''}
                    incoming={pageReferences.incoming}
                    contexts={backlinkContexts}
                    onNavigateToNote={setActiveNoteId}
                  />
                  <ReferenceExplorerPanel
                    colors={c}
                    summary={noteReferenceSummary}
                    mentioning={mentioningNotes}
                    onNavigateToNote={setActiveNoteId}
                    onNavigateToWiki={navigateToWiki}
                  />
                  <RelatedNotesPanel
                    colors={c}
                    related={relatedNotes}
                    onNavigateToNote={setActiveNoteId}
                    onLinkToNote={handleLinkRelatedNote}
                    onOpenGraph={handleOpenCosmosGraph}
                    onLearnLinking={handleStartWikiLink}
                    onCreateRelatedNote={handleCreateRelatedNote}
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
                    onNavigateToNote={setActiveNoteId}
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

          {rightPanel === 'graph' && localGraphData && (
            <>
              <div style={{ flex: 1, minHeight: 180, display: 'flex', flexDirection: 'column' }}>
                <LocalGraphView
                  colors={c}
                  graphData={localGraphData}
                  onNavigate={setActiveNoteId}
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
              onNavigateToNote={setActiveNoteId}
              onOpenLinks={() => openContextPanel('links')}
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
              onNavigateToNote={setActiveNoteId}
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
              vaultPhase={cosmosVaultPhase}
              onNavigateToNote={setActiveNoteId}
              onCreateRelation={handleDiscoveryCreateRelation}
              onCreateHub={handleCosmosCreateHub}
              onLearnLinking={handleStartWikiLink}
              onOpenGraph={handleOpenCosmosGraph}
            />
          )}

          {rightPanel === 'timeline' && (
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
              onNavigateToNote={setActiveNoteId}
              onCreateNote={() => createNote()}
            />
          )}

          {rightPanel === 'properties' && activeNote && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {projectEditorData && (
                <ProjectEditorPanel
                  colors={c}
                  data={projectEditorData}
                  onUpdateDescription={handleUpdateProjectDescription}
                  onUpdateStatus={handleUpdateProjectStatus}
                  onNavigateToNote={setActiveNoteId}
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
              onNavigateToNote={setActiveNoteId}
              onResolveTargetId={title =>
                knowledgeIndexService.resolveNoteId(title)
                ?? findNoteByTitle(title, notes)?.id
              }
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
