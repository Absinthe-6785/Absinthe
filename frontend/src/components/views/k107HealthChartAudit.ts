/**
 * K-107 — Chart lazy mount audit.
 */
export const K107_CHART_LAZY_RULES = [
  'charts-collapsed-by-default',
  'weekly-chart-only-when-expanded-and-visible',
  'no-canvas-library-on-initial-health-mount',
  'data-k107-health-charts-toggle',
  'data-k107-health-weekly-chart',
] as const;

export function auditHealthChartLazyMount(): readonly string[] {
  return K107_CHART_LAZY_RULES;
}
