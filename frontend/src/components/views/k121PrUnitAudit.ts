/**
 * K-121 — PR historical unit preservation audit (display layer).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatPrDisplay } from './features/health/formatPrDisplay';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditPrUnitPreservation(): Record<string, boolean> {
  const projection = readFileSync(join(ROOT, 'components/views/features/health/buildHealthProjection.ts'), 'utf8');
  const panel = readFileSync(join(ROOT, 'components/views/features/health/HealthAnalyticsPanel.tsx'), 'utf8');
  const format = readFileSync(join(ROOT, 'components/views/features/health/formatPrDisplay.ts'), 'utf8');
  const lbs = formatPrDisplay(102.058, 'bench-1', { 'bench-1': 'lbs' });
  const kg = formatPrDisplay(80, 'press-1', { 'press-1': 'kg' });
  return {
    formatModule: format.includes('formatPrDisplay'),
    displayFields: projection.includes('displayValue') && projection.includes('displayUnit') && projection.includes('conversionHint'),
    panelRendersUnit: panel.includes('p.displayValue') && panel.includes('p.displayUnit'),
    tooltipConversion: panel.includes('title={p.conversionHint'),
    lbsPreserves: lbs.displayUnit === 'lbs' && lbs.displayValue === 225,
    kgPreserves: kg.displayUnit === 'kg' && kg.displayValue === 80,
    noSchemaChange: !projection.includes('migration') && !format.includes('indexedDB'),
  };
}

export function auditPrUnitRc(): boolean {
  const r = auditPrUnitPreservation();
  return Object.values(r).every(Boolean);
}
