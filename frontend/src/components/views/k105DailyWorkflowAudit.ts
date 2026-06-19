/** K-105 — Daily note workflow audit (Option C). */
export const K105_DAILY_WORKFLOW_HOOKS = [
  'data-k105-planner-today',
  'data-k105-planner-todays-note',
  'data-k105-planner-recent-activity',
  'data-k105-planner-today-schedule',
] as const;

export function auditDailyWorkflow(): readonly string[] {
  return K105_DAILY_WORKFLOW_HOOKS;
}

export function formatK105DailyWorkflowReport(hooks: readonly string[]): string {
  return ['K-105 daily workflow audit', '', ...hooks.map(h => `  ${h}`)].join('\n');
}
