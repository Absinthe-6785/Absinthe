/** K-104 — Schedule CRUD audit. */
export const K104_SCHEDULE_FEATURES = [
  'day-schedule-timeline',
  'schedule-detail-panel',
  'schedule-edit-modal',
  'schedule-duplicate',
  'schedule-delete-confirm',
] as const;

export function auditScheduleCrud(): string[] {
  return [...K104_SCHEDULE_FEATURES];
}

export function formatK104ScheduleReport(features: readonly string[]): string {
  return ['K-104 schedule audit', '', ...features.map(f => `  ${f}`)].join('\n');
}
