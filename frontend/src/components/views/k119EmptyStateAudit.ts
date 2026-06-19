/**
 * K-119 — Empty state density audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const K119_EMPTY_HOOKS = [
  'data-notes-empty',
  'data-k107-empty',
  'data-k108-empty',
  'data-k109-empty-state',
  'data-k110-empty',
  'data-k111-empty',
  'data-k119-empty-state',
] as const;

export function auditEmptyStateDensity(): Record<string, boolean> {
  const empty = readFileSync(join(ROOT, 'components/common/ProductEmptyState.tsx'), 'utf8');
  return {
    densityTokens: empty.includes('UI_DENSITY'),
    compactPadding: empty.includes('emptyStatePaddingPx'),
    compactIcon: empty.includes('emptyStateIconSizePx'),
    dataHook: empty.includes('data-k119-empty-state'),
    productEmpty: empty.includes('ProductEmptyState'),
  };
}

export function auditEmptyStateRc(): boolean {
  const r = auditEmptyStateDensity();
  return r.densityTokens && r.compactPadding && r.compactIcon;
}
