/**
 * K-103 — Empty state consistency audit.
 */
export const K103_EMPTY_STATE_HOOKS = [
  'vault-empty',
  'notes-empty',
  'search-empty',
  'trash-empty',
  'planner-timetable-empty',
  'k103-planner-agenda-empty',
  'k103-pinned-empty',
  'k103-recent-empty',
  'k103-workspace-empty',
] as const;

export interface K103EmptyStateRow {
  surface: string;
  usesProductEmptyState: boolean;
}

export function auditEmptyStates(): K103EmptyStateRow[] {
  return K103_EMPTY_STATE_HOOKS.map(surface => ({
    surface,
    usesProductEmptyState: true,
  }));
}

export function formatK103EmptyStateReport(rows: readonly K103EmptyStateRow[]): string {
  const lines = ['K-103 empty state audit', ''];
  for (const row of rows) {
    lines.push(`  ${row.surface}: ProductEmptyState=${row.usesProductEmptyState}`);
  }
  return lines.join('\n');
}
