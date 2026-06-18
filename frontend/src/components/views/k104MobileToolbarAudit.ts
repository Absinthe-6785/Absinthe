/** K-104 — Mobile toolbar audit. */
export const K104_MOBILE_TOOLBAR_VISIBLE = ['search', 'new', 'more'] as const;
export const K104_MOBILE_MORE_ITEMS = ['settings', 'appearance', 'density', 'help'] as const;

export function auditMobileToolbar(): { visible: string[]; more: string[] } {
  return { visible: [...K104_MOBILE_TOOLBAR_VISIBLE], more: [...K104_MOBILE_MORE_ITEMS] };
}

export function formatK104MobileToolbarReport(t: { visible: string[]; more: string[] }): string {
  return [
    'K-104 mobile toolbar audit',
    '',
    `  visible: ${t.visible.join(', ')}`,
    `  more: ${t.more.join(', ')}`,
  ].join('\n');
}
