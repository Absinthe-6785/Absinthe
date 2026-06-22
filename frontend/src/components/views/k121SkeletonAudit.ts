/**
 * K-121 — fixed skeleton heights audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditSkeletonHeights(): Record<string, boolean> {
  const tokens = readFileSync(join(ROOT, 'lib/k121SkeletonHeights.ts'), 'utf8');
  const analytics = readFileSync(join(ROOT, 'components/views/features/health/HealthAnalyticsPanel.tsx'), 'utf8');
  const calendar = readFileSync(join(ROOT, 'components/views/features/health/HealthCalendarPanel.tsx'), 'utf8');
  return {
    tokenModule: tokens.includes('K121_SKELETON_HEIGHT'),
    analyticsSummary: tokens.includes('analyticsSummary') && analytics.includes('K121_SKELETON_HEIGHT.analyticsSummary'),
    analyticsPr: tokens.includes('analyticsPr') && analytics.includes('K121_SKELETON_HEIGHT.analyticsPr'),
    analyticsRecent: tokens.includes('analyticsRecent') && analytics.includes('K121_SKELETON_HEIGHT.analyticsRecent'),
    analyticsHistory: tokens.includes('analyticsHistory') && analytics.includes('K121_SKELETON_HEIGHT.analyticsHistory'),
    calendarPanel: calendar.includes('data-k125c-health-immediate="calendar"'),
  };
}

export function auditSkeletonRc(): boolean {
  const r = auditSkeletonHeights();
  return Object.values(r).every(Boolean);
}
