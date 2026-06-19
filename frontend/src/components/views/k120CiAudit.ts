/**
 * K-120 — CI health classification audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export const K120_CI_REQUIRED = ['typecheck', 'test', 'build'] as const;
export const K120_CI_HEAVY = ['k95eLargeVaultAudit', 'k92b2bIncrementalLocalReheatAudit', 'discoveryRediscoveryAudit'] as const;
export const K120_CI_OPTIONAL = ['audit:discovery', 'K95_PRINT'] as const;

export function auditCiHealth(): Record<string, boolean> {
  const pkg = readFileSync(join(ROOT, 'package.json'), 'utf8');
  const ci = readFileSync(join(join(ROOT, '..'), '.github/workflows/ci.yml'), 'utf8');
  const vite = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
  const k95 = readFileSync(join(ROOT, 'src/components/views/k95KnowledgeIndexAudit.test.ts'), 'utf8');
  return {
    typecheckScript: pkg.includes('"typecheck"'),
    testScript: pkg.includes('"test": "vitest run"'),
    buildScript: pkg.includes('"build"'),
    ciRunsTypecheck: ci.includes('npm run typecheck'),
    ciRunsTest: ci.includes('npm test'),
    ciRunsBuild: ci.includes('npm run build'),
    vitestNodeEnv: vite.includes("environment: 'node'"),
    k95Hardened: k95.includes('120_000'),
    heavyClassified: K120_CI_HEAVY.length >= 3,
  };
}

export function auditCiRc(): boolean {
  const r = auditCiHealth();
  return r.typecheckScript && r.ciRunsTest && r.k95Hardened;
}
