/**
 * K-92B3C — Cosmos renderMap & display-position pipeline audit (test/dev only).
 *
 * Models steady-state render costs after K-92B3A (throttle) + K-92B3B (memo pipeline).
 * No production instrumentation — static source analysis + deterministic cost model.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import { KnowledgeIndexService } from './features/knowledge/KnowledgeIndexService';
import { buildGlobalGraphData } from './features/knowledge/graph/buildGlobalGraphData';
import { enrichGraphNodeMeta } from './features/knowledge/graph/knowledgeUniverse';
import {
  COSMOS_SIM_SETTLE_RENDER_DIVISOR,
  countReactCommitsDuringSimTicks,
} from './cosmosRenderThrottle';
import {
  RENDER_PAIR_EQUIVALENCE,
  runK92b3CostSplitAudit,
  runK92b3RenderAttributionAudit,
} from './k92b3CosmosSvgRenderAudit';
import {
  buildGalaxyVisualTopology,
  buildOrbitPathTopology,
  buildVisibleGraphSnapshot,
} from './cosmosGraphMemoPipeline';

export interface K92b3cPolicySnapshot {
  renderMapInlineBuild: boolean;
  renderMapMemoized: boolean;
  getDisplayPosTickCoupled: boolean;
  getDisplayPosParentLinearScan: boolean;
  getDisplayPosParentIndexed: boolean;
  getDisplayPosCacheEnabled: boolean;
  matchedIdsTickCoupled: boolean;
  galaxyResolveGatedOnSettle: boolean;
  orbitResolveGatedOnSettle: boolean;
}

export interface K92b3cRenderMapAuditRow {
  noteCount: number;
  nodeCount: number;
  edgeCount: number;
  visibleNodeCount: number;
  reactCommitsDuringSettle: number;
  renderMapBuildsPerCommit: number;
  renderMapBuildsPerSettle: number;
  renderMapEntriesPerBuild: number;
  mapEntryAllocationsPerBuild: number;
  renderMapLookupsPerCommit: number;
  renderMapLookupsPerSettle: number;
  renderMapModeledMsPerSettle: number;
  renderMapCostSharePct: number;
}

export interface K92b3cDisplayPosAuditRow {
  noteCount: number;
  visibleNodeCount: number;
  visibleEdgeCount: number;
  orbitParentNodeCount: number;
  getDisplayPosCallsPerCommit: number;
  nodeLayerCallsPerCommit: number;
  edgeLayerCallsPerCommit: number;
  getDisplayPosCallsPerSettle: number;
  parentScanStepsPerCommit: number;
  displayPosModeledMsPerSettle: number;
  displayPosCostSharePct: number;
}

export interface K92b3cBenchmarkRow {
  noteCount: number;
  simTicks: number;
  reactCommits: number;
  renderMapBuildsPerSettle: number;
  getDisplayPosCallsPerSettle: number;
  renderMapModeledMs: number;
  displayPosModeledMs: number;
  pipelineModeledMs: number;
  pipelineCostSharePct: number;
  totalRenderMs: number;
  totalSettleMs: number;
}

export interface K92b3cHotspotRow {
  rank: number;
  id: string;
  layer: 'react' | 'svg' | 'memo' | 'pipeline';
  status: 'legacy' | 'current' | 'reduced' | 'emerging';
  description: string;
  scalesWith: string;
}

export interface K92b3cOptimizationCandidate {
  rank: number;
  id: 'K-92B3C1' | 'K-92B3C2' | 'K-92B4' | 'search_decouple' | 'resolve_gate';
  title: string;
  expectedGain: string;
  complexity: 'low' | 'med' | 'high';
  regressionRisk: 'low' | 'med' | 'high';
  notes: string;
}

const RENDERMAP_BUILD_US_PER_NODE = 0.38;
const RENDERMAP_LOOKUP_US = 0.025;
const DISPLAY_POS_US_PER_CALL = 0.055;
const PARENT_SCAN_US_PER_STEP = 0.0035;
const REACT_BASE_RENDER_MS = 0.45;
const REACT_PER_NODE_US = 4.2;
const REACT_PER_EDGE_US = 1.8;
const MEMO_LAYER_SAVINGS = 0.18;
const MEMO_PIPELINE_SAVINGS = 0.12;
const SETTLE_SUPPRESSION_SVG_FRACTION = 0.22;

function viewsRoot(): string {
  return dirname(fileURLToPath(import.meta.url));
}

function pctShare(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

interface GraphGeometryCounts {
  nodeCount: number;
  edgeCount: number;
  visibleNodeCount: number;
  visibleEdgeCount: number;
  orbitParentNodeCount: number;
  orbitPathCount: number;
  galaxyMemberLookupsPerCommit: number;
}

function graphGeometryCounts(noteCount: number): GraphGeometryCounts {
  const dataset = buildLargeVaultDataset({ noteCount });
  const service = new KnowledgeIndexService();
  service.buildFromNotes(dataset.notes);
  const global = buildGlobalGraphData({ service });
  const noteById = new Map(dataset.notes.map(note => [note.id, note]));
  const edges = global.edges.map(edge => ({
    from: edge.sourceId,
    to: edge.targetId,
    relationshipType: edge.relationshipType,
    weight: edge.weight,
  }));
  const metaById = enrichGraphNodeMeta({
    noteIds: global.nodes.map(node => node.noteId),
    notesById: noteById,
    service,
    edges,
    galaxyCacheKey: `k92b3c-${noteCount}`,
  });

  const nodes = global.nodes.map(node => {
    const meta = metaById.get(node.noteId);
    return {
      id: node.noteId,
      title: node.title,
      folderId: noteById.get(node.noteId)?.folderId ?? null,
      x: 0,
      y: 0,
      links: node.degree ?? 0,
      backlinkCount: meta?.backlinkCount ?? 0,
      importance: meta?.importance ?? 0,
      radius: meta?.radius ?? 8,
      tier: meta?.tier ?? 'moon' as const,
      galaxyId: meta?.galaxy.galaxyId ?? 'uncategorized',
      galaxyLabel: meta?.galaxy.galaxyLabel ?? 'Uncategorized',
      isAreaNote: meta?.isAreaNote ?? false,
      orbitParentId: meta?.orbit.parentId ?? null,
      orbitRadius: meta?.orbit.orbitRadius ?? 0,
      orbitAngle: meta?.orbit.orbitAngle ?? 0,
      orbitSpeed: meta?.orbit.orbitSpeed ?? 0,
    };
  });

  const { visibleNodes, visibleEdges } = buildVisibleGraphSnapshot(nodes, edges, false);
  const orbitPathCount = buildOrbitPathTopology(visibleNodes).length;
  const galaxyTopology = buildGalaxyVisualTopology(visibleNodes);
  const galaxyMemberLookupsPerCommit = galaxyTopology.reduce(
    (sum, entry) => sum + entry.memberIds.length + (entry.anchorNodeId ? 1 : 0),
    0,
  );

  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    visibleNodeCount: visibleNodes.length,
    visibleEdgeCount: visibleEdges.length,
    orbitParentNodeCount: visibleNodes.filter(node => node.orbitParentId != null).length,
    orbitPathCount,
    galaxyMemberLookupsPerCommit,
  };
}

export function readK92b3cPolicySnapshot(): K92b3cPolicySnapshot {
  const src = readFileSync(join(viewsRoot(), 'NoteGraphView.tsx'), 'utf8');
  return {
    renderMapInlineBuild: /const renderMap = new Map\(ns\.map/.test(src),
    renderMapMemoized: /const renderMap = useMemo\([\s\S]{0,200}graphTopologySignature/.test(src),
    getDisplayPosTickCoupled: src.includes('createCosmosDisplayPositionResolver')
      && /displayPosContext = useMemo\([\s\S]{0,200}tick/s.test(src),
    getDisplayPosParentLinearScan: src.includes('nodesRef.current.find(n => n.id === node.orbitParentId)'),
    getDisplayPosParentIndexed: src.includes('createCosmosDisplayPositionResolver')
      || readFileSync(join(viewsRoot(), 'cosmosDisplayPositionCache.ts'), 'utf8')
        .includes('renderMap.get(node.orbitParentId)'),
    getDisplayPosCacheEnabled: src.includes('createCosmosDisplayPositionResolver'),
    matchedIdsTickCoupled: src.includes('matchedIds = useMemo')
      && src.includes('[searchLower, searchQuery, safeNotes, tick]'),
    galaxyResolveGatedOnSettle: /const galaxyVisuals = [\s\S]{0,160}simSettling/.test(src),
    orbitResolveGatedOnSettle: /const orbitPaths = [\s\S]{0,160}simSettling/.test(src),
  };
}

export function countReactCommitsDuringColdSettle(simTicks: number): number {
  return countReactCommitsDuringSimTicks(simTicks, COSMOS_SIM_SETTLE_RENDER_DIVISOR) + 1;
}

export function countRenderMapBuildsDuringSettle(reactCommits: number): number {
  return reactCommits;
}

export function countRenderMapLookupsPerCommit(geometry: GraphGeometryCounts): number {
  return geometry.galaxyMemberLookupsPerCommit
    + geometry.orbitPathCount
    + (geometry.visibleEdgeCount * 2);
}

export function countGetDisplayPosCallsPerCommit(geometry: GraphGeometryCounts): {
  total: number;
  nodeLayer: number;
  edgeLayer: number;
} {
  const nodeLayer = geometry.visibleNodeCount;
  const edgeLayer = geometry.visibleEdgeCount * 2;
  return { total: nodeLayer + edgeLayer, nodeLayer, edgeLayer };
}

export function runK92b3cRenderMapAudit(noteCount: number): K92b3cRenderMapAuditRow {
  const attr = runK92b3RenderAttributionAudit(noteCount, 'cold_open_settle');
  const commits = countReactCommitsDuringColdSettle(attr.simTicks);
  const geometry = graphGeometryCounts(noteCount);
  const buildsPerCommit = 1;
  const buildsPerSettle = countRenderMapBuildsDuringSettle(commits);
  const lookupsPerCommit = countRenderMapLookupsPerCommit(geometry);
  const lookupsPerSettle = lookupsPerCommit * commits;
  const renderMapMs = (
    buildsPerSettle * geometry.nodeCount * (RENDERMAP_BUILD_US_PER_NODE / 1000)
    + lookupsPerSettle * (RENDERMAP_LOOKUP_US / 1000)
  );
  const totalRenderMs = modeledTotalRenderMs(noteCount, commits, geometry);

  return {
    noteCount,
    nodeCount: geometry.nodeCount,
    edgeCount: geometry.edgeCount,
    visibleNodeCount: geometry.visibleNodeCount,
    reactCommitsDuringSettle: commits,
    renderMapBuildsPerCommit: buildsPerCommit,
    renderMapBuildsPerSettle: buildsPerSettle,
    renderMapEntriesPerBuild: geometry.nodeCount,
    mapEntryAllocationsPerBuild: geometry.nodeCount * 2,
    renderMapLookupsPerCommit: lookupsPerCommit,
    renderMapLookupsPerSettle: lookupsPerSettle,
    renderMapModeledMsPerSettle: Math.round(renderMapMs * 100) / 100,
    renderMapCostSharePct: pctShare(renderMapMs, totalRenderMs),
  };
}

export function runK92b3cDisplayPosAudit(noteCount: number): K92b3cDisplayPosAuditRow {
  const attr = runK92b3RenderAttributionAudit(noteCount, 'cold_open_settle');
  const commits = countReactCommitsDuringColdSettle(attr.simTicks);
  const geometry = graphGeometryCounts(noteCount);
  const calls = countGetDisplayPosCallsPerCommit(geometry);
  const parentScanSteps = geometry.orbitParentNodeCount * geometry.nodeCount;
  const displayPosMs = commits * (
    calls.total * (DISPLAY_POS_US_PER_CALL / 1000)
    + parentScanSteps * (PARENT_SCAN_US_PER_STEP / 1000)
  );
  const totalRenderMs = modeledTotalRenderMs(noteCount, commits, geometry);

  return {
    noteCount,
    visibleNodeCount: geometry.visibleNodeCount,
    visibleEdgeCount: geometry.visibleEdgeCount,
    orbitParentNodeCount: geometry.orbitParentNodeCount,
    getDisplayPosCallsPerCommit: calls.total,
    nodeLayerCallsPerCommit: calls.nodeLayer,
    edgeLayerCallsPerCommit: calls.edgeLayer,
    getDisplayPosCallsPerSettle: calls.total * commits,
    parentScanStepsPerCommit: parentScanSteps,
    displayPosModeledMsPerSettle: Math.round(displayPosMs * 100) / 100,
    displayPosCostSharePct: pctShare(displayPosMs, totalRenderMs),
  };
}

function modeledTotalRenderMs(
  noteCount: number,
  commits: number,
  geometry: GraphGeometryCounts,
): number {
  const base = commits * REACT_BASE_RENDER_MS
    + commits * geometry.visibleNodeCount * (REACT_PER_NODE_US / 1000)
    + commits * geometry.visibleEdgeCount * (REACT_PER_EDGE_US / 1000);
  return Math.round(base * (1 - MEMO_LAYER_SAVINGS) * (1 - MEMO_PIPELINE_SAVINGS) * 100) / 100;
}

export function runK92b3cBenchmarkRow(noteCount: number): K92b3cBenchmarkRow {
  const attr = runK92b3RenderAttributionAudit(noteCount, 'cold_open_settle');
  const cost = runK92b3CostSplitAudit(noteCount, 'cold_open_settle');
  const commits = countReactCommitsDuringColdSettle(attr.simTicks);
  const renderMap = runK92b3cRenderMapAudit(noteCount);
  const displayPos = runK92b3cDisplayPosAudit(noteCount);
  const pipelineMs = renderMap.renderMapModeledMsPerSettle + displayPos.displayPosModeledMsPerSettle;
  const totalRenderMs = modeledTotalRenderMs(noteCount, commits, graphGeometryCounts(noteCount));
  const totalSettleMs = cost.simMs + totalRenderMs * RENDER_PAIR_EQUIVALENCE;

  return {
    noteCount,
    simTicks: attr.simTicks,
    reactCommits: commits,
    renderMapBuildsPerSettle: renderMap.renderMapBuildsPerSettle,
    getDisplayPosCallsPerSettle: displayPos.getDisplayPosCallsPerSettle,
    renderMapModeledMs: renderMap.renderMapModeledMsPerSettle,
    displayPosModeledMs: displayPos.displayPosModeledMsPerSettle,
    pipelineModeledMs: Math.round(pipelineMs * 100) / 100,
    pipelineCostSharePct: pctShare(pipelineMs, totalRenderMs),
    totalRenderMs,
    totalSettleMs: Math.round(totalSettleMs * 100) / 100,
  };
}

export function listK92b3cHotspots(): K92b3cHotspotRow[] {
  return [
    { rank: 1, id: 'react_full_tree_on_tick', layer: 'react', status: 'current', description: 'setTick still re-renders full NoteGraphView each throttled commit', scalesWith: 'commits × component tree' },
    { rank: 2, id: 'svg_edge_line_coords', layer: 'svg', status: 'current', description: 'Edge layer updates line endpoints every commit', scalesWith: 'edges × commits' },
    { rank: 3, id: 'getDisplayPos_orbit', layer: 'pipeline', status: 'emerging', description: 'Linear parent scan + orbit math per node/edge call', scalesWith: '(V + 2E) × commits × n scan' },
    { rank: 4, id: 'render_map_each_render', layer: 'pipeline', status: 'emerging', description: 'Inline Map rebuild over all nodes every render', scalesWith: 'n × commits' },
    { rank: 5, id: 'render_map_lookups', layer: 'pipeline', status: 'current', description: 'Galaxy/orbit resolve + edge nodeById lookups via renderMap', scalesWith: '(V + orbit + 2E) × commits' },
    { rank: 6, id: 'tick_usememos', layer: 'memo', status: 'reduced', description: 'Topology memos decoupled in K-92B3B', scalesWith: 'topology changes only' },
    { rank: 7, id: 'visible_maps_inline', layer: 'memo', status: 'reduced', description: 'visibleGraph memoized in K-92B3B', scalesWith: 'topology changes only' },
    { rank: 8, id: 'matched_ids_tick', layer: 'memo', status: 'current', description: 'Search filter set recomputed on tick even without query change', scalesWith: 'commits when search active' },
    { rank: 9, id: 'galaxy_orbit_resolve_while_suppressed', layer: 'pipeline', status: 'emerging', description: 'resolveGalaxy/Orbit still runs while decorations suppressed during settle', scalesWith: 'V × commits during settle' },
    { rank: 10, id: 'sim_o_n2_repulsion', layer: 'react', status: 'legacy', description: 'Cold-open sim still dominant total settle bucket', scalesWith: 'n² × ticks' },
  ];
}

export function listK92b3cOptimizationCandidates(): K92b3cOptimizationCandidate[] {
  return [
    {
      rank: 1,
      id: 'K-92B3C1',
      title: 'RenderMap memoization on graphTopologySignature',
      expectedGain: '10–18% render-ms during settle; eliminates n Map rebuilds per commit',
      complexity: 'low',
      regressionRisk: 'low',
      notes: 'Reuse stable node refs from nodesRef; rebuild only on topology/isolate toggle',
    },
    {
      rank: 2,
      id: 'K-92B3C2',
      title: 'Display position cache + parent index',
      expectedGain: '15–28% render-ms when orbit-heavy; removes O(n) parent scans',
      complexity: 'med',
      regressionRisk: 'med',
      notes: 'Precompute parentId→node map; cache display coords per tick frame in ref',
    },
    {
      rank: 3,
      id: 'resolve_gate',
      title: 'Gate galaxy/orbit resolve when settle decorations suppressed',
      expectedGain: '5–12% render-ms during settle',
      complexity: 'low',
      regressionRisk: 'low',
      notes: 'Skip resolveGalaxyVisualsFromTopology / resolveOrbitPaths when simSettling',
    },
    {
      rank: 4,
      id: 'search_decouple',
      title: 'Decouple matchedIds from tick when search inactive',
      expectedGain: '2–5% render-ms; removes spurious Set rebuild',
      complexity: 'low',
      regressionRisk: 'low',
      notes: 'Drop tick from matchedIds deps; depend on search query + note versions only',
    },
    {
      rank: 5,
      id: 'K-92B4',
      title: 'Ref-based SVG position pipeline',
      expectedGain: '40–65% React render during settle',
      complexity: 'high',
      regressionRisk: 'med',
      notes: 'Bypass React reconciliation for pure geometry; larger refactor than C1/C2',
    },
  ];
}

export function formatK92b3cTickDependencyGraph(): string {
  return [
    'Tick (setTick during sim settle)',
    ' ├─ NoteGraphView re-render (mandatory — drives SVG geometry)',
    ' ├─ renderMap = new Map(ns.map(...))  [every render, O(n) alloc]',
    ' ├─ getDisplayPos useCallback invalidates on tick',
    ' │    ├─ CosmosNodeLayer: getDisplayPos(node) × V',
    ' │    └─ CosmosEdgeLayer: getDisplayPos(a/b) × 2E',
    ' ├─ resolveGalaxyVisualsFromTopology(renderMap.get)  [not gated on simSettling]',
    ' ├─ resolveOrbitPathsFromTopology(renderMap.get)       [not gated on simSettling]',
    ' └─ memo layers reconcile props → SVG attr writes',
    '',
    'Removable / cacheable (K-92B3C candidates):',
    ' • renderMap rebuild → memo on graphTopologySignature',
    ' • parent scan inside getDisplayPos → parentId index map',
    ' • galaxy/orbit resolve during settle suppression → gate on !simSettling',
    ' • matchedIds tick dep when search empty → drop tick',
  ].join('\n');
}

export function formatK92b3cBenchmarkTable(rows: K92b3cBenchmarkRow[]): string {
  const lines = [
    '=== K-92B3C RenderMap & DisplayPos Pipeline (cold_open_settle) ===',
    '',
    '| Notes | Sim ticks | React commits | renderMap builds | getDisplayPos calls | Pipeline ms | Render ms | Settle ms | Pipeline % render |',
    '| ----: | --------: | ------------: | ---------------: | ------------------: | ----------: | --------: | --------: | ----------------: |',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.noteCount} | ${row.simTicks} | ${row.reactCommits} | ${row.renderMapBuildsPerSettle} | `
      + `${row.getDisplayPosCallsPerSettle} | ${row.pipelineModeledMs} | ${row.totalRenderMs} | ${row.totalSettleMs} | ${row.pipelineCostSharePct}% |`,
    );
  }
  return lines.join('\n');
}

export function formatK92b3cRenderMapTable(rows: K92b3cRenderMapAuditRow[]): string {
  const lines = [
    '=== K-92B3C renderMap Audit ===',
    '',
    '| Notes | Builds/commit | Builds/settle | Entries/build | Allocs/build | Lookups/commit | Modeled ms | Share % |',
    '| ----: | ------------: | ------------: | ------------: | -----------: | -------------: | ---------: | ------: |',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.noteCount} | ${row.renderMapBuildsPerCommit} | ${row.renderMapBuildsPerSettle} | `
      + `${row.renderMapEntriesPerBuild} | ${row.mapEntryAllocationsPerBuild} | ${row.renderMapLookupsPerCommit} | `
      + `${row.renderMapModeledMsPerSettle} | ${row.renderMapCostSharePct}% |`,
    );
  }
  return lines.join('\n');
}

export function formatK92b3cDisplayPosTable(rows: K92b3cDisplayPosAuditRow[]): string {
  const lines = [
    '=== K-92B3C getDisplayPos Audit ===',
    '',
    '| Notes | Calls/commit | Node calls | Edge calls | Calls/settle | Parent scans/commit | Modeled ms | Share % |',
    '| ----: | -----------: | ---------: | ---------: | -----------: | ------------------: | ---------: | ------: |',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.noteCount} | ${row.getDisplayPosCallsPerCommit} | ${row.nodeLayerCallsPerCommit} | `
      + `${row.edgeLayerCallsPerCommit} | ${row.getDisplayPosCallsPerSettle} | ${row.parentScanStepsPerCommit} | `
      + `${row.displayPosModeledMsPerSettle} | ${row.displayPosCostSharePct}% |`,
    );
  }
  return lines.join('\n');
}

export function recommendK92b3cNextStep(): {
  recommendation: 'K-92B3C1' | 'K-92B3C2' | 'K-92B4' | 'no_further_optimization';
  rationale: string;
  pipelineDominant: boolean;
} {
  const row = runK92b3cBenchmarkRow(1000);
  const pipelineDominant = row.pipelineCostSharePct >= 28;
  if (!pipelineDominant && row.pipelineCostSharePct < 18) {
    return {
      recommendation: 'no_further_optimization',
      rationale: `Pipeline share ${row.pipelineCostSharePct}% at 1000 notes — SVG + full-tree React still dominate; defer C1/C2.`,
      pipelineDominant,
    };
  }
  if (row.displayPosModeledMs > row.renderMapModeledMs * 1.35) {
    return {
      recommendation: 'K-92B3C2',
      rationale: `Display-position path (${row.displayPosModeledMs}ms modeled) exceeds renderMap (${row.renderMapModeledMs}ms); parent-scan cache is highest ROI.`,
      pipelineDominant,
    };
  }
  return {
    recommendation: 'K-92B3C1',
    rationale: `renderMap + displayPos pipeline is ${row.pipelineCostSharePct}% of modeled render at 1000 notes; memoize renderMap first (low risk), then C2.`,
    pipelineDominant,
  };
}
