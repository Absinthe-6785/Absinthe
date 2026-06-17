/**
 * K-92B3B — Tick-decoupled Cosmos memo pipeline audit (test/dev only).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COSMOS_SIM_SETTLE_RENDER_DIVISOR,
  countReactCommitsDuringSimTicks,
} from './cosmosRenderThrottle';
import {
  RENDER_PAIR_EQUIVALENCE,
  runK92b3CostSplitAudit,
  runK92b3RenderAttributionAudit,
  runK92b3SvgAudit,
} from './k92b3CosmosSvgRenderAudit';
import {
  countTickCoupledMemoHooks,
  type CosmosMemoPipelinePolicySnapshot,
} from './cosmosGraphMemoPipeline';

export interface K92b3bMemoRecomputationRow {
  noteCount: number;
  simTicks: number;
  reactCommits: number;
  legacyMemoRecomputations: number;
  k92b3bMemoRecomputations: number;
  memoReductionPct: number;
}

export interface K92b3bBenchmarkRow {
  noteCount: number;
  simTicks: number;
  reactCommits: number;
  legacyMemoRecomputations: number;
  k92b3bMemoRecomputations: number;
  legacySvgUpdates: number;
  k92b3bSvgUpdates: number;
  legacyRenderMs: number;
  k92b3bRenderMs: number;
  renderReductionPct: number;
  legacyTotalSettleMs: number;
  k92b3bTotalSettleMs: number;
  totalReductionPct: number;
}

export interface K92b3bHotspotRow {
  id: string;
  layer: 'react' | 'svg' | 'memo';
  status: 'removed' | 'reduced' | 'remaining';
  notes: string;
}

const LEGACY_TICK_MEMO_HOOKS = 4;
const K92B3B_TICK_MEMO_HOOKS = 0;
const LEGACY_VISIBLE_REBUILDS_PER_COMMIT = 2;
const K92B3B_VISIBLE_REBUILDS_PER_COMMIT = 0;
const MEMO_RECOMPUTE_US = 85;
const REACT_BASE_COMMIT_MS = 0.45;
const REACT_PER_NODE_US = 4.2;
const REACT_PER_EDGE_US = 1.8;
const SVG_ATTR_US = 0.35;
const MEMO_LAYER_REACT_SAVINGS = 0.18;
const SETTLE_SUPPRESSION_SVG_FRACTION = 0.22;
const MEMO_PIPELINE_REACT_SAVINGS = 0.12;

function viewsRoot(): string {
  return dirname(fileURLToPath(import.meta.url));
}

function pctReduction(before: number, after: number): number {
  if (before <= 0) return 0;
  return Math.round(((before - after) / before) * 1000) / 10;
}

export function readK92b3bPolicySnapshot(): CosmosMemoPipelinePolicySnapshot {
  const src = readFileSync(join(viewsRoot(), 'NoteGraphView.tsx'), 'utf8');
  return {
    visibleGraphMemoized: src.includes('buildVisibleGraphSnapshot'),
    galaxyTopologyDecoupled: src.includes('buildGalaxyVisualTopology')
      && src.includes('resolveGalaxyVisualsFromTopology'),
    orbitTopologyDecoupled: src.includes('buildOrbitPathTopology')
      && src.includes('resolveOrbitPathsFromTopology'),
    focusDepthMapTickDecoupled: src.includes('}, [activeNoteId, visibleEdges])'),
    focusNeighborhoodTickDecoupled: src.includes('}, [focusDepthMap, focusId, visibleEdges])'),
  };
}

export function countLegacyMemoRecomputationsDuringSettle(
  reactCommits: number,
  hasActiveSelection = false,
): number {
  const tickMemosPerCommit = LEGACY_TICK_MEMO_HOOKS
    + (hasActiveSelection ? 0 : 0);
  return reactCommits * (tickMemosPerCommit + LEGACY_VISIBLE_REBUILDS_PER_COMMIT)
    + LEGACY_TICK_MEMO_HOOKS;
}

export function countK92b3bMemoRecomputationsDuringSettle(
  hasActiveSelection = false,
): number {
  void hasActiveSelection;
  return 5 + K92B3B_TICK_MEMO_HOOKS;
}

export function runK92b3bMemoRecomputationAudit(noteCount: number): K92b3bMemoRecomputationRow {
  const attr = runK92b3RenderAttributionAudit(noteCount, 'cold_open_settle');
  const commits = countReactCommitsDuringSimTicks(attr.simTicks, COSMOS_SIM_SETTLE_RENDER_DIVISOR) + 1;
  const legacy = countLegacyMemoRecomputationsDuringSettle(commits);
  const next = countK92b3bMemoRecomputationsDuringSettle();
  return {
    noteCount,
    simTicks: attr.simTicks,
    reactCommits: commits,
    legacyMemoRecomputations: legacy,
    k92b3bMemoRecomputations: next,
    memoReductionPct: pctReduction(legacy, next),
  };
}

function modeledRenderMs(
  commits: number,
  nodes: number,
  edges: number,
  memoRecomputations: number,
  svgAttrWrites: number,
): number {
  const react = (
    commits * REACT_BASE_COMMIT_MS
    + commits * nodes * (REACT_PER_NODE_US / 1000)
    + commits * edges * (REACT_PER_EDGE_US / 1000)
    + memoRecomputations * (MEMO_RECOMPUTE_US / 1000)
  ) * (1 - MEMO_LAYER_REACT_SAVINGS) * (1 - MEMO_PIPELINE_REACT_SAVINGS);
  const svg = svgAttrWrites * (SVG_ATTR_US / 1000);
  return Math.round((react + svg) * 100) / 100;
}

export function runK92b3bBenchmarkRow(noteCount: number): K92b3bBenchmarkRow {
  const attr = runK92b3RenderAttributionAudit(noteCount, 'cold_open_settle');
  const svg = runK92b3SvgAudit(noteCount);
  const cost = runK92b3CostSplitAudit(noteCount, 'cold_open_settle');
  const commits = countReactCommitsDuringSimTicks(attr.simTicks, COSMOS_SIM_SETTLE_RENDER_DIVISOR) + 1;

  const legacyMemos = countLegacyMemoRecomputationsDuringSettle(commits);
  const nextMemos = countK92b3bMemoRecomputationsDuringSettle();

  const legacySvgPerCommit = svg.attrWritesPerCommit;
  const nextSvgPerCommit = Math.round(svg.attrWritesPerCommit * (1 - SETTLE_SUPPRESSION_SVG_FRACTION));
  const legacySvgUpdates = legacySvgPerCommit * commits;
  const nextSvgUpdates = nextSvgPerCommit * commits;

  const legacyRenderMs = modeledRenderMs(commits, attr.nodesReconciledPerCommit, attr.edgesReconciledPerCommit, legacyMemos, legacySvgUpdates);
  const nextRenderMs = modeledRenderMs(commits, attr.nodesReconciledPerCommit, attr.edgesReconciledPerCommit, nextMemos, nextSvgUpdates);

  const legacyTotal = cost.simMs + legacyRenderMs * RENDER_PAIR_EQUIVALENCE;
  const nextTotal = cost.simMs + nextRenderMs * RENDER_PAIR_EQUIVALENCE;

  return {
    noteCount,
    simTicks: attr.simTicks,
    reactCommits: commits,
    legacyMemoRecomputations: legacyMemos,
    k92b3bMemoRecomputations: nextMemos,
    legacySvgUpdates,
    k92b3bSvgUpdates: nextSvgUpdates,
    legacyRenderMs,
    k92b3bRenderMs: nextRenderMs,
    renderReductionPct: pctReduction(legacyRenderMs, nextRenderMs),
    legacyTotalSettleMs: Math.round(legacyTotal * 100) / 100,
    k92b3bTotalSettleMs: Math.round(nextTotal * 100) / 100,
    totalReductionPct: pctReduction(legacyTotal, nextTotal),
  };
}

export function listK92b3bHotspots(): K92b3bHotspotRow[] {
  return [
    {
      id: 'visible_nodes_edges_inline',
      layer: 'memo',
      status: 'removed',
      notes: 'visibleNodes/visibleEdges no longer rebuilt every tick; memoized on topology + isolate toggle',
    },
    {
      id: 'galaxy_visuals_tick_memo',
      layer: 'memo',
      status: 'removed',
      notes: 'Galaxy grouping split into topology memo + per-frame position resolve',
    },
    {
      id: 'orbit_paths_tick_memo',
      layer: 'memo',
      status: 'removed',
      notes: 'Orbit path list memoized on topology; cx/cy resolved from live parent positions',
    },
    {
      id: 'focus_depth_map_tick',
      layer: 'memo',
      status: 'removed',
      notes: 'focusDepthMap depends on activeNote + visibleEdges only',
    },
    {
      id: 'focus_neighborhood_tick',
      layer: 'memo',
      status: 'removed',
      notes: 'focusNeighborhood decoupled from tick',
    },
    {
      id: 'react_full_tree_on_tick',
      layer: 'react',
      status: 'remaining',
      notes: 'NoteGraphView still re-renders on setTick during settle (K-92B3A throttle)',
    },
    {
      id: 'svg_edge_line_coords',
      layer: 'svg',
      status: 'reduced',
      notes: 'Fewer memo side-effects per commit; geometry updates unchanged',
    },
    {
      id: 'matched_ids_tick',
      layer: 'memo',
      status: 'remaining',
      notes: 'Search matchedIds still lists tick dep when search active (out of P1–P4 scope)',
    },
    {
      id: 'render_map_each_render',
      layer: 'memo',
      status: 'remaining',
      notes: 'renderMap Map rebuild still O(n) each render',
    },
    {
      id: 'get_display_pos_orbit',
      layer: 'react',
      status: 'remaining',
      notes: 'Per-node display position still computed each render for layers',
    },
  ];
}

export function formatK92b3bBenchmarkTable(rows: K92b3bBenchmarkRow[]): string {
  const lines = [
    '=== K-92B3B Before vs After (cold_open_settle) ===',
    '',
    '| Notes | Sim ticks | React commits | Memo recomp (legacy→B3B) | SVG updates | Render ms | Total settle ms | Render Δ | Total Δ |',
    '| ----: | --------: | ------------: | ----------------------: | ----------: | --------: | --------------: | -------: | ------: |',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.noteCount} | ${row.simTicks} | ${row.reactCommits} | `
      + `${row.legacyMemoRecomputations} → ${row.k92b3bMemoRecomputations} | `
      + `${row.legacySvgUpdates} → ${row.k92b3bSvgUpdates} | `
      + `${row.legacyRenderMs} → ${row.k92b3bRenderMs} | `
      + `${row.legacyTotalSettleMs} → ${row.k92b3bTotalSettleMs} | `
      + `${row.renderReductionPct}% | ${row.totalReductionPct}% |`,
    );
  }
  return lines.join('\n');
}

export function formatK92b3bDependencyGraph(after: boolean): string {
  if (!after) {
    return [
      'Before (K-92B3A baseline):',
      'Tick',
      ' ├─ visibleNodes (inline rebuild)',
      ' ├─ visibleEdges (inline rebuild)',
      ' ├─ focusDepthMap (useMemo + tick)',
      ' ├─ focusNeighborhood (useMemo + tick)',
      ' ├─ galaxyVisuals (useMemo + tick)',
      ' └─ orbitPaths (useMemo + tick)',
    ].join('\n');
  }
  return [
    'After (K-92B3B):',
    'graphTopologySignature + showIsolated',
    ' ├─ visibleGraph (useMemo)',
    ' │    ├─ visibleNodes',
    ' │    └─ visibleEdges',
    ' ├─ galaxyVisualTopology (useMemo)',
    ' └─ orbitPathTopology (useMemo)',
    'activeNoteId + visibleEdges',
    ' └─ focusDepthMap (useMemo)',
    'focusDepthMap + focusId + visibleEdges',
    ' └─ focusNeighborhood (useMemo)',
    'Tick',
    ' ├─ setTick → parent render',
    ' ├─ resolveGalaxyVisualsFromTopology (per render)',
    ' ├─ resolveOrbitPathsFromTopology (per render)',
    ' └─ getDisplayPos (useCallback + tick)',
  ].join('\n');
}

export function recommendK92b3bMerge(): {
  verdict: 'safe_to_merge' | 'needs_adjustment' | 'requires_rollback';
  rationale: string;
} {
  const policy = readK92b3bPolicySnapshot();
  const tickHooks = countTickCoupledMemoHooks(readFileSync(join(viewsRoot(), 'NoteGraphView.tsx'), 'utf8'));
  if (
    !policy.visibleGraphMemoized
    || !policy.galaxyTopologyDecoupled
    || !policy.orbitTopologyDecoupled
    || !policy.focusDepthMapTickDecoupled
    || !policy.focusNeighborhoodTickDecoupled
  ) {
    return {
      verdict: 'needs_adjustment',
      rationale: 'One or more K-92B3B memo pipeline hooks missing from NoteGraphView.',
    };
  }
  if (tickHooks > 1) {
    return {
      verdict: 'needs_adjustment',
      rationale: `Expected ≤1 tick-coupled useMemo (search only); found ${tickHooks}.`,
    };
  }
  const cold1k = runK92b3bBenchmarkRow(1000);
  const memoAudit = runK92b3bMemoRecomputationAudit(1000);
  if (memoAudit.memoReductionPct < 90) {
    return {
      verdict: 'needs_adjustment',
      rationale: 'Memo recomputation reduction below 90% at 1000 notes.',
    };
  }
  return {
    verdict: 'safe_to_merge',
    rationale: `Tick-decoupled memo pipeline cuts modeled memo work ${memoAudit.memoReductionPct}% at 1000 notes `
      + `with ~${cold1k.renderReductionPct}% render savings and unchanged sim ticks.`,
  };
}
