import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useNotesStore } from '../../../../store/useNotesStore';
import { findNoteByTitle } from '../../noteUtils';
import { parseIdWikiLink, type WikiNavigationTarget } from '../../wikiLinks';
import { captureWikiPublication } from '../../wikiNoteAuthority';
import type { NoteBase as Note } from '../../noteUtils';
import { toggleEditReading } from '../../editorMode';
import { cancelScheduledEditorModeFocus, scheduleEditorFocus, scheduleEditorModeFocus } from '../editorFocus';
import { toDateKey } from '../../features/knowledge/databaseViews/parseDatabaseDate';
import { openOrCreateDailyNote } from '../../k101DailyNote';
import { navigateToNoteWithHistory } from '../../../../lib/noteNavigationStack';
import { openWorkspaceSearch } from '../../../../lib/noteNavigation';
import { useNoteNavigationStack } from '../../../../hooks/useNoteNavigationStack';
import type { CreateNoteFn, UseNoteViewActionsParams } from './types';

export function useNoteKeyboardActions(
  params: UseNoteViewActionsParams,
  createNote: CreateNoteFn,
  duplicateNote: (note: Note) => void,
) {
  const {
    notes,
    activeNote,
    activeNoteId,
    viewMode,
    showSortMenu,
    searchInputRef,
    blockEditorRef,
    editorScrollRef,
    setViewMode,
    setShowShortcuts,
    setShowSortMenu,
    setFocusMode,
    setSearchScope,
    setDocumentSearchOpen,
    setActiveNoteId,
    flushPendingSync,
    syncNoteToDB,
  } = params;

  const editorModeStateRef = useRef({ viewMode, activeNoteId });
  editorModeStateRef.current = { viewMode, activeNoteId };
  const pendingModeFocusCancelRef = useRef<(() => void) | null>(null);
  const previousModeFocusNoteIdRef = useRef(activeNoteId);
  useLayoutEffect(() => {
    if (previousModeFocusNoteIdRef.current === activeNoteId) return;
    pendingModeFocusCancelRef.current?.();
    pendingModeFocusCancelRef.current = null;
    cancelScheduledEditorModeFocus(editorScrollRef.current);
    previousModeFocusNoteIdRef.current = activeNoteId;
  }, [activeNoteId]);
  useEffect(() => () => pendingModeFocusCancelRef.current?.(), []);

  const setEditorMode = (nextMode: typeof viewMode) => {
    const currentMode = editorModeStateRef.current.viewMode;
    const isReadingEditTransition = (currentMode === 'reading' && nextMode === 'edit')
      || (currentMode === 'edit' && nextMode === 'reading');
    cancelScheduledEditorModeFocus(editorScrollRef.current);
    pendingModeFocusCancelRef.current?.();
    pendingModeFocusCancelRef.current = null;
    if (isReadingEditTransition) {
      const transitionNoteId = editorModeStateRef.current.activeNoteId;
      pendingModeFocusCancelRef.current = scheduleEditorModeFocus(blockEditorRef, editorScrollRef, {
        focus: nextMode === 'edit',
        isCurrent: () => editorModeStateRef.current.activeNoteId === transitionNoteId
          && editorModeStateRef.current.viewMode === nextMode,
      });
    } else if (nextMode === 'edit') {
      scheduleEditorFocus(blockEditorRef);
    }
    setViewMode(nextMode);
  };

  const wikiPublication = captureWikiPublication();
  const navigateToWiki = useCallback((title: WikiNavigationTarget, opts?: { preferReading?: boolean }) => {
    if (typeof title !== 'string') {
      const idLink = parseIdWikiLink(title.raw);
      if (!idLink) return;
      const target = wikiPublication.resolve(idLink);
      if (!target) return;
      navigateToNoteWithHistory(target.id, 'wiki');
      if (opts?.preferReading) {
        cancelScheduledEditorModeFocus(editorScrollRef.current);
        setViewMode('reading');
      }
      return;
    }
    const trimmed = title.trim();
    if (!trimmed) return;
    const found = findNoteByTitle(trimmed, notes);
    if (found) {
      navigateToNoteWithHistory(found.id, 'wiki');
      if (opts?.preferReading) {
        cancelScheduledEditorModeFocus(editorScrollRef.current);
        setViewMode('reading');
      }
      return;
    }
    createNote({ title: trimmed, body: '' });
  }, [notes, setViewMode, createNote, wikiPublication]);

  const { canBack, canForward, goBack, goForward } = useNoteNavigationStack();

  const shortcutRef = useRef({
    showSortMenu, viewMode, activeNote, createNote, duplicateNote,
    focusSearch: () => {},
  });
  const syncShortcutRef = useRef({
    flushPendingSync,
    syncNoteToDB,
    getActiveNote: () => null as Note | null,
  });

  useEffect(() => {
    shortcutRef.current = {
      showSortMenu, viewMode, activeNote, createNote, duplicateNote,
      focusSearch: () => {
        setDocumentSearchOpen(true);
        searchInputRef.current?.focus();
        setSearchScope('document');
      },
    };
    syncShortcutRef.current = {
      flushPendingSync,
      syncNoteToDB,
      getActiveNote: () => useNotesStore.getState().notes.find(n => n.id === activeNoteId) ?? null,
    };
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const { showSortMenu: sm, activeNote: an, createNote: cn, duplicateNote: dn } = shortcutRef.current;
    const notes = useNotesStore.getState().notes;
      const mod = e.ctrlKey || e.metaKey;
      if (sm && e.key === 'Escape') { setShowSortMenu(false); return; }

      const target = e.target;
      if (!mod && e.key === '?') {
        if (
          target instanceof HTMLElement
          && !target.closest('[contenteditable="true"], .be-editable, input, textarea')
          && !target.closest('.be-editor-root')
        ) {
          e.preventDefault();
          setShowShortcuts(v => !v);
        }
        return;
      }

      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack();
        return;
      }
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        goForward();
        return;
      }

      if (mod && e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        const todayKey = toDateKey(new Date());
        openOrCreateDailyNote({
          notes,
          dateKey: todayKey,
          createNote: opts => cn({ title: opts.title, body: opts.body }),
          setActiveNoteId,
        });
        return;
      }

      if (!mod) return;

      if (e.key === 's') {
        e.preventDefault();
        const { flushPendingSync: flush, syncNoteToDB: sync, getActiveNote } = syncShortcutRef.current;
        flush();
        const note = getActiveNote();
        if (note) void sync(note);
        return;
      }

      if (
        target instanceof HTMLElement
        && target.closest('[contenteditable="true"], .be-editable')
      ) {
        return;
      }

      switch (e.key) {
        case 'k':
          e.preventDefault();
          openWorkspaceSearch();
          break;
        case 'n': e.preventDefault(); cn(); break;
        case 'd': e.preventDefault(); { if (an) dn(an); } break;
        case 'e':
          e.preventDefault();
          setEditorMode(toggleEditReading(editorModeStateRef.current.viewMode));
          break;
        case 'g':
          e.preventDefault();
          setEditorMode(editorModeStateRef.current.viewMode === 'graph' ? 'edit' : 'graph');
          break;
        case 'f':
          e.preventDefault();
          if (e.shiftKey) openWorkspaceSearch();
          else {
            setDocumentSearchOpen(true);
            searchInputRef.current?.focus();
            setSearchScope('document');
          }
          break;
        case '/':
          if (target instanceof HTMLElement && target.closest('.be-editor-root')) break;
          e.preventDefault();
          setShowShortcuts(v => !v);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { navigateToWiki, canBack, canForward, goBack, goForward };
}
