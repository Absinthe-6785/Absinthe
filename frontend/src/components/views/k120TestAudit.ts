/**
 * K-120 — Shared test utility audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const K120_TEST_UTIL_FILES = [
  'test/testRenderUtils.ts',
  'test/testProjectionFactory.ts',
  'test/testMockStores.ts',
] as const;

export function auditTestUtilities(): Record<string, boolean> {
  const render = readFileSync(join(ROOT, 'test/testRenderUtils.ts'), 'utf8');
  const projection = readFileSync(join(ROOT, 'test/testProjectionFactory.ts'), 'utf8');
  const stores = readFileSync(join(ROOT, 'test/testMockStores.ts'), 'utf8');
  return {
    renderUtils: render.includes('readSrcFile') && render.includes('auditSrcRoot'),
    projectionFactory: projection.includes('makeHealthProjectionAuditFixture') && projection.includes('makeSearchProjectionAuditFixture'),
    mockStores: stores.includes('synthNotes') && stores.includes('makeMockVault'),
    healthFixture: projection.includes('buildHealthProjection'),
    recipeFixture: projection.includes('buildRecipeProjection'),
  };
}

export function auditTestRc(): boolean {
  const r = auditTestUtilities();
  return r.renderUtils && r.projectionFactory && r.mockStores;
}
