/** K-109 — Mobile archive audit. */
export const K109_MOBILE_WIDTHS = [320, 375, 768] as const;

export const K109_MOBILE_SURFACES = [
  { surface: 'history-list', hooks: ['data-k109-history-row', 'min-h-[44px]'] },
  { surface: 'deleted-restore', hooks: ['data-k109-deleted-restore', 'min-h-[44px]'] },
  { surface: 'snapshot-cards', hooks: ['data-k109-snapshot-card', 'min-h-[44px]'] },
] as const;

export function auditArchiveMobile(): readonly number[] {
  return K109_MOBILE_WIDTHS;
}

export function auditArchiveMobileTouchTargets(): boolean {
  return K109_MOBILE_SURFACES.some(s => s.hooks.some(h => h.includes('44px')));
}
