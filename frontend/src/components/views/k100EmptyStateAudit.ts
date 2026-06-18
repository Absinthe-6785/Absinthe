/**
 * K-100 — Empty state & feedback audit.
 */
import { K99_EMPTY_STATE_CATALOG } from './k99EmptyStateAudit';

export const K100_EMPTY_ENHANCEMENTS = [
  'contextual-description',
  'primary-cta',
  'loading-skeleton-class',
] as const;

export function auditK100EmptyStates(): { view: string; hasDescription: boolean; hasPrimaryCta: boolean }[] {
  return K99_EMPTY_STATE_CATALOG.map(row => ({
    view: `${row.view}/${row.scenario}`,
    hasDescription: Boolean(row.descriptionKey),
    hasPrimaryCta: row.hasPrimaryCta,
  }));
}

export function formatK100EmptyStateReport(
  rows: readonly { view: string; hasDescription: boolean; hasPrimaryCta: boolean }[],
): string {
  const lines = ['K-100 empty state audit', ''];
  for (const row of rows) {
    lines.push(`  ${row.view}: desc=${row.hasDescription} cta=${row.hasPrimaryCta}`);
  }
  lines.push('', 'Skeleton: .k100-skeleton-pulse');
  return lines.join('\n');
}
