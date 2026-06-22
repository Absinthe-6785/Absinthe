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
    chartsCollapsible: panel.includes('dataHook="charts"') && panel.includes('data-k121-health-collapsible'),
    prCollapsible: panel.includes('dataHook="pr"') && panel.includes('data-k121-health-collapsible'),
    recentCollapsible: panel.includes('dataHook="recent-sessions"') && panel.includes('data-k121-health-collapsible'),
    historyCollapsible: panel.includes('dataHook="exercise-history"') && panel.includes('data-k121-health-collapsible'),
    prCollapsedDefault: prefs.includes('prSectionCollapsed: true'),
    recentCollapsedDefault: prefs.includes('recentSessionsCollapsed: true'),
    historyCollapsedDefault: prefs.includes('exerciseHistoryCollapsed: true'),
    analyticsExpandedDefault: prefs.includes('analyticsCollapsed: false'),
    chartsCollapsedDefault: prefs.includes('chartsCollapsed: true'),
  };
}

export function auditHealthAnalyticsRc(): boolean {
  const r = auditHealthAnalyticsSimplification();
  return Object.values(r).every(Boolean);
}
