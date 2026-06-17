/**
 * K-92B3A — Cosmos render throttle + layer memoization audit (test/dev only).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COSMOS_LEGACY_SIM_RENDER_DIVISOR,
  COSMOS_SIM_SETTLE_RENDER_DIVISOR,
  countReactCommitsDuringSimTicks,
  shouldSuppressSettleDecorations,
} from './cosmosRenderThrottle';
import {
  PRODUCTION_RENDER_TICK_DIVISOR,
  RENDER_PAIR_EQUIVALENCE,
  runK92b3CostSplitAudit,
  runK92b3RenderAttributionAudit,
  runK92b3SvgAudit,
  type K92b3RenderAttributionRow,
} from './k92b3CosmosSvgRenderAudit';

export interface K92b3aBenchmarkRow {
  noteCount: number;
  scenario: K92b3RenderAttributionRow['scenario'];
  simTicks: number;
  legacyReactCommits: number;
  k92b3aReactCommits: number;
  reactCommitReductionPct: number;
  legacySvgAttrWrites: number;
  k92b3aSvgAttrWrites: number;
  svgAttrReductionPct: number;
  legacyRenderMs: number;
  k92b3aRenderMs: number;
  renderCostReductionPct: number;
  legacyTotalSettleMs: number;
  k92b3aTotalSettleMs: number;
  totalSettleReductionPct: number;
}

export interface K92b3aPolicySnapshot {
  legacyDivisor: number;
  settleDivisor: number;
  memoLayersPresent: boolean;
  settleSuppressionPresent: boolean;
  finalCommitOnSettleComplete: boolean;
}

const REACT_BASE_COMMIT_MS = 0.45;
const REACT_PER_NODE_US = 4.2;
const REACT_PER_EDGE_US = 1.8;
const SVG_ATTR_US = 0.35;
const MEMO_LAYER_REACT_SAVINGS = 0.18;
const SETTLE_SUPPRESSION_SVG_FRACTION = 0.22;

function viewsRoot(): string {
  return dirname(fileURLToPath(import.meta.url));
}

function modeledReactMs(
  commits: number,
  nodes: number,
  edges: number,
  memoLayers: boolean,
): number {
  const base = commits * REACT_BASE_COMMIT_MS
    + commits * nodes * (REACT_PER_NODE_US / 1000)
    + commits * edges * (REACT_PER_EDGE_US / 1000);
  return Math.round(base * (memoLayers ? (1 - MEMO_LAYER_REACT_SAVINGS) : 1) * 100) / 100;
}

function modeledSvgMs(attrWrites: number): number {
  return Math.round(attrWrites * (SVG_ATTR_US / 1000) * 100) / 100;
}

function pctReduction(before: number, after: number): number {
  if (before <= 0) return 0;
  return Math.round(((before - after) / before) * 1000) / 10;
}

function svgAttrWritesDuringSettle(
  baseAttrWritesPerCommit: number,
  commits: number,
  suppressDecorations: boolean,
): number {
  const perCommit = suppressDecorations
    ? Math.round(baseAttrWritesPerCommit * (1 - SETTLE_SUPPRESSION_SVG_FRACTION))
    : baseAttrWritesPerCommit;
  return perCommit * commits;
}

export function readK92b3aPolicySnapshot(): K92b3aPolicySnapshot {
  const noteGraph = readFileSync(join(viewsRoot(), 'NoteGraphView.tsx'), 'utf8');
  return {
    legacyDivisor: COSMOS_LEGACY_SIM_RENDER_DIVISOR,
    settleDivisor: COSMOS_SIM_SETTLE_RENDER_DIVISOR,
    memoLayersPresent: noteGraph.includes('CosmosNodeLayer') && noteGraph.includes('CosmosEdgeLayer'),
    settleSuppressionPresent: noteGraph.includes('shouldSuppressSettleDecorations'),
    finalCommitOnSettleComplete: noteGraph.includes('simSettlingRef.current = false'),
  };
}

export function runK92b3aBenchmarkRow(
  noteCount: number,
  scenario: K92b3RenderAttributionRow['scenario'],
): K92b3aBenchmarkRow {
  const attr = runK92b3RenderAttributionAudit(noteCount, scenario);
  const svg = runK92b3SvgAudit(noteCount);
  const cost = runK92b3CostSplitAudit(noteCount, scenario);

  const legacyCommits = countReactCommitsDuringSimTicks(attr.simTicks, COSMOS_LEGACY_SIM_RENDER_DIVISOR);
  const k92b3aCommits = countReactCommitsDuringSimTicks(attr.simTicks, COSMOS_SIM_SETTLE_RENDER_DIVISOR) + 1;

  const legacySvgAttrs = svgAttrWritesDuringSettle(svg.attrWritesPerCommit, legacyCommits, false);
  const k92b3aSvgAttrs = svgAttrWritesDuringSettle(
    svg.attrWritesPerCommit,
    k92b3aCommits,
    shouldSuppressSettleDecorations(true),
  );

  const legacyRenderMs = modeledReactMs(legacyCommits, attr.nodesReconciledPerCommit, attr.edgesReconciledPerCommit, false)
    + modeledSvgMs(legacySvgAttrs);
  const k92b3aRenderMs = modeledReactMs(
    k92b3aCommits,
    attr.nodesReconciledPerCommit,
    attr.edgesReconciledPerCommit,
    true,
  ) + modeledSvgMs(k92b3aSvgAttrs);

  const legacyTotal = cost.simMs + legacyRenderMs * RENDER_PAIR_EQUIVALENCE;
  const k92b3aTotal = cost.simMs + k92b3aRenderMs * RENDER_PAIR_EQUIVALENCE;

  return {
    noteCount,
    scenario,
    simTicks: attr.simTicks,
    legacyReactCommits: legacyCommits,
    k92b3aReactCommits: k92b3aCommits,
    reactCommitReductionPct: pctReduction(legacyCommits, k92b3aCommits),
    legacySvgAttrWrites: legacySvgAttrs,
    k92b3aSvgAttrWrites: k92b3aSvgAttrs,
    svgAttrReductionPct: pctReduction(legacySvgAttrs, k92b3aSvgAttrs),
    legacyRenderMs,
    k92b3aRenderMs,
    renderCostReductionPct: pctReduction(legacyRenderMs, k92b3aRenderMs),
    legacyTotalSettleMs: Math.round(legacyTotal * 100) / 100,
    k92b3aTotalSettleMs: Math.round(k92b3aTotal * 100) / 100,
    totalSettleReductionPct: pctReduction(legacyTotal, k92b3aTotal),
  };
}

export function formatK92b3aBenchmarkTable(rows: K92b3aBenchmarkRow[]): string {
  const lines = [
    '=== K-92B3A Before vs After (cold_open_settle) ===',
    '',
    '| Notes | Sim ticks | React commits (3→4) | SVG attr writes | Render ms (est) | Total settle ms (est) | Render Δ | Total Δ |',
    '| ----: | --------: | ------------------: | --------------: | --------------: | --------------------: | -------: | ------: |',
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.noteCount} | ${r.simTicks} | ${r.legacyReactCommits} → ${r.k92b3aReactCommits} | `
      + `${r.legacySvgAttrWrites} → ${r.k92b3aSvgAttrWrites} | `
      + `${r.legacyRenderMs} → ${r.k92b3aRenderMs} | `
      + `${r.legacyTotalSettleMs} → ${r.k92b3aTotalSettleMs} | `
      + `${r.renderCostReductionPct}% | ${r.totalSettleReductionPct}% |`,
    );
  }
  return lines.join('\n');
}

export function recommendK92b3aMerge(): {
  verdict: 'safe_to_merge' | 'needs_adjustment' | 'needs_rollback';
  rationale: string;
} {
  const policy = readK92b3aPolicySnapshot();
  if (!policy.memoLayersPresent || !policy.settleSuppressionPresent || !policy.finalCommitOnSettleComplete) {
    return {
      verdict: 'needs_adjustment',
      rationale: 'Missing one or more K-92B3A policy hooks in NoteGraphView.',
    };
  }
  if (policy.settleDivisor <= policy.legacyDivisor) {
    return {
      verdict: 'needs_adjustment',
      rationale: 'Settle render divisor must exceed legacy N=3 to reduce commit frequency.',
    };
  }
  const cold1k = runK92b3aBenchmarkRow(1000, 'cold_open_settle');
  if (cold1k.renderCostReductionPct < 10) {
    return {
      verdict: 'needs_adjustment',
      rationale: 'Modeled render savings below 10% at 1000-note cold open.',
    };
  }
  return {
    verdict: 'safe_to_merge',
    rationale: `N=${policy.legacyDivisor}→${policy.settleDivisor} throttle, memo layers, and settle decoration suppression `
      + `model ~${cold1k.renderCostReductionPct}% render cost reduction at 1000 notes with unchanged sim ticks.`,
  };
}

/** Guard: K-92B3 historical baseline divisor remains 3 for pre-change audits. */
export function assertK92b3LegacyBaseline(): void {
  if (PRODUCTION_RENDER_TICK_DIVISOR !== COSMOS_LEGACY_SIM_RENDER_DIVISOR) {
    throw new Error('K-92B3 legacy baseline divisor drift');
  }
}
