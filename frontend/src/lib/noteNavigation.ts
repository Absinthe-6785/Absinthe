/**
 * Cross-tab note navigation — open a note and switch to the Notes tab (K-30.34, K-66, K-67).
 */
import type { TabId } from '../components/common/Sidebar';
import { useNotesStore } from '../store/useNotesStore';
import { setNoteBreadcrumb, type NoteBreadcrumbSegment } from './noteBreadcrumb';
import { healthDayNoteTitle } from './healthDayNotes';
import { navigateToNoteWithHistory, type NoteNavigationSource } from './noteNavigationStack';

export type NotesTabSwitcher = () => void;
export type AppTabSwitcher = (tab: TabId) => void;

export interface OpenNoteOptions {
  returnTab?: TabId;
  breadcrumb?: readonly NoteBreadcrumbSegment[];
}

const RETURN_TAB_KEY = 'absinthe.noteNav.returnTab';

let notesTabSwitcher: NotesTabSwitcher | null = null;
let appTabSwitcher: AppTabSwitcher | null = null;
let workspaceSearchOpener: (() => void) | null = null;
const returnTabListeners = new Set<() => void>();

function notifyReturnTab(): void {
  returnTabListeners.forEach(fn => fn());
}

function sourceForReturnTab(tab: TabId | undefined): NoteNavigationSource {
  if (tab === 'planner') return 'schedule';
  if (tab === 'health') return 'health';
  if (tab === 'analytics') return 'archive';
  return 'external';
}

/** Called once from AppContent to wire activeTab → Notes. */
export function registerNotesTabSwitcher(switcher: NotesTabSwitcher): () => void {
  notesTabSwitcher = switcher;
  return () => {
    if (notesTabSwitcher === switcher) notesTabSwitcher = null;
  };
}

/** Switch to any main tab (K-66 cross-workspace return). */
export function registerAppTabSwitcher(switcher: AppTabSwitcher): () => void {
  appTabSwitcher = switcher;
  return () => {
    if (appTabSwitcher === switcher) appTabSwitcher = null;
  };
}

/** Open workspace search from any tab (K-101 Ctrl+Shift+F). */
export function registerWorkspaceSearchOpener(opener: () => void): () => void {
  workspaceSearchOpener = opener;
  return () => {
    if (workspaceSearchOpener === opener) workspaceSearchOpener = null;
  };
}

export function openWorkspaceSearch(): void {
  switchToNotesTab();
  workspaceSearchOpener?.();
}

export function subscribeNoteReturnTab(listener: () => void): () => void {
  returnTabListeners.add(listener);
  return () => returnTabListeners.delete(listener);
}

export function getNoteReturnTab(): TabId | null {
  try {
    const raw = sessionStorage.getItem(RETURN_TAB_KEY);
    if (!raw) return null;
    return raw as TabId;
  } catch {
    return null;
  }
}

export function setNoteReturnTab(tab: TabId | null): void {
  try {
    if (tab) sessionStorage.setItem(RETURN_TAB_KEY, tab);
    else sessionStorage.removeItem(RETURN_TAB_KEY);
  } catch {
    /* */
  }
  notifyReturnTab();
}

export function clearNoteReturnTab(): void {
  setNoteReturnTab(null);
}

/** Switch to the Notes tab when a switcher is registered. */
export function switchToNotesTab(): void {
  notesTabSwitcher?.();
}

/** Switch to a main app tab. */
export function switchToTab(tab: TabId): void {
  appTabSwitcher?.(tab);
}

/** Navigate to a note with optional return path and breadcrumb (in-tab or cross-tab). */
export function navigateToNote(
  toId: string,
  source: NoteNavigationSource = 'panel',
  options?: Pick<OpenNoteOptions, 'breadcrumb'>,
): void {
  if (!toId) return;
  if (options?.breadcrumb?.length) setNoteBreadcrumb(options.breadcrumb);
  navigateToNoteWithHistory(toId, source);
}

/** Select note globally and switch to the Notes tab when a switcher is registered. */
export function openNote(noteId: string, options?: OpenNoteOptions): void {
  if (!noteId) return;
  if (options?.returnTab) setNoteReturnTab(options.returnTab);
  if (options?.breadcrumb?.length) setNoteBreadcrumb(options.breadcrumb);
  navigateToNoteWithHistory(noteId, sourceForReturnTab(options?.returnTab));
  switchToNotesTab();
}

/** Return to the workspace that opened the current note flow. */
export function returnFromNote(): boolean {
  const tab = getNoteReturnTab();
  if (!tab) return false;
  clearNoteReturnTab();
  switchToTab(tab);
  return true;
}

/** Open or create a dated health log note and preserve Health return path. */
export function openHealthDayNote(
  dateLabel: string,
  createNote: () => string,
  updateNote: (id: string, patch: { title: string }) => void,
  breadcrumb?: readonly NoteBreadcrumbSegment[],
): void {
  const title = healthDayNoteTitle(dateLabel);
  const notes = useNotesStore.getState().notes;
  const existing = notes.find(n => !n.deletedAt && n.title.trim() === title);
  const noteId = existing?.id ?? (() => {
    const id = createNote();
    updateNote(id, { title });
    return id;
  })();
  const crumbs = breadcrumb ?? [
    { type: 'key' as const, key: 'healthNavWorkout' },
    { type: 'key' as const, key: 'healthOpenDayNote' },
  ];
  openNote(noteId, { returnTab: 'health', breadcrumb: crumbs });
}

/** Test-only visibility into registration state. */
export function peekNotesTabSwitcher(): NotesTabSwitcher | null {
  return notesTabSwitcher;
}

export function peekWorkspaceSearchOpener(): (() => void) | null {
  return workspaceSearchOpener;
}

export type { NoteBreadcrumbSegment } from './noteBreadcrumb';
export { setNoteBreadcrumb, clearNoteBreadcrumb, getNoteBreadcrumb } from './noteBreadcrumb';
