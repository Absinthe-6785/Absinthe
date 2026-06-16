/**
 * K-89 — Large vault performance validation harness.
 * Run: npm test -- largeVaultUsageAudit
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LARGE_VAULT_SCALES,
  measureVaultAtScale,
  type LargeVaultMetricsRow,
} from '@/dev/largeVaultBenchmark';
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import { noteSearchScore } from '@/lib/math/noteSearch';
import type { NoteBase } from '@/components/views/noteUtils';

const REGRESSION_SCALES = [250, 500] as const;
const PROBE_SCALES = [1000, 3000] as const;

/** Regression guard — stable fast paths at daily-use vault sizes. Index build excluded (high variance, scale probe). */
const REGRESSION_BUDGETS: Record<number, Partial<Record<keyof Omit<LargeVaultMetricsRow, 'noteCount' | 'estimatedBytes'>, number>>> = {
  250: {
    workspaceSearchMs: 50,
    globalGraphMs: 50,
    discoveryFeedMs: 200,
    plainTextFilterMs: 50,
  },
  500: {
    workspaceSearchMs: 50,
    globalGraphMs: 50,
    discoveryFeedMs: 400,
    plainTextFilterMs: 50,
  },
};

const allRows: LargeVaultMetricsRow[] = [];

function recordAllScaleMetrics(): LargeVaultMetricsRow[] {
  allRows.length = 0;
  for (const scale of LARGE_VAULT_SCALES) {
    allRows.push(measureVaultAtScale(scale));
  }
  return allRows;
}

function simulatePlainTextSidebarFilter(notes: readonly NoteBase[], query: string): NoteBase[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...notes];
  return notes.filter(n => {
    const score = noteSearchScore(n, q);
    return score != null && score > 0;
  });
}

describe('K-89 large vault usage audit', () => {
  beforeAll(() => {
    recordAllScaleMetrics();
  }, 120_000);

  describe('regression scales', () => {
    for (const scale of REGRESSION_SCALES) {
      it(`measures vault operations at ${scale} notes (regression guard)`, () => {
        const row = allRows.find(r => r.noteCount === scale);
        expect(row).toBeDefined();

        const budget = REGRESSION_BUDGETS[scale];
        if (budget && row) {
          for (const [key, maxMs] of Object.entries(budget)) {
            const actual = row[key as keyof LargeVaultMetricsRow];
            expect(
              actual as number,
              `${key} at ${scale} notes (${actual}ms) exceeds budget ${maxMs}ms`,
            ).toBeLessThan(maxMs!);
          }
        }
      });
    }
  });

  describe('scale probes', () => {
    for (const scale of PROBE_SCALES) {
      it(`probes vault operations at ${scale} notes (informational)`, () => {
        const row = allRows.find(r => r.noteCount === scale);
        expect(row).toBeDefined();
        expect(row!.indexBuildMs).toBeGreaterThan(0);
        expect(row!.globalGraphMs).toBeGreaterThan(0);
      });
    }

    it('prints scaling summary table', () => {
      expect(allRows.length).toBe(LARGE_VAULT_SCALES.length);
      const summary = allRows.map(r => ({
        notes: r.noteCount,
        vaultKb: Math.round(r.estimatedBytes / 1024),
        indexMs: Math.round(r.indexBuildMs),
        searchMs: Math.round(r.workspaceSearchMs),
        relatedMs: Math.round(r.relatedNotesMs),
        discoverMs: Math.round(r.discoveryFeedMs),
        cosmosMs: Math.round(r.globalGraphMs),
        healthMs: Math.round(r.vaultHealthMs),
        sidebarMs: Math.round(r.sidebarSortMs),
        plainFilterMs: Math.round(r.plainTextFilterMs),
      }));
      // eslint-disable-next-line no-console
      console.log('K89_METRICS_JSON', JSON.stringify(summary));
      // eslint-disable-next-line no-console
      console.table(summary);
      writeFileSync(
        join(process.cwd(), 'docs', 'k89-observed-metrics.json'),
        `${JSON.stringify(summary, null, 2)}\n`,
      );
    });
  });
});

describe('K-89 workflow friction signals', () => {
  it('documents sidebar plain-text filter is not wired in NoteView', () => {
    const dataset = buildLargeVaultDataset({ noteCount: 250 });
    const filtered = simulatePlainTextSidebarFilter(dataset.notes, 'grammar');
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.length).toBeLessThan(dataset.notes.length);
  });

  it('representative vault spans all study categories', () => {
    const dataset = buildLargeVaultDataset({ noteCount: 250 });
    expect(dataset.stats.categoryBreakdown?.eju).toBeGreaterThan(0);
    expect(dataset.stats.categoryBreakdown?.toefl).toBeGreaterThan(0);
    expect(dataset.stats.categoryBreakdown?.japanese).toBeGreaterThan(0);
    expect(dataset.stats.categoryBreakdown?.workout).toBeGreaterThan(0);
    expect(dataset.stats.categoryBreakdown?.reference).toBeGreaterThan(0);
  });
});
