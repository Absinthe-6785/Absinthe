/**
 * K-120 — Memory / listener leak observation audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const K120_MEMORY_DOMAINS = [
  'search',
  'image-gallery',
  'planner',
  'health',
] as const;

export function auditMemoryObservation(): Record<string, boolean> {
  const search = readFileSync(join(ROOT, 'components/views/features/search/components/SearchWorkspacePalette.tsx'), 'utf8');
  const gallery = readFileSync(join(ROOT, 'components/views/ImageGalleryViewer.tsx'), 'utf8');
  const popover = readFileSync(join(ROOT, 'components/common/popover/Popover.tsx'), 'utf8');
  const planner = readFileSync(join(ROOT, 'components/views/PlannerView.tsx'), 'utf8');
  return {
    searchListenerCleanup: search.includes('removeEventListener'),
    galleryListenerCleanup: gallery.includes('removeEventListener'),
    popoverListenerCleanup: popover.includes('removeEventListener'),
    noNakedSetIntervalSearch: !search.includes('setInterval('),
    noNakedSetIntervalGallery: !gallery.includes('setInterval('),
    plannerProjection: planner.includes('useMemo') || planner.includes('projection'),
  };
}

export function auditMemoryRc(): boolean {
  const r = auditMemoryObservation();
  return r.searchListenerCleanup && r.galleryListenerCleanup && r.popoverListenerCleanup;
}
