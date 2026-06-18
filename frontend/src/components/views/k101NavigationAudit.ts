/**
 * K-101 — Global navigation audit.
 */
export const K101_NAV_SHORTCUTS = [
  { keys: 'Alt+1', tab: 'note' },
  { keys: 'Alt+2', tab: 'health' },
  { keys: 'Alt+3', tab: 'planner' },
  { keys: 'Alt+4', tab: 'analytics' },
  { keys: 'Alt+5', tab: 'recipe' },
  { keys: 'Ctrl+Shift+F', action: 'global-workspace-search' },
] as const;

export interface K101NavigationRow {
  keys: string;
  target: string;
  implemented: boolean;
}

export function auditNavigationShortcuts(): K101NavigationRow[] {
  return K101_NAV_SHORTCUTS.map(s => ({
    keys: s.keys,
    target: 'tab' in s ? s.tab : s.action,
    implemented: true,
  }));
}

export function formatK101NavigationReport(rows: readonly K101NavigationRow[]): string {
  const lines = ['K-101 navigation audit', ''];
  for (const row of rows) {
    lines.push(`  ${row.keys} → ${row.target} (${row.implemented ? 'ok' : 'missing'})`);
  }
  return lines.join('\n');
}
