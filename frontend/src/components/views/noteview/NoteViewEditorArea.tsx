import { forwardRef, useImperativeHandle, useEffect, useMemo, useRef, useCallback, type RefObject, type MutableRefObject, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useNoteReturnTab } from '../../../hooks/useNoteReturnTab';
import { useNoteBreadcrumb } from '../../../hooks/useNoteBreadcrumb';
import { setNoteBreadcrumb } from '../../../lib/noteNavigation';
import { NoteBreadcrumbBar } from './NoteBreadcrumbBar';
import { WorkspaceContextBanner } from './WorkspaceContextBanner';
import { displayNoteTitle } from '../noteDisplayTitle';
import {
  Type, Eye, Orbit, Plus, Search,
  AlertTriangle, Save, GitFork, Upload,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Image as ImageIcon, FileText,
} from 'lucide-react';
import type { EditorSearchScope } from '../editorSearch';
import { collectEditorSearchMatches } from '../editorSearch';
import { shouldSuppressEditorKeyboardShortcuts } from '../searchFocusIsolation';
import {
  BlockEditor,
  useBlockEditor,
  type BlockEditorColors,
  type BlockEditorHandle,
} from '../BlockEditor';
import {
  EDITOR_TOOLBAR_GAP,
  METADATA_CHIP_HEIGHT,
} from './metadataChipStyles';
import {
  NOTE_FONT_OPTIONS,
  NOTE_DOCUMENT_MAX_WIDTH,
  NOTE_RADIUS_CARD,
  type NoteChromeColors,
} from '../noteEditorTheme';
import { type EditorMode, toggleEditReading } from '../editorMode';
import { scheduleEditorFocus } from './editorFocus';
import type { VirtualScrollApiRef } from '../features/block-editor/performance';
import {
  setNoteKind,
  setWeakTopic,
  isWeakTopic,
  isEventNote,
  isMilestoneNote,
  isAreaNote,
  canMarkAsArea,
  NoteClassificationSelector,
  LiteratureWorkflowIndicator,
  WeakTopicToggle,
  type NoteKind,
} from '../features/knowledge';
import type { NoteBase as Note, NoteFolderBase as NoteFolder } from '../noteUtils';
import { NoteEditorHeaderActions } from './NoteEditorHeaderActions';
import { FindInNotePanel } from './FindInNotePanel';
import { ProductEmptyState } from '../../common/ProductEmptyState';
import { TagChip, TagChipRow } from '../features/knowledge/components/TagChip';
import { NoteContextStrip } from '../features/knowledge/components/NoteContextStrip';
import type { KnowledgeContextTab } from '../features/knowledge/components/KnowledgeContextPanel';
import type { AppSettings } from '../../../types';
import { K123_EDITOR_SHELL_MAX_PX } from '../../../lib/k123EditorLayout';
import { UI_INTERACTION } from '../../../lib/uiInteractionTokens';
import { useTranslation } from '../../../lib/i18n';
import { NoteGraphViewLazy } from './NoteGraphViewLazy';
import type { KnowledgeTimeline } from '../features/knowledge/timeline';
import type { DiscoveryFeed } from '../features/knowledge/discovery';
import type { ReviewQueueEntry } from '../features/knowledge/review/reviewQueue';
import type { FocusPreset } from '../features/knowledge/workspace/focusModeModels';
import type { GraphNodeTier } from '../features/knowledge/graph/knowledgeUniverse/graphNodeTier';

interface NoteBlockEditorProps {
  body: string;
  onBodyChange: (md: string) => void;
  colors: BlockEditorColors;
  readOnly: boolean;
  searchQuery: string;
  searchScope: EditorSearchScope;
  searchMatchIndex: number;
  wikiTargets: string[];
  onWikiNavigate?: (title: string) => void;
  virtualScrollApiRef?: VirtualScrollApiRef;
  virtualScrollParentRef?: RefObject<HTMLElement | null>;
}

const NoteBlockEditor = forwardRef<BlockEditorHandle, NoteBlockEditorProps>(function NoteBlockEditor(
  {
    body, onBodyChange, colors, readOnly, searchQuery, searchScope, searchMatchIndex,
    wikiTargets, onWikiNavigate, virtualScrollApiRef, virtualScrollParentRef,
  },
  ref,
) {
  const {
    blocks, handleBlockChange, undo, redo, canUndo, canRedo,
    insertImage, insertEmptyImageBlock, insertWikiLinkDraft,
    setActiveBlockId, externalFocusId, externalFocusOffset, clearExternalFocus,
    getBlocks, copyDocument, focusEditor,
  } = useBlockEditor(body, onBodyChange);

  useImperativeHandle(ref, () => ({
    insertImage,
    insertEmptyImageBlock,
    insertWikiLinkDraft,
    getBlocks,
    copyDocument,
    undo,
    redo,
    canUndo,
    canRedo,
    focusEditor,
  }), [insertImage, insertEmptyImageBlock, insertWikiLinkDraft, getBlocks, copyDocument, undo, redo, canUndo, canRedo, focusEditor]);

  useEffect(() => {
    if (readOnly) return;
    const handler = (e: KeyboardEvent) => {
      if (shouldSuppressEditorKeyboardShortcuts()) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey)              { e.preventDefault(); e.stopImmediatePropagation(); undo(); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); e.stopImmediatePropagation(); redo(); }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [undo, redo, readOnly]);

  return (
    <BlockEditor
      blocks={blocks}
      onChange={handleBlockChange}
      colors={colors}
      readOnly={readOnly}
      searchQuery={searchQuery}
      searchScope={searchScope}
      searchMatchIndex={searchMatchIndex}
      wikiTargets={wikiTargets}
      onWikiNavigate={onWikiNavigate}
      onActiveBlockChange={setActiveBlockId}
      externalFocusId={externalFocusId}
      externalFocusOffset={externalFocusOffset}
      onExternalFocusConsumed={clearExternalFocus}
      virtualScrollApiRef={virtualScrollApiRef}
      virtualScrollParentRef={virtualScrollParentRef}
    />
  );
});

export interface NoteViewEditorLayout {
  hideEditorArea: boolean;
  isMobile: boolean;
  isCompactChrome: boolean;
  isFocusPresetActive: boolean;
  isTrash: boolean;
  showRightPanel: boolean;
  viewMode: EditorMode;
  showAppearance: boolean;
  isDragOver: boolean;
  headerTagsExpanded: boolean;
  docCopied: boolean;
  dark: boolean;
  isEmptyVault: boolean;
}

export interface NoteViewEditorData {
  c: NoteChromeColors;
  activeNote: Note | null;
  activeNoteId: string | null;
  notes: Note[];
  folders: NoteFolder[];
  titleDraft: string;
  activeNoteKind: NoteKind | null;
  noteTags: string[];
  syncError: string | null;
  isSyncing: boolean;
  savedAt: Date | null;
  viewModes: ReadonlyArray<{ key: 'reading' | 'graph'; icon: React.ReactNode; label: string }>;
  noteAreaProperty: string | undefined;
  noteLinkedProjectTitle: string;
  noteLinkedProjectId: string | null;
  noteLearningPathLabel: string | null;
  noteContextReviewEntry: ReviewQueueEntry | null;
  noteConnectionCount: number;
  noteCosmosTier: GraphNodeTier;
  activeTag: string | null;
  searchQuery: string;
  searchScope: EditorSearchScope;
  searchMatchIdx: number;
  editorSearchQuery: string;
  blockColors: BlockEditorColors;
  wikiTargets: string[];
  appSettings: AppSettings;
  knowledgeTimeline: KnowledgeTimeline;
  activeFocusPreset: FocusPreset | undefined;
  discoveryFeed: DiscoveryFeed;
  documentSearchOpen: boolean;
}

export interface NoteViewEditorHandlers {
  titleInputRef: RefObject<HTMLInputElement | null>;
  titleComposingRef: MutableRefObject<boolean>;
  blockEditorRef: RefObject<BlockEditorHandle | null>;
  editorScrollRef: RefObject<HTMLDivElement | null>;
  virtualScrollApiRef: VirtualScrollApiRef;
  searchInputRef: RefObject<HTMLInputElement | null>;
  importInputRef: RefObject<HTMLInputElement | null>;
  setMobileShowEditor: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveNoteId: (id: string | null) => void;
  handleExitFocusPreset: () => void;
  handleTitleChange: (value: string) => void;
  handleTitleCompositionEnd: (value: string) => void;
  noteUpdate: (id: string, patch: Partial<Note>) => void;
  retrySync: () => void;
  setViewMode: React.Dispatch<React.SetStateAction<EditorMode>>;
  openEditEventDialog: (note: Note) => void;
  openMilestoneDialog: (note: Note) => void;
  handleToggleAreaNote: () => void;
  toggleStar: (id: string) => void;
  duplicateNote: (note: Note) => void;
  setShowRightPanel: React.Dispatch<React.SetStateAction<boolean>>;
  handleCopyDocument: () => void | Promise<void>;
  exportNote: (note: Note) => void;
  restoreNote: (id: string) => void;
  moveNoteToTrash: (id: string) => void;
  onPermanentDelete?: () => void;
  setActiveFolderId: React.Dispatch<React.SetStateAction<string | null | 'trash' | 'starred'>>;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setActiveTag: React.Dispatch<React.SetStateAction<string | null>>;
  setHeaderTagsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  openContextPanel: (tab: KnowledgeContextTab) => void;
  setRightPanel: React.Dispatch<React.SetStateAction<KnowledgeContextTab>>;
  handlePromoteNoteKind: () => void;
  handleLearnLinking: () => void;
  handleHudReviewWeakAreas: () => void;
  handleOpenDiscover: () => void;
  handleOpenTimeline: () => void;
  createNote: (initial?: Partial<Pick<Note, 'title' | 'body' | 'folderId'>>) => string;
  setSearchScope: React.Dispatch<React.SetStateAction<EditorSearchScope>>;
  setSearchMatchIdx: React.Dispatch<React.SetStateAction<number>>;
  setDocumentSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  insertEmptyImageBlockAtCursor: () => void;
  setShowAppearance: React.Dispatch<React.SetStateAction<boolean>>;
  setShowShortcuts?: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenSettings?: () => void;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  setIsDragOver: React.Dispatch<React.SetStateAction<boolean>>;
  insertImageAtCursor: (alt: string, src: string) => void;
  handleEditorDrop: React.DragEventHandler<HTMLDivElement>;
  handleReadingModeClick: React.MouseEventHandler<HTMLDivElement>;
  handleActiveBodyChange: (md: string) => void;
  navigateToWiki: (title: string, options?: { preferReading?: boolean }) => void;
  canBackNote: boolean;
  canForwardNote: boolean;
  goBackNote: () => void;
  goForwardNote: () => void;
  openNoteById: (id: string, source?: import('../../../lib/noteNavigationStack').NoteNavigationSource, breadcrumb?: import('../../../lib/noteBreadcrumb').NoteBreadcrumbSegment[]) => void;
  onOpenTodaysNote?: () => void;
  onImportVault?: () => void;
}

export interface NoteViewEditorAreaProps {
  layout: NoteViewEditorLayout;
  data: NoteViewEditorData;
  handlers: NoteViewEditorHandlers;
}

export function NoteViewEditorArea({ layout, data, handlers }: NoteViewEditorAreaProps) {
  const { t } = useTranslation();
  const {
    hideEditorArea, isMobile, isCompactChrome, isFocusPresetActive, isTrash, showRightPanel,
    viewMode, showAppearance, isDragOver, headerTagsExpanded, docCopied, dark, isEmptyVault,
  } = layout;
  const {
    c, activeNote, activeNoteId, notes, folders, titleDraft, activeNoteKind, noteTags,
    syncError, isSyncing, savedAt, viewModes: VIEW_MODES, noteAreaProperty, noteLinkedProjectTitle,
    noteLinkedProjectId, noteLearningPathLabel, noteContextReviewEntry, noteConnectionCount,
    noteCosmosTier, activeTag, searchQuery, searchScope, searchMatchIdx, editorSearchQuery,
    blockColors, wikiTargets, appSettings, knowledgeTimeline, activeFocusPreset, discoveryFeed,
    documentSearchOpen,
  } = data;
  const {
    titleInputRef, titleComposingRef, blockEditorRef, editorScrollRef, virtualScrollApiRef,
    searchInputRef, importInputRef, setMobileShowEditor, setActiveNoteId, handleExitFocusPreset,
    handleTitleChange, handleTitleCompositionEnd, noteUpdate, retrySync, setViewMode,
    openEditEventDialog, openMilestoneDialog, handleToggleAreaNote, toggleStar, duplicateNote,
    setShowRightPanel, handleCopyDocument, exportNote, restoreNote, moveNoteToTrash, onPermanentDelete,
    setActiveFolderId, setSearchQuery, setActiveTag, setHeaderTagsExpanded, openContextPanel,
    setRightPanel, handlePromoteNoteKind, handleLearnLinking, handleHudReviewWeakAreas,
    handleOpenDiscover, handleOpenTimeline, createNote, setSearchScope, setSearchMatchIdx, setDocumentSearchOpen,
    insertEmptyImageBlockAtCursor, setShowAppearance, setShowShortcuts, onOpenSettings, updateSetting, setIsDragOver,
    insertImageAtCursor, handleEditorDrop, handleReadingModeClick, handleActiveBodyChange,
    navigateToWiki, canBackNote, canForwardNote, goBackNote, goForwardNote, openNoteById,
    onOpenTodaysNote, onImportVault,
  } = handlers;

  const showFindInNotePanel = documentSearchOpen && Boolean(activeNote) && !isTrash;
  const showNotesTopBar = !isTrash && !activeNote && !isEmptyVault;

  const editorFocusBeforeSearchRef = useRef<HTMLElement | null>(null);

  const closeDocumentSearch = useCallback(() => {
    setDocumentSearchOpen(false);
    setSearchQuery('');
    setSearchMatchIdx(0);
    const prev = editorFocusBeforeSearchRef.current;
    if (prev?.isConnected) prev.focus();
    else scheduleEditorFocus(blockEditorRef);
    editorFocusBeforeSearchRef.current = null;
  }, [blockEditorRef, setDocumentSearchOpen, setSearchMatchIdx, setSearchQuery]);

  const openDocumentSearch = useCallback(() => {
    editorFocusBeforeSearchRef.current = document.activeElement as HTMLElement;
    setDocumentSearchOpen(true);
    setSearchScope('document');
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [searchInputRef, setDocumentSearchOpen, setSearchScope]);

  const documentSearchMatchCount = useMemo(() => {
    const blocks = blockEditorRef.current?.getBlocks?.();
    if (!blocks || !editorSearchQuery.trim()) return 0;
    return collectEditorSearchMatches(blocks, editorSearchQuery).length;
  }, [blockEditorRef, editorSearchQuery, searchMatchIdx, activeNote?.body, activeNoteId]);

  const { returnTab, goReturn } = useNoteReturnTab();
  const breadcrumb = useNoteBreadcrumb();
  const returnLabel = returnTab === 'planner'
    ? t('nvReturnToSchedule')
    : returnTab === 'health'
      ? t('nvReturnToHealth')
      : returnTab === 'analytics'
        ? t('nvReturnToArchive')
        : null;

  const handleMobileBack = () => {
    if (canBackNote) goBackNote();
    else if (returnTab) goReturn();
    else setMobileShowEditor(false);
  };

  const handleNewNote = () => {
    createNote();
    if (isMobile) setMobileShowEditor(true);
  };

  const handleDocumentSearchKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      if (searchQuery.trim()) {
        setSearchQuery('');
        setSearchMatchIdx(0);
      } else {
        closeDocumentSearch();
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) setSearchMatchIdx(i => Math.max(0, i - 1));
      else setSearchMatchIdx(i => i + 1);
    }
  };

  const handleCosmosSelect = (id: string) => {
    setNoteBreadcrumb([
      { type: 'key', key: 'graphModeCosmos' },
    ]);
    openNoteById(id, 'cosmos');
    setViewMode('edit');
    scheduleEditorFocus(blockEditorRef);
  };

  return (
    <main id="noteview-main" tabIndex={-1} aria-label={t('nvEditorMain')} style={{ flex: 1, display: hideEditorArea ? 'none' : 'flex', flexDirection: 'column', minWidth: 0, background: c.editor }}>
      {showNotesTopBar ? (
        <div
          data-k117-note-top-actions
          data-k121-notes-header-action-row
          data-k122-notes-header
          data-k125a-notes-top-bar
          className="bsticky-header k125a-notes-top-bar"
        >
          <button
            type="button"
            onClick={handleNewNote}
            title={t('nvNewNoteBtn')}
            data-k117-new-note-btn
            data-noteview-new-note-btn
            data-k121-notes-new
            className="btbtn k125a-notes-new-btn"
          >
            <Plus size={14} />
            {!isMobile ? t('nvNewNoteBtn') : null}
          </button>
        </div>
      ) : null}
      {activeNote ? (
        <>
          {/* Note Header — title */}
          <div
            data-note-header-title-row
            className="k125a-notes-header-band k125a-notes-header-band--title"
            style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: isMobile ? 'wrap' : 'nowrap' }}
          >
            {isMobile ? (
              <>
                <button type="button" className="btbtn min-h-[44px] min-w-[44px]" onClick={handleMobileBack}
                  style={{ padding: '2px 4px', color: c.textMuted }} title={canBackNote ? t('nvBackToPreviousNote') : t('nvBackToNotes')}>
                  <ChevronLeft size={14}/>
                </button>
                {canForwardNote && (
                  <button type="button" className="btbtn min-h-[44px] min-w-[44px]" onClick={goForwardNote}
                    title={t('nvForwardNote')} aria-label={t('nvForwardNote')}
                    style={{ padding: '2px 4px', color: c.textMuted }}>
                    <ChevronRight size={14}/>
                  </button>
                )}
              </>
            ) : (canBackNote || canForwardNote) ? (
              <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <button type="button" className="btbtn" disabled={!canBackNote}
                  onClick={goBackNote} title={t('nvBackToPreviousNote')} aria-label={t('nvBackToPreviousNote')}
                  style={{ padding: '2px 4px', color: canBackNote ? c.textMuted : c.textFaint, opacity: canBackNote ? 1 : 0.4 }}>
                  <ChevronLeft size={14}/>
                </button>
                <button type="button" className="btbtn" disabled={!canForwardNote}
                  onClick={goForwardNote} title={t('nvForwardNote')} aria-label={t('nvForwardNote')}
                  style={{ padding: '2px 4px', color: canForwardNote ? c.textMuted : c.textFaint, opacity: canForwardNote ? 1 : 0.4 }}>
                  <ChevronRight size={14}/>
                </button>
              </div>
            ) : null}
            {returnLabel && (
              <button
                type="button"
                className="btbtn"
                onClick={goReturn}
                title={returnLabel}
                style={{ fontSize: 10, color: c.accent, whiteSpace: 'nowrap', minHeight: isMobile ? 44 : undefined }}
              >
                ← {returnLabel}
              </button>
            )}
            {isFocusPresetActive && activeFocusPreset && (
              <button
                type="button"
                className="btbtn"
                onClick={handleExitFocusPreset}
                style={{ fontSize: 10, color: c.accent, whiteSpace: 'nowrap' }}
                title={t('nvExitFocus')}
              >
                {t('nvExitFocus')}
              </button>
            )}
            <input ref={titleInputRef} value={titleDraft} readOnly={isTrash}
              onChange={e => handleTitleChange(e.target.value)}
              onCompositionStart={() => { titleComposingRef.current = true; }}
              onCompositionEnd={e => handleTitleCompositionEnd(e.currentTarget.value)}
              style={{ flex: '1 1 120px', minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: c.text, fontSize: isMobile ? 16 : 15, fontWeight: 700 }}
              placeholder={t('title')}/>
            {!isTrash && !isMobile && !isCompactChrome && (
              <select value={activeNote.folderId ?? ''} onChange={e => noteUpdate(activeNote.id, { folderId: e.target.value || null })}
                style={{ background: c.input, border: `1px solid ${c.inputBdr}`, color: c.textMuted, borderRadius: 5, padding: '3px 6px', fontSize: 10, outline: 'none', cursor: 'pointer', flexShrink: 0, maxWidth: 120 }}>
                <option value="">{t('nvNoFolder')}</option>
                {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            )}
            {/* Cloud sync status — decorative saved-at clock removed K-108A */}
            {!isTrash && (
              syncError ? (
                <button type="button" onClick={retrySync} className="btbtn" title={t('nvRetrySync')}
                  style={{ fontSize: 9, color: c.danger, display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px' }}>
                  <AlertTriangle size={10}/> {syncError}
                </button>
              ) : isSyncing ? (
                <span style={{ fontSize: 9, color: c.textMuted, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.textMuted, opacity: 0.6, animation: 'pulse 1s infinite' }}/>
                  {t('nvSyncing')}
                </span>
              ) : null
            )}
          </div>
          {/* Status cluster */}
          {!isTrash && activeNote && (
            <div
              data-note-header-metadata-row
              className="k125a-notes-header-band k125a-notes-header-band--title"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
              }}
            >
              {!isCompactChrome && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  flexShrink: 0,
                  padding: '1px 3px',
                  borderRadius: 6,
                  border: `1px solid ${c.inputBdr}`,
                  background: c.input,
                }}
                data-note-header-classification-group
              >
                <NoteClassificationSelector
                  colors={c}
                  value={activeNoteKind}
                  onChange={kind => {
                    const updated = setNoteKind(activeNote, kind);
                    noteUpdate(activeNote.id, { properties: updated.properties });
                  }}
                />
                <WeakTopicToggle
                  colors={c}
                  active={isWeakTopic(activeNote)}
                  onChange={weak => {
                    const updated = setWeakTopic(activeNote, weak);
                    noteUpdate(activeNote.id, { properties: updated.properties });
                  }}
                />
              </div>
              )}
              <NoteContextStrip
                colors={c}
                note={activeNote}
                isArea={isAreaNote(activeNote)}
                areaTitle={noteAreaProperty || undefined}
                projectTitle={noteLinkedProjectTitle || undefined}
                projectId={noteLinkedProjectId}
                learningPathLabel={noteLearningPathLabel}
                reviewReason={noteContextReviewEntry?.reason ?? null}
                connectionCount={noteConnectionCount}
                tier={noteCosmosTier}
                isWeakTopic={isCompactChrome ? isWeakTopic(activeNote) : false}
                onNavigateToNote={setActiveNoteId}
                onOpenLinks={() => openContextPanel('links')}
                onOpenCosmos={() => {
                  setShowRightPanel(true);
                  setRightPanel('graph');
                }}
              />
            </div>
          )}
          {/* Actions toolbar */}
          <div
            data-note-header-actions-row
            data-k125a-notes-workspace-header
            className="k125a-notes-header-band k125a-notes-header-band--toolbar"
          >
            <NoteEditorHeaderActions
              colors={c}
              isTrash={isTrash}
              isMobile={isMobile}
              showRightPanel={showRightPanel}
              viewMode={viewMode}
              viewModeButtons={VIEW_MODES}
              starred={!!activeNote.starred}
              docCopied={docCopied}
              isEvent={isEventNote(activeNote)}
              isMilestone={isMilestoneNote(activeNote)}
              isArea={isAreaNote(activeNote)}
              canMarkArea={canMarkAsArea(activeNote)}
              onViewModeToggle={key => {
                if (key === 'reading') {
                  setViewMode(v => {
                    const next = toggleEditReading(v);
                    if (next === 'edit' && v === 'reading') scheduleEditorFocus(blockEditorRef);
                    return next;
                  });
                } else {
                  setViewMode(v => {
                    const next = v === 'graph' ? 'edit' : 'graph';
                    if (next === 'edit') scheduleEditorFocus(blockEditorRef);
                    return next;
                  });
                }
              }}
              onOpenDocumentSearch={openDocumentSearch}
              onMarkEvent={() => openEditEventDialog(activeNote)}
              onMarkMilestone={() => openMilestoneDialog(activeNote)}
              onToggleArea={handleToggleAreaNote}
              isWeakTopic={isWeakTopic(activeNote)}
              onToggleWeakTopic={() => {
                const updated = setWeakTopic(activeNote, !isWeakTopic(activeNote));
                noteUpdate(activeNote.id, { properties: updated.properties });
              }}
              onToggleStar={() => toggleStar(activeNote.id)}
              onDuplicate={() => duplicateNote(activeNote)}
              onTogglePanel={() => {
                setShowRightPanel(v => {
                  const opening = !v;
                  if (opening && noteConnectionCount > 0) setRightPanel('links');
                  return opening;
                });
              }}
              onCopyDocument={() => void handleCopyDocument()}
              onExport={() => exportNote(activeNote)}
              onRestore={() => restoreNote(activeNote.id)}
              onPermanentDelete={onPermanentDelete}
              onOpenSettings={onOpenSettings}
              onOpenAppearance={() => setShowAppearance(true)}
              onOpenHelp={setShowShortcuts ? () => setShowShortcuts(true) : undefined}
              onTrash={() => moveNoteToTrash(activeNote.id)}
              onNewNote={handleNewNote}
            />
          </div>
          <NoteBreadcrumbBar
            colors={c}
            segments={breadcrumb}
            noteTitle={breadcrumb.length > 0 ? displayNoteTitle(activeNote.title) : undefined}
          />
          <WorkspaceContextBanner
            colors={c}
            note={activeNote}
            hasReturnSchedule={returnTab === 'planner'}
            hasReturnHealth={returnTab === 'health'}
            hasReturnArchive={returnTab === 'analytics'}
            onReturnSchedule={goReturn}
            onReturnHealth={goReturn}
            onReturnArchive={goReturn}
          />
          {!isTrash && noteTags.length > 0 && (() => {
            const MAX_INLINE_HEADER_TAGS = 3;
            const visibleHeaderTags = headerTagsExpanded ? noteTags : noteTags.slice(0, MAX_INLINE_HEADER_TAGS);
            const hiddenTagCount = noteTags.length - visibleHeaderTags.length;
            return (
            <div style={{ padding: '4px 13px 3px', borderBottom: `1px solid ${c.sideBdr}`, background: c.editor, flexShrink: 0, minWidth: 0 }}>
              <TagChipRow>
                {visibleHeaderTags.map(tag => (
                  <TagChip
                    key={tag}
                    colors={c}
                    tag={tag}
                    size="sm"
                    selected={activeTag?.toLowerCase() === tag.toLowerCase()}
                    onClick={() => {
                      setActiveFolderId(null);
                      setSearchQuery('');
                      setActiveTag(prev => prev?.toLowerCase() === tag.toLowerCase() ? null : tag);
                    }}
                  />
                ))}
                {hiddenTagCount > 0 && !headerTagsExpanded && (
                  <button
                    type="button"
                    className="btbtn"
                    onClick={() => setHeaderTagsExpanded(true)}
                    style={{
                      fontSize: 10,
                      height: 24,
                      padding: '0 8px',
                      color: c.textMuted,
                      borderRadius: 999,
                      border: `1px solid ${c.sideBdr}`,
                      background: c.cardHov,
                      flexShrink: 0,
                    }}
                  >
                    +{hiddenTagCount}
                  </button>
                )}
                {headerTagsExpanded && noteTags.length > MAX_INLINE_HEADER_TAGS && (
                  <button
                    type="button"
                    className="btbtn"
                    onClick={() => setHeaderTagsExpanded(false)}
                    style={{ fontSize: 9, color: c.textMuted, padding: '0 6px', height: 24, flexShrink: 0 }}
                  >
                    {t('nvCollapseSection')}
                  </button>
                )}
              </TagChipRow>
            </div>
            );
          })()}
          {!isTrash && activeNoteKind && activeNoteKind !== 'concept' && (
            <div style={{ padding: '4px 13px', borderBottom: `1px solid ${c.sideBdr}`, background: c.editor, flexShrink: 0 }}>
              <LiteratureWorkflowIndicator
                colors={c}
                kind={activeNoteKind}
                onPromote={handlePromoteNoteKind}
              />
            </div>
          )}
    
          {/* Graph View (full area) */}
          {viewMode === 'graph' ? (
            <div style={{ flex: 1, minHeight: 0 }}>
              <NoteGraphViewLazy notes={Array.isArray(notes) ? notes : []} folders={folders} activeNoteId={activeNoteId} onSelect={handleCosmosSelect} dark={dark} compactChrome={isCompactChrome} onCreateNote={() => createNote()} onLearnLinking={handleLearnLinking} onHudReviewWeakAreas={handleHudReviewWeakAreas} onHudOpenDiscover={handleOpenDiscover} onHudReviewDiscoveries={handleOpenDiscover} onHudOpenTimeline={handleOpenTimeline} recentEvolution={knowledgeTimeline.recentEvolution} sharedDiscoveryFeed={discoveryFeed}/>
            </div>
          ) : (
            <>
              {showFindInNotePanel && isMobile ? (
                <FindInNotePanel
                  open={documentSearchOpen}
                  isMobile
                  colors={c}
                  searchInputRef={searchInputRef}
                  searchQuery={searchQuery}
                  matchCount={documentSearchMatchCount}
                  activeMatchIndex={searchMatchIdx}
                  onQueryChange={query => {
                    setSearchQuery(query);
                    setSearchScope('document');
                  }}
                  onPrevMatch={() => setSearchMatchIdx(i => Math.max(0, i - 1))}
                  onNextMatch={() => setSearchMatchIdx(i => i + 1)}
                  onClose={closeDocumentSearch}
                  onKeyDown={handleDocumentSearchKeyDown}
                />
              ) : null}

              {/* Toolbar - edit 모드에서만 */}
              {!isTrash && viewMode === 'edit' && (
                <div
                  data-k123-editor-toolbar-row
                  style={{
                    flexShrink: 0,
                    background: c.toolbar,
                    borderBottom: `1px solid ${c.toolBdr}`,
                  }}
                >
                <div className="k123-editor-toolbar-shell" data-k123-editor-toolbar-shell>
                <div
                  className="be-editor-toolbar"
                  style={{
                    padding: '6px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: EDITOR_TOOLBAR_GAP,
                    flexWrap: 'wrap',
                    minHeight: METADATA_CHIP_HEIGHT + 10,
                  }}
                >
                  <span style={{ fontSize: 10, color: c.textMuted, display: 'flex', alignItems: 'center', gap: EDITOR_TOOLBAR_GAP, flexWrap: 'wrap', lineHeight: 1 }}>
                    <kbd style={{ background: c.card, border: `1px solid ${c.toolBdr}`, borderRadius: 4, padding: '2px 5px', fontSize: 10, fontFamily: 'monospace', color: c.text, height: METADATA_CHIP_HEIGHT, display: 'inline-flex', alignItems: 'center', boxSizing: 'border-box' }}>/</kbd>
                    {t('editorToolbarSlash')} ·
                    <kbd style={{ background: c.card, border: `1px solid ${c.toolBdr}`, borderRadius: 4, padding: '2px 5px', fontSize: 10, fontFamily: 'monospace', height: METADATA_CHIP_HEIGHT, display: 'inline-flex', alignItems: 'center', boxSizing: 'border-box' }}>⌘B</kbd> {t('editorToolbarBold')} ·
                    <kbd style={{ background: c.card, border: `1px solid ${c.toolBdr}`, borderRadius: 4, padding: '2px 5px', fontSize: 10, fontFamily: 'monospace', height: METADATA_CHIP_HEIGHT, display: 'inline-flex', alignItems: 'center', boxSizing: 'border-box' }}>⌘⇧1</kbd> {t('editorToolbarHeading')}
                  </span>
                  <button
                    type="button"
                    onClick={openDocumentSearch}
                    className="be-editor-toolbar-btn"
                    title={t('nvDocumentSearch')}
                    data-k123-toolbar-find
                    style={{ minWidth: isMobile ? UI_INTERACTION.touchTargetMinPx : 24, minHeight: isMobile ? UI_INTERACTION.touchTargetMinPx : 24 }}
                  >
                    <Search size={12} />
                  </button>
                  <button onClick={() => importInputRef.current?.click()} className="be-editor-toolbar-btn" title={t('nvImportMd')} style={{ marginLeft: 'auto' }}>
                    <Upload size={12}/>
                  </button>
                  <button onClick={insertEmptyImageBlockAtCursor} className="be-editor-toolbar-btn" title={t('nvInsertImage')}>
                    <ImageIcon size={12}/>
                  </button>
                  <div
                    style={{ position: 'relative' }}
                    onMouseLeave={e => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) setShowAppearance(false);
                    }}>
                    <button
                      type="button"
                      onClick={() => setShowAppearance(v => !v)}
                      className="be-editor-toolbar-btn"
                      title={t('nvAppearance')}
                      style={{ color: showAppearance ? c.accent : undefined }}>
                      <Type size={12}/>
                    </button>
                    {showAppearance && (
                      <div style={{
                        position: 'absolute', top: '100%', right: 0, paddingTop: 6, zIndex: 50,
                      }}>
                      <div style={{
                        background: c.card, border: `1px solid ${c.toolBdr}`, borderRadius: NOTE_RADIUS_CARD,
                        padding: '12px 14px', width: 240, boxShadow: '0 8px 28px #00000020',
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 10 }}>편집기 모양</div>
                        <label style={{ display: 'block', fontSize: 11, color: c.textMuted, marginBottom: 4 }}>글꼴</label>
                        <select
                          value={appSettings.notesFontFamily ?? 'system'}
                          onChange={e => updateSetting('notesFontFamily', e.target.value as AppSettings['notesFontFamily'])}
                          style={{ width: '100%', marginBottom: 10, background: c.input, border: `1px solid ${c.inputBdr}`, color: c.text, borderRadius: 6, padding: '5px 8px', fontSize: 12 }}>
                          {NOTE_FONT_OPTIONS.map(o => (
                            <option key={o.id} value={o.id}>{o.label}</option>
                          ))}
                        </select>
                        <label style={{ display: 'block', fontSize: 11, color: c.textMuted, marginBottom: 4 }}>
                          글자 크기 ({appSettings.notesFontSize ?? 16}px)
                        </label>
                        <input
                          type="range" min={12} max={22} step={1}
                          value={appSettings.notesFontSize ?? 16}
                          onChange={e => updateSetting('notesFontSize', Number(e.target.value))}
                          style={{ width: '100%', marginBottom: 10 }}
                        />
                        <label style={{ display: 'block', fontSize: 11, color: c.textMuted, marginBottom: 4 }}>본문 색상</label>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                          <input
                            type="color"
                            value={appSettings.notesTextColor?.trim() || (dark ? '#dcddde' : '#2e3338')}
                            onChange={e => updateSetting('notesTextColor', e.target.value)}
                            style={{ width: 36, height: 28, padding: 0, border: 'none', background: 'none' }}
                          />
                          <button type="button" className="btbtn" style={{ fontSize: 10 }}
                            onClick={() => updateSetting('notesTextColor', '')}>
                            기본값
                          </button>
                        </div>
                        <label style={{ display: 'block', fontSize: 11, color: c.textMuted, marginBottom: 4 }}>링크·강조 색</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            type="color"
                            value={appSettings.notesAccentColor?.trim() || (dark ? '#7f6df2' : '#7c3aed')}
                            onChange={e => updateSetting('notesAccentColor', e.target.value)}
                            style={{ width: 36, height: 28, padding: 0, border: 'none', background: 'none' }}
                          />
                          <button type="button" className="btbtn" style={{ fontSize: 10 }}
                            onClick={() => updateSetting('notesAccentColor', '')}>
                            기본값
                          </button>
                        </div>
                        <div style={{ fontSize: 10, color: c.textFaint, marginTop: 10 }}>
                          문서 폭 {NOTE_DOCUMENT_MAX_WIDTH}px
                        </div>
                      </div>
                      </div>
                    )}
                  </div>
                </div>
                </div>
                </div>
              )}
    
              {/* Body — centered editor column */}
              <div
                className="editor-drop-zone"
                ref={editorScrollRef}
                data-k123-editor-scroll
                style={{ flex: 1, overflow: 'auto', position: 'relative', overscrollBehavior: 'contain', minWidth: 0 }}
                onDragOver={e => { e.preventDefault(); if (Array.from(e.dataTransfer.items).some(i => i.kind === 'file' && i.type.startsWith('image/'))) setIsDragOver(true); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false); }}
                onPaste={e => {
                  if (!activeNote || viewMode !== 'edit') return;
                  const items = Array.from(e.clipboardData?.items ?? []);
                  const imageItem = items.find(i => i.kind === 'file' && i.type.startsWith('image/'));
                  if (!imageItem) return;
                  e.preventDefault();
                  const file = imageItem.getAsFile();
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = ev => {
                    const src = ev.target?.result as string;
                    if (src) insertImageAtCursor(file.name.replace(/\.[^.]+$/, ''), src);
                  };
                  reader.readAsDataURL(file);
                }}
                onDrop={handleEditorDrop}>
                {isDragOver && (
                  <div className="editor-drop-overlay">
                    <ImageIcon size={22}/> 이미지를 놓아 삽입
                  </div>
                )}
                {(
                  isTrash ? (
                    <div style={{ padding: '40px 60px', maxWidth: 860, margin: '0 auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16, color: c.danger, fontSize: 13 }}>
                        <AlertTriangle size={14}/> {t('nvInTrashWarning')}
                      </div>
                      <div style={{ color: c.textMuted, fontSize: 15, lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{activeNote.body}</div>
                    </div>
                  ) : (
                    <div
                      className="k123-editor-column-shell"
                      data-k123-editor-column
                      style={{ maxWidth: K123_EDITOR_SHELL_MAX_PX }}
                      onClick={viewMode === 'reading' ? handleReadingModeClick : undefined}
                      data-k108-editor-focus={viewMode === 'edit' ? 'active' : undefined}
                    >
                      {showFindInNotePanel && !isMobile ? (
                        <FindInNotePanel
                          open={documentSearchOpen}
                          isMobile={false}
                          colors={c}
                          searchInputRef={searchInputRef}
                          searchQuery={searchQuery}
                          matchCount={documentSearchMatchCount}
                          activeMatchIndex={searchMatchIdx}
                          onQueryChange={query => {
                            setSearchQuery(query);
                            setSearchScope('document');
                          }}
                          onPrevMatch={() => setSearchMatchIdx(i => Math.max(0, i - 1))}
                          onNextMatch={() => setSearchMatchIdx(i => i + 1)}
                          onClose={closeDocumentSearch}
                          onKeyDown={handleDocumentSearchKeyDown}
                        />
                      ) : null}
                      <div className="k123-editor-body-pad">
                      {viewMode === 'reading' && (
                        <div style={{ maxWidth: NOTE_DOCUMENT_MAX_WIDTH, margin: '0 auto 8px', fontSize: 11, color: c.textMuted }}>
                          {t('nvReadingModeHint')}
                        </div>
                      )}
                      <NoteBlockEditor
                        ref={blockEditorRef}
                        key={activeNote.id}
                        body={activeNote.body}
                        onBodyChange={handleActiveBodyChange}
                        colors={blockColors}
                        readOnly={viewMode === 'reading'}
                        searchQuery={editorSearchQuery}
                        searchScope={searchScope}
                        searchMatchIndex={searchMatchIdx}
                        wikiTargets={wikiTargets}
                        onWikiNavigate={navigateToWiki}
                        virtualScrollApiRef={virtualScrollApiRef}
                        virtualScrollParentRef={editorScrollRef}
                      />
                      </div>
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </>
      ) : (
        // Graph View without active note
        viewMode === 'graph' ? (
          <div style={{ flex: 1, minHeight: 0 }}>
            <NoteGraphViewLazy notes={Array.isArray(notes) ? notes : []} folders={folders} activeNoteId={null} onSelect={handleCosmosSelect} dark={dark} compactChrome={isCompactChrome} onCreateNote={() => createNote()} onLearnLinking={handleLearnLinking} onHudReviewWeakAreas={handleHudReviewWeakAreas} onHudOpenDiscover={handleOpenDiscover} onHudReviewDiscoveries={handleOpenDiscover} onHudOpenTimeline={handleOpenTimeline} recentEvolution={knowledgeTimeline.recentEvolution} sharedDiscoveryFeed={discoveryFeed}/>
          </div>
        ) : isEmptyVault ? (
          <div className="k125a-notes-empty-shell" data-k125a-notes-empty data-k125a-notes-empty-vault>
          <ProductEmptyState
            variant="note-chrome"
            colors={c}
            icon={FileText}
            title={t('k101EmptyVaultTitle')}
            description={t('k101EmptyVaultDesc')}
            dataHook="vault-empty"
            primaryAction={{ label: t('nvNewNoteBtn'), onClick: () => createNote() }}
            secondaryAction={onOpenTodaysNote ? { label: t('k101OpenTodaysNote'), onClick: onOpenTodaysNote } : undefined}
          >
            {onImportVault ? (
              <button
                type="button"
                className="k101-interactive"
                onClick={onImportVault}
                data-vault-empty-import
                style={{
                  background: 'transparent',
                  color: c.textMuted,
                  border: `1px solid ${c.inputBdr}`,
                  borderRadius: 10,
                  padding: '8px 16px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  minHeight: 44,
                }}
              >
                {t('nvImportVaultBackup')}
              </button>
            ) : null}
          </ProductEmptyState>
          </div>
        ) : (
          <div className="k125a-notes-empty-shell" data-k125a-notes-empty data-k125a-notes-empty-select>
          <ProductEmptyState
            variant="note-chrome"
            colors={c}
            icon={FileText}
            title={t('nvSelectNoteEmpty')}
            description={t('k99EmptyNotesDesc')}
            dataHook="notes-editor-empty"
            primaryAction={{ label: t('nvNewNoteBtn'), onClick: () => createNote() }}
            secondaryAction={{ label: t('nvScGraph'), onClick: () => setViewMode('graph') }}
          />
          </div>
        )
      )}
    </main>
  );
}
