/**
 * K-92B3C2 — Cosmos display position cache audit (test/dev only).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  countCachedDisplayPosComputationsPerCommit,
  countIndexedParentLookupsPerCommit,
  countLegacyDisplayPosComputationsPerCommit,
  countLegacyParentScanStepsPerCommit,
} from './cosmosDisplayPositionCache';
import {
  runK92b3cBenchmarkRow,
  runK92b3cDisplayPosAudit,
} from './k92b3cCosmosRenderMapAudit';
import { runK92b3RenderAttributionAudit } from './k92b3CosmosSvgRenderAudit';
import { countReactCommitsDuringSimTicks, COSMOS_SIM_SETTLE_RENDER_DIVISOR } from './cosmosRenderThrottle';

export interface K92b3c2PolicySnapshot {
  parentIndexViaRenderMap: boolean;
  linearParentScanRemoved: boolean;
  displayPosCacheEnabled: boolean;
  getDisplayPosUsesResolverFactory: boolean;
  tickDrivesDisplayContext: boolean;
}

export interface K92b3c2BenchmarkRow {
  noteCount: number;
  simTicks: number;
  reactCommits: number;
  getDisplayPosCallsPerSettle: number;
  legacyParentScansPerSettle: number;
  k92b3c2ParentLookupsPerSettle: number;
  parentScanReductionPct: number;
  legacyDisplayPosComputationsPerSettle: number;
  k92b3c2DisplayPosComputationsPerSettle: number;
  computeReductionPct: number;
  legacyDisplayPosMs: number;
  k92b3c2DisplayPosMs: number;
  displayPosMsReductionPct: number;
  legacyTotalSettleMs: number;
  k92b3c2TotalSettleMs: number;
  totalSettleReductionPct: number;
}

const DISPLAY_POS_US_PER_CALL = 0.055;
const PARENT_SCAN_US_PER_STEP = 0.0035;
const PARENT_LOOKUP_US = 0.004;
const RENDER_PAIR_EQUIVALENCE = 12;

function viewsRoot(): string {
  return dirname(fileURLToPath(import.meta.url));
}

function pctReduction(before: number, after: number): number {
  if (before <= 0) return 0;
  return Math.round(((before - after) / before) * 1000) / 10;
}

export function readK92b3c2PolicySnapshot(): K92b3c2PolicySnapshot {
  const src = readFileSync(join(viewsRoot(), 'NoteGraphView.tsx'), 'utf8');
  return {
    parentIndexViaRenderMap: src.includes('createCosmosDisplayPositionResolver'),
    linearParentScanRemoved: !src.includes('nodesRef.current.find(n => n.id === node.orbitParentId)'),
    displayPosCacheEnabled: src.includes('createCosmosDisplayPositionResolver'),
    getDisplayPosUsesResolverFactory: src.includes('createCosmosDisplayPositionResolver(displayPosContext)'),
    tickDrivesDisplayContext: /displayPosContext = useMemo\([\s\S]{0,200}tick/s.test(src),
  };
}

export function runK92b3c2BenchmarkRow(noteCount: number): K92b3c2BenchmarkRow {
  const legacy = runK92b3cDisplayPosAudit(noteCount);
  const bench = runK92b3cBenchmarkRow(noteCount);
  const attr = runK92b3RenderAttributionAudit(noteCount, 'cold_open_settle');
  const commits = countReactCommitsDuringSimTicks(attr.simTicks, COSMOS_SIM_SETTLE_RENDER_DIVISOR) + 1;

  const legacyParentScans = countLegacyParentScanStepsPerCommit(
    legacy.getDisplayPosCallsPerCommit,
    legacy.orbitParentNodeCount,
    legacy.visibleNodeCount,
  ) * commits;
  const indexedLookups = countIndexedParentLookupsPerCommit(
    legacy.getDisplayPosCallsPerCommit,
    legacy.orbitParentNodeCount,
  ) * commits;

  const legacyComputes = countLegacyDisplayPosComputationsPerCommit(
    legacy.visibleNodeCount,
    legacy.visibleEdgeCount,
  ) * commits;
  const cachedComputes = countCachedDisplayPosComputationsPerCommit(legacy.visibleNodeCount) * commits;

  const legacyMs = legacy.displayPosModeledMsPerSettle;
  const legacyScanMs = legacyParentScans * (PARENT_SCAN_US_PER_STEP / 1000);
  const legacyComputeMs = legacyComputes * (DISPLAY_POS_US_PER_CALL / 1000);
  const modeledLegacyMs = legacyScanMs + legacyComputeMs;

  const c2ScanMs = indexedLookups * (PARENT_LOOKUP_US / 1000);
  const c2ComputeMs = cachedComputes * (DISPLAY_POS_US_PER_CALL / 1000);
  const k92b3c2Ms = Math.round((c2ScanMs + c2ComputeMs) * 100) / 100;

  const savedMs = Math.max(modeledLegacyMs, legacyMs) - k92b3c2Ms;
  const k92b3c2TotalSettleMs = bench.totalSettleMs - savedMs * RENDER_PAIR_EQUIVALENCE;

  return {
    noteCount,
    simTicks: bench.simTicks,
    reactCommits: commits,
    getDisplayPosCallsPerSettle: legacy.getDisplayPosCallsPerSettle,
    legacyParentScansPerSettle: legacyParentScans,
    k92b3c2ParentLookupsPerSettle: indexedLookups,
    parentScanReductionPct: pctReduction(legacyParentScans, indexedLookups),
    legacyDisplayPosComputationsPerSettle: legacyComputes,
    k92b3c2DisplayPosComputationsPerSettle: cachedComputes,
    computeReductionPct: pctReduction(legacyComputes, cachedComputes),
    legacyDisplayPosMs: Math.round(Math.max(modeledLegacyMs, legacyMs) * 100) / 100,
    k92b3c2DisplayPosMs: k92b3c2Ms,
    displayPosMsReductionPct: pctReduction(Math.max(modeledLegacyMs, legacyMs), k92b3c2Ms),
    legacyTotalSettleMs: bench.totalSettleMs,
    k92b3c2TotalSettleMs: Math.round(k92b3c2TotalSettleMs * 100) / 100,
    totalSettleReductionPct: pctReduction(bench.totalSettleMs, k92b3c2TotalSettleMs),
  };
}

export function formatK92b3c2BenchmarkTable(rows: K92b3c2BenchmarkRow[]): string {
  const lines = [
    '=== K-92B3C2 Before vs After (cold_open_settle) ===',
    '',
    '| Notes | getDisplayPos calls | Parent scans → lookups | Computations | DisplayPos ms | Total settle ms | Scan Δ | Compute Δ | DisplayPos ms Δ |',
    '| ----: | ------------------: | ---------------------: | -----------: | ------------: | --------------: | -----: | --------: | --------------: |',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.noteCount} | ${row.getDisplayPosCallsPerSettle} | `
      + `${row.legacyParentScansPerSettle} → ${row.k92b3c2ParentLookupsPerSettle} | `
      + `${row.legacyDisplayPosComputationsPerSettle} → ${row.k92b3c2DisplayPosComputationsPerSettle} | `
      + `${row.legacyDisplayPosMs} → ${row.k92b3c2DisplayPosMs} | `
      + `${row.legacyTotalSettleMs} → ${row.k92b3c2TotalSettleMs} | `
      + `${row.parentScanReductionPct}% | ${row.computeReductionPct}% | ${row.displayPosMsReductionPct}% |`,
    );
  }
  return lines.join('\n');
}

export function recommendK92b3c2Merge(): {
  verdict: 'safe_to_merge' | 'needs_adjustment' | 'rollback';
  rationale: string;
} {
  const policy = readK92b3c2PolicySnapshot();
  if (
    !policy.parentIndexViaRenderMap
    || !policy.linearParentScanRemoved
    || !policy.displayPosCacheEnabled
  ) {
    return {
      verdict: 'needs_adjustment',
      rationale: 'Missing K-92B3C2 parent index or display position cache hooks.',
    };
  }
  const cold1k = runK92b3c2BenchmarkRow(1000);
  if (cold1k.computeReductionPct < 40) {
    return {
      verdict: 'needs_adjustment',
      rationale: `Display position compute reduction ${cold1k.computeReductionPct}% below 40% at 1000 notes.`,
    };
  }
  return {
    verdict: 'safe_to_merge',
    rationale: `Parent index + per-render cache cut display-position work `
      + `${cold1k.computeReductionPct}% (computes) with ${cold1k.displayPosMsReductionPct}% modeled ms reduction at 1000 notes.`,
  };
}
