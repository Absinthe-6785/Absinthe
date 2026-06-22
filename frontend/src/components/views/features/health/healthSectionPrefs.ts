export const HEALTH_SECTION_PREFS_KEY = 'absinthe-health-sections';

export interface HealthSectionPrefs {
  analyticsCollapsed: boolean;
  chartsCollapsed: boolean;
  prSectionCollapsed: boolean;
  recentSessionsCollapsed: boolean;
  exerciseHistoryCollapsed: boolean;
  inbodyHistoryCollapsed: boolean;
}

export const DEFAULT_HEALTH_SECTION_PREFS: HealthSectionPrefs = {
  analyticsCollapsed: true,
  chartsCollapsed: true,
  prSectionCollapsed: true,
  recentSessionsCollapsed: true,
  exerciseHistoryCollapsed: true,
  inbodyHistoryCollapsed: true,
};

export function readHealthSectionPrefs(): HealthSectionPrefs {
  try {
    const raw = localStorage.getItem(HEALTH_SECTION_PREFS_KEY);
    if (!raw) return DEFAULT_HEALTH_SECTION_PREFS;
    const parsed = JSON.parse(raw) as Partial<HealthSectionPrefs>;
    return {
      analyticsCollapsed: parsed.analyticsCollapsed ?? DEFAULT_HEALTH_SECTION_PREFS.analyticsCollapsed,
      chartsCollapsed: parsed.chartsCollapsed ?? DEFAULT_HEALTH_SECTION_PREFS.chartsCollapsed,
      prSectionCollapsed: parsed.prSectionCollapsed ?? DEFAULT_HEALTH_SECTION_PREFS.prSectionCollapsed,
      recentSessionsCollapsed: parsed.recentSessionsCollapsed ?? DEFAULT_HEALTH_SECTION_PREFS.recentSessionsCollapsed,
      exerciseHistoryCollapsed: parsed.exerciseHistoryCollapsed ?? DEFAULT_HEALTH_SECTION_PREFS.exerciseHistoryCollapsed,
      inbodyHistoryCollapsed: parsed.inbodyHistoryCollapsed ?? DEFAULT_HEALTH_SECTION_PREFS.inbodyHistoryCollapsed,
    };
  } catch {
    return DEFAULT_HEALTH_SECTION_PREFS;
  }
}

export function writeHealthSectionPrefs(prefs: HealthSectionPrefs): void {
  try {
    localStorage.setItem(HEALTH_SECTION_PREFS_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}
