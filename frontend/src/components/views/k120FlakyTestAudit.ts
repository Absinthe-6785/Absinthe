/**
 * K-120 — Flaky / heavy test classification audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const K120_FLAKY_TEST_CLASS = {
  deterministic: 'deterministic',
  heavy: 'heavy',
  timeoutSensitive: 'timeout-sensitive',
} as const;

export type K120FlakyTestClass = (typeof K120_FLAKY_TEST_CLASS)[keyof typeof K120_FLAKY_TEST_CLASS];

export const K120_KNOWN_FLAKY_TESTS = [
  { id: 'k95-growth-curve', file: 'components/views/k95KnowledgeIndexAudit.test.ts', class: 'timeout-sensitive' as const },
  { id: 'k95e-large-vault', file: 'components/views/k95eLargeVaultAudit.test.ts', class: 'heavy' as const },
  { id: 'k92b2b-incremental-reheat', file: 'components/views/k92b2bIncrementalLocalReheatAudit.test.ts', class: 'heavy' as const },
  { id: 'discovery-rediscovery', file: 'components/views/discoveryRediscoveryAudit.test.ts', class: 'heavy' as const },
] as const;

export function auditFlakyTestHardening(): Record<string, boolean> {
  const k95 = readFileSync(join(ROOT, 'components/views/k95KnowledgeIndexAudit.test.ts'), 'utf8');
  const k95e = readFileSync(join(ROOT, 'components/views/k95eLargeVaultAudit.test.ts'), 'utf8');
  return {
    k95GrowthCurveTimeout: k95.includes('growth curve is monotonic') && k95.includes('120_000'),
    k95EachCountTimeout: k95.includes('counts index maps at') && k95.includes('120_000'),
    k95RelatedTimeout: k95.includes('related footprint grows') && k95.includes('60_000'),
    k95eHeavyTimeout: k95e.includes('300_000'),
    classificationExported: K120_KNOWN_FLAKY_TESTS.length >= 4,
  };
}

export function auditFlakyTestRc(): boolean {
  const r = auditFlakyTestHardening();
  return r.k95GrowthCurveTimeout && r.k95EachCountTimeout && r.classificationExported;
}
