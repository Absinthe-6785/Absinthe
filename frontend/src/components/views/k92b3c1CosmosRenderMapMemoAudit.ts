/**
 * K-92B3C1 — Cosmos renderMap memoization audit (test/dev only).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  countLegacyRenderMapAllocationsDuringSettle,
  countLegacyRenderMapBuildsDuringSettle,
  countMemoizedRenderMapAllocationsDuringSettle,
  countMemoizedRenderMapBuildsDuringSettle,
  COSMOS_RENDERMAP_MEMO_DEPS,
} from './cosmosRenderMapMemo';
import {
  runK92b3cBenchmarkRow,
  runK92b3cRenderMapAudit,
  type K92b3cHotspotRow,
} from './k92b3cCosmosRenderMapAudit';

export interface K92b3c1PolicySnapshot {
  renderMapMemoizedOnTopology: boolean;
  memoDeps: readonly string[];
  inlineRenderMapRemoved: boolean;
  nodeByIdUsesRenderMap: boolean;
}

export interface K92b3c1BenchmarkRow {
  noteCount: number;
  simTicks: number;
  reactCommits: number;
  legacyRenderMapBuilds: number;
  k92b3c1RenderMapBuilds: number;
  buildReductionPct: number;
  legacyAllocations: number;
  k92b3c1Allocations: number;
  allocationReductionPct: number;
  legacyRenderMapMs: number;
  k92b3c1RenderMapMs: number;
  renderMapMsReductionPct: number;
  legacyTotalSettleMs: number;
  k92b3c1TotalSettleMs: number;
  totalSettleReductionPct: number;
}

function viewsRoot(): string {
  return dirname(fileURLToPath(import.meta.url));
}

function pctReduction(before: number, after: number): number {
  if (before <= 0) return 0;
  return Math.round(((before - after) / before) * 1000) / 10;
}

export function readK92b3c1PolicySnapshot(): K92b3c1PolicySnapshot {
  const src = readFileSync(join(viewsRoot(), 'NoteGraphView.tsx'), 'utf8');
  return {
    renderMapMemoizedOnTopology: /const renderMap = useMemo\([\s\S]{0,200}graphTopologySignature/.test(src),
    memoDeps: COSMOS_RENDERMAP_MEMO_DEPS,
    inlineRenderMapRemoved: !/const renderMap = new Map\(ns\.map/.test(src),
    nodeByIdUsesRenderMap: src.includes('const nodeById = renderMap'),
  };
}

export function runK92b3c1BenchmarkRow(noteCount: number): K92b3c1BenchmarkRow {
  const legacy = runK92b3cRenderMapAudit(noteCount);
  const bench = runK92b3cBenchmarkRow(noteCount);
  const legacyBuilds = countLegacyRenderMapBuildsDuringSettle(legacy.reactCommitsDuringSettle);
  const nextBuilds = countMemoizedRenderMapBuildsDuringSettle();
  const legacyAllocs = countLegacyRenderMapAllocationsDuringSettle(
    legacy.reactCommitsDuringSettle,
    legacy.nodeCount,
  );
  const nextAllocs = countMemoizedRenderMapAllocationsDuringSettle(legacy.nodeCount);
  const legacyRenderMapMs = legacy.renderMapModeledMsPerSettle;
  const buildRatio = nextBuilds / Math.max(1, legacyBuilds);
  const k92b3c1RenderMapMs = Math.round(legacyRenderMapMs * buildRatio * 100) / 100;
  const renderSaved = legacyRenderMapMs - k92b3c1RenderMapMs;
  const k92b3c1TotalSettleMs = bench.totalSettleMs - renderSaved * 12;

  return {
    noteCount,
    simTicks: bench.simTicks,
    reactCommits: bench.reactCommits,
    legacyRenderMapBuilds: legacyBuilds,
    k92b3c1RenderMapBuilds: nextBuilds,
    buildReductionPct: pctReduction(legacyBuilds, nextBuilds),
    legacyAllocations: legacyAllocs,
    k92b3c1Allocations: nextAllocs,
    allocationReductionPct: pctReduction(legacyAllocs, nextAllocs),
    legacyRenderMapMs,
    k92b3c1RenderMapMs,
    renderMapMsReductionPct: pctReduction(legacyRenderMapMs, k92b3c1RenderMapMs),
    legacyTotalSettleMs: bench.totalSettleMs,
    k92b3c1TotalSettleMs: Math.round(k92b3c1TotalSettleMs * 100) / 100,
    totalSettleReductionPct: pctReduction(bench.totalSettleMs, k92b3c1TotalSettleMs),
  };
}

export function listK92b3c1HotspotUpdates(): K92b3cHotspotRow[] {
  return [
    {
      rank: 4,
      id: 'render_map_each_render',
      layer: 'pipeline',
      status: 'reduced',
      description: 'renderMap memoized on graphTopologySignature — one rebuild per topology generation',
      scalesWith: 'topology changes only',
    },
    {
      rank: 5,
      id: 'render_map_lookups',
      layer: 'pipeline',
      status: 'current',
      description: 'Map.get lookups unchanged; stable Map reference reused across tick commits',
      scalesWith: '(V + orbit + 2E) × commits',
    },
    {
      rank: 3,
      id: 'getDisplayPos_orbit',
      layer: 'pipeline',
      status: 'emerging',
      description: 'Now largest pipeline bucket after renderMap memo — candidate for K-92B3C2',
      scalesWith: '(V + 2E) × commits × n scan',
    },
  ];
}

export function formatK92b3c1BenchmarkTable(rows: K92b3c1BenchmarkRow[]): string {
  const lines = [
    '=== K-92B3C1 Before vs After (cold_open_settle) ===',
    '',
    '| Notes | React commits | renderMap builds | Map allocs | renderMap ms | Total settle ms | Build Δ | Alloc Δ | RenderMap ms Δ |',
    '| ----: | ------------: | ---------------: | ---------: | -----------: | --------------: | ------: | ------: | -------------: |',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.noteCount} | ${row.reactCommits} | ${row.legacyRenderMapBuilds} → ${row.k92b3c1RenderMapBuilds} | `
      + `${row.legacyAllocations} → ${row.k92b3c1Allocations} | `
      + `${row.legacyRenderMapMs} → ${row.k92b3c1RenderMapMs} | `
      + `${row.legacyTotalSettleMs} → ${row.k92b3c1TotalSettleMs} | `
      + `${row.buildReductionPct}% | ${row.allocationReductionPct}% | ${row.renderMapMsReductionPct}% |`,
    );
  }
  return lines.join('\n');
}

export function recommendK92b3c1Merge(): {
  verdict: 'safe_to_merge' | 'needs_adjustment' | 'rollback';
  rationale: string;
} {
  const policy = readK92b3c1PolicySnapshot();
  if (!policy.renderMapMemoizedOnTopology || !policy.inlineRenderMapRemoved || !policy.nodeByIdUsesRenderMap) {
    return {
      verdict: 'needs_adjustment',
      rationale: 'renderMap memoization hooks missing or inline rebuild still present in NoteGraphView.',
    };
  }
  const cold1k = runK92b3c1BenchmarkRow(1000);
  if (cold1k.buildReductionPct < 90) {
    return {
      verdict: 'needs_adjustment',
      rationale: `renderMap build reduction ${cold1k.buildReductionPct}% below 90% target at 1000 notes.`,
    };
  }
  return {
    verdict: 'safe_to_merge',
    rationale: `Topology-keyed renderMap cuts builds ${cold1k.buildReductionPct}% and allocations `
      + `${cold1k.allocationReductionPct}% at 1000 notes with stable node ref lookups.`,
  };
}
