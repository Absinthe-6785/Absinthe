/**
 * K-125D — Archive UX accordion & layout audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_ARCHIVE_SECTION_PREFS } from './features/knowledge/archive/archiveSectionPrefs';
import { ARCHIVE_MAJOR_SECTION_KEYS } from './features/archive/hooks/useArchiveSectionPrefs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const K125D_ARCHIVE_MAJOR_SECTIONS = ['history', 'deleted', 'snapshots', 'timeline'] as const;

export function auditK125dArchiveUx(): Record<string, boolean> {
  const unified = readFileSync(join(ROOT, 'components/views/features/archive/ArchiveUnifiedView.tsx'), 'utf8');
  const prefsHook = readFileSync(join(ROOT, 'components/views/features/archive/hooks/useArchiveSectionPrefs.ts'), 'utf8');
  const prefs = readFileSync(join(ROOT, 'components/views/features/knowledge/archive/archiveSectionPrefs.ts'), 'utf8');
  const collapsible = readFileSync(join(ROOT, 'components/views/features/archive/sections/ArchiveCollapsibleSection.tsx'), 'utf8');
  const shell = readFileSync(join(ROOT, 'components/views/features/archive/ArchiveShell.tsx'), 'utf8');

  const historyIdx = unified.indexOf("toggleMajor('historyCollapsed')");
  const deletedIdx = unified.indexOf("toggleMajor('deletedCollapsed')");
  const snapshotsIdx = unified.indexOf("toggleMajor('snapshotsCollapsed')");
  const timelineIdx = unified.indexOf("toggleMajor('timelineCollapsed')");

  return {
    layoutHook: unified.includes('data-k125d-archive-layout'),
    accordionHook: unified.includes('data-k125d-archive-accordion'),
    centeredMaxWidth: unified.includes('max-w-[1200px]') && unified.includes('mx-auto'),
    singleColumnStack: unified.includes('data-k125d-archive-major-stack') && !unified.includes('lg:grid-cols-2'),
    toggleMajorWired: historyIdx >= 0 && deletedIdx > historyIdx && snapshotsIdx > deletedIdx && timelineIdx > snapshotsIdx,
    accordionLogic: prefsHook.includes('toggleMajor') && prefsHook.includes('ARCHIVE_MAJOR_SECTION_KEYS'),
    historyExpandedDefault: DEFAULT_ARCHIVE_SECTION_PREFS.historyCollapsed === false,
    othersCollapsedDefault: DEFAULT_ARCHIVE_SECTION_PREFS.deletedCollapsed === true
      && DEFAULT_ARCHIVE_SECTION_PREFS.snapshotsCollapsed === true
      && DEFAULT_ARCHIVE_SECTION_PREFS.timelineCollapsed === true,
    restoreToolsCollapsedDefault: prefs.includes('restoreToolsCollapsed: true'),
    majorSectionMarkers: collapsible.includes('data-k125d-archive-major'),
    compactSectionPadding: collapsible.includes('p-3 lg:p-3.5'),
    compactEmpty: collapsible.includes('data-k125d-empty-compact'),
    scrollMargin: collapsible.includes('scroll-mt-2'),
    shellTightPadding: shell.includes('lg:px-3'),
    majorKeyCount: ARCHIVE_MAJOR_SECTION_KEYS.length === 4,
  };
}

export function auditK125dArchiveUxRc(): boolean {
  return Object.values(auditK125dArchiveUx()).every(Boolean);
}
