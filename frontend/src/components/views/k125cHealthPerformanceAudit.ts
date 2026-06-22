/**
 * K-125C — Health workspace progressive rendering & layout audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_HEALTH_SECTION_PREFS } from './features/health/healthSectionPrefs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const K125C_IMMEDIATE_SECTIONS = ['library', 'routine', 'calendar'] as const;
export const K125C_DEFERRED_SECTIONS = ['analytics', 'supporting'] as const;
export const K125C_HEALTH_ORDER = ['workout', 'calendar', 'analytics', 'supporting'] as const;

export function auditK125cHealthPerformance(): Record<string, boolean> {
  const view = readFileSync(join(ROOT, 'components/views/HealthView.tsx'), 'utf8');
  const prefs = readFileSync(join(ROOT, 'components/views/features/health/healthSectionPrefs.ts'), 'utf8');
  const analytics = readFileSync(join(ROOT, 'components/views/features/health/HealthAnalyticsPanel.tsx'), 'utf8');
  const supporting = readFileSync(join(ROOT, 'components/views/features/health/HealthSupportingPanels.tsx'), 'utf8');
  const calendar = readFileSync(join(ROOT, 'components/views/features/health/HealthCalendarPanel.tsx'), 'utf8');
  const library = readFileSync(join(ROOT, 'components/views/features/health/ExerciseLibraryPanel.tsx'), 'utf8');
  const routine = readFileSync(join(ROOT, 'components/views/features/health/WorkoutRoutinePanel.tsx'), 'utf8');
  const deferred = readFileSync(join(ROOT, 'components/views/features/health/HealthDeferredMount.tsx'), 'utf8');

  const workoutIdx = view.indexOf('data-k125c-health-order="workout"');
  const calendarIdx = view.indexOf('<HealthCalendarPanel');
  const analyticsIdx = view.indexOf('dataHook="analytics"');
  const supportingIdx = view.indexOf('dataHook="supporting"');

  return {
    analyticsCollapsedDefault: DEFAULT_HEALTH_SECTION_PREFS.analyticsCollapsed === false
      && prefs.includes('analyticsCollapsed: false'),
    prCollapsedDefault: prefs.includes('prSectionCollapsed: true'),
    recentCollapsedDefault: prefs.includes('recentSessionsCollapsed: true'),
    historyCollapsedDefault: prefs.includes('exerciseHistoryCollapsed: true'),
    immediateLibrary: library.includes('data-k125c-health-immediate="library"'),
    immediateRoutine: routine.includes('data-k125c-health-immediate="routine"') && view.includes('WorkoutRoutinePanel'),
    immediateCalendar: calendar.includes('data-k125c-health-immediate="calendar"'),
    calendarExtracted: calendar.includes('WorkoutMonthCalendar') && !supporting.includes('WorkoutMonthCalendar'),
    deferredMount: deferred.includes('useElementVisible') && view.includes('HealthDeferredMount'),
    deferredAnalytics: view.includes('dataHook="analytics"'),
    deferredSupporting: view.includes('dataHook="supporting"'),
    layoutMarker: view.includes('data-k125c-health-layout'),
    domWorkoutBeforeCalendar: workoutIdx >= 0 && calendarIdx > workoutIdx,
    domCalendarBeforeAnalytics: calendarIdx >= 0 && analyticsIdx > calendarIdx,
    domAnalyticsBeforeSupporting: analyticsIdx >= 0 && supportingIdx > analyticsIdx,
    compactEmpty: view.includes('data-k125c-empty-compact'),
    analyticsOrderHook: analytics.includes('data-k125c-health-order="analytics"'),
    supportingOrderHook: supporting.includes('data-k125c-health-order="supporting"'),
    supportingTwoCol: supporting.includes('lg:grid-cols-2'),
    noCalendarInSupporting: !supporting.includes('WorkoutMonthCalendar'),
  };
}

export function auditK125cHealthPerformanceRc(): boolean {
  return Object.values(auditK125cHealthPerformance()).every(Boolean);
}
