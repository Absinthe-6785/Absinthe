// @vitest-environment happy-dom
/**
 * K-92B1B — Cosmos warm reheat verification.
 * Run: npm test -- k92b1bCosmosWarmReheat
 */
import { describe, expect, it } from 'vitest';
import {
  formatK92b1bAuditTable,
  noteGraphViewUsesWarmReheatPolicy,
  runK92b1bWarmReheatAudit,
} from './k92b1bCosmosWarmReheatAudit';
import { COSMOS_WARM_REHEAT_ALPHA } from './cosmosSimReheat';

const SCALE_POINTS = [100, 300, 500, 1000] as const;

describe('K-92B1B cosmos warm reheat', () => {
  const rows = SCALE_POINTS.map(n => runK92b1bWarmReheatAudit(n));

  it('prints before/after benchmark table', () => {
    // eslint-disable-next-line no-console
    console.log('\n' + formatK92b1bAuditTable(rows));
    expect(rows.length).toBe(4);
  });

  it('NoteGraphView uses warm reheat resolver instead of hardcoded alpha=1.0', () => {
    expect(noteGraphViewUsesWarmReheatPolicy()).toBe(true);
  });

  for (const noteCount of SCALE_POINTS) {
    it(`warm reheat beats cold settle @ ${noteCount} notes`, () => {
      const row = rows.find(r => r.noteCount === noteCount)!;
      expect(row.warmSettleMs).toBeLessThan(row.coldSettleMs);
      expect(row.warmTicks).toBeLessThanOrEqual(row.coldTicks);
      expect(row.settleImprovementPct).toBeGreaterThan(0);
    });
  }

  it('@ 1000 notes warm reheat uses production alpha constant', () => {
    expect(COSMOS_WARM_REHEAT_ALPHA).toBe(0.2);
    const row = rows.find(r => r.noteCount === 1000)!;
    expect(row.settleImprovementPct).toBeGreaterThan(40);
  });
});
