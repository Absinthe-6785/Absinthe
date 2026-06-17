/**
 * K-92B1B — Cosmos force simulation warm-reheat policy.
 * Shared between NoteGraphView and audit tests.
 */
import type { GlobalGraphRelationshipFilter } from './features/knowledge';
import type { GraphViewMode } from './features/knowledge/graph/knowledgeUniverse/graphViewMode';

export const COSMOS_COLD_START_ALPHA = 1.0;
export const COSMOS_WARM_REHEAT_ALPHA = 0.2;

export interface CosmosSimContextSnapshot {
  vaultStructureVersion: number;
  indexContentVersion: number;
  sizeW: number;
  sizeH: number;
  relationshipFilter: GlobalGraphRelationshipFilter;
  graphViewMode: GraphViewMode;
  reducedMotion: boolean;
}

export interface CosmosSimRestartInput {
  preservedNodeCount: number;
  totalNodeCount: number;
  prev: CosmosSimContextSnapshot | null;
  next: CosmosSimContextSnapshot;
}

/** Decide initial simulation alpha when the force loop effect (re)starts. */
export function resolveCosmosSimInitialAlpha(input: CosmosSimRestartInput): number {
  const { preservedNodeCount, totalNodeCount, prev, next } = input;

  if (totalNodeCount === 0 || preservedNodeCount === 0) {
    return COSMOS_COLD_START_ALPHA;
  }

  if (prev == null) {
    return COSMOS_COLD_START_ALPHA;
  }

  const modeOrFilterChange =
    prev.graphViewMode !== next.graphViewMode
    || prev.relationshipFilter !== next.relationshipFilter
    || prev.reducedMotion !== next.reducedMotion;

  if (modeOrFilterChange) {
    return COSMOS_COLD_START_ALPHA;
  }

  const vaultOrContentChange =
    prev.vaultStructureVersion !== next.vaultStructureVersion
    || prev.indexContentVersion !== next.indexContentVersion;
  const sizeChange = prev.sizeW !== next.sizeW || prev.sizeH !== next.sizeH;

  if (vaultOrContentChange || sizeChange) {
    return COSMOS_WARM_REHEAT_ALPHA;
  }

  return COSMOS_COLD_START_ALPHA;
}

export function countPreservedGraphNodes(
  existingIds: ReadonlySet<string>,
  nextNodeIds: readonly string[],
): number {
  let preserved = 0;
  for (const id of nextNodeIds) {
    if (existingIds.has(id)) preserved += 1;
  }
  return preserved;
}
