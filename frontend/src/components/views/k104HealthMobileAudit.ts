/** K-104 — Health mobile layout audit. */
export const K104_HEALTH_MOBILE_HOOKS = [
  'data-k104-health-workout-footer',
  'data-k104-health-no-sticky-mobile',
] as const;

export function auditHealthMobileLayout(): string[] {
  return [...K104_HEALTH_MOBILE_HOOKS];
}

export function formatK104HealthMobileReport(hooks: readonly string[]): string {
  return ['K-104 health mobile audit', '', ...hooks.map(h => `  ${h}`)].join('\n');
}
