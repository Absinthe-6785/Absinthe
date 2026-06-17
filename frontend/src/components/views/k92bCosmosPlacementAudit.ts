/**
 * K-92B — Cosmos node placement / graph interaction performance audit (test/dev only).
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
  buildFocusUniverseDepthMap,
  buildGalaxyVisuals,
  buildOrbitPaths,
  computeGalaxyCenters,
  interGalaxyRepulsionMultiplier,
  isUniverseMode,
} from './features/knowledge/graph/knowledgeUniverse';
import {
  graphRepulsionStrength,
  graphSimulationAlphaFloor,
} from './graphScalePolicy';
import type { GraphData } from './features/knowledge/graph/graphModels';

export interface CosmosPhaseTiming {
  operation: string;
  ms: number;
  pct: number;
}

export interface CosmosPlacementAuditReport {
  noteCount: number;
  centerNoteId: string;
  expandableCount: number;
  expandedNodeCount: number;
  localGraphNodes: number;
  globalGraphNodes: number;
  globalGraphEdges: number;
  graphRebuildScope: 'incremental-neighborhood' | 'full-vault';
  phases: CosmosPhaseTiming[];
  totalInteractionMs: number;
}

interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  galaxyId: string;
  links: number;
}

interface SimEdge {
  from: string;
  to: string;
}

/** Mirrors LocalGraphView.computeRadialLayout for audit timing. */
function computeRadialLayoutMs(graphData: GraphData, width: number, height: number): number {
  return measureMs(() => {
    const cx = width / 2;
    const cy = height / 2;
    const maxRadius = Math.max(70, Math.min(width, height) * 0.38);
    const groups = new Map<number, typeof graphData.nodes>();
    for (const node of graphData.nodes) {
      const hop = node.hop ?? (node.type === 'current' ? 0 : 1);
      const bucket = groups.get(hop) ?? [];
      bucket.push(node);
      groups.set(hop, bucket);
    }
    const hops = [...groups.keys()].sort((a, b) => a - b);
    const hopCount = hops.length;
    const layout = graphData.nodes.map(node => ({
      noteId: node.noteId,
      x: cx,
      y: cy,
    }));
    hops.forEach((hop, hopIndex) => {
      const ringNodes = groups.get(hop) ?? [];
      const radius = hop === 0 ? 0 : (maxRadius * hopIndex) / Math.max(hopCount - 1, 1);
      ringNodes.forEach((node, index) => {
        const entry = layout.find(item => item.noteId === node.noteId);
        if (!entry) return;
        if (hop === 0) {
          entry.x = cx;
          entry.y = cy;
          return;
        }
        const angle = ringNodes.length === 1
          ? -Math.PI / 2
          : (index / ringNodes.length) * Math.PI * 2 - Math.PI / 2;
        entry.x = cx + Math.cos(angle) * radius;
        entry.y = cy + Math.sin(angle) * radius;
      });
    });
  });
}

function simulateForceSimulationSettle(
  nodes: SimNode[],
  edges: SimEdge[],
  width: number,
  height: number,
  universeMode: boolean,
): number {
  let alpha = 1.0;
  const nodeCount = nodes.length;
  const REPEL = graphRepulsionStrength(nodeCount);
  const alphaFloor = graphSimulationAlphaFloor(nodeCount);
  const ATTRACT = 0.05;
  const CENTER = 0.008;
  const DAMPING = 0.85;
  const LINK_DIST = 130;
  let steps = 0;
  const maxSteps = 500;

  const t0 = performance.now();
  while (alpha >= alphaFloor && steps < maxSteps) {
    alpha *= 0.97;
    steps += 1;

    const galaxyCenters = universeMode
      ? computeGalaxyCenters(nodes.map(n => ({ id: n.id, x: n.x, y: n.y, galaxyId: n.galaxyId })))
      : null;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
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
      const force = (dist - LINK_DIST) * ATTRACT;
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
      n.vx += (cx - n.x) * CENTER;
      n.vy += (cy - n.y) * CENTER;
      if (universeMode && galaxyCenters) {
        applyGalaxyCohesion(n, galaxyCenters.get(n.galaxyId), true);
      }
      n.vx *= DAMPING;
      n.vy *= DAMPING;
      n.x += n.vx * alpha;
      n.y += n.vy * alpha;
    });
  }
  return performance.now() - t0;
}

function pickCenterNote(service: KnowledgeIndexService): string {
  let bestId = service.getAllNoteIds()[0] ?? 'lv-eju-0';
  let bestDegree = -1;
  for (const id of service.getAllNoteIds()) {
    const out = service.getOutgoing(id).length;
    const inCount = service.getIncoming(service.getNoteTitle(id)).length;
    const degree = out + inCount;
    if (degree > bestDegree) {
      bestDegree = degree;
      bestId = id;
    }
  }
  return bestId;
}

function buildNotesById(notes: readonly NoteBase[]): Map<string, NoteBase> {
  return new Map(notes.filter(n => !n.deletedAt).map(n => [n.id, n]));
}

export function runCosmosPlacementAudit(noteCount: number): CosmosPlacementAuditReport {
  const dataset = buildLargeVaultDataset({ noteCount });
  const service = new KnowledgeIndexService();
  service.buildFromNotes(dataset.notes);
  const notesById = buildNotesById(dataset.notes);
  const centerNoteId = pickCenterNote(service);
  const centerTitle = service.getNoteTitle(centerNoteId);

  const baseLocal = buildExpandedGraphData({
    centerId: centerNoteId,
    centerTitle,
    expandedNodeIds: [],
    service,
  });
  const expandableIds = baseLocal.nodes.filter(n => n.expandable).map(n => n.noteId);
  const expandTarget = expandableIds[0] ?? centerNoteId;
  const expandedIds = expandNode([], expandTarget, expandableIds);

  const timings: { operation: string; ms: number }[] = [];

  const globalGraph = buildGlobalGraphData({ service });
  timings.push({
    operation: 'buildGlobalGraphData (full vault)',
    ms: measureMs(() => { buildGlobalGraphData({ service }); }),
  });

  const edgeList = globalGraph.edges.map(e => ({
    from: e.sourceId,
    to: e.targetId,
  }));
  const noteIds = globalGraph.nodes.map(n => n.noteId);

  timings.push({
    operation: 'enrichGraphNodeMeta (galaxy/orbit/tier)',
    ms: measureMs(() => {
      enrichGraphNodeMeta({
        noteIds,
        notesById,
        service,
        edges: edgeList,
        galaxyCacheKey: 'audit',
      });
    }),
  });

  const metaById = enrichGraphNodeMeta({
    noteIds,
    notesById,
    service,
    edges: edgeList,
    galaxyCacheKey: 'audit',
  });

  timings.push({
    operation: 'Cosmos graph node init (NoteGraphView useEffect)',
    ms: measureMs(() => {
      const cx = 400;
      const cy = 300;
      globalGraph.nodes.map(node => {
        const meta = metaById.get(node.noteId);
        return {
          id: node.noteId,
          x: cx + (Math.random() - 0.5) * 300,
          y: cy + (Math.random() - 0.5) * 300,
          vx: 0,
          vy: 0,
          galaxyId: meta?.galaxy.galaxyId ?? 'uncategorized',
          links: node.degree ?? 0,
        };
      });
    }),
  });

  const simNodes: SimNode[] = globalGraph.nodes.map((node, i) => {
    const meta = metaById.get(node.noteId);
    return {
      id: node.noteId,
      x: 400 + (i % 20) * 8,
      y: 300 + Math.floor(i / 20) * 8,
      vx: 0,
      vy: 0,
      galaxyId: meta?.galaxy.galaxyId ?? 'uncategorized',
      links: node.degree ?? 0,
    };
  });
  const simEdges: SimEdge[] = globalGraph.edges.map(e => ({ from: e.sourceId, to: e.targetId }));

  timings.push({
    operation: 'Force simulation settle (Cosmos universe)',
    ms: simulateForceSimulationSettle(simNodes, simEdges, 800, 600, isUniverseMode('universe')),
  });

  timings.push({
    operation: 'buildExpandedGraphData (local, pre-expand)',
    ms: measureMs(() => {
      buildExpandedGraphData({
        centerId: centerNoteId,
        centerTitle,
        expandedNodeIds: [],
        service,
      });
    }),
  });

  let expandedGraph: GraphData | null = null;
  timings.push({
    operation: 'buildExpandedGraphData (+1 expand click)',
    ms: measureMs(() => {
      expandedGraph = buildExpandedGraphData({
        centerId: centerNoteId,
        centerTitle,
        expandedNodeIds: expandedIds,
        service,
      });
    }),
  });

  const graphForLayout = expandedGraph ?? baseLocal;
  timings.push({
    operation: 'computeRadialLayout (LocalGraphView)',
    ms: computeRadialLayoutMs(graphForLayout, 360, 280),
  });

  timings.push({
    operation: 'Preview click render prep (focus + orbit + nebula)',
    ms: measureMs(() => {
      const visibleEdges = graphForLayout.edges.map(e => ({
        from: e.sourceId,
        to: e.targetId,
        relationshipType: e.relationshipType,
        weight: e.weight,
      }));
      const focusId = expandTarget;
      const depthMap = buildFocusUniverseDepthMap(focusId, visibleEdges, 2);
      const positions = new Map(simNodes.slice(0, graphForLayout.nodes.length).map(n => [n.id, { x: n.x, y: n.y }]));
      buildOrbitPaths(
        simNodes.slice(0, graphForLayout.nodes.length).map(n => ({
          id: n.id,
          orbitParentId: null,
          orbitRadius: 0,
          orbitAngle: 0,
          orbitSpeed: 0,
          tier: 'moon' as const,
          galaxyId: n.galaxyId,
        })),
        positions,
      );
      buildGalaxyVisuals(
        simNodes.slice(0, Math.min(80, simNodes.length)).map(n => ({
          id: n.id,
          x: n.x,
          y: n.y,
          galaxyId: n.galaxyId,
          galaxyLabel: n.galaxyId,
          tier: 'moon' as const,
        })),
        new Map(),
      );
      void depthMap;
    }),
  });

  const totalInteractionMs = timings.reduce((s, t) => s + t.ms, 0);
  const phases = timings.map(t => ({
    ...t,
    pct: totalInteractionMs > 0 ? Math.round((t.ms / totalInteractionMs) * 1000) / 10 : 0,
  }));

  return {
    noteCount,
    centerNoteId,
    expandableCount: expandableIds.length,
    expandedNodeCount: expandedIds.length,
    localGraphNodes: graphForLayout.nodes.length,
    globalGraphNodes: globalGraph.nodes.length,
    globalGraphEdges: globalGraph.edges.length,
    graphRebuildScope: 'incremental-neighborhood',
    phases,
    totalInteractionMs: Math.round(totalInteractionMs * 100) / 100,
  };
}

export function formatCosmosPlacementAuditReport(report: CosmosPlacementAuditReport): string {
  const lines = [
    '=== K-92B Cosmos Placement Performance Audit ===',
    `Notes: ${report.noteCount}`,
    `Global graph: ${report.globalGraphNodes} nodes / ${report.globalGraphEdges} edges`,
    `Local expand graph: ${report.localGraphNodes} nodes (${report.expandableCount} expandable)`,
    `Graph rebuild on expand: ${report.graphRebuildScope}`,
    `Total measured interaction path: ${report.totalInteractionMs.toFixed(2)}ms`,
    '',
    '| Operation | Time | % |',
    '| --------- | ---- | - |',
  ];
  for (const phase of report.phases) {
    lines.push(`| ${phase.operation} | ${phase.ms.toFixed(2)}ms | ${phase.pct}% |`);
  }
  return lines.join('\n');
}
