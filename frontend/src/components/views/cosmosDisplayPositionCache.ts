/**
 * K-92B3C2 — Cosmos display position resolver with parent index + per-render cache.
 */
import { computeDisplayPosition } from './features/knowledge/graph/knowledgeUniverse';
import type { CosmosDisplayPosNode } from './cosmosGraphLayers';

export interface CosmosDisplayPositionContext {
  renderMap: ReadonlyMap<string, CosmosDisplayPosNode>;
  timeMs: number;
  reducedMotion: boolean;
  universeMode: boolean;
}

export interface CosmosDisplayPositionResolver {
  (node: CosmosDisplayPosNode): { x: number; y: number };
  cache: Map<string, { x: number; y: number }>;
}

/** O(1) parent lookup via topology-stable renderMap + optional per-render cache. */
export function resolveCosmosDisplayPosition(
  node: CosmosDisplayPosNode,
  context: CosmosDisplayPositionContext,
): { x: number; y: number } {
  const parent = node.orbitParentId
    ? context.renderMap.get(node.orbitParentId)
    : undefined;
  return computeDisplayPosition({
    x: node.x,
    y: node.y,
    parentX: parent?.x ?? null,
    parentY: parent?.y ?? null,
    orbitRadius: node.orbitRadius ?? 0,
    orbitAngle: node.orbitAngle ?? 0,
    orbitSpeed: node.orbitSpeed ?? 0,
    timeMs: context.timeMs,
    reducedMotion: context.reducedMotion,
    enabled: context.universeMode,
  });
}

export function createCosmosDisplayPositionResolver(
  context: CosmosDisplayPositionContext,
): CosmosDisplayPositionResolver {
  const cache = new Map<string, { x: number; y: number }>();
  const resolve = ((node: CosmosDisplayPosNode) => {
    const cached = cache.get(node.id);
    if (cached) return cached;
    const pos = resolveCosmosDisplayPosition(node, context);
    cache.set(node.id, pos);
    return pos;
  }) as CosmosDisplayPositionResolver;
  resolve.cache = cache;
  return resolve;
}

/** Pre-K-92B3C2: linear parent scan per orbit-child getDisplayPos call. */
export function countLegacyParentScanStepsPerCommit(
  getDisplayPosCallsPerCommit: number,
  orbitParentNodeCount: number,
  nodeCount: number,
): number {
  if (orbitParentNodeCount <= 0 || getDisplayPosCallsPerCommit <= 0) return 0;
  const orbitCallShare = Math.min(1, orbitParentNodeCount / Math.max(1, getDisplayPosCallsPerCommit));
  return Math.round(getDisplayPosCallsPerCommit * orbitCallShare * nodeCount);
}

/** Post-K-92B3C2: O(1) renderMap.get per orbit-child call. */
export function countIndexedParentLookupsPerCommit(
  getDisplayPosCallsPerCommit: number,
  orbitParentNodeCount: number,
): number {
  if (orbitParentNodeCount <= 0) return 0;
  const orbitCallShare = Math.min(1, orbitParentNodeCount / Math.max(1, getDisplayPosCallsPerCommit));
  return Math.round(getDisplayPosCallsPerCommit * orbitCallShare);
}

/** Unique position computations with per-render cache (node layer + edge endpoints). */
export function countCachedDisplayPosComputationsPerCommit(
  visibleNodeCount: number,
): number {
  return visibleNodeCount;
}

export function countLegacyDisplayPosComputationsPerCommit(
  visibleNodeCount: number,
  visibleEdgeCount: number,
): number {
  return visibleNodeCount + visibleEdgeCount * 2;
}
