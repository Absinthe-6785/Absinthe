export const NOTE_LIST_SECTION_PREFS_KEY = 'absinthe-note-list-sections';

export interface NoteListSectionPrefs {
  pinnedCollapsed: boolean;
  recentCollapsed: boolean;
  starredCollapsed: boolean;
  todayCollapsed: boolean;
  weekCollapsed: boolean;
  activityCollapsed: boolean;
  traceQuickNavCollapsed: boolean;
  workspaceCollapsed: boolean;
  areasCollapsed: boolean;
}

export const DEFAULT_NOTE_LIST_SECTION_PREFS: NoteListSectionPrefs = {
  pinnedCollapsed: false,
  recentCollapsed: false,
  starredCollapsed: false,
  todayCollapsed: false,
  weekCollapsed: false,
  activityCollapsed: true,
  traceQuickNavCollapsed: true,
  workspaceCollapsed: true,
  areasCollapsed: true,
};

export function readNoteListSectionPrefs(): NoteListSectionPrefs {
  try {
    const raw = localStorage.getItem(NOTE_LIST_SECTION_PREFS_KEY);
    if (!raw) return DEFAULT_NOTE_LIST_SECTION_PREFS;
    const parsed = JSON.parse(raw) as Partial<NoteListSectionPrefs>;
    return {
      pinnedCollapsed: Boolean(parsed.pinnedCollapsed),
      recentCollapsed: Boolean(parsed.recentCollapsed),
      starredCollapsed: Boolean(parsed.starredCollapsed),
      todayCollapsed: Boolean(parsed.todayCollapsed),
      weekCollapsed: Boolean(parsed.weekCollapsed),
      activityCollapsed: parsed.activityCollapsed !== undefined
        ? Boolean(parsed.activityCollapsed)
        : DEFAULT_NOTE_LIST_SECTION_PREFS.activityCollapsed,
      traceQuickNavCollapsed: parsed.traceQuickNavCollapsed !== undefined
        ? Boolean(parsed.traceQuickNavCollapsed)
        : DEFAULT_NOTE_LIST_SECTION_PREFS.traceQuickNavCollapsed,
      workspaceCollapsed: parsed.workspaceCollapsed !== undefined
        ? Boolean(parsed.workspaceCollapsed)
        : DEFAULT_NOTE_LIST_SECTION_PREFS.workspaceCollapsed,
      areasCollapsed: parsed.areasCollapsed !== undefined
        ? Boolean(parsed.areasCollapsed)
        : DEFAULT_NOTE_LIST_SECTION_PREFS.areasCollapsed,
    };
  } catch {
    return DEFAULT_NOTE_LIST_SECTION_PREFS;
  }
}

export function writeNoteListSectionPrefs(prefs: NoteListSectionPrefs): void {
  try {
    localStorage.setItem(NOTE_LIST_SECTION_PREFS_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}
