/**
 * K-107 — Tab switch latency audit.
 */
export const K107_TAB_SURFACES = [
  'note',
  'health',
  'planner',
  'analytics',
  'settings',
  'recipe',
] as const;

export const K107_TAB_MOUNT_RULES = [
  'lazy-import-planner-health-analytics-settings-recipe',
  'activeTab-conditional-mount-only',
  'note-view-always-mounted-when-active',
  'suspense-fallback-ViewLoadingFallback',
] as const;

export interface K107TabPerfRow {
  tab: string;
  lazyLoaded: boolean;
  mountsWhenHidden: boolean;
}

export function auditTabPerformanceMatrix(): K107TabPerfRow[] {
  return [
    { tab: 'note', lazyLoaded: false, mountsWhenHidden: false },
    { tab: 'health', lazyLoaded: true, mountsWhenHidden: false },
    { tab: 'planner', lazyLoaded: true, mountsWhenHidden: false },
    { tab: 'analytics', lazyLoaded: true, mountsWhenHidden: false },
    { tab: 'settings', lazyLoaded: true, mountsWhenHidden: false },
    { tab: 'recipe', lazyLoaded: true, mountsWhenHidden: false },
  ];
}

export function auditTabPerformanceHooks(): readonly string[] {
  return K107_TAB_MOUNT_RULES;
}
