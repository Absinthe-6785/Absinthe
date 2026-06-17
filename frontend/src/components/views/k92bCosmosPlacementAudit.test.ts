// @vitest-environment happy-dom
/**
 * K-92B — Cosmos placement performance audit.
 * Run: npm test -- k92bCosmosPlacement
 */
import { describe, expect, it } from 'vitest';
import {
  formatCosmosPlacementAuditReport,
  runCosmosPlacementAudit,
} from './k92bCosmosPlacementAudit';

const SCALE_POINTS = [100, 300, 500, 1000] as const;

describe('K-92B cosmos placement audit', () => {
  const reports = SCALE_POINTS.map(noteCount => runCosmosPlacementAudit(noteCount));

  for (let i = 0; i < SCALE_POINTS.length; i++) {
    const noteCount = SCALE_POINTS[i];
    it(`measures placement path @ ${noteCount} notes`, () => {
      const report = reports[i];

      // eslint-disable-next-line no-console
      console.log('\n' + formatCosmosPlacementAuditReport(report));

      expect(report.noteCount).toBe(noteCount);
      expect(report.globalGraphNodes).toBe(noteCount);
      expect(report.phases.length).toBeGreaterThan(5);

      const forcePhase = report.phases.find(p => p.operation.includes('Force simulation'));
      const expandPhase = report.phases.find(p => p.operation.includes('+1 expand'));
      expect(forcePhase?.ms).toBeGreaterThan(0);
      expect(expandPhase?.ms).toBeGreaterThan(0);
    }, noteCount >= 500 ? 60_000 : 30_000);
  }

  it('expand path stays incremental (local graph smaller than vault)', () => {
    const report = reports.find(r => r.noteCount === 500)!;
    expect(report.localGraphNodes).toBeLessThan(report.globalGraphNodes);
    expect(report.graphRebuildScope).toBe('incremental-neighborhood');
  }, 30_000);
});
