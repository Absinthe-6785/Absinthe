/**
 * Shared health day-log note title convention (K-67).
 * One note per calendar day (YYYY-MM-DD) for workout, nutrition, and recovery.
 */
const DAY_TITLE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function healthDayNoteTitle(dateLabel: string): string {
  return dateLabel.trim();
}

export function isHealthDayNoteTitle(title: string | undefined | null): boolean {
  return Boolean(title?.trim() && DAY_TITLE_RE.test(title.trim()));
}
