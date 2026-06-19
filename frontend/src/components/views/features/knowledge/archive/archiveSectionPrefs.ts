export const ARCHIVE_SECTION_PREFS_KEY = 'absinthe-archive-sections';

export interface ArchiveSectionPrefs {
  historyCollapsed: boolean;
  deletedCollapsed: boolean;
  snapshotsCollapsed: boolean;
  timelineCollapsed: boolean;
  restoreToolsCollapsed: boolean;
  browseCollapsed: boolean;
  areasCollapsed: boolean;
}

export const DEFAULT_ARCHIVE_SECTION_PREFS: ArchiveSectionPrefs = {
  historyCollapsed: false,
  deletedCollapsed: false,
  snapshotsCollapsed: false,
  timelineCollapsed: false,
  restoreToolsCollapsed: false,
  browseCollapsed: true,
  areasCollapsed: true,
};

export type ArchiveSectionPrefKey = keyof ArchiveSectionPrefs;

export function readArchiveSectionPrefs(): ArchiveSectionPrefs {
  try {
    const raw = localStorage.getItem(ARCHIVE_SECTION_PREFS_KEY);
    if (!raw) return DEFAULT_ARCHIVE_SECTION_PREFS;
    const parsed = JSON.parse(raw) as Partial<ArchiveSectionPrefs>;
    return {
      historyCollapsed: Boolean(parsed.historyCollapsed),
      deletedCollapsed: Boolean(parsed.deletedCollapsed),
      snapshotsCollapsed: Boolean(parsed.snapshotsCollapsed),
      timelineCollapsed: Boolean(parsed.timelineCollapsed),
      restoreToolsCollapsed: Boolean(parsed.restoreToolsCollapsed),
      browseCollapsed: parsed.browseCollapsed !== undefined ? Boolean(parsed.browseCollapsed) : true,
      areasCollapsed: parsed.areasCollapsed !== undefined ? Boolean(parsed.areasCollapsed) : true,
    };
  } catch {
    return DEFAULT_ARCHIVE_SECTION_PREFS;
  }
}

export function writeArchiveSectionPrefs(prefs: ArchiveSectionPrefs): void {
  try {
    localStorage.setItem(ARCHIVE_SECTION_PREFS_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}
