/**
 * K-103 — Workspace panel audit.
 */
export const K103_WORKSPACE_FEATURES = [
  { feature: 'pinned-collapse', dataHook: 'data-k103-pinned-workspaces' },
  { feature: 'recent-collapse', dataHook: 'data-k103-recent-workspaces' },
  { feature: 'pinned-empty', dataHook: 'data-k103-pinned-empty' },
  { feature: 'recent-empty', dataHook: 'data-k103-recent-empty' },
  { feature: 'workspace-persist', dataHook: 'workspaceCollapsed' },
] as const;

export interface K103WorkspaceRow {
  feature: string;
  dataHook: string;
}

export function auditWorkspacePanel(): K103WorkspaceRow[] {
  return K103_WORKSPACE_FEATURES.map(f => ({ feature: f.feature, dataHook: f.dataHook }));
}

export function formatK103WorkspaceReport(rows: readonly K103WorkspaceRow[]): string {
  const lines = ['K-103 workspace audit', ''];
  for (const row of rows) {
    lines.push(`  ${row.feature}: ${row.dataHook}`);
  }
  return lines.join('\n');
}
