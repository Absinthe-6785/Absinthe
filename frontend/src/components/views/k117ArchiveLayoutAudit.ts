/**
 * K-117 — Archive vertical layout audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

export const K117_ARCHIVE_SECTION_ORDER = [
  'history',
  'deleted',
  'snapshots',
  'timeline',
  'restore-tools',
  'browse',
] as const;

export function auditArchiveLayout(): Record<string, boolean> {
  const archive = readFileSync(join(ROOT, 'features/archive/ArchiveUnifiedView.tsx'), 'utf8');
  const prefs = readFileSync(join(ROOT, 'features/knowledge/archive/archiveSectionPrefs.ts'), 'utf8');
  return {
    unifiedLayoutHook: archive.includes('data-k117-archive-layout'),
    noSupportingColumn: !archive.includes('supporting={'),
    browseAfterRestore: archive.indexOf('sectionId="restore-tools"') < archive.indexOf('sectionId="browse"'),
    browseCollapsedDefault: prefs.includes('browseCollapsed: true'),
    compactGap: archive.includes('gap-2 lg:gap-3'),
  };
}

export function auditArchiveLayoutRc(): boolean {
  const r = auditArchiveLayout();
  return r.unifiedLayoutHook && r.noSupportingColumn && r.browseAfterRestore;
}
