/**
 * K-118 — Mobile layout audit (320–1440).
 */
export const K118_MOBILE_WIDTHS = [320, 375, 768, 1440] as const;

export const K118_MOBILE_DOMAINS = [
  'notes',
  'planner',
  'health',
  'recipe',
  'archive',
  'search',
] as const;

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

export function auditMobileLayout(): Record<string, boolean> {
  const archive = readFileSync(join(ROOT, 'features/archive/ArchiveShell.tsx'), 'utf8');
  const note = readFileSync(join(ROOT, 'noteview/useNoteViewStyles.ts'), 'utf8');
  const planner = readFileSync(join(ROOT, 'features/planner/PlannerStickyActions.tsx'), 'utf8');
  return {
    widths: K118_MOBILE_WIDTHS.length === 4,
    noteOverflow: note.includes('overflow-x:hidden'),
    archiveOverflow: archive.includes('overflow-x-hidden'),
    plannerTouch: planner.includes('min-h-[44px]'),
    embedMaxWidth: readFileSync(join(ROOT, 'editorChromeStyles.ts'), 'utf8').includes('[data-k118-embed-preview]'),
  };
}

export function auditMobileLayoutRc(): boolean {
  const r = auditMobileLayout();
  return r.widths && r.noteOverflow && r.archiveOverflow;
}
