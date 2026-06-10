/** Reuse existing database templates — no special storage */
export const TASK_DATABASE_TEMPLATE_ID = 'project-tracker';

export const JOURNAL_DATABASE_TEMPLATE_ID = 'reading-tracker';

export function getTaskDatabaseTemplateId(): string {
  return TASK_DATABASE_TEMPLATE_ID;
}

export function getJournalDatabaseTemplateId(): string {
  return JOURNAL_DATABASE_TEMPLATE_ID;
}
