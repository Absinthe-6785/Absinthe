/**
 * K-125F — Health mobile recovery & analytics simplification audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_HEALTH_SECTION_PREFS } from './features/health/healthSectionPrefs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const K125F_MOBILE_WORKOUT_ORDER = ['workout', 'inbody', 'analytics', 'supporting'] as const;

export function auditK125fHealthRecovery(): Record<string, boolean> {
  const view = readFileSync(join(ROOT, 'components/views/HealthView.tsx'), 'utf8');
  const analytics = readFileSync(join(ROOT, 'components/views/features/health/HealthAnalyticsPanel.tsx'), 'utf8');
  const library = readFileSync(join(ROOT, 'components/views/features/health/HealthBlockLibrary.tsx'), 'utf8');
  const blockCard = readFileSync(join(ROOT, 'components/views/features/health/WorkoutBlockCard.tsx'), 'utf8');
  const inbody = readFileSync(join(ROOT, 'components/views/features/health/HealthInbodyQuickPanel.tsx'), 'utf8');
  const nav = readFileSync(join(ROOT, 'components/views/features/health/HealthNavigation.tsx'), 'utf8');
  const sidebar = readFileSync(join(ROOT, 'components/common/Sidebar.tsx'), 'utf8');
  const prefs = readFileSync(join(ROOT, 'components/views/features/health/healthSectionPrefs.ts'), 'utf8');

  const workoutIdx = view.indexOf('data-k125f-workout-hero');
  const inbodyIdx = view.indexOf('<HealthInbodyQuickPanel');
  const analyticsIdx = view.indexOf('dataHook="analytics"');

  return {
    summaryExpandedDefault: DEFAULT_HEALTH_SECTION_PREFS.analyticsCollapsed === false
      && prefs.includes('analyticsCollapsed: false'),
    noStreak: !analytics.includes('k107WorkoutStreak'),
    summaryTwoCol: analytics.includes('grid-cols-2') && analytics.includes('data-k125f-summary-grid'),
    chartsCollapsedDefault: prefs.includes('chartsCollapsed: true'),
    chartsBehindCollapsible: analytics.includes('dataHook="charts"'),
    prCollapsedDefault: prefs.includes('prSectionCollapsed: true'),
    mobileInbodyPanel: inbody.includes('data-k125f-inbody-mobile') && view.includes('HealthInbodyQuickPanel'),
    mobileInbodyBeforeAnalytics: workoutIdx >= 0 && inbodyIdx > workoutIdx && analyticsIdx > inbodyIdx,
    workoutOverlapGuard: view.includes('isolate') && view.includes('data-k125f-workout-hero'),
    workoutMobileOverflow: view.includes('data-k125f-workout-overflow'),
    libraryTagScroll: library.includes('data-k125f-library-tag-scroll') && library.includes('flex-nowrap'),
    blockOverflowMenu: blockCard.includes('data-k125f-block-overflow'),
    blockDesktopHoverDelete: blockCard.includes('hidden lg:block') && blockCard.includes('data-k125f-block-delete'),
    healthNavigation: nav.includes('data-k125f-health-navigation'),
    navMoreSheet: sidebar.includes('data-k125f-nav-more') && sidebar.includes('data-k125f-nav-more-sheet'),
    navThemeInMore: sidebar.includes('data-k125f-nav-more-sheet') && sidebar.includes("updateSetting('darkMode'"),
    routinePanel: view.includes('WorkoutRoutinePanel'),
  };
}

export function auditK125fHealthRecoveryRc(): boolean {
  return Object.values(auditK125fHealthRecovery()).every(Boolean);
}
