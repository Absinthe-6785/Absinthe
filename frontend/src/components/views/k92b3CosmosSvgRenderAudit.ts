/**
 * K-92B3 — Cosmos SVG render throttle audit (test/dev only).
 *
 * Models React/SVG render cost vs force simulation after K-92B1A/B1B/B2A/B2B.
 * No production instrumentation — deterministic harness + static source analysis.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import { KnowledgeIndexService } from './features/knowledge/KnowledgeIndexService';
import { buildGlobalGraphData } from './features/knowledge/graph/buildGlobalGraphData';
import {
  countAlphaTicks,
  runK92b1ForceSimAudit,
  WARM_PARTIAL_REHEAT_ALPHA,
} from './k92b1CosmosForceSimAudit';
import { graphSimulationAlphaFloor } from './graphScalePolicy';
import {
  runK92b2bScenarioAudit,
  type K92b2bAuditRow,
  type K92b2bScenarioId,
} from './k92b2bIncrementalLocalReheatAudit';
import type { K92b1ForceSimAuditRow } from './k92b1CosmosForceSimAudit';
import {
  COSMOS_LEGACY_SIM_RENDER_DIVISOR,
  COSMOS_SIM_SETTLE_RENDER_DIVISOR,
  countReactCommitsDuringSimTicks,
} from './cosmosRenderThrottle';

/** Pre-K-92B3A baseline divisor (legacy production). */
export const PRODUCTION_RENDER_TICK_DIVISOR = COSMOS_LEGACY_SIM_RENDER_DIVISOR;

/** Weight render reconciliation vs one physics pair iteration (calibrated for SVG+React). */
export const RENDER_PAIR_EQUIVALENCE = 12;

export interface CosmosRenderPolicySnapshot {
  renderTickDivisor: number;
  tickStateDrivesRender: boolean;
  fullComponentRerenderOnTick: boolean;
  nodeEdgeMapsMemoized: boolean;
  svgBackend: 'react-svg';
  universeModeDefault: boolean;
}

export interface K92b3RenderAttributionRow {
  noteCount: number;
  scenario: 'cold_open_settle' | 'warm_full_settle' | 'warm_local_link_settle';
  simTicks: number;
  rafFramesDuringSettle: number;
  reactCommitsDuringSettle: number;
  commitsPerSecondAt60Fps: number;
  rendersPerSecondAt60Fps: number;
  nodesReconciledPerCommit: number;
  edgesReconciledPerCommit: number;
  tickMemosRecomputedPerCommit: number;
}

export interface K92b3SvgAuditRow {
  noteCount: number;
  nodeCount: number;
  edgeCount: number;
  svgElementCountEstimate: number;
  nodeCircleElements: number;
  edgeLineElements: number;
  labelTextElements: number;
  galaxyLayerElements: number;
  orbitPathElements: number;
  attrWritesPerCommit: number;
  hottestSvgOps: readonly string[];
}

export interface K92b3CostSplitRow {
  noteCount: number;
  scenario: K92b3RenderAttributionRow['scenario'];
  simMs: number;
  reactModeledMs: number;
  svgModeledMs: number;
  simPct: number;
  reactPct: number;
  svgPct: number;
  dominantBucket: 'simulation' | 'react' | 'svg' | 'mixed';
}

export interface K92b3Hotspot {
  rank: number;
  id: string;
  layer: 'sim' | 'react' | 'svg' | 'mount';
  description: string;
  scalesWith: string;
}

export interface K92b3OptimizationProposal {
  rank: number;
  id: string;
  title: string;
  expectedGain: string;
  risk: 'low' | 'med' | 'high';
  effort: 'low' | 'med' | 'high';
  notes: string;
}

const TICK_MEMO_COUNT = 6;
const AVG_CIRCLES_PER_NODE = 3.2;
const LABEL_VISIBLE_FRACTION = 0.35;
const GALAXY_ELEMENTS_PER_GALAXY = 4;
const EST_GALAXIES_AT_1K = 14;
const ORBIT_PATH_FRACTION = 0.12;
const REACT_BASE_COMMIT_MS = 0.45;
const REACT_PER_NODE_US = 4.2;
const REACT_PER_EDGE_US = 1.8;
const SVG_ATTR_US = 0.35;

function viewsRoot(): string {
  return dirname(fileURLToPath(import.meta.url));
}

export function readCosmosRenderPolicyFromNoteGraphView(): CosmosRenderPolicySnapshot {
  const src = readFileSync(join(viewsRoot(), 'NoteGraphView.tsx'), 'utf8');
  const throttleSrc = readFileSync(join(viewsRoot(), 'cosmosRenderThrottle.ts'), 'utf8');
  const divisorMatch = throttleSrc.match(/COSMOS_SIM_SETTLE_RENDER_DIVISOR = (\d+)/);
  return {
    renderTickDivisor: divisorMatch
      ? Number(divisorMatch[1])
      : COSMOS_SIM_SETTLE_RENDER_DIVISOR,
    tickStateDrivesRender: src.includes('const [tick, setTick]'),
    fullComponentRerenderOnTick:
      src.includes('}, [graphViewMode, reducedMotion, tick]')
      || /displayPosContext = useMemo\([\s\S]{0,200}tick/s.test(src),
    nodeEdgeMapsMemoized: src.includes('CosmosNodeLayer') && src.includes('CosmosEdgeLayer'),
    svgBackend: 'react-svg',
    universeModeDefault: true,
  };
}

const graphCountsCache = new Map<number, { nodes: number; edges: number }>();
const k92b1ForceSimAuditCache = new Map<number, K92b1ForceSimAuditRow>();
const k92b2bScenarioAuditCache = new Map<string, K92b2bAuditRow>();

function computeGraphCounts(noteCount: number): { nodes: number; edges: number } {
  const dataset = buildLargeVaultDataset({ noteCount });
  const service = new KnowledgeIndexService();
  service.buildFromNotes(dataset.notes);
  const global = buildGlobalGraphData({ service });
  return { nodes: global.nodes.length, edges: global.edges.length };
}

function getGraphCounts(noteCount: number): { nodes: number; edges: number } {
  const cached = graphCountsCache.get(noteCount);
  if (cached) return cached;
  const counts = computeGraphCounts(noteCount);
  graphCountsCache.set(noteCount, counts);
  return counts;
}

function getK92b1ForceSimAudit(noteCount: number): K92b1ForceSimAuditRow {
  const cached = k92b1ForceSimAuditCache.get(noteCount);
  if (cached) return cached;
  const row = runK92b1ForceSimAudit(noteCount);
  k92b1ForceSimAuditCache.set(noteCount, row);
  return row;
}

function getK92b2bScenarioAudit(
  noteCount: number,
  scenarioId: K92b2bScenarioId,
): K92b2bAuditRow {
  const key = `${noteCount}:${scenarioId}`;
  const cached = k92b2bScenarioAuditCache.get(key);
  if (cached) return cached;
  const row = runK92b2bScenarioAudit(noteCount, scenarioId);
  k92b2bScenarioAuditCache.set(key, row);
  return row;
}

/** Test-only: reset memoized audit snapshots between isolated harness runs. */
export function clearK92b3CosmosSvgRenderAuditCache(): void {
  graphCountsCache.clear();
  k92b1ForceSimAuditCache.clear();
  k92b2bScenarioAuditCache.clear();
}

export function countReactCommitsDuringSettle(
  simTicks: number,
  divisor = PRODUCTION_RENDER_TICK_DIVISOR,
): number {
  return countReactCommitsDuringSimTicks(simTicks, divisor);
}

export function runK92b3RenderAttributionAudit(
  noteCount: number,
  scenario: K92b3RenderAttributionRow['scenario'],
): K92b3RenderAttributionRow {
  const { nodes, edges } = getGraphCounts(noteCount);
  const alphaFloor = graphSimulationAlphaFloor(noteCount);
  let simTicks = countAlphaTicks(alphaFloor, 0.97, 1.0);

  if (scenario === 'warm_full_settle' || scenario === 'warm_local_link_settle') {
    // Same α-decay model as K-92B2B harness; no physics run needed for tick attribution.
    simTicks = countAlphaTicks(alphaFloor, 0.97, WARM_PARTIAL_REHEAT_ALPHA);
  }

  const commits = countReactCommitsDuringSettle(simTicks);
  const settleSeconds = simTicks / 60;

  return {
    noteCount,
    scenario,
    simTicks,
    rafFramesDuringSettle: simTicks,
    reactCommitsDuringSettle: commits,
    commitsPerSecondAt60Fps: settleSeconds > 0 ? Math.round((commits / settleSeconds) * 10) / 10 : 0,
    rendersPerSecondAt60Fps: settleSeconds > 0 ? Math.round((commits / settleSeconds) * 10) / 10 : 0,
    nodesReconciledPerCommit: nodes,
    edgesReconciledPerCommit: edges,
    tickMemosRecomputedPerCommit: TICK_MEMO_COUNT,
  };
}

export function runK92b3SvgAudit(noteCount: number): K92b3SvgAuditRow {
  const { nodes, edges } = getGraphCounts(noteCount);
  const nodeCircles = Math.round(nodes * AVG_CIRCLES_PER_NODE);
  const labelTextElements = Math.round(nodes * LABEL_VISIBLE_FRACTION);
  const edgeLineElements = edges;
  const galaxyCount = Math.min(EST_GALAXIES_AT_1K, Math.max(4, Math.round(Math.sqrt(nodes))));
  const galaxyLayerElements = galaxyCount * GALAXY_ELEMENTS_PER_GALAXY;
  const orbitPathElements = Math.round(nodes * ORBIT_PATH_FRACTION);
  const svgElementCountEstimate = nodeCircles + labelTextElements + edgeLineElements
    + galaxyLayerElements + orbitPathElements + 12;

  const attrWritesPerCommit = Math.round(
    nodeCircles * 2
    + labelTextElements * 2
    + edgeLineElements * 4
    + galaxyLayerElements * 0.2,
  );

  return {
    noteCount,
    nodeCount: nodes,
    edgeCount: edges,
    svgElementCountEstimate,
    nodeCircleElements: nodeCircles,
    edgeLineElements,
    labelTextElements,
    galaxyLayerElements,
    orbitPathElements,
    attrWritesPerCommit,
    hottestSvgOps: [
      'line x1/y1/x2/y2 updates (edges × commits)',
      'circle cx/cy updates (nodes × circles × commits)',
      'text x/y label reposition',
      'filter url(#ku-star-glow) on star nodes',
      'g opacity / focus dimming reconciliation',
      'transform on root <g> (pan/zoom — user input)',
      'marker-end arrowhead on edges',
      'galaxy nebula circle r/cx/cy',
      'orbit path circle stroke',
      'hit-target transparent circles (pointer capture)',
    ],
  };
}

export function runK92b3WarmVsLocalLinkCostSplitCompare(noteCount: number): {
  warm: K92b3CostSplitRow;
  local: K92b3CostSplitRow;
} {
  const k92 = getK92b1ForceSimAudit(noteCount);
  const localB2b = getK92b2bScenarioAudit(noteCount, 'link_add_1');
  return {
    warm: buildK92b3CostSplitRow(noteCount, 'warm_full_settle', k92),
    local: buildK92b3CostSplitRow(noteCount, 'warm_local_link_settle', k92, localB2b),
  };
}

function buildK92b3CostSplitRow(
  noteCount: number,
  scenario: K92b3RenderAttributionRow['scenario'],
  k92: K92b1ForceSimAuditRow,
  localB2b?: K92b2bAuditRow,
): K92b3CostSplitRow {
  const attr = runK92b3RenderAttributionAudit(noteCount, scenario);
  const svg = runK92b3SvgAudit(noteCount);

  let simMs = k92.coldSimSettleMs;
  if (scenario === 'warm_full_settle') simMs = k92.warmPartialReheatMs;
  if (scenario === 'warm_local_link_settle' && localB2b) {
    simMs = Math.round(
      k92.warmPartialReheatMs * (localB2b.localPairIterations / Math.max(1, localB2b.warmFullPairIterations)) * 100,
    ) / 100;
  }

  const reactModeledMs = Math.round((
    attr.reactCommitsDuringSettle * REACT_BASE_COMMIT_MS
    + attr.reactCommitsDuringSettle * attr.nodesReconciledPerCommit * (REACT_PER_NODE_US / 1000)
    + attr.reactCommitsDuringSettle * attr.edgesReconciledPerCommit * (REACT_PER_EDGE_US / 1000)
  ) * 100) / 100;

  const svgModeledMs = Math.round(
    attr.reactCommitsDuringSettle * svg.attrWritesPerCommit * (SVG_ATTR_US / 1000) * 100,
  ) / 100;

  const simUnits = simMs;
  const reactUnits = reactModeledMs * RENDER_PAIR_EQUIVALENCE;
  const svgUnits = svgModeledMs * RENDER_PAIR_EQUIVALENCE;
  const total = simUnits + reactUnits + svgUnits;
  const simPct = total > 0 ? Math.round((simUnits / total) * 1000) / 10 : 0;
  const reactPct = total > 0 ? Math.round((reactUnits / total) * 1000) / 10 : 0;
  const svgPct = Math.round((100 - simPct - reactPct) * 10) / 10;

  let dominantBucket: K92b3CostSplitRow['dominantBucket'] = 'mixed';
  if (simPct >= 55) dominantBucket = 'simulation';
  else if (reactPct >= 40) dominantBucket = 'react';
  else if (svgPct >= 25) dominantBucket = 'svg';

  return {
    noteCount,
    scenario,
    simMs,
    reactModeledMs,
    svgModeledMs,
    simPct,
    reactPct,
    svgPct,
    dominantBucket,
  };
}

export function runK92b3CostSplitAudit(
  noteCount: number,
  scenario: K92b3RenderAttributionRow['scenario'],
): K92b3CostSplitRow {
  const k92 = getK92b1ForceSimAudit(noteCount);
  const localB2b = scenario === 'warm_local_link_settle'
    ? getK92b2bScenarioAudit(noteCount, 'link_add_1')
    : undefined;
  return buildK92b3CostSplitRow(noteCount, scenario, k92, localB2b);
}

export function listK92b3Hotspots(): K92b3Hotspot[] {
  return [
    { rank: 1, id: 'sim_o_n2_repulsion', layer: 'sim', description: 'Brute-force pairwise repulsion each sim tick', scalesWith: 'n² × ticks' },
    { rank: 2, id: 'react_full_tree_on_tick', layer: 'react', description: 'setTick re-renders entire NoteGraphView (no node/edge memo layers)', scalesWith: 'commits × n' },
    { rank: 3, id: 'svg_edge_line_coords', layer: 'svg', description: 'Every edge <line> updates x1/y1/x2/y2 each commit', scalesWith: 'edges × commits' },
    { rank: 4, id: 'svg_node_circle_coords', layer: 'svg', description: 'Multiple <circle> cx/cy per node (body, hit-target, decorations)', scalesWith: 'n × circles × commits' },
    { rank: 5, id: 'tick_usememos', layer: 'react', description: 'galaxyVisuals, orbitPaths, focusDepthMap, matchedIds recompute on tick', scalesWith: 'commits × n' },
    { rank: 6, id: 'getDisplayPos_orbit', layer: 'react', description: 'Parent lookup + orbit math per node/edge each render', scalesWith: 'n + e per commit' },
    { rank: 7, id: 'mount_enrich_meta', layer: 'mount', description: 'enrichGraphNodeMeta + node init on graphData change', scalesWith: 'n on tab open' },
    { rank: 8, id: 'svg_filters_glow', layer: 'svg', description: 'feGaussianBlur filters on star/planet nodes and glowing edges', scalesWith: 'star/planet count' },
    { rank: 9, id: 'visible_maps_inline', layer: 'react', description: 'visibleNodes/visibleEdges rebuilt every render (not useMemo)', scalesWith: 'n + e per commit' },
    { rank: 10, id: 'sim_ticks_post_b2b', layer: 'sim', description: 'Warm settle still 76+ ticks; local reheat only on edge-only edits', scalesWith: 'ticks (constant)' },
  ];
}

export function listK92b3OptimizationRoadmap(): K92b3OptimizationProposal[] {
  return [
    { rank: 1, id: 'render_every_nth', title: 'Increase render throttle N=4–5 during sim-only phase', expectedGain: '20–33% fewer commits', risk: 'low', effort: 'low', notes: 'Already N=3; extend divisor while alpha > floor' },
    { rank: 2, id: 'memo_node_edge_layers', title: 'React.memo NodeLayer / EdgeLayer with position props', expectedGain: '30–50% React time during settle', risk: 'low', effort: 'med', notes: 'Isolate tick-driven geometry from toolbar/HUD' },
    { rank: 3, id: 'ref_svg_position_patch', title: 'Direct SVG attribute writes for cx/cy/x1/y1 during settle', expectedGain: '40–60% React+SVG during settle', risk: 'med', effort: 'med', notes: 'Bypass React reconciliation for pure geometry' },
    { rank: 4, id: 'hide_labels_during_settle', title: 'Suppress labels/nebula until sim alpha < floor', expectedGain: '15–25% SVG attr writes', risk: 'low', effort: 'low', notes: 'Quality-safe; labels static until settled' },
    { rank: 5, id: 'decouple_tick_memos', title: 'Remove tick from galaxy/orbit memos when positions frozen', expectedGain: '10–20% React per commit', risk: 'low', effort: 'low', notes: 'Galaxy centers stable during force settle' },
    { rank: 6, id: 'canvas_edges', title: 'Canvas/WebGL edge layer', expectedGain: '50–70% edge SVG cost', risk: 'med', effort: 'high', notes: 'Keep React nodes; canvas for lines only' },
    { rank: 7, id: 'single_commit_settle', title: 'Run sim offscreen/in refs; one setTick at end', expectedGain: '95%+ commit reduction during settle', risk: 'med', effort: 'med', notes: 'Best UX if intermediate frames not needed' },
    { rank: 8, id: 'worker_sim', title: 'Worker-based physics (deferred)', expectedGain: 'Main thread free', risk: 'high', effort: 'high', notes: 'Out of scope per K-92B; pair with render throttle' },
    { rank: 9, id: 'barnes_hut', title: 'Barnes-Hut repulsion (deferred)', expectedGain: 'Large sim ms drop', risk: 'med', effort: 'high', notes: 'K-92B1 Phase 3; orthogonal to render audit' },
    { rank: 10, id: 'offscreen_prerender', title: 'Offscreen settle snapshot', expectedGain: 'Eliminate visible jank', risk: 'med', effort: 'med', notes: 'Show spinner until first stable frame' },
  ];
}

export function recommendNextImplementationBranch(): {
  branch: string;
  scope: string;
  rationale: string;
} {
  return {
    branch: 'k92b3a-cosmos-render-throttle',
    scope: 'Increase sim-phase render divisor + memoized NodeLayer/EdgeLayer + hide labels during settle',
    rationale: 'Post-B2B, cold-open and warm-full paths still issue ~25–43 full-tree React commits while SVG line/circle writes scale with n. Lowest-risk ROI is render throttling and layer memoization before canvas/worker rewrites.',
  };
}

export function formatK92b3RenderAttributionTable(rows: K92b3RenderAttributionRow[]): string {
  const lines = [
    '=== K-92B3 Render Attribution ===',
    '',
    '| Notes | Scenario | Sim ticks | rAF frames | React commits | Commits/s @60fps | Nodes/commit | Edges/commit | Memos/commit |',
    '| ----: | -------- | --------: | ---------: | ------------: | ---------------: | -----------: | -----------: | -----------: |',
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.noteCount} | ${r.scenario} | ${r.simTicks} | ${r.rafFramesDuringSettle} | ${r.reactCommitsDuringSettle} | `
      + `${r.commitsPerSecondAt60Fps} | ${r.nodesReconciledPerCommit} | ${r.edgesReconciledPerCommit} | ${r.tickMemosRecomputedPerCommit} |`,
    );
  }
  return lines.join('\n');
}

export function formatK92b3SvgAuditTable(rows: K92b3SvgAuditRow[]): string {
  const lines = [
    '=== K-92B3 SVG Element Audit ===',
    '',
    '| Notes | Nodes | Edges | SVG elems (est) | Circles | Lines | Labels | Attr writes/commit |',
    '| ----: | ----: | ----: | --------------: | ------: | ----: | -----: | -----------------: |',
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.noteCount} | ${r.nodeCount} | ${r.edgeCount} | ${r.svgElementCountEstimate} | ${r.nodeCircleElements} | `
      + `${r.edgeLineElements} | ${r.labelTextElements} | ${r.attrWritesPerCommit} |`,
    );
  }
  return lines.join('\n');
}

export function formatK92b3CostSplitTable(rows: K92b3CostSplitRow[]): string {
  const lines = [
    '=== K-92B3 Simulation vs Rendering Split (modeled) ===',
    '',
    '| Notes | Scenario | Sim ms | React ms | SVG ms | Sim % | React % | SVG % | Dominant |',
    '| ----: | -------- | -----: | -------: | -----: | ----: | ------: | ----: | -------- |',
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.noteCount} | ${r.scenario} | ${r.simMs} | ${r.reactModeledMs} | ${r.svgModeledMs} | `
      + `${r.simPct}% | ${r.reactPct}% | ${r.svgPct}% | ${r.dominantBucket} |`,
    );
  }
  return lines.join('\n');
}

export function formatK92b3RoadmapTable(items: K92b3OptimizationProposal[]): string {
  const lines = [
    '=== K-92B3 Optimization Roadmap (ranked) ===',
    '',
    '| Rank | ID | Gain | Risk | Effort |',
    '| ---: | -- | ---- | ---- | ------ |',
  ];
  for (const p of items) {
    lines.push(`| ${p.rank} | ${p.id} | ${p.expectedGain} | ${p.risk} | ${p.effort} |`);
  }
  return lines.join('\n');
}
