/**
 * K-104 — Popover / sort menu collision audit.
 */
export const K104_POPOVER_FEATURES = [
  { feature: 'sort-menu-portal', dataHook: 'data-k104-sort-menu' },
  { feature: 'sort-menu-min-width', minWidthPx: 220 },
  { feature: 'sort-menu-mobile-sheet', dataHook: 'data-k104-sort-sheet' },
] as const;

export interface K104PopoverRow {
  feature: string;
  dataHook?: string;
  minWidthPx?: number;
}

export function auditPopoverSurfaces(): K104PopoverRow[] {
  return K104_POPOVER_FEATURES.map(f => ({
    feature: f.feature,
    dataHook: 'dataHook' in f ? f.dataHook : undefined,
    minWidthPx: 'minWidthPx' in f ? f.minWidthPx : undefined,
  }));
}

export function formatK104PopoverReport(rows: readonly K104PopoverRow[]): string {
  const lines = ['K-104 popover audit', ''];
  for (const row of rows) {
    lines.push(`  ${row.feature}${row.dataHook ? `: ${row.dataHook}` : ''}`);
  }
  return lines.join('\n');
}
