/**
 * K-92B2 — Cosmos incremental simulation restart audit (test/dev only).
 */
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import { KnowledgeIndexService } from './features/knowledge/KnowledgeIndexService';
import { buildGlobalGraphData } from './features/knowledge/graph/buildGlobalGraphData';
import {
  countAlphaTicks,
  runK92b1ForceSimAudit,
  WARM_PARTIAL_REHEAT_ALPHA,
} from './k92b1CosmosForceSimAudit';
import { COSMOS_WARM_REHEAT_ALPHA } from './cosmosSimReheat';
import { graphSimulationAlphaFloor } from './graphScalePolicy';

export type SimRestartKind = 'none' | 'cold_full' | 'warm_full' | 'incremental_local' | 'debounced';

export interface CosmosTriggerSpec {
  id: string;
  userAction: string;
  storeVersionBump: string;
  graphTopologyChanges: boolean;
  metadataOnly: boolean;
  currentBehavior: SimRestartKind;
  recommendedBehavior: SimRestartKind;
  notes: string;
}

export interface K92b2ScenarioRow {
  noteCount: number;
  scenarioId: string;
  restartCount: number;
  initialAlpha: number;
  settleTicks: number;
  /** Deterministic pair-loop share vs full warm restart (0–1). */
  incrementalPairShare: number;
  affectedNodeCount: number;
  totalNodeCount: number;
  /** Modeled tick-equivalent cost = settleTicks × incrementalPairShare. */
  modeledTickCost: number;
}

const TRIGGER_CATALOG: CosmosTriggerSpec[] = [
  {
    id: 'note_create',
    userAction: 'Create note',
    storeVersionBump: 'vaultStructureVersion',
    graphTopologyChanges: true,
    metadataOnly: false,
    currentBehavior: 'warm_full',
    recommendedBehavior: 'incremental_local',
    notes: 'New node + random placement; reheat 1-hop/2-hop neighborhood.',
  },
  {
    id: 'note_delete',
    userAction: 'Move note to trash / permanent delete',
    storeVersionBump: 'vaultStructureVersion',
    graphTopologyChanges: true,
    metadataOnly: false,
    currentBehavior: 'warm_full',
    recommendedBehavior: 'incremental_local',
    notes: 'Remove node; relax neighbors only.',
  },
  {
    id: 'note_restore',
    userAction: 'Restore trashed note',
    storeVersionBump: 'vaultStructureVersion',
    graphTopologyChanges: true,
    metadataOnly: false,
    currentBehavior: 'warm_full',
    recommendedBehavior: 'incremental_local',
    notes: 'Re-add node with prior position if cached.',
  },
  {
    id: 'wiki_link_body',
    userAction: 'Add/remove wiki link in body (debounced body sync)',
    storeVersionBump: 'indexContentVersion',
    graphTopologyChanges: true,
    metadataOnly: false,
    currentBehavior: 'warm_full',
    recommendedBehavior: 'incremental_local',
    notes: 'Edge delta localized to two endpoints + neighbors.',
  },
  {
    id: 'body_text_only',
    userAction: 'Body edit without link/tag/frontmatter change',
    storeVersionBump: 'indexContentVersion (debounced)',
    graphTopologyChanges: false,
    metadataOnly: true,
    currentBehavior: 'none',
    recommendedBehavior: 'none',
    notes: 'Graph data unchanged; sim restart is unnecessary today.',
  },
  {
    id: 'title_edit',
    userAction: 'Rename note title',
    storeVersionBump: 'vaultStructureVersion',
    graphTopologyChanges: false,
    metadataOnly: true,
    currentBehavior: 'none',
    recommendedBehavior: 'none',
    notes: 'Labels/radius refresh in node init; positions stable.',
  },
  {
    id: 'tag_property_edit',
    userAction: 'Tag / property patch (non-body)',
    storeVersionBump: 'vaultStructureVersion',
    graphTopologyChanges: false,
    metadataOnly: true,
    currentBehavior: 'none',
    recommendedBehavior: 'none',
    notes: 'May affect galaxy meta; usually no layout change needed.',
  },
  {
    id: 'star_toggle',
    userAction: 'Toggle star',
    storeVersionBump: 'vaultStructureVersion',
    graphTopologyChanges: false,
    metadataOnly: true,
    currentBehavior: 'none',
    recommendedBehavior: 'none',
    notes: 'Visual only; no force change.',
  },
  {
    id: 'folder_move',
    userAction: 'Move note between folders',
    storeVersionBump: 'vaultStructureVersion',
    graphTopologyChanges: false,
    metadataOnly: true,
    currentBehavior: 'none',
    recommendedBehavior: 'none',
    notes: 'Folder color only unless universe cohesion uses folder galaxies.',
  },
  {
    id: 'relationship_filter',
    userAction: 'Cosmos relationship filter toggle',
    storeVersionBump: 'none (UI state)',
    graphTopologyChanges: true,
    metadataOnly: false,
    currentBehavior: 'cold_full',
    recommendedBehavior: 'cold_full',
    notes: 'Filtered edge set changes; full relayout acceptable.',
  },
  {
    id: 'graph_view_mode',
    userAction: 'Network ↔ Universe mode',
    storeVersionBump: 'none (localStorage)',
    graphTopologyChanges: false,
    metadataOnly: false,
    currentBehavior: 'cold_full',
    recommendedBehavior: 'cold_full',
    notes: 'Forces/cohesion rules change.',
  },
  {
    id: 'panel_resize',
    userAction: 'Cosmos panel resize',
    storeVersionBump: 'none',
    graphTopologyChanges: false,
    metadataOnly: false,
    currentBehavior: 'warm_full',
    recommendedBehavior: 'incremental_local',
    notes: 'Center gravity target moves; could nudge without full settle.',
  },
  {
    id: 'drag_click',
    userAction: 'Node click / drag',
    storeVersionBump: 'none',
    graphTopologyChanges: false,
    metadataOnly: false,
    currentBehavior: 'none',
    recommendedBehavior: 'none',
    notes: 'Fixed in K-92B1A (draggingRef).',
  },
  {
    id: 'vault_import',
    userAction: 'Vault import / restore',
    storeVersionBump: 'vaultStructureVersion (+ rebuild index)',
    graphTopologyChanges: true,
    metadataOnly: false,
    currentBehavior: 'warm_full',
    recommendedBehavior: 'cold_full',
    notes: 'Large delta; cold or progressive layout preferred.',
  },
];

/** Pairs that touch at least one affected node / all pairs. */
export function incrementalPairShare(affectedCount: number, totalCount: number): number {
  if (totalCount <= 1) return 1;
  const allPairs = (totalCount * (totalCount - 1)) / 2;
  const touchedPairs = (affectedCount * (2 * totalCount - affectedCount - 1)) / 2;
  return touchedPairs / allPairs;
}

export function estimateAffectedNodesWithinHops(
  seedIds: readonly string[],
  nodeIds: readonly string[],
  edges: readonly { from: string; to: string }[],
  hops = 2,
): number {
  const adj = new Map<string, Set<string>>();
  for (const id of nodeIds) adj.set(id, new Set());
  for (const e of edges) {
    adj.get(e.from)?.add(e.to);
    adj.get(e.to)?.add(e.from);
  }
  const visited = new Set(seedIds.filter(id => adj.has(id)));
  let frontier = new Set(visited);
  for (let h = 0; h < hops; h++) {
    const next = new Set<string>();
    for (const id of frontier) {
      for (const nb of adj.get(id) ?? []) {
        if (!visited.has(nb)) {
          visited.add(nb);
          next.add(nb);
        }
      }
    }
    frontier = next;
  }
  return visited.size;
}

function pickHubId(service: KnowledgeIndexService, noteIds: string[]): string {
  const global = buildGlobalGraphData({ service });
  let best = noteIds[0] ?? 'lv-eju-0';
  let bestDegree = -1;
  for (const node of global.nodes) {
    if ((node.degree ?? 0) > bestDegree) {
      bestDegree = node.degree ?? 0;
      best = node.noteId;
    }
  }
  return best;
}

export function listCosmosTriggerCatalog(): readonly CosmosTriggerSpec[] {
  return TRIGGER_CATALOG;
}

export function readForceSimEffectDeps(): string[] {
  return [
    'graphTopologySignature',
    'size.w',
    'size.h',
    'relationshipFilter',
    'graphViewMode',
    'reducedMotion',
  ];
}

export function runK92b2ScenarioAudit(
  noteCount: number,
  scenarioId: 'note_add_1' | 'link_add_1' | 'note_remove_1' | 'metadata_only',
): K92b2ScenarioRow {
  if (scenarioId === 'metadata_only') {
    return {
      noteCount,
      scenarioId,
      restartCount: 0,
      initialAlpha: 0,
      settleTicks: 0,
      incrementalPairShare: 0,
      affectedNodeCount: 0,
      totalNodeCount: noteCount,
      modeledTickCost: 0,
    };
  }

  const alphaFloor = graphSimulationAlphaFloor(noteCount);
  const warmTicks = countAlphaTicks(alphaFloor, 0.97, WARM_PARTIAL_REHEAT_ALPHA);

  const dataset = buildLargeVaultDataset({ noteCount });
  const service = new KnowledgeIndexService();
  service.buildFromNotes(dataset.notes);
  const noteIds = dataset.notes.filter(n => !n.deletedAt).map(n => n.id);
  const global = buildGlobalGraphData({ service });
  const edges = global.edges.map(e => ({ from: e.sourceId, to: e.targetId }));
  const hubId = pickHubId(service, noteIds);

  let affected = noteCount;
  let restartCount = 1;
  let initialAlpha = COSMOS_WARM_REHEAT_ALPHA;

  switch (scenarioId) {
    case 'note_add_1':
      affected = estimateAffectedNodesWithinHops([hubId, 'new-note-synthetic'], noteIds, edges, 2) + 1;
      break;
    case 'link_add_1': {
      const leaf = global.nodes.find(n => (n.degree ?? 0) === 1)?.noteId ?? noteIds[0]!;
      affected = estimateAffectedNodesWithinHops([hubId, leaf], noteIds, edges, 2);
      break;
    }
    case 'note_remove_1': {
      const leaf = global.nodes.find(n => (n.degree ?? 0) === 1)?.noteId ?? noteIds[0]!;
      affected = estimateAffectedNodesWithinHops([leaf], noteIds, edges, 2);
      break;
    }
    default:
      break;
  }

  const pairShare = incrementalPairShare(Math.min(affected, noteCount), noteCount);
  return {
    noteCount,
    scenarioId,
    restartCount,
    initialAlpha,
    settleTicks: warmTicks,
    incrementalPairShare: Math.round(pairShare * 1000) / 1000,
    affectedNodeCount: Math.min(affected, noteCount),
    totalNodeCount: noteCount,
    modeledTickCost: Math.round(warmTicks * pairShare * 10) / 10,
  };
}

export function formatK92b2AuditTable(rows: K92b2ScenarioRow[]): string {
  const lines = [
    '=== K-92B2 Incremental Sim Restart Audit ===',
    '',
    '| Notes | Scenario | Restarts | α₀ | Warm ticks | Affected nodes | Pair share | Modeled tick cost | Full warm ticks |',
    '| ----: | -------- | -------: | -: | ---------: | -------------: | ---------: | ----------------: | --------------: |',
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.noteCount} | ${r.scenarioId} | ${r.restartCount} | ${r.initialAlpha} | ${r.settleTicks} | `
      + `${r.affectedNodeCount} | ${(r.incrementalPairShare * 100).toFixed(1)}% | ${r.modeledTickCost} | ${r.settleTicks} |`,
    );
  }
  return lines.join('\n');
}

export function formatK92b2BaselineTable(scales: readonly number[]): string {
  const lines = [
    '=== K-92B2 Current warm-full restart cost ===',
    '',
    '| Notes | Cold ticks | Warm ticks (current minor edit) | Tick reduction vs cold |',
    '| ----: | ---------: | ------------------------------: | ---------------------: |',
  ];
  for (const n of scales) {
    const row = runK92b1ForceSimAudit(n);
    const pct = row.coldSimTicks > 0
      ? Math.round(((row.coldSimTicks - row.warmPartialReheatTicks) / row.coldSimTicks) * 1000) / 10
      : 0;
    lines.push(`| ${n} | ${row.coldSimTicks} | ${row.warmPartialReheatTicks} | ${pct}% |`);
  }
  return lines.join('\n');
}
