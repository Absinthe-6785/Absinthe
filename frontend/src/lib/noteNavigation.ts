/**
 * Cross-tab note navigation — open a note and switch to the Notes tab (K-30.34).
 *
 * AppContent registers the tab switcher; Archive/Planner call openNote() only.
 */
import { useNotesStore } from '../store/useNotesStore';

export type NotesTabSwitcher = () => void;

let notesTabSwitcher: NotesTabSwitcher | null = null;

/** Called once from AppContent to wire activeTab → Notes. */
export function registerNotesTabSwitcher(switcher: NotesTabSwitcher): () => void {
  notesTabSwitcher = switcher;
  return () => {
    if (notesTabSwitcher === switcher) notesTabSwitcher = null;
  };
}

/** Select note globally and switch to the Notes tab when a switcher is registered. */
export function openNote(noteId: string): void {
  if (!noteId) return;
  useNotesStore.getState().setActiveNoteId(noteId);
  notesTabSwitcher?.();
}

/** Test-only visibility into registration state. */
export function peekNotesTabSwitcher(): NotesTabSwitcher | null {
  return notesTabSwitcher;
}
