import { useMemo, useCallback, type RefObject } from 'react';
import type { NoteBase as Note } from '../noteUtils';
import type { EditorMode } from '../editorMode';
import type { KnowledgeContextTab } from '../features/knowledge/components/KnowledgeContextPanel';
import type { BlockEditorHandle } from '../BlockEditor';
import {
  knowledgeIndexService,
  buildNoteIntelligenceSnapshot,
  buildImportanceInputForNote,
  buildCosmosVaultAnalysis,
  addRelationTarget,
  buildAreaAssignmentPatch,
  buildConnectPatch,
  buildHubNoteTemplate,
  applyAreaToNote,
} from '../features/knowledge';
import { getNoteHistoryContext, recordDiscoveryResolved } from '../features/knowledge/history';
import { buildNoteGalaxyMap } from '../features/knowledge/graph/knowledgeUniverse/galaxyClustering';

export function useNoteViewPanels(params: {
  notes: Note[];
  activeNote: Note | null;
  historyEvents: ReturnType<typeof import('../features/knowledge/history').loadKnowledgeHistoryEvents>;
  noteUpdate: (id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'folderId' | 'starred' | 'properties' | 'relations'>>) => void;
  createNote: (initial?: Partial<Pick<Note, 'title' | 'body' | 'folderId'>>) => string;
  setActiveNoteId: (id: string) => void;
  setViewMode: (mode: EditorMode) => void;
  setShowRightPanel: (show: boolean) => void;
  setRightPanel: (tab: KnowledgeContextTab) => void;
  setTimelineInitialArea: (area: string | null) => void;
  blockEditorRef: RefObject<BlockEditorHandle | null>;
}) {
  const {
    notes,
    activeNote,
    historyEvents,
    noteUpdate,
    createNote,
    setActiveNoteId,
    setViewMode,
    setShowRightPanel,
    setRightPanel,
    setTimelineInitialArea,
    blockEditorRef,
  } = params;

  const openContextPanel = useCallback((tab: KnowledgeContextTab) => {
    setShowRightPanel(true);
    setRightPanel(tab);
  }, [setShowRightPanel, setRightPanel]);

  const noteIntelligenceSnapshot = useMemo(
    () => (activeNote ? buildNoteIntelligenceSnapshot(activeNote, notes, knowledgeIndexService) : null),
    [activeNote, notes],
  );

  const noteHistoryContext = useMemo(
    () => (activeNote ? getNoteHistoryContext(activeNote.id, 30, Date.now(), historyEvents) : null),
    [activeNote, historyEvents],
  );

  const noteTierInput = useMemo(() => {
    if (!activeNote) return null;
    const galaxyMap = buildNoteGalaxyMap(notes, knowledgeIndexService);
    return buildImportanceInputForNote(activeNote, knowledgeIndexService, galaxyMap.get(activeNote.id));
  }, [activeNote, notes]);

  const handleLearnLinking = useCallback(() => {
    const target = activeNote ?? notes.find(n => !n.deletedAt);
    if (target) {
      setActiveNoteId(target.id);
      setViewMode('edit');
      setShowRightPanel(true);
      setRightPanel('links');
      return;
    }
    createNote();
  }, [activeNote, notes, createNote, setActiveNoteId, setViewMode, setShowRightPanel, setRightPanel]);

  const handleStartWikiLink = useCallback(() => {
    const target = activeNote ?? notes.find(n => !n.deletedAt);
    if (target) {
      setActiveNoteId(target.id);
      setViewMode('edit');
      setShowRightPanel(true);
      setRightPanel('links');
      setTimeout(() => blockEditorRef.current?.insertWikiLinkDraft(), 80);
      return;
    }
    const id = createNote({ body: '' });
    setTimeout(() => blockEditorRef.current?.insertWikiLinkDraft(), 120);
    return id;
  }, [activeNote, notes, createNote, setActiveNoteId, setViewMode, setShowRightPanel, setRightPanel, blockEditorRef]);

  const handleCreateRelatedNote = useCallback(() => {
    createNote({ title: '', body: '' });
  }, [createNote]);

  const handleOpenDiscover = useCallback(() => {
    const target = activeNote ?? notes.find(n => !n.deletedAt);
    if (target) setActiveNoteId(target.id);
    setViewMode('edit');
    setShowRightPanel(true);
    setRightPanel('discover');
  }, [activeNote, notes, setActiveNoteId, setViewMode, setShowRightPanel, setRightPanel]);

  const handleOpenCosmosGraph = useCallback(() => {
    const target = activeNote ?? notes.find(n => !n.deletedAt);
    if (target) setActiveNoteId(target.id);
    setViewMode('edit');
    setShowRightPanel(true);
    setRightPanel('graph');
  }, [activeNote, notes, setActiveNoteId, setViewMode, setShowRightPanel, setRightPanel]);

  const handleOpenTimeline = useCallback(() => {
    setTimelineInitialArea(null);
    const target = activeNote ?? notes.find(n => !n.deletedAt);
    if (target) setActiveNoteId(target.id);
    setViewMode('edit');
    setShowRightPanel(true);
    setRightPanel('timeline');
  }, [activeNote, notes, setActiveNoteId, setViewMode, setShowRightPanel, setRightPanel, setTimelineInitialArea]);

  const handleOpenEvolution = useCallback(() => {
    setTimelineInitialArea(null);
    handleOpenTimeline();
  }, [handleOpenTimeline, setTimelineInitialArea]);

  const handleNavigateToArea = useCallback((areaLabel: string) => {
    setTimelineInitialArea(areaLabel);
    const target = activeNote ?? notes.find(n => !n.deletedAt);
    if (target) setActiveNoteId(target.id);
    setViewMode('edit');
    setShowRightPanel(true);
    setRightPanel('timeline');
  }, [activeNote, notes, setActiveNoteId, setViewMode, setShowRightPanel, setRightPanel, setTimelineInitialArea]);

  const handleDiscoveryCreateRelation = useCallback((sourceNoteId: string, targetNoteId: string) => {
    const source = notes.find(n => n.id === sourceNoteId);
    if (!source) return;
    const updated = addRelationTarget(source, 'related-to', targetNoteId);
    noteUpdate(sourceNoteId, { relations: updated.relations });
    recordDiscoveryResolved(sourceNoteId, { action: 'create-relation' }, targetNoteId);
    setActiveNoteId(sourceNoteId);
    setViewMode('edit');
    setShowRightPanel(true);
    setRightPanel('discover');
  }, [notes, noteUpdate, setActiveNoteId, setViewMode, setShowRightPanel, setRightPanel]);

  const handleCosmosConnect = useCallback((targetTitle: string) => {
    if (!activeNote) return;
    noteUpdate(activeNote.id, buildConnectPatch(activeNote, targetTitle));
    recordDiscoveryResolved(activeNote.id, { action: 'connect', targetTitle });
  }, [activeNote, noteUpdate]);

  const handleCosmosAssignArea = useCallback((areaLabel: string, areaNoteId?: string) => {
    if (!activeNote) return;
    const areaNote = areaNoteId
      ? notes.find(n => n.id === areaNoteId)
      : notes.find(n => (n.title ?? '').trim() === areaLabel.trim());
    const linkTitle = areaNote?.title?.trim() || areaLabel;
    noteUpdate(activeNote.id, buildAreaAssignmentPatch(activeNote, areaLabel, linkTitle));
    recordDiscoveryResolved(activeNote.id, { action: 'assign-area', areaLabel }, areaNoteId);
  }, [activeNote, notes, noteUpdate]);

  const handleCosmosCreateHub = useCallback((areaLabel: string) => {
    const template = buildHubNoteTemplate(areaLabel);
    const id = createNote({ title: template.title, body: template.body });
    noteUpdate(id, { properties: applyAreaToNote({ id, title: template.title } as Note).properties });
    recordDiscoveryResolved(id, { action: 'create-hub', areaLabel });
    setActiveNoteId(id);
    openContextPanel('actions');
  }, [createNote, noteUpdate, setActiveNoteId, openContextPanel]);

  const handleCosmosCreateRelation = useCallback((targetNoteId: string) => {
    if (!activeNote) return;
    const updated = addRelationTarget(activeNote, 'related-to', targetNoteId);
    noteUpdate(activeNote.id, { relations: updated.relations });
    recordDiscoveryResolved(activeNote.id, { action: 'create-relation' }, targetNoteId);
  }, [activeNote, noteUpdate]);

  const handleLinkRelatedNote = useCallback((_noteId: string, noteTitle: string) => {
    if (!activeNote) return;
    noteUpdate(activeNote.id, buildConnectPatch(activeNote, noteTitle));
  }, [activeNote, noteUpdate]);

  const handleHudReviewWeakAreas = useCallback(() => {
    const analysis = buildCosmosVaultAnalysis(notes, knowledgeIndexService);
    const weak = analysis.areaHealthRows
      .filter(row => row.category === 'fragmented' || row.category === 'critical')
      .sort((a, b) => a.score - b.score)[0];
    if (!weak) return;
    const galaxyMap = buildNoteGalaxyMap(notes, knowledgeIndexService);
    const member = notes.find(
      n => !n.deletedAt && galaxyMap.get(n.id)?.galaxyId === weak.galaxyId && n.id !== weak.galaxyId,
    );
    if (member) {
      setActiveNoteId(member.id);
      setViewMode('edit');
      setShowRightPanel(true);
      setRightPanel('actions');
    }
  }, [notes, setActiveNoteId, setViewMode, setShowRightPanel, setRightPanel]);

  return {
    openContextPanel,
    noteIntelligenceSnapshot,
    noteHistoryContext,
    noteTierInput,
    handleLearnLinking,
    handleStartWikiLink,
    handleCreateRelatedNote,
    handleOpenDiscover,
    handleOpenCosmosGraph,
    handleOpenTimeline,
    handleOpenEvolution,
    handleNavigateToArea,
    handleDiscoveryCreateRelation,
    handleCosmosConnect,
    handleCosmosAssignArea,
    handleCosmosCreateHub,
    handleCosmosCreateRelation,
    handleLinkRelatedNote,
    handleHudReviewWeakAreas,
  };
}
