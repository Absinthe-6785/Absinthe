import { forwardRef, useImperativeHandle, useEffect, type RefObject, type MutableRefObject } from 'react';
import {
  Search, Trash2, Star, Type, Eye, Orbit,
  RotateCcw, AlertTriangle, Save, Copy, AlignLeft, GitFork, Upload,
  ChevronUp, ChevronDown, ChevronLeft, Image as ImageIcon, FileText,
} from 'lucide-react';
import type { EditorSearchScope } from '../editorSearch';
import {
  BlockEditor,
  useBlockEditor,
  type BlockEditorColors,
  type BlockEditorHandle,
} from '../BlockEditor';
import {
  NOTE_FONT_OPTIONS,
  NOTE_DOCUMENT_MAX_WIDTH,
  NOTE_RADIUS_CARD,
  type NoteChromeColors,
} from '../noteEditorTheme';
import { type EditorMode, toggleEditReading } from '../editorMode';
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
import { TagChip, TagChipRow } from '../features/knowledge/components/TagChip';
import { NoteContextStrip } from '../features/knowledge/components/NoteContextStrip';
import type { KnowledgeContextTab } from '../features/knowledge/components/KnowledgeContextPanel';
import type { AppSettings } from '../../../types';
import { useTranslation } from '../../../lib/i18n';
import { NoteGraphView } from '../NoteGraphView';
import type { KnowledgeTimeline } from '../features/knowledge/timeline';
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
    blocks, handleBlockChange, undo, redo,
    insertImage, insertEmptyImageBlock, insertWikiLinkDraft,
    setActiveBlockId, externalFocusId, externalFocusOffset, clearExternalFocus,
    getBlocks, copyDocument,
  } = useBlockEditor(body, onBodyChange);

  useImperativeHandle(ref, () => ({
    insertImage,
    insertEmptyImageBlock,
    insertWikiLinkDraft,
    getBlocks,
    copyDocument,
  }), [insertImage, insertEmptyImageBlock, insertWikiLinkDraft, getBlocks, copyDocument]);

  useEffect(() => {
    if (readOnly) return;
    const handler = (e: KeyboardEvent) => {
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
  insertEmptyImageBlockAtCursor: () => void;
  setShowAppearance: React.Dispatch<React.SetStateAction<boolean>>;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  setIsDragOver: React.Dispatch<React.SetStateAction<boolean>>;
  insertImageAtCursor: (alt: string, src: string) => void;
  handleEditorDrop: React.DragEventHandler<HTMLDivElement>;
  handleReadingModeClick: React.MouseEventHandler<HTMLDivElement>;
  handleActiveBodyChange: (md: string) => void;
  navigateToWiki: (title: string, options?: { preferReading?: boolean }) => void;
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
    viewMode, showAppearance, isDragOver, headerTagsExpanded, docCopied, dark,
  } = layout;
  const {
    c, activeNote, activeNoteId, notes, folders, titleDraft, activeNoteKind, noteTags,
    syncError, isSyncing, savedAt, viewModes: VIEW_MODES, noteAreaProperty, noteLinkedProjectTitle,
    noteLinkedProjectId, noteLearningPathLabel, noteContextReviewEntry, noteConnectionCount,
    noteCosmosTier, activeTag, searchQuery, searchScope, searchMatchIdx, editorSearchQuery,
    blockColors, wikiTargets, appSettings, knowledgeTimeline, activeFocusPreset,
  } = data;
  const {
    titleInputRef, titleComposingRef, blockEditorRef, editorScrollRef, virtualScrollApiRef,
    searchInputRef, importInputRef, setMobileShowEditor, setActiveNoteId, handleExitFocusPreset,
    handleTitleChange, handleTitleCompositionEnd, noteUpdate, retrySync, setViewMode,
    openEditEventDialog, openMilestoneDialog, handleToggleAreaNote, toggleStar, duplicateNote,
    setShowRightPanel, handleCopyDocument, exportNote, restoreNote, moveNoteToTrash,
    setActiveFolderId, setSearchQuery, setActiveTag, setHeaderTagsExpanded, openContextPanel,
    setRightPanel, handlePromoteNoteKind, handleLearnLinking, handleHudReviewWeakAreas,
    handleOpenDiscover, handleOpenTimeline, createNote, setSearchScope, setSearchMatchIdx,
    insertEmptyImageBlockAtCursor, setShowAppearance, updateSetting, setIsDragOver,
    insertImageAtCursor, handleEditorDrop, handleReadingModeClick, handleActiveBodyChange,
    navigateToWiki,
  } = handlers;

  return (
    <main id="noteview-main" tabIndex={-1} aria-label={t('nvEditorMain')} style={{ flex: 1, display: hideEditorArea ? 'none' : 'flex', flexDirection: 'column', minWidth: 0, background: c.editor }}>
      {activeNote ? (
        <>
          {/* Note Header */}
          <div style={{ padding: isMobile ? '7px 10px' : '7px 13px', borderBottom: `1px solid ${c.sideBdr}`, display: 'flex', alignItems: 'center', gap: 6, background: c.editor, flexShrink: 0, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            {isMobile && (
              <button type="button" className="btbtn" onClick={() => { setMobileShowEditor(false); setActiveNoteId(null); }}
                style={{ padding: '2px 4px', color: c.textMuted }} title={t('nvBackToNotes')}>
                <ChevronLeft size={14}/>
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
              style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: c.text, fontSize: isMobile ? 16 : 15, fontWeight: 700 }}
              placeholder={t('title')}/>
            {!isTrash && (
              <select value={activeNote.folderId ?? ''} onChange={e => noteUpdate(activeNote.id, { folderId: e.target.value || null })}
                style={{ background: c.input, border: `1px solid ${c.inputBdr}`, color: c.textMuted, borderRadius: 5, padding: '3px 6px', fontSize: 10, outline: 'none', cursor: 'pointer' }}>
                <option value="">{t('nvNoFolder')}</option>
                {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            )}
            {!isTrash && (
              <NoteClassificationSelector
                colors={c}
                value={activeNoteKind}
                onChange={kind => {
                  const updated = setNoteKind(activeNote, kind);
                  noteUpdate(activeNote.id, { properties: updated.properties });
                }}
              />
            )}
            {!isTrash && (
              <WeakTopicToggle
                colors={c}
                active={isWeakTopic(activeNote)}
                onChange={weak => {
                  const updated = setWeakTopic(activeNote, weak);
                  noteUpdate(activeNote.id, { properties: updated.properties });
                }}
              />
            )}
            {/* Cloud sync status */}
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
              ) : savedAt ? (
                <span style={{ fontSize: 9, color: c.green, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Save size={9}/> {savedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              ) : null
            )}
            {/* View: edit default · Reading / Graph secondary */}
            <div style={{ display: 'flex', background: c.toolbar, borderRadius: 7, padding: 2, gap: 1 }}>
              {VIEW_MODES.map(({ key, icon }) => (
                <button
                  key={key}
                  title={key === 'reading' ? t('nvReadingMode') : t('nvGraphMode')}
                  onClick={() => {
                    if (key === 'reading') setViewMode(v => toggleEditReading(v));
                    else setViewMode(v => v === 'graph' ? 'edit' : 'graph');
                  }}
                  className="btbtn"
                  style={{
                    padding: '3px 7px', borderRadius: 5,
                    background: (key === 'reading' ? viewMode === 'reading' : viewMode === 'graph') ? c.card : 'none',
                    color: (key === 'reading' ? viewMode === 'reading' : viewMode === 'graph') ? c.accent : c.textMuted,
                  }}>
                  {icon}
                </button>
              ))}
            </div>
            {/* Event / milestone note actions */}
            {!isTrash && (
              <button
                type="button"
                onClick={() => openEditEventDialog(activeNote)}
                className="btbtn"
                style={{ fontSize: 10, color: isEventNote(activeNote) ? c.accent : c.textMuted, whiteSpace: 'nowrap' }}
                title={isEventNote(activeNote) ? t('nvEditEventTitle') : t('nvMarkEventTitle')}
              >
                {isEventNote(activeNote) ? t('nvEditEvent') : t('nvMarkEvent')}
              </button>
            )}
            {!isTrash && (
              <button
                type="button"
                onClick={() => openMilestoneDialog(activeNote)}
                className="btbtn"
                style={{ fontSize: 10, color: isMilestoneNote(activeNote) ? c.accent : c.textMuted, whiteSpace: 'nowrap' }}
                title={isMilestoneNote(activeNote) ? t('nvEditMilestoneTitle') : t('nvMarkMilestoneTitle')}
              >
                {isMilestoneNote(activeNote) ? t('nvEditMilestone') : t('nvMarkMilestone')}
              </button>
            )}
            {!isTrash && (isAreaNote(activeNote) || canMarkAsArea(activeNote)) && (
              <button
                type="button"
                onClick={handleToggleAreaNote}
                className="btbtn"
                style={{ fontSize: 10, color: isAreaNote(activeNote) ? c.accent : c.textMuted, whiteSpace: 'nowrap' }}
                title={isAreaNote(activeNote) ? t('nvClearAreaTitle') : t('nvMarkAreaTitle')}
              >
                {isAreaNote(activeNote) ? t('nvClearArea') : t('nvMarkArea')}
              </button>
            )}
            {/* Star */}
            {!isTrash && (
              <button onClick={() => toggleStar(activeNote.id)} className="btbtn" title={activeNote.starred ? t('nvUnstar') : t('nvStar')}>
                <Star size={13} color={activeNote.starred ? c.accent : c.textMuted} fill={activeNote.starred ? c.accent : 'none'}/>
              </button>
            )}
            {/* Duplicate */}
            {!isTrash && (
              <button onClick={() => duplicateNote(activeNote)} className="btbtn" title={t('nvDuplicate')}>
                <span style={{ fontSize: 11 }}>⎘</span>
              </button>
            )}
            {/* Right panel toggle */}
            <button onClick={() => setShowRightPanel(v => !v)} className={`btbtn${isCompactChrome ? ' btbtn-mobile' : ''}`} title={t('nvTogglePanel')}
              style={{ color: showRightPanel ? c.accent : c.textMuted }}>
              <AlignLeft size={12}/>
            </button>
            {/* Copy document */}
            {!isTrash && (
              <button onClick={() => void handleCopyDocument()} className="btbtn"
                title={docCopied ? t('nvCopied') : t('nvCopyDocument')}
                style={{ color: docCopied ? c.green : c.textMuted }}>
                <Copy size={12}/>
              </button>
            )}
            {/* Export */}
            <button onClick={() => exportNote(activeNote)} className="btbtn" title={t('nvExportMd')}>
              <Save size={12}/>
            </button>
            {isTrash
              ? <button onClick={() => restoreNote(activeNote.id)} className="btbtn" style={{ color: c.green }}><RotateCcw size={12}/></button>
              : <button onClick={() => moveNoteToTrash(activeNote.id)} className="btbtn"><Trash2 size={12}/></button>
            }
          </div>
          {!isTrash && noteTags.length > 0 && (() => {
            const MAX_HEADER_TAGS = 10;
            const visibleHeaderTags = headerTagsExpanded ? noteTags : noteTags.slice(0, MAX_HEADER_TAGS);
            const hiddenTagCount = noteTags.length - visibleHeaderTags.length;
            return (
            <div style={{ padding: '5px 13px', borderBottom: `1px solid ${c.sideBdr}`, background: c.editor, flexShrink: 0, minWidth: 0 }}>
              <TagChipRow>
                {visibleHeaderTags.map(tag => (
                  <TagChip
                    key={tag}
                    colors={c}
                    tag={tag}
                    size="sm"
                    wrap
                    selected={activeTag?.toLowerCase() === tag.toLowerCase()}
                    onClick={() => {
                      setActiveFolderId(null);
                      setSearchQuery('');
                      setActiveTag(prev => prev?.toLowerCase() === tag.toLowerCase() ? null : tag);
                    }}
                  />
                ))}
                {hiddenTagCount > 0 && (
                  <button
                    type="button"
                    className="btbtn"
                    onClick={() => setHeaderTagsExpanded(v => !v)}
                    style={{ fontSize: 9, color: c.textMuted, padding: '2px 6px' }}
                  >
                    {headerTagsExpanded ? t('nvCollapseSection') : t('k35MoreTags').replace('{count}', String(hiddenTagCount))}
                  </button>
                )}
              </TagChipRow>
            </div>
            );
          })()}
          {!isTrash && activeNote && (
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
              onNavigateToNote={setActiveNoteId}
              onOpenLinks={() => openContextPanel('links')}
              onOpenCosmos={() => {
                setShowRightPanel(true);
                setRightPanel('graph');
              }}
            />
          )}
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
              <NoteGraphView notes={Array.isArray(notes) ? notes : []} folders={folders} activeNoteId={activeNoteId} onSelect={id => { setActiveNoteId(id); setViewMode('edit'); }} dark={dark} onCreateNote={() => createNote()} onLearnLinking={handleLearnLinking} onHudReviewWeakAreas={handleHudReviewWeakAreas} onHudOpenDiscover={handleOpenDiscover} onHudReviewDiscoveries={handleOpenDiscover} onHudOpenTimeline={handleOpenTimeline} recentEvolution={knowledgeTimeline.recentEvolution}/>
            </div>
          ) : (
            <>
              {/* Toolbar - edit 모드에서만 (블록 에디터: 슬래시 커맨드 기반) */}
              {!isTrash && viewMode === 'edit' && (
                <div style={{ padding: '5px 12px', borderBottom: `1px solid ${c.toolBdr}`, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, background: c.toolbar, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: c.textMuted, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <kbd style={{ background: c.card, border: `1px solid ${c.toolBdr}`, borderRadius: 4, padding: '1px 5px', fontSize: 10, fontFamily: 'monospace', color: c.text }}>/</kbd>
                    {t('editorToolbarSlash')} ·
                    <kbd style={{ background: c.card, border: `1px solid ${c.toolBdr}`, borderRadius: 4, padding: '1px 4px', fontSize: 10, fontFamily: 'monospace' }}>⌘B</kbd> {t('editorToolbarBold')} ·
                    <kbd style={{ background: c.card, border: `1px solid ${c.toolBdr}`, borderRadius: 4, padding: '1px 4px', fontSize: 10, fontFamily: 'monospace' }}>⌘⇧1</kbd> {t('editorToolbarHeading')}
                  </span>
                  {activeNote && (
                    <button
                      type="button"
                      className="btbtn"
                      title={t('nvNoteSearchPlaceholder')}
                      onClick={() => {
                        searchInputRef.current?.focus();
                        setSearchScope('document');
                      }}
                      style={{ fontSize: 10, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Search size={11}/> {t('nvSearchButton')}
                    </button>
                  )}
                  {searchQuery.trim() && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8, flexWrap: 'wrap' }}>
                      {(['block', 'document', 'all'] as const).map(scope => (
                        <button key={scope} type="button" className="btbtn"
                          onClick={() => setSearchScope(scope)}
                          style={{
                            fontSize: 10, padding: '2px 8px',
                            background: searchScope === scope ? c.accentBg : c.card,
                            color: searchScope === scope ? c.accent : c.textMuted,
                            border: `1px solid ${searchScope === scope ? c.accent : c.toolBdr}`,
                            borderRadius: 5, cursor: 'pointer',
                          }}>
                          {scope === 'block' ? t('nvSearchScopeBlock') : scope === 'document' ? t('nvSearchScopeDocument') : t('nvSearchScopeAll')}
                        </button>
                      ))}
                      {searchScope !== 'all' && (
                        <>
                          <button type="button" className="btbtn" title={t('nvSearchPrev')}
                            onClick={() => setSearchMatchIdx(i => Math.max(0, i - 1))}
                            style={{ padding: '2px 5px' }}><ChevronUp size={12}/></button>
                          <button type="button" className="btbtn" title={t('nvSearchNext')}
                            onClick={() => setSearchMatchIdx(i => i + 1)}
                            style={{ padding: '2px 5px' }}><ChevronDown size={12}/></button>
                        </>
                      )}
                    </div>
                  )}
                  <button onClick={() => importInputRef.current?.click()} className="btbtn" title={t('nvImportMd')} style={{ marginLeft: 4 }}>
                    <Upload size={13}/>
                  </button>
                  <button onClick={insertEmptyImageBlockAtCursor} className="btbtn" title={t('nvInsertImage')}>
                    <ImageIcon size={13}/>
                  </button>
                  <div
                    style={{ position: 'relative', marginLeft: 'auto' }}
                    onMouseLeave={e => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) setShowAppearance(false);
                    }}>
                    <button
                      type="button"
                      onClick={() => setShowAppearance(v => !v)}
                      className="btbtn"
                      title={t('nvAppearance')}
                      style={{ color: showAppearance ? c.accent : c.textMuted }}>
                      <Type size={13}/>
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
              )}
    
              {/* Body — 드래그&드롭 + 단일 컬럼 전체 너비 */}
              <div
                className="editor-drop-zone"
                ref={editorScrollRef}
                style={{ flex: 1, overflow: 'auto', position: 'relative' }}
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
                        <AlertTriangle size={14}/> {t('nvInTrashRestore')}
                      </div>
                      <div style={{ color: c.textMuted, fontSize: 15, lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{activeNote.body}</div>
                    </div>
                  ) : (
                    <div
                      onClick={viewMode === 'reading' ? handleReadingModeClick : undefined}
                      style={{ minHeight: '100%', padding: isMobile ? '12px 0 48px' : '24px 0 80px' }}>
                      {viewMode === 'reading' && (
                        <div style={{ maxWidth: isMobile ? '100%' : 720, margin: '0 auto 8px', padding: isMobile ? '0 12px' : '0 16px', fontSize: 11, color: c.textMuted }}>
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
            <NoteGraphView notes={Array.isArray(notes) ? notes : []} folders={folders} activeNoteId={null} onSelect={id => { setActiveNoteId(id); setViewMode('edit'); }} dark={dark} onCreateNote={() => createNote()} onLearnLinking={handleLearnLinking} onHudReviewWeakAreas={handleHudReviewWeakAreas} onHudOpenDiscover={handleOpenDiscover} onHudReviewDiscoveries={handleOpenDiscover} onHudOpenTimeline={handleOpenTimeline} recentEvolution={knowledgeTimeline.recentEvolution}/>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: c.textMuted }}>
            <FileText size={32} strokeWidth={1.5} style={{ opacity: 0.4 }} />
            <p style={{ fontSize: 13 }}>{t('nvSelectNoteEmpty')}</p>
            <button className="bwbg" onClick={() => createNote()}>{t('nvNewNoteBtn')}</button>
            <button onClick={() => setViewMode('graph')}
              style={{ background: 'none', border: `1px solid ${c.inputBdr}`, borderRadius: 7, padding: '6px 14px', fontSize: 12, color: c.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <GitFork size={12}/> {t('nvScGraph')}
            </button>
          </div>
        )
      )}
    </main>
  );
}
