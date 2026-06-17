/**
 * K-92B1 — Cosmos force simulation optimization audit (test/dev only).
 */
import type { NoteBase } from './noteUtils';
import { measureMs } from './editorBenchmark';
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import { KnowledgeIndexService } from './features/knowledge/KnowledgeIndexService';
import { buildGlobalGraphData } from './features/knowledge/graph/buildGlobalGraphData';
import { buildExpandedGraphData, expandNode } from './features/knowledge/graph/buildExpandedGraphData';
import { enrichGraphNodeMeta } from './features/knowledge/graph/knowledgeUniverse/enrichGraphNodes';
import {
  applyGalaxyCohesion,
  computeGalaxyCenters,
  interGalaxyRepulsionMultiplier,
  isUniverseMode,
} from './features/knowledge/graph/knowledgeUniverse';
import {
  graphRepulsionStrength,
  graphSimulationAlphaFloor,
} from './graphScalePolicy';

export interface ForceSimConfigSnapshot {
  initialAlpha: number;
  alphaDecayPerTick: number;
  alphaFloor: number;
  velocityDecay: number;
  linkAttraction: number;
  centerGravity: number;
  linkDistance: number;
  repulsionStrength: number;
  pairLoopComplexity: 'O(n²) brute force';
  renderTickThrottle: string;
  effectRestartDeps: string[];
  usesBarnesHut: false;
  usesAlphaTarget: false;
}

export interface ForceSimSettleResult {
  ms: number;
  tickCount: number;
  pairIterations: number;
}

export interface K92b1ForceSimAuditRow {
  noteCount: number;
  globalEdges: number;
  expandNodeMs: number;
  coldSimSettleMs: number;
  coldSimTicks: number;
  /** Simulates vault edit with preserved positions (partial reheat α=0.2). */
  warmPartialReheatMs: number;
  warmPartialReheatTicks: number;
  /** Simulates click mousedown+mouseup restarting sim twice (dragging in effect deps). */
  doubleRestartSimMs: number;
  /** Raised alphaFloor 0.05 vs policy 0.02 @ 250+ nodes. */
  raisedFloorSimMs: number;
  totalPlacementPathMs: number;
  config: ForceSimConfigSnapshot;
}

interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  galaxyId: string;
}

interface SimEdge {
  from: string;
  to: string;
}

const PRODUCTION_SIM_CONFIG = {
  initialAlpha: 1.0,
  alphaDecayPerTick: 0.97,
  velocityDecay: 0.85,
  linkAttraction: 0.05,
  centerGravity: 0.008,
  linkDistance: 130,
  renderTickThrottle: 'setTick every 3rd rAF frame during sim',
  effectRestartDeps: [
    'vaultStructureVersion',
    'indexContentVersion',
    'size.w',
    'size.h',
    'relationshipFilter',
    'graphViewMode',
    'reducedMotion',
  ],
} as const;

function cloneNodes(nodes: SimNode[]): SimNode[] {
  return nodes.map(n => ({ ...n, vx: 0, vy: 0 }));
}

function runForceSimSettle(
  nodes: SimNode[],
  edges: SimEdge[],
  width: number,
  height: number,
  universeMode: boolean,
  options: {
    initialAlpha?: number;
    alphaDecay?: number;
    alphaFloor?: number;
    maxSteps?: number;
  } = {},
): ForceSimSettleResult {
  let alpha = options.initialAlpha ?? PRODUCTION_SIM_CONFIG.initialAlpha;
  const alphaDecay = options.alphaDecay ?? PRODUCTION_SIM_CONFIG.alphaDecayPerTick;
  const nodeCount = nodes.length;
  const alphaFloor = options.alphaFloor ?? graphSimulationAlphaFloor(nodeCount);
  const REPEL = graphRepulsionStrength(nodeCount);
  const maxSteps = options.maxSteps ?? 500;
  let tickCount = 0;
  let pairIterations = 0;

  const t0 = performance.now();
  while (alpha >= alphaFloor && tickCount < maxSteps) {
    alpha *= alphaDecay;
    tickCount += 1;

    const galaxyCenters = universeMode
      ? computeGalaxyCenters(nodes.map(n => ({ id: n.id, x: n.x, y: n.y, galaxyId: n.galaxyId })))
      : null;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        pairIterations += 1;
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist2 = dx * dx + dy * dy + 1;
        const repMul = interGalaxyRepulsionMultiplier(nodes[i].galaxyId, nodes[j].galaxyId, universeMode);
        const force = (REPEL / dist2) * repMul;
        const d = Math.sqrt(dist2);
        const fx = force * dx / d;
        const fy = force * dy / d;
        nodes[i].vx -= fx;
        nodes[i].vy -= fy;
        nodes[j].vx += fx;
        nodes[j].vy += fy;
      }
    }

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    edges.forEach(e => {
      const a = nodeMap.get(e.from);
      const b = nodeMap.get(e.to);
      if (!a || !b) return;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - PRODUCTION_SIM_CONFIG.linkDistance) * PRODUCTION_SIM_CONFIG.linkAttraction;
      const fx = force * dx / dist;
      const fy = force * dy / dist;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    });

    const cx = width / 2;
    const cy = height / 2;
    nodes.forEach(n => {
      n.vx += (cx - n.x) * PRODUCTION_SIM_CONFIG.centerGravity;
      n.vy += (cy - n.y) * PRODUCTION_SIM_CONFIG.centerGravity;
      if (universeMode && galaxyCenters) {
        applyGalaxyCohesion(n, galaxyCenters.get(n.galaxyId), true);
      }
      n.vx *= PRODUCTION_SIM_CONFIG.velocityDecay;
      n.vy *= PRODUCTION_SIM_CONFIG.velocityDecay;
      n.x += n.vx * alpha;
      n.y += n.vy * alpha;
    });
  }

  return {
    ms: performance.now() - t0,
    tickCount,
    pairIterations,
  };
}

function buildSimGraph(noteCount: number): {
  nodes: SimNode[];
  edges: SimEdge[];
  service: KnowledgeIndexService;
  centerNoteId: string;
  centerTitle: string;
  expandableIds: string[];
} {
  const dataset = buildLargeVaultDataset({ noteCount });
  const service = new KnowledgeIndexService();
  service.buildFromNotes(dataset.notes);
  const notesById = new Map(dataset.notes.filter(n => !n.deletedAt).map(n => [n.id, n]));
  const globalGraph = buildGlobalGraphData({ service });
  const edgeList = globalGraph.edges.map(e => ({ from: e.sourceId, to: e.targetId }));
  const noteIds = globalGraph.nodes.map(n => n.noteId);
  const metaById = enrichGraphNodeMeta({
    noteIds,
    notesById,
    service,
    edges: edgeList,
    galaxyCacheKey: 'k92b1',
  });

  let centerNoteId = noteIds[0] ?? 'lv-eju-0';
  let bestDegree = -1;
  for (const id of noteIds) {
    const degree = (globalGraph.nodes.find(n => n.noteId === id)?.degree ?? 0);
    if (degree > bestDegree) {
      bestDegree = degree;
      centerNoteId = id;
    }
  }

  const nodes: SimNode[] = globalGraph.nodes.map((node, i) => {
    const meta = metaById.get(node.noteId);
    return {
      id: node.noteId,
      x: 400 + (i % 20) * 8,
      y: 300 + Math.floor(i / 20) * 8,
      vx: 0,
      vy: 0,
      galaxyId: meta?.galaxy.galaxyId ?? 'uncategorized',
    };
  });

  const baseLocal = buildExpandedGraphData({
    centerId: centerNoteId,
    centerTitle: service.getNoteTitle(centerNoteId),
    expandedNodeIds: [],
    service,
  });
  const expandableIds = baseLocal.nodes.filter(n => n.expandable).map(n => n.noteId);

  return {
    nodes,
    edges: edgeList,
    service,
    centerNoteId,
    centerTitle: service.getNoteTitle(centerNoteId),
    expandableIds,
  };
}

export function snapshotProductionSimConfig(nodeCount: number): ForceSimConfigSnapshot {
  return {
    initialAlpha: PRODUCTION_SIM_CONFIG.initialAlpha,
    alphaDecayPerTick: PRODUCTION_SIM_CONFIG.alphaDecayPerTick,
    alphaFloor: graphSimulationAlphaFloor(nodeCount),
    velocityDecay: PRODUCTION_SIM_CONFIG.velocityDecay,
    linkAttraction: PRODUCTION_SIM_CONFIG.linkAttraction,
    centerGravity: PRODUCTION_SIM_CONFIG.centerGravity,
    linkDistance: PRODUCTION_SIM_CONFIG.linkDistance,
    repulsionStrength: graphRepulsionStrength(nodeCount),
    pairLoopComplexity: 'O(n²) brute force',
    renderTickThrottle: PRODUCTION_SIM_CONFIG.renderTickThrottle,
    effectRestartDeps: [...PRODUCTION_SIM_CONFIG.effectRestartDeps],
    usesBarnesHut: false,
    usesAlphaTarget: false,
  };
}

export function runK92b1ForceSimAudit(noteCount: number): K92b1ForceSimAuditRow {
  const { nodes, edges, service, centerNoteId, centerTitle, expandableIds } = buildSimGraph(noteCount);
  const expandTarget = expandableIds[0] ?? centerNoteId;
  const expandedIds = expandNode([], expandTarget, expandableIds);
  const universeMode = isUniverseMode('universe');

  const expandNodeMs = measureMs(() => {
    buildExpandedGraphData({
      centerId: centerNoteId,
      centerTitle,
      expandedNodeIds: expandedIds,
      service,
    });
  });

  const coldNodes = cloneNodes(nodes);
  const cold = runForceSimSettle(coldNodes, edges, 800, 600, universeMode);

  const warmNodes = cloneNodes(coldNodes);
  const warm = runForceSimSettle(warmNodes, edges, 800, 600, universeMode, {
    initialAlpha: 0.2,
  });

  const raisedFloorNodes = cloneNodes(nodes);
  const raisedFloor = runForceSimSettle(raisedFloorNodes, edges, 800, 600, universeMode, {
    alphaFloor: 0.05,
  });

  const doubleRestartSimMs = cold.ms * 2;

  const totalPlacementPathMs = expandNodeMs + cold.ms;

  return {
    noteCount,
    globalEdges: edges.length,
    expandNodeMs: Math.round(expandNodeMs * 100) / 100,
    coldSimSettleMs: Math.round(cold.ms * 100) / 100,
    coldSimTicks: cold.tickCount,
    warmPartialReheatMs: Math.round(warm.ms * 100) / 100,
    warmPartialReheatTicks: warm.tickCount,
    doubleRestartSimMs: Math.round(doubleRestartSimMs * 100) / 100,
    raisedFloorSimMs: Math.round(raisedFloor.ms * 100) / 100,
    totalPlacementPathMs: Math.round(totalPlacementPathMs * 100) / 100,
    config: snapshotProductionSimConfig(noteCount),
  };
}

export function formatK92b1AuditTable(rows: K92b1ForceSimAuditRow[]): string {
  const header = [
    '=== K-92B1 Force Sim Audit ===',
    '',
    '| Notes | Expand node | Cold sim settle | Warm reheat (α=0.2) | Double restart (click) | Raised floor (0.05) | Total path | Ticks (cold) |',
    '| ----: | ----------: | --------------: | ------------------: | ---------------------: | ------------------: | ---------: | -----------: |',
  ];
  for (const r of rows) {
    header.push(
      `| ${r.noteCount} | ${r.expandNodeMs.toFixed(2)}ms | ${r.coldSimSettleMs.toFixed(2)}ms | `
      + `${r.warmPartialReheatMs.toFixed(2)}ms | ${r.doubleRestartSimMs.toFixed(2)}ms | `
      + `${r.raisedFloorSimMs.toFixed(2)}ms | ${r.totalPlacementPathMs.toFixed(2)}ms | ${r.coldSimTicks} |`,
    );
  }
  return header.join('\n');
}

export function countAlphaTicks(alphaFloor: number, alphaDecay = 0.97, initialAlpha = 1.0): number {
  let alpha = initialAlpha;
  let ticks = 0;
  while (alpha >= alphaFloor && ticks < 500) {
    alpha *= alphaDecay;
    ticks += 1;
  }
  return ticks;
}

/** Estimate Barnes-Hut speedup factor vs brute force (theoretical, θ=0.9). */
export function estimateBarnesHutSpeedup(nodeCount: number): number {
  if (nodeCount <= 64) return 1;
  const brute = nodeCount * nodeCount;
  const bh = nodeCount * Math.log2(nodeCount) * 4;
  return Math.round((brute / bh) * 10) / 10;
}
