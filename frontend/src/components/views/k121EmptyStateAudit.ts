/**
 * K-121 — Empty state density audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditEmptyStateDensity(): Record<string, boolean> {
  const timetable = readFileSync(join(ROOT, 'components/views/features/planner/WeeklyTimetableSection.tsx'), 'utf8');
  const health = readFileSync(join(ROOT, 'components/views/HealthView.tsx'), 'utf8');
  const archive = readFileSync(join(ROOT, 'components/views/features/archive/ArchiveUnifiedView.tsx'), 'utf8');
  const empty = readFileSync(join(ROOT, 'components/common/ProductEmptyState.tsx'), 'utf8');
  return {
    productEmptyState: empty.includes('UI_DENSITY.emptyStatePaddingPx'),
    timetableHook: timetable.includes('data-k121-empty-state="planner-timetable"'),
    timetableCompactPadding: timetable.includes('p-2 gap-1') || timetable.includes('py-3'),
    healthHook: health.includes('data-k121-empty-state="health-workouts"'),
    healthUsesProductEmpty: health.includes('ProductEmptyState') && health.includes('data-k121-empty-state'),
    archiveHook: archive.includes('data-k121-empty-state="archive-unified"'),
    archiveTightHint: archive.includes('py-2') && archive.includes('data-k121-empty-state'),
  };
}

export function auditEmptyStateRc(): boolean {
  const r = auditEmptyStateDensity();
  return Object.values(r).every(Boolean);
}
