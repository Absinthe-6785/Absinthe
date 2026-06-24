/**
 * K-126A — Health analytics simplification & mobile flow audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditK126aAnalyticsSimplification(): Record<string, boolean> {
  const panel = readFileSync(join(ROOT, 'components/views/features/health/HealthAnalyticsPanel.tsx'), 'utf8');
  const health = readFileSync(join(ROOT, 'components/views/HealthView.tsx'), 'utf8');
  return {
    twoColumnSummary: panel.includes('grid-cols-2') && panel.includes('data-k126-health-summary-grid'),
    noStreakUi: !panel.includes('k107WorkoutStreak'),
    noRecentSessionsUi: !panel.includes('k107RecentSessions'),
    historyOpenNote: panel.includes('k113OpenWorkoutNote') && panel.includes('exercise-history'),
    compactChart: panel.includes('h-12') && panel.includes('data-k126-health-chart'),
    analyticsHook: panel.includes('data-k126-health-analytics'),
    overviewAnalysisSplit:
      health.includes("healthSection === 'analysis'") &&
      health.includes('data-k129b-health-overview') &&
      health.includes('data-k129b-health-analysis-view') &&
      health.includes('standalone'),
    workoutRecordsScroll:
      health.includes('data-k129b-workout-records-scroll') &&
      health.includes('data-k134b-health-natural-scroll') &&
      !health.includes('lg:max-h-full'),
    inbodyQuickHook: readFileSync(join(ROOT, 'components/views/features/health/HealthInbodyQuickPanel.tsx'), 'utf8').includes('data-k126-inbody-quick'),
    scrollAfterSave: health.includes('inbodyQuickRef') && health.includes('scrollIntoView'),
  };
}

export function auditK126aMobileFlow(): Record<string, boolean> {
  const blockCard = readFileSync(join(ROOT, 'components/views/features/health/WorkoutBlockCard.tsx'), 'utf8');
  const library = readFileSync(join(ROOT, 'components/views/features/health/HealthBlockLibrary.tsx'), 'utf8');
  const health = readFileSync(join(ROOT, 'components/views/HealthView.tsx'), 'utf8');
  return {
    workoutBlockCardExtracted: library.includes('WorkoutBlockCard'),
    blockOverflowMenu: blockCard.includes('data-k126-block-overflow-menu'),
    blockIsolate: blockCard.includes('isolate z-0'),
    workoutOverflowMenu: health.includes('data-k126-workout-overflow-menu'),
    workoutCardIsolate: health.includes('data-k126-workout-exercise-card') && health.includes('isolate z-0'),
    inbodyQuickPanel: readFileSync(join(ROOT, 'components/views/features/health/HealthInbodyQuickPanel.tsx'), 'utf8').includes('data-k126-inbody-quick'),
  };
}

export function auditK126aRc(): boolean {
  return [
    ...Object.values(auditK126aAnalyticsSimplification()),
    ...Object.values(auditK126aMobileFlow()),
  ].every(Boolean);
}
