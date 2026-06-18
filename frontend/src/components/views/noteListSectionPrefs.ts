export const NOTE_LIST_SECTION_PREFS_KEY = 'absinthe-note-list-sections';

export interface NoteListSectionPrefs {
  pinnedCollapsed: boolean;
  recentCollapsed: boolean;
  starredCollapsed: boolean;
  todayCollapsed: boolean;
  weekCollapsed: boolean;
  activityCollapsed: boolean;
  traceQuickNavCollapsed: boolean;
}

export const DEFAULT_NOTE_LIST_SECTION_PREFS: NoteListSectionPrefs = {
  pinnedCollapsed: false,
  recentCollapsed: false,
  starredCollapsed: false,
  todayCollapsed: false,
  weekCollapsed: false,
  activityCollapsed: true,
  traceQuickNavCollapsed: true,
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
      activityCollapsed: Boolean(parsed.activityCollapsed),
      traceQuickNavCollapsed: Boolean(parsed.traceQuickNavCollapsed),
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
