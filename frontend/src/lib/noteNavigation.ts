/**
 * Cross-tab note navigation — open a note and switch to the Notes tab (K-30.34).
 *
 * AppContent registers the tab switcher; Archive/Planner call openNote() only.
 */
import { useNotesStore } from '../store/useNotesStore';
import { navigateToNoteWithHistory } from './noteNavigationStack';

export type NotesTabSwitcher = () => void;

let notesTabSwitcher: NotesTabSwitcher | null = null;

/** Called once from AppContent to wire activeTab → Notes. */
export function registerNotesTabSwitcher(switcher: NotesTabSwitcher): () => void {
  notesTabSwitcher = switcher;
  return () => {
    if (notesTabSwitcher === switcher) notesTabSwitcher = null;
  };
}

/** Switch to the Notes tab when a switcher is registered. */
export function switchToNotesTab(): void {
  notesTabSwitcher?.();
}

/** Select note globally and switch to the Notes tab when a switcher is registered. */
export function openNote(noteId: string): void {
  if (!noteId) return;
  navigateToNoteWithHistory(noteId, 'external');
  switchToNotesTab();
}

/** Test-only visibility into registration state. */
export function peekNotesTabSwitcher(): NotesTabSwitcher | null {
  return notesTabSwitcher;
}
