// @vitest-environment happy-dom
import { act, createElement, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoteViewEditorArea } from './NoteViewEditorArea';

vi.mock('./NoteEditorHeaderActions', () => ({ NoteEditorHeaderActions: () => null }));
vi.mock('./NoteBreadcrumbBar', () => ({ NoteBreadcrumbBar: () => null }));
vi.mock('./WorkspaceContextBanner', () => ({ WorkspaceContextBanner: () => null }));
vi.mock('./NoteImageAttachments', () => ({ NoteImageAttachments: () => null }));
vi.mock('../features/knowledge/components/NoteContextStrip', () => ({ NoteContextStrip: () => null }));
vi.mock('./NoteGraphViewLazy', () => ({ NoteGraphViewLazy: () => null }));

const colors = {
  wrap: '#fff', sidebar: '#fff', sideBdr: '#ddd', notelist: '#fff', editor: '#fff', toolbar: '#fff',
  toolBdr: '#ddd', card: '#fff', cardHov: '#fafafa', cardAct: '#f0f0f0', cardActBdr: '#ddd',
  text: '#111', textMuted: '#555', textFaint: '#888', accent: '#7c3aed', accentBg: '#f3e8ff',
  input: '#fff', inputBdr: '#ddd', badge: '#eee', badgeTxt: '#111', tag: '#eee', tagTxt: '#111',
  danger: '#dc2626', green: '#16a34a',
} as never;

const blockColors = {
  bg: '#fff', text: '#111', textMuted: '#555', textFaint: '#888', accent: '#7c3aed', accentBg: '#f3e8ff',
  border: '#ddd', card: '#fff', cardHov: '#fafafa', input: '#fff', inputBdr: '#ddd', toolbar: '#fff',
  danger: '#dc2626', green: '#16a34a', codeBg: '#f5f5f5', calloutBg: '#f5f5f5', toggleBg: '#f5f5f5',
  quoteBdr: '#ddd', selection: '#ddd',
} as never;

const note = {
  id: 'note-1', title: 'Note', body: 'hello', updatedAt: 1, folderId: null, deletedAt: null,
} as never;

function makeProps(onBodyChange: ReturnType<typeof vi.fn>, attachImageFilesToActiveNote: ReturnType<typeof vi.fn>) {
  const layout = {
    hideEditorArea: false, isMobile: false, isCompactChrome: false, isFocusPresetActive: false,
    isTrash: false, showRightPanel: false, viewMode: 'edit', showAppearance: false,
    isDragOver: false, headerTagsExpanded: false, docCopied: false, dark: false, isEmptyVault: false,
  } as never;
  const data = {
    c: colors, activeNote: note, activeNoteId: 'note-1', notes: [note], folders: [], titleDraft: 'Note',
    activeNoteKind: null, noteTags: [], syncError: null, isSyncing: false, savedAt: null, viewModes: [],
    noteAreaProperty: undefined, noteLinkedProjectTitle: '', noteLinkedProjectId: null,
    noteLearningPathLabel: null, noteContextReviewEntry: null, noteConnectionCount: 0,
    noteCosmosTier: 'core', activeTag: null, searchQuery: '', searchScope: 'document', searchMatchIdx: 0,
    editorSearchQuery: '', blockColors, wikiTargets: [], appSettings: {
      notesFontFamily: 'system', notesFontSize: 16, notesTextColor: '', notesAccentColor: '', language: 'en',
    }, knowledgeTimeline: { recentEvolution: [] }, activeFocusPreset: undefined, discoveryFeed: {},
    documentSearchOpen: false,
  } as never;
  const noop = vi.fn();
  const handlers = {
    titleInputRef: createRef<HTMLInputElement>(), titleComposingRef: { current: false },
    blockEditorRef: createRef(), editorScrollRef: createRef<HTMLDivElement>(), virtualScrollApiRef: createRef(),
    searchInputRef: createRef<HTMLInputElement>(), importInputRef: createRef<HTMLInputElement>(),
    setMobileShowEditor: noop, setActiveNoteId: noop, handleExitFocusPreset: noop, handleTitleChange: noop,
    handleTitleCompositionEnd: noop, noteUpdate: noop, retrySync: noop, setViewMode: noop,
    openEditEventDialog: noop, openMilestoneDialog: noop, handleToggleAreaNote: noop, toggleStar: noop,
    duplicateNote: noop, setShowRightPanel: noop, handleCopyDocument: noop, exportNote: noop,
    restoreNote: noop, moveNoteToTrash: noop, onPermanentDelete: noop, setActiveFolderId: noop,
    setSearchQuery: noop, setActiveTag: noop, setHeaderTagsExpanded: noop, openContextPanel: noop,
    setRightPanel: noop, handlePromoteNoteKind: noop, handleLearnLinking: noop, handleHudReviewWeakAreas: noop,
    handleOpenDiscover: noop, handleOpenTimeline: noop, createNote: vi.fn(() => 'new-note'),
    setSearchScope: noop, setSearchMatchIdx: noop, setDocumentSearchOpen: noop,
    insertEmptyImageBlockAtCursor: noop, attachImageFilesToActiveNote, setShowAppearance: noop,
    setShowShortcuts: noop, onOpenSettings: noop, updateSetting: noop, setIsDragOver: noop,
    insertImageAtCursor: noop, handleEditorDrop: noop, handleReadingModeClick: noop,
    handleActiveBodyChange: onBodyChange, navigateToWiki: noop, canBackNote: false, canForwardNote: false,
    goBackNote: noop, goForwardNote: noop, openNoteById: noop, onOpenTodaysNote: noop, onImportVault: noop,
  } as never;
  return { layout, data, handlers };
}

function renderEditor(props: ReturnType<typeof makeProps>) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(NoteViewEditorArea, props)));
  return { host, root };
}

function cleanup(root: Root, host: HTMLElement) {
  act(() => root.unmount());
  host.remove();
}

function clipboardData({ image, text }: { image?: File; text?: string }) {
  const items = image ? [{ kind: 'file', type: image.type, getAsFile: () => image }] : [];
  return { items, getData: () => text ?? '' };
}

afterEach(() => vi.unstubAllEnvs());

describe('NoteViewEditorArea Return-to-Use attachment isolation', () => {
  it('blocks image paste while preserving ordinary text editing and text paste', () => {
    vi.stubEnv('VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION', 'true');
    const onBodyChange = vi.fn();
    const attachImageFilesToActiveNote = vi.fn();
    const mounted = renderEditor(makeProps(onBodyChange, attachImageFilesToActiveNote));
    const editable = mounted.host.querySelector('[contenteditable="true"]');
    if (!(editable instanceof HTMLElement)) throw new Error('active editor block missing');
    const editorDropZone = mounted.host.querySelector('.editor-drop-zone');
    if (!(editorDropZone instanceof HTMLElement)) throw new Error('editor paste surface missing');
    expect(editorDropZone.contains(editable)).toBe(true);

    act(() => {
      editable.textContent = 'edited text';
      editable.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onBodyChange).toHaveBeenCalled();
    onBodyChange.mockClear();

    const image = new File(['image'], 'paste.png', { type: 'image/png' });
    const imagePaste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(imagePaste, 'clipboardData', { value: clipboardData({ image }) });
    act(() => editable.dispatchEvent(imagePaste));
    expect(attachImageFilesToActiveNote).not.toHaveBeenCalled();
    expect(onBodyChange).not.toHaveBeenCalled();
    expect(mounted.host.textContent).toContain('Attachments are temporarily disabled');

    const textPaste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(textPaste, 'clipboardData', { value: clipboardData({ text: ' pasted text' }) });
    act(() => editable.dispatchEvent(textPaste));
    expect(onBodyChange).toHaveBeenCalled();
    expect(attachImageFilesToActiveNote).not.toHaveBeenCalled();
    cleanup(mounted.root, mounted.host);
  });
});
