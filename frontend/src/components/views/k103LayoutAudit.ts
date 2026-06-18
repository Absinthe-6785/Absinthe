/**
 * K-103 — Desktop layout balance audit.
 */
import {
  K103_NOTE_LIST_WIDTH_PX,
  K103_READING_MAX_WIDTH_PX,
  K103_PLANNER_RIGHT_PANEL_MAX_PX,
  K103_RESPONSIVE_WIDTHS,
} from './k103LayoutConstants';

export interface K103LayoutRow {
  surface: string;
  value: string;
}

export function auditDesktopLayout(): K103LayoutRow[] {
  return [
    { surface: 'note-list-width', value: `${K103_NOTE_LIST_WIDTH_PX}px` },
    { surface: 'reading-max-width', value: `${K103_READING_MAX_WIDTH_PX}px` },
    { surface: 'planner-right-panel-max', value: `${K103_PLANNER_RIGHT_PANEL_MAX_PX}px` },
    { surface: 'settings-max-width', value: 'max-w-3xl' },
    { surface: 'responsive-matrix', value: K103_RESPONSIVE_WIDTHS.join(',') },
  ];
}

export function formatK103LayoutReport(rows: readonly K103LayoutRow[]): string {
  const lines = ['K-103 layout audit', ''];
  for (const row of rows) {
    lines.push(`  ${row.surface}: ${row.value}`);
  }
  return lines.join('\n');
}
