/**
 * K-105 — Product cohesion audit.
 * Classifies sidebar/planner surfaces by intended default visibility.
 */
export type K105CohesionDisposition = 'always' | 'collapsed' | 'planner' | 'remove';

export interface K105CohesionRow {
  id: string;
  disposition: K105CohesionDisposition;
  rationale: string;
}

export const K105_PRODUCT_COHESION_MATRIX: readonly K105CohesionRow[] = [
  { id: 'daily-note', disposition: 'planner', rationale: 'Day anchor belongs with Today schedule (K-105 Option C)' },
  { id: 'yesterday-tomorrow', disposition: 'remove', rationale: 'Removed from Notes sidebar; use calendar navigation' },
  { id: 'favorites', disposition: 'always', rationale: 'Core note filter — always one tap away' },
  { id: 'folders', disposition: 'always', rationale: 'Primary organization surface' },
  { id: 'trash', disposition: 'always', rationale: 'Recovery must never be buried' },
  { id: 'recent-activity', disposition: 'planner', rationale: 'Contextual with Today workflow, not dashboard noise' },
  { id: 'timeline-lens', disposition: 'collapsed', rationale: 'Power feature — opt-in via Time Lens' },
  { id: 'workspace', disposition: 'collapsed', rationale: 'Collections/dashboard — advanced' },
  { id: 'areas', disposition: 'collapsed', rationale: 'Cosmos areas — advanced' },
  { id: 'smart-collections', disposition: 'collapsed', rationale: 'Rule collections inside workspace' },
];

export function auditProductCohesion(): K105CohesionRow[] {
  return [...K105_PRODUCT_COHESION_MATRIX];
}

export function formatK105ProductCohesionReport(rows: readonly K105CohesionRow[]): string {
  return [
    'K-105 product cohesion audit',
    '',
    ...rows.map(r => `  ${r.id}: ${r.disposition} — ${r.rationale}`),
  ].join('\n');
}
