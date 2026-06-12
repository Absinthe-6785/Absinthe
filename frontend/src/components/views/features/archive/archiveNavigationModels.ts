/** Internal Archive branch — only home is reachable in K-30.11. */
export type ArchiveViewMode = 'home' | 'period' | 'area' | 'timeline';

export const ARCHIVE_VIEW_MODES = ['home', 'period', 'area', 'timeline'] as const satisfies readonly ArchiveViewMode[];

export function archiveViewModeLabel(mode: ArchiveViewMode): string {
  switch (mode) {
    case 'home':
      return 'Home';
    case 'period':
      return 'Period';
    case 'area':
      return 'Area';
    case 'timeline':
      return 'Timeline';
    default:
      return mode;
  }
}

export function isArchiveViewMode(value: string): value is ArchiveViewMode {
  return (ARCHIVE_VIEW_MODES as readonly string[]).includes(value);
}

/** Default shell mode — home only until branch navigation ships. */
export const DEFAULT_ARCHIVE_VIEW_MODE: ArchiveViewMode = 'home';
