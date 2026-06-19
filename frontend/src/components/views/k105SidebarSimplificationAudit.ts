/** K-105 — Notes sidebar simplification audit. */
export const K105_SIDEBAR_ALWAYS_VISIBLE = ['favorites', 'folders', 'trash'] as const;
export const K105_SIDEBAR_DEFAULT_COLLAPSED = [
  'activity',
  'timeline-lens',
  'workspace',
  'areas',
] as const;

export function auditSidebarSimplification(): { always: string[]; collapsed: string[] } {
  return {
    always: [...K105_SIDEBAR_ALWAYS_VISIBLE],
    collapsed: [...K105_SIDEBAR_DEFAULT_COLLAPSED],
  };
}

export function formatK105SidebarSimplificationReport(s: { always: string[]; collapsed: string[] }): string {
  return [
    'K-105 sidebar simplification audit',
    '',
    `  always: ${s.always.join(', ')}`,
    `  collapsed: ${s.collapsed.join(', ')}`,
  ].join('\n');
}
