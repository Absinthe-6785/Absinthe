// @vitest-environment happy-dom
import { act, createElement, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoteViewEditorArea } from './NoteViewEditorArea';
import { getTranslator } from '../../../lib/i18n';

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

function makeProps(
  onBodyChange: ReturnType<typeof vi.fn>,
  attachImageFilesToActiveNote: ReturnType<typeof vi.fn>,
  body = 'hello',
  options: { syncError?: string | null; syncIssueRetryable?: boolean; isSyncing?: boolean; retrySync?: ReturnType<typeof vi.fn> } = {},
) {
  const activeNote = { ...note, body } as never;
  const layout = {
    hideEditorArea: false, isMobile: false, isCompactChrome: false, isFocusPresetActive: false,
    isTrash: false, showRightPanel: false, viewMode: 'edit', showAppearance: false,
    isDragOver: false, headerTagsExpanded: false, docCopied: false, dark: false, isEmptyVault: false,
  } as never;
  const data = {
    c: colors, activeNote, activeNoteId: 'note-1', notes: [activeNote], folders: [], titleDraft: 'Note',
    activeNoteKind: null, noteTags: [], syncError: options.syncError ?? null, syncIssueRetryable: options.syncIssueRetryable, isSyncing: options.isSyncing ?? false, savedAt: null, viewModes: [],
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
    handleTitleCompositionEnd: noop, noteUpdate: noop, retrySync: options.retrySync ?? noop, setViewMode: noop,
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

function fireKey(target: EventTarget, key: string, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  act(() => target.dispatchEvent(event));
  return event;
}

afterEach(() => vi.unstubAllEnvs());

describe('NoteViewEditorArea Return-to-Use attachment isolation', () => {
  it('presents sync errors as a compact generic retry control', () => {
    const retrySync = vi.fn();
    const rawDiagnostic = `notes_bootstrap_missing_remote_${'x'.repeat(180)}`;
    const mounted = renderEditor(makeProps(vi.fn(), vi.fn(), 'hello', { syncError: rawDiagnostic, retrySync }));
    const control = mounted.host.querySelector('[data-note-sync-error-control]');

    expect(control).toBeInstanceOf(HTMLButtonElement);
    expect(control?.textContent).toContain('동기화 문제');
    expect(control?.textContent).not.toContain(rawDiagnostic);
    expect(control?.getAttribute('aria-label')).toBe('동기화 문제. 클라우드 동기화 재시도');
    expect(control?.getAttribute('style')).toContain('max-width');
    expect(control?.getAttribute('style')).toContain('overflow: hidden');

    act(() => (control as HTMLButtonElement).click());
    expect(retrySync).toHaveBeenCalledTimes(1);
    cleanup(mounted.root, mounted.host);
  });

  it('keeps syncing and idle states separate from the error control', () => {
    const syncing = renderEditor(makeProps(vi.fn(), vi.fn(), 'hello', { isSyncing: true }));
    expect(syncing.host.textContent).toContain('동기화 중…');
    expect(syncing.host.querySelector('[data-note-sync-error-control]')).toBeNull();
    cleanup(syncing.root, syncing.host);

    const idle = renderEditor(makeProps(vi.fn(), vi.fn()));
    expect(idle.host.textContent).not.toContain('동기화 중…');
    expect(idle.host.querySelector('[data-note-sync-error-control]')).toBeNull();
    cleanup(idle.root, idle.host);
  });

  it('keeps a non-retryable issue visible without a misleading retry action', () => {
    const retrySync = vi.fn();
    const mounted = renderEditor(makeProps(vi.fn(), vi.fn(), 'hello', {
      syncError: 'bootstrap still active',
      syncIssueRetryable: false,
      retrySync,
    }));
    expect(mounted.host.querySelector('[data-note-sync-error-control]')).toBeNull();
    expect(mounted.host.querySelector('[data-note-sync-error-indicator]')).not.toBeNull();
    expect(mounted.host.textContent).toContain('동기화 문제');
    expect(retrySync).not.toHaveBeenCalled();
    cleanup(mounted.root, mounted.host);
  });

  it('provides sync issue labels in every supported locale', () => {
    for (const lang of ['en', 'ko', 'ja'] as const) {
      const t = getTranslator(lang);
      expect(t('nvSyncIssue')).not.toBe('nvSyncIssue');
      expect(t('nvSyncIssueRetry')).not.toBe('nvSyncIssueRetry');
    }
  });

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

  it('uses the existing block history for scoped undo and redo shortcuts', () => {
    const onBodyChange = vi.fn();
    const mounted = renderEditor(makeProps(onBodyChange, vi.fn()));
    const getEditable = () => mounted.host.querySelector('[contenteditable="true"]') as HTMLElement;
    const editable = getEditable();
    editable.focus();

    act(() => {
      editable.textContent = 'changed';
      editable.dispatchEvent(new Event('input', { bubbles: true }));
    });
    onBodyChange.mockClear();

    expect(fireKey(getEditable(), 'z', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(onBodyChange).toHaveBeenLastCalledWith('hello');

    expect(fireKey(getEditable(), 'z', { metaKey: true, shiftKey: true }).defaultPrevented).toBe(true);
    expect(onBodyChange).toHaveBeenLastCalledWith('changed');

    expect(fireKey(getEditable(), 'z', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(onBodyChange).toHaveBeenLastCalledWith('hello');

    expect(fireKey(getEditable(), 'y', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(onBodyChange).toHaveBeenLastCalledWith('changed');

    expect(fireKey(getEditable(), 'z', { metaKey: true }).defaultPrevented).toBe(true);
    expect(onBodyChange).toHaveBeenLastCalledWith('hello');
    expect(fireKey(getEditable(), 'z', { metaKey: true, shiftKey: true }).defaultPrevented).toBe(true);
    expect(onBodyChange).toHaveBeenLastCalledWith('changed');

    cleanup(mounted.root, mounted.host);
  });

  it('keeps short typing undo/redo incremental and clears obsolete redo', () => {
    const onBodyChange = vi.fn();
    const mounted = renderEditor(makeProps(onBodyChange, vi.fn(), ''));
    const getEditable = () => mounted.host.querySelector('[contenteditable="true"]') as HTMLElement;
    const input = (text: string) => act(() => {
      const editable = getEditable();
      editable.textContent = text;
      editable.dispatchEvent(new Event('input', { bubbles: true }));
    });

    input('a');
    input('as');
    input('asd');
    onBodyChange.mockClear();

    expect(fireKey(getEditable(), 'z', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(onBodyChange).toHaveBeenLastCalledWith('as');
    expect(fireKey(getEditable(), 'z', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(onBodyChange).toHaveBeenLastCalledWith('a');
    expect(fireKey(getEditable(), 'z', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(onBodyChange).toHaveBeenLastCalledWith('');

    expect(fireKey(getEditable(), 'z', { ctrlKey: true, shiftKey: true }).defaultPrevented).toBe(true);
    expect(onBodyChange).toHaveBeenLastCalledWith('a');
    expect(fireKey(getEditable(), 'y', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(onBodyChange).toHaveBeenLastCalledWith('as');
    expect(fireKey(getEditable(), 'y', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(onBodyChange).toHaveBeenLastCalledWith('asd');

    expect(fireKey(getEditable(), 'z', { ctrlKey: true }).defaultPrevented).toBe(true);
    input('new');
    onBodyChange.mockClear();
    expect(fireKey(getEditable(), 'y', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(onBodyChange).not.toHaveBeenCalled();

    cleanup(mounted.root, mounted.host);
  });

  it('commits one completed IME composition instead of intermediate history states', () => {
    const onBodyChange = vi.fn();
    const mounted = renderEditor(makeProps(onBodyChange, vi.fn(), ''));
    const editable = mounted.host.querySelector('[contenteditable="true"]') as HTMLElement;

    act(() => editable.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })));
    act(() => {
      editable.textContent = 'ㅎ';
      editable.dispatchEvent(new Event('input', { bubbles: true }));
      editable.textContent = '한';
      editable.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onBodyChange).not.toHaveBeenCalled();

    act(() => editable.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
    expect(onBodyChange).toHaveBeenLastCalledWith('한');
    onBodyChange.mockClear();
    expect(fireKey(editable, 'z', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(onBodyChange).toHaveBeenLastCalledWith('');

    cleanup(mounted.root, mounted.host);
  });

  it('does not hijack unrelated inputs or active IME composition', () => {
    const onBodyChange = vi.fn();
    const mounted = renderEditor(makeProps(onBodyChange, vi.fn()));
    const editable = mounted.host.querySelector('[contenteditable="true"]') as HTMLElement;
    editable.focus();
    act(() => {
      editable.textContent = 'changed';
      editable.dispatchEvent(new Event('input', { bubbles: true }));
    });
    onBodyChange.mockClear();

    const outsideInput = document.createElement('input');
    document.body.appendChild(outsideInput);
    outsideInput.focus();
    expect(fireKey(outsideInput, 'z', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(onBodyChange).not.toHaveBeenCalled();

    editable.focus();
    const composing = fireKey(editable, 'z', { ctrlKey: true, isComposing: true });
    expect(composing.defaultPrevented).toBe(false);
    expect(onBodyChange).not.toHaveBeenCalled();

    outsideInput.remove();
    cleanup(mounted.root, mounted.host);
  });
});
