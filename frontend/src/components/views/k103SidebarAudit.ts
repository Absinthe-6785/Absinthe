/**
 * K-103 — Sidebar hierarchy audit.
 */
export const K103_SIDEBAR_SECTIONS = [
  { id: 'favorites', dataHook: 'data-k103-favorites-section', alwaysVisible: true },
  { id: 'recent-activity', dataHook: 'data-k105-planner-recent-activity', defaultCollapsed: true, movedTo: 'planner' },
  { id: 'timeline-lens', dataHook: 'data-trace-quick-nav-toggle', defaultCollapsed: true },
  { id: 'folders', dataHook: 'data-k103-folders-section', alwaysVisible: true },
  { id: 'trash', dataHook: 'data-k104-trash-section', alwaysVisible: true },
] as const;

export interface K103SidebarRow {
  id: string;
  dataHook: string;
  persisted: boolean;
}

export function auditSidebarHierarchy(): K103SidebarRow[] {
  return K103_SIDEBAR_SECTIONS.map(s => ({
    id: s.id,
    dataHook: s.dataHook,
    persisted: s.id !== 'folders',
  }));
}

export function formatK103SidebarReport(rows: readonly K103SidebarRow[]): string {
  const lines = ['K-103 sidebar audit', ''];
  for (const row of rows) {
    lines.push(`  ${row.id}: ${row.dataHook} persisted=${row.persisted}`);
  }
  return lines.join('\n');
}
