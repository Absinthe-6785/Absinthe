/**
 * K-121 — Health analytics simplification audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditHealthAnalyticsSimplification(): Record<string, boolean> {
  const panel = readFileSync(join(ROOT, 'components/views/features/health/HealthAnalyticsPanel.tsx'), 'utf8');
  const prefs = readFileSync(join(ROOT, 'components/views/features/health/healthSectionPrefs.ts'), 'utf8');
  return {
    analyticsHook: panel.includes('data-k121-health-analytics'),
    summaryGrid: panel.includes('data-k121-health-summary') && panel.includes('grid-cols-2'),
    weeklySessions: panel.includes('k107WeeklySessions'),
    monthlySessions: panel.includes('k107MonthlySessions'),
    noStreak: !panel.includes('k107WorkoutStreak'),
    noRecentSessions: !panel.includes('k107RecentSessions'),
    prCollapsible: panel.includes('dataHook="pr"') && panel.includes('data-k121-health-collapsible'),
    historyCollapsible: panel.includes('dataHook="exercise-history"') && panel.includes('data-k121-health-collapsible'),
    historyOpenWorkoutNote: panel.includes('k113OpenWorkoutNote') && panel.includes('exercise-history'),
    prCollapsedDefault: prefs.includes('prSectionCollapsed: true'),
    historyCollapsedDefault: prefs.includes('exerciseHistoryCollapsed: true'),
    chartsCollapsedDefault: prefs.includes('chartsCollapsed: true'),
    analyticsOpenDefault: prefs.includes('analyticsCollapsed: false'),
  };
}

export function auditHealthAnalyticsRc(): boolean {
  const r = auditHealthAnalyticsSimplification();
  return Object.values(r).every(Boolean);
}
