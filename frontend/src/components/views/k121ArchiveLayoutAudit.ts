/**
 * K-121 — Archive layout recovery audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditArchiveLayoutRecovery(): Record<string, boolean> {
  const archive = readFileSync(join(ROOT, 'components/views/features/archive/ArchiveUnifiedView.tsx'), 'utf8');
  return {
    layoutHook: archive.includes('data-k121-archive-layout'),
    centeredMaxWidth: archive.includes('max-w-[1320px]') && archive.includes('mx-auto'),
    twoColumnDesktop: archive.includes('lg:grid-cols-2'),
    historySection: archive.includes('ArchiveHistorySection'),
    deletedSection: archive.includes('ArchiveDeletedSection'),
    snapshotsSection: archive.includes('ArchiveSnapshotsSection'),
    timelineSection: archive.includes('ArchiveTimelineSection'),
    restoreToolsBelow: archive.includes('ArchiveRestoreToolsSection'),
    noNarrowStack: !archive.includes('max-w-3xl'),
  };
}

export function auditArchiveLayoutRc(): boolean {
  const r = auditArchiveLayoutRecovery();
  return Object.values(r).every(Boolean);
}
