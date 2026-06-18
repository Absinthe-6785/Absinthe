/** K-104 — Mobile topbar audit. */
export const K104_TOPBAR_VISIBLE = ['search', 'new', 'more'] as const;
export const K104_TOPBAR_OVERFLOW = [
  'cosmos',
  'history',
  'export',
  'calendar',
  'undo',
  'settings',
] as const;

export function auditMobileTopbar(): { visible: string[]; overflow: string[] } {
  return { visible: [...K104_TOPBAR_VISIBLE], overflow: [...K104_TOPBAR_OVERFLOW] };
}

export function formatK104TopbarReport(t: { visible: string[]; overflow: string[] }): string {
  return [
    'K-104 topbar audit',
    '',
    `  visible: ${t.visible.join(', ')}`,
    `  overflow: ${t.overflow.join(', ')}`,
  ].join('\n');
}
