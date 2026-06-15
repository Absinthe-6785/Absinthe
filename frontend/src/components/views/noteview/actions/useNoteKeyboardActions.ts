import { useCallback, useEffect, useRef } from 'react';
import { useNotesStore } from '../../../../store/useNotesStore';
import { findNoteByTitle } from '../../noteUtils';
import type { NoteBase as Note } from '../../noteUtils';
import { toggleEditReading } from '../../editorMode';
import { navigateToNoteWithHistory } from '../../../../lib/noteNavigationStack';
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
    setViewMode,
    setWorkspaceSearchOpen,
    setShowShortcuts,
    setShowSortMenu,
    setFocusMode,
    setSearchScope,
    setActiveNoteId,
    flushPendingSync,
    syncNoteToDB,
  } = params;

  const navigateToWiki = useCallback((title: string, opts?: { preferReading?: boolean }) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const found = findNoteByTitle(trimmed, notes);
    if (found) {
      navigateToNoteWithHistory(found.id, 'wiki');
      if (opts?.preferReading) setViewMode('reading');
      return;
    }
    createNote({ title: trimmed, body: '' });
  }, [notes, setViewMode, createNote]);

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
        setWorkspaceSearchOpen(true);
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
          setWorkspaceSearchOpen(true);
          break;
        case 'n': e.preventDefault(); cn(); break;
        case 'd': e.preventDefault(); { if (an) dn(an); } break;
        case 'e': e.preventDefault(); setViewMode(v => toggleEditReading(v)); break;
        case 'g': e.preventDefault(); setViewMode(v => v === 'graph' ? 'edit' : 'graph'); break;
        case 'f':
          e.preventDefault();
          if (e.shiftKey) setFocusMode(v => !v);
          else shortcutRef.current.focusSearch();
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
