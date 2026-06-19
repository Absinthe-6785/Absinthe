/**
 * K-116 — Smart collections cleanup audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function auditSmartCollectionsCleanup(): Record<string, boolean> {
  const section = readFileSync(
    join(ROOT, 'components/views/features/knowledge/components/SmartCollectionsSection.tsx'),
    'utf8',
  );
  return {
    hideZeroCount: section.includes('hideZeroCount'),
    collapseEmptyGroups: section.includes('visiblePrimary.length === 0'),
    reducedIcons: section.includes('showIcon={visiblePrimary.length <= 8}'),
    dataHook: section.includes('data-k116-sc-row'),
  };
}

export function auditCollectionRc(): boolean {
  const c = auditSmartCollectionsCleanup();
  return c.hideZeroCount && c.collapseEmptyGroups;
}
