/**
 * K-101 — Micro-interaction audit.
 */
export const K101_INTERACTION_SURFACES = [
  { surface: 'sidebar', className: 'k101-interactive' },
  { surface: 'planner', className: 'k101-planner-chip' },
  { surface: 'settings', className: 'k101-interactive' },
  { surface: 'knowledge-panel', className: 'k101-interactive' },
] as const;

export const K101_INTERACTION_STATES = [
  'hover',
  'focus',
  'pressed',
  'disabled',
  'selected',
  'transitions',
] as const;

export interface K101InteractionRow {
  surface: string;
  states: readonly string[];
}

export function auditInteractionSurfaces(): K101InteractionRow[] {
  return K101_INTERACTION_SURFACES.map(s => ({
    surface: s.surface,
    states: K101_INTERACTION_STATES,
  }));
}

export function formatK101InteractionReport(rows: readonly K101InteractionRow[]): string {
  const lines = ['K-101 interaction audit', ''];
  for (const row of rows) {
    lines.push(`  ${row.surface}: ${row.states.join(', ')}`);
  }
  return lines.join('\n');
}
