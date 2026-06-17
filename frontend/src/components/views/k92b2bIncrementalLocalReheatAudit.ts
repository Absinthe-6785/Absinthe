/**
 * K-92B2B — Incremental local reheat audit (test/dev only).
 */
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import { KnowledgeIndexService } from './features/knowledge/KnowledgeIndexService';
import { buildGlobalGraphData } from './features/knowledge/graph/buildGlobalGraphData';
import { enrichGraphNodeMeta } from './features/knowledge/graph/knowledgeUniverse/enrichGraphNodes';
import { isUniverseMode } from './features/knowledge/graph/knowledgeUniverse';
import { buildGraphTopologySignature, buildGraphTopologySignatureFromGraphData } from './cosmosGraphSignature';
import {
  COSMOS_LOCAL_REHEAT_HOPS,
  resolveCosmosLocalReheatPlan,
  type CosmosReheatMode,
} from './cosmosLocalReheat';
import {
  countAlphaTicks,
  runForceSimSettleForAudit,
  WARM_PARTIAL_REHEAT_ALPHA,
} from './k92b1CosmosForceSimAudit';
import { graphSimulationAlphaFloor } from './graphScalePolicy';

export type K92b2bScenarioId = 'link_add_1' | 'note_add_1' | 'note_remove_1';

export interface K92b2bAuditRow {
  noteCount: number;
  scenarioId: K92b2bScenarioId;
  dirtySeedCount: number;
  localReheatNodeCount: number;
  restartCount: number;
  tickCount: number;
  warmFullPairIterations: number;
  localPairIterations: number;
  settleCostReductionPct: number;
  maxActiveDisplacementPx: number;
  meanActiveDisplacementPx: number;
  reheatMode: CosmosReheatMode;
  fallbackReason: string | null;
  hops: number;
}

interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  galaxyId: string;
}

interface ScenarioGraph {
  nodes: SimNode[];
  edges: { from: string; to: string }[];
  prevSignature: string;
  nextSignature: string;
}

const QUALITY_MAX_ACTIVE_DISPLACEMENT_PX = 18;

function cloneNodes(nodes: SimNode[]): SimNode[] {
  return nodes.map(n => ({ ...n, vx: 0, vy: 0 }));
}

function buildSettledVaultGraph(noteCount: number): ScenarioGraph {
  const dataset = buildLargeVaultDataset({ noteCount });
  const service = new KnowledgeIndexService();
  service.buildFromNotes(dataset.notes);
  const notesById = new Map(dataset.notes.filter(n => !n.deletedAt).map(n => [n.id, n]));
  const global = buildGlobalGraphData({ service });
  const edgeList = global.edges.map(e => ({ from: e.sourceId, to: e.targetId }));
  const noteIds = global.nodes.map(n => n.noteId);
  const metaById = enrichGraphNodeMeta({
    noteIds,
    notesById,
    service,
    edges: edgeList,
    galaxyCacheKey: 'k92b2b',
  });

  const nodes: SimNode[] = global.nodes.map((node, i) => {
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

  const universeMode = isUniverseMode('universe');
  runForceSimSettleForAudit(nodes, edgeList, 800, 600, universeMode);

  const signature = buildGraphTopologySignatureFromGraphData(global);
  return {
    nodes,
    edges: edgeList,
    prevSignature: signature,
    nextSignature: signature,
  };
}

function pickHubAndLeaf(global: ReturnType<typeof buildGlobalGraphData>): { hubId: string; leafId: string } {
  let hubId = global.nodes[0]?.noteId ?? 'lv-eju-0';
  let leafId = hubId;
  let bestDegree = -1;
  let leafDegree = Number.MAX_SAFE_INTEGER;
  for (const node of global.nodes) {
    const degree = node.degree ?? 0;
    if (degree > bestDegree) {
      bestDegree = degree;
      hubId = node.noteId;
    }
    if (degree > 0 && degree < leafDegree) {
      leafDegree = degree;
      leafId = node.noteId;
    }
  }
  return { hubId, leafId };
}

function applyScenario(
  base: ScenarioGraph,
  noteCount: number,
  scenarioId: K92b2bScenarioId,
): ScenarioGraph {
  const dataset = buildLargeVaultDataset({ noteCount });
  const service = new KnowledgeIndexService();
  service.buildFromNotes(dataset.notes);
  const global = buildGlobalGraphData({ service });
  const { hubId, leafId } = pickHubAndLeaf(global);

  const nodes = cloneNodes(base.nodes);
  let edges = [...base.edges];

  switch (scenarioId) {
    case 'link_add_1': {
      const newEdge = { from: hubId, to: leafId };
      if (!edges.some(e => e.from === newEdge.from && e.to === newEdge.to)
        && !edges.some(e => e.from === newEdge.to && e.to === newEdge.from)) {
        edges = [...edges, newEdge];
      }
      break;
    }
    case 'note_add_1': {
      const newId = 'k92b2b-synthetic-note';
      nodes.push({
        id: newId,
        x: 420,
        y: 320,
        vx: 0,
        vy: 0,
        galaxyId: 'uncategorized',
      });
      edges = [...edges, { from: hubId, to: newId }];
      break;
    }
    case 'note_remove_1': {
      nodes.splice(nodes.findIndex(n => n.id === leafId), 1);
      edges = edges.filter(e => e.from !== leafId && e.to !== leafId);
      break;
    }
    default:
      break;
  }

  const nextSignature = buildGraphTopologySignature({
    nodeIds: nodes.map(n => n.id),
    edges: edges.map(e => ({
      sourceId: e.from,
      targetId: e.to,
      relationshipType: 'backlink',
    })),
  });

  return {
    nodes,
    edges,
    prevSignature: base.prevSignature,
    nextSignature,
  };
}

function displacementStats(
  reference: SimNode[],
  candidate: SimNode[],
  activeIds: ReadonlySet<string>,
): { max: number; mean: number } {
  const refById = new Map(reference.map(n => [n.id, n]));
  let max = 0;
  let sum = 0;
  let count = 0;
  for (const id of activeIds) {
    const a = refById.get(id);
    const b = candidate.find(n => n.id === id);
    if (!a || !b) continue;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    max = Math.max(max, d);
    sum += d;
    count += 1;
  }
  return { max, mean: count > 0 ? sum / count : 0 };
}

export function runK92b2bScenarioAudit(
  noteCount: number,
  scenarioId: K92b2bScenarioId,
  hops = COSMOS_LOCAL_REHEAT_HOPS,
): K92b2bAuditRow {
  const base = buildSettledVaultGraph(noteCount);
  const scenario = applyScenario(base, noteCount, scenarioId);
  const alphaFloor = graphSimulationAlphaFloor(noteCount);
  const tickCount = countAlphaTicks(alphaFloor, 0.97, WARM_PARTIAL_REHEAT_ALPHA);
  const universeMode = isUniverseMode('universe');

  const plan = resolveCosmosLocalReheatPlan({
    prevSignature: scenario.prevSignature,
    nextSignature: scenario.nextSignature,
    totalNodeCount: scenario.nodes.length,
    preservedNodeCount: Math.min(base.nodes.length, scenario.nodes.length),
    hops,
  });

  const warmFullNodes = cloneNodes(scenario.nodes);
  const warmFull = runForceSimSettleForAudit(
    warmFullNodes,
    scenario.edges,
    800,
    600,
    universeMode,
    { initialAlpha: WARM_PARTIAL_REHEAT_ALPHA },
  );

  const localNodes = cloneNodes(scenario.nodes);
  const local = runForceSimSettleForAudit(
    localNodes,
    scenario.edges,
    800,
    600,
    universeMode,
    {
      initialAlpha: WARM_PARTIAL_REHEAT_ALPHA,
      activeNodeIds: plan.activeNodeIds,
    },
  );

  const activeIds = plan.activeNodeIds ?? new Set(scenario.nodes.map(n => n.id));
  const quality = displacementStats(warmFullNodes, localNodes, activeIds);
  const settleCostReductionPct = warmFull.pairIterations > 0
    ? Math.round(((warmFull.pairIterations - local.pairIterations) / warmFull.pairIterations) * 1000) / 10
    : 0;

  return {
    noteCount,
    scenarioId,
    dirtySeedCount: plan.dirtySeedCount,
    localReheatNodeCount: plan.activeNodeIds?.size ?? scenario.nodes.length,
    restartCount: 1,
    tickCount,
    warmFullPairIterations: warmFull.pairIterations,
    localPairIterations: local.pairIterations,
    settleCostReductionPct,
    maxActiveDisplacementPx: Math.round(quality.max * 100) / 100,
    meanActiveDisplacementPx: Math.round(quality.mean * 100) / 100,
    reheatMode: plan.mode,
    fallbackReason: plan.fallbackReason,
    hops,
  };
}

export function compareHopRadii(
  noteCount: number,
  scenarioId: K92b2bScenarioId,
): K92b2bAuditRow[] {
  return [0, 1, 2].map(hops => runK92b2bScenarioAudit(noteCount, scenarioId, hops));
}

export function passesLocalReheatQuality(row: K92b2bAuditRow): boolean {
  if (row.reheatMode !== 'local_reheat') return true;
  return row.maxActiveDisplacementPx <= QUALITY_MAX_ACTIVE_DISPLACEMENT_PX;
}

export function formatK92b2bAuditTable(rows: K92b2bAuditRow[]): string {
  const lines = [
    '=== K-92B2B Incremental Local Reheat Audit ===',
    '',
    '| Notes | Scenario | Seeds | Local nodes | Restarts | Ticks | Warm pairs | Local pairs | Cost Δ | Max active Δpx | Mode | Fallback |',
    '| ----: | -------- | ----: | ----------: | -------: | ----: | ---------: | ----------: | -----: | -------------: | ---- | -------- |',
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.noteCount} | ${r.scenarioId} | ${r.dirtySeedCount} | ${r.localReheatNodeCount} | ${r.restartCount} | ${r.tickCount} | `
      + `${r.warmFullPairIterations} | ${r.localPairIterations} | ${r.settleCostReductionPct}% | `
      + `${r.maxActiveDisplacementPx} | ${r.reheatMode} | ${r.fallbackReason ?? '—'} |`,
    );
  }
  return lines.join('\n');
}

export function formatK92b2bHopComparisonTable(rows: K92b2bAuditRow[]): string {
  const lines = [
    '=== K-92B2B Hop radius comparison @ 1000 notes (link_add_1) ===',
    '',
    '| Hops | Local nodes | Local pairs | Cost Δ | Max active Δpx | Quality pass |',
    '| ---: | ----------: | ----------: | -----: | -------------: | :----------: |',
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.hops} | ${r.localReheatNodeCount} | ${r.localPairIterations} | ${r.settleCostReductionPct}% | `
      + `${r.maxActiveDisplacementPx} | ${passesLocalReheatQuality(r) ? 'yes' : 'no'} |`,
    );
  }
  return lines.join('\n');
}

export { QUALITY_MAX_ACTIVE_DISPLACEMENT_PX };
