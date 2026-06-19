/** K-104 — Sidebar density audit. */
export const K104_SIDEBAR_ALWAYS_VISIBLE = ['favorites', 'folders', 'trash'] as const;
export const K104_SIDEBAR_DEFAULT_COLLAPSED = [
  'recent-activity',
  'timeline-lens',
  'areas',
  'workspace',
] as const;

export function auditSidebarDensity(): { always: string[]; collapsed: string[] } {
  return { always: [...K104_SIDEBAR_ALWAYS_VISIBLE], collapsed: [...K104_SIDEBAR_DEFAULT_COLLAPSED] };
}

export function formatK104SidebarDensityReport(d: { always: string[]; collapsed: string[] }): string {
  return [
    'K-104 sidebar density audit',
    '',
    `  always: ${d.always.join(', ')}`,
    `  collapsed: ${d.collapsed.join(', ')}`,
  ].join('\n');
}
