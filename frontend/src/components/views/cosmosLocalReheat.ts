/**
 * K-92B2B — Incremental local reheat for Cosmos force simulation.
 */
import { COSMOS_WARM_REHEAT_ALPHA } from './cosmosSimReheat';

export const COSMOS_LOCAL_REHEAT_HOPS = 2;
/** Fall back to full warm settle when local set exceeds this share of nodes. */
export const COSMOS_LOCAL_REHEAT_MAX_FRACTION = 0.2;
export const COSMOS_LOCAL_REHEAT_MAX_NODES = 200;
/** Fall back when added + removed node count exceeds this (import / bulk edit). */
export const COSMOS_LOCAL_REHEAT_BULK_NODE_THRESHOLD = 10;

export interface ParsedTopology {
  nodeIds: ReadonlySet<string>;
  edgeKeys: ReadonlySet<string>;
}

export interface TopologyDiff {
  addedNodeIds: readonly string[];
  removedNodeIds: readonly string[];
  addedEdgeKeys: readonly string[];
  removedEdgeKeys: readonly string[];
}

export type CosmosReheatMode = 'cold_full' | 'warm_full' | 'local_reheat';

export interface CosmosLocalReheatPlan {
  mode: CosmosReheatMode;
  initialAlpha: number;
  activeNodeIds: ReadonlySet<string> | null;
  dirtySeedCount: number;
  hops: number;
  fallbackReason: string | null;
}

export interface CosmosLocalReheatInput {
  prevSignature: string | null;
  nextSignature: string;
  totalNodeCount: number;
  preservedNodeCount: number;
  hops?: number;
}

export function parseGraphTopologySignature(signature: string): ParsedTopology {
  const nodeIds = new Set<string>();
  const edgeKeys = new Set<string>();
  let section: 'none' | 'nodes' | 'edges' = 'none';

  for (const line of signature.split('\n')) {
    if (line.startsWith('n:')) {
      section = 'nodes';
      const rest = line.slice(2);
      if (rest) nodeIds.add(rest);
      continue;
    }
    if (line.startsWith('e:')) {
      section = 'edges';
      const rest = line.slice(2);
      if (rest) edgeKeys.add(rest);
      continue;
    }
    if (section === 'nodes' && line) nodeIds.add(line);
    if (section === 'edges' && line) edgeKeys.add(line);
  }

  return { nodeIds, edgeKeys };
}

export function diffTopologySignatures(prevSignature: string, nextSignature: string): TopologyDiff {
  const prev = parseGraphTopologySignature(prevSignature);
  const next = parseGraphTopologySignature(nextSignature);

  const addedNodeIds: string[] = [];
  const removedNodeIds: string[] = [];
  const addedEdgeKeys: string[] = [];
  const removedEdgeKeys: string[] = [];

  for (const id of next.nodeIds) {
    if (!prev.nodeIds.has(id)) addedNodeIds.push(id);
  }
  for (const id of prev.nodeIds) {
    if (!next.nodeIds.has(id)) removedNodeIds.push(id);
  }
  for (const key of next.edgeKeys) {
    if (!prev.edgeKeys.has(key)) addedEdgeKeys.push(key);
  }
  for (const key of prev.edgeKeys) {
    if (!next.edgeKeys.has(key)) removedEdgeKeys.push(key);
  }

  return { addedNodeIds, removedNodeIds, addedEdgeKeys, removedEdgeKeys };
}

function edgeEndpoints(edgeKey: string): [string, string] {
  const [from, to] = edgeKey.split('|');
  return [from ?? '', to ?? ''];
}

/** Seeds from topology delta — endpoints and neighbors of removed nodes. */
export function collectTopologyDirtySeeds(
  diff: TopologyDiff,
  prevTopology: ParsedTopology,
  nextTopology: ParsedTopology,
): Set<string> {
  const seeds = new Set<string>();

  for (const id of diff.addedNodeIds) seeds.add(id);

  for (const id of diff.removedNodeIds) {
    for (const key of prevTopology.edgeKeys) {
      const [from, to] = edgeEndpoints(key);
      if (from === id && nextTopology.nodeIds.has(to)) seeds.add(to);
      if (to === id && nextTopology.nodeIds.has(from)) seeds.add(from);
    }
  }

  for (const key of diff.addedEdgeKeys) {
    const [from, to] = edgeEndpoints(key);
    if (nextTopology.nodeIds.has(from)) seeds.add(from);
    if (nextTopology.nodeIds.has(to)) seeds.add(to);
  }

  for (const key of diff.removedEdgeKeys) {
    const [from, to] = edgeEndpoints(key);
    if (nextTopology.nodeIds.has(from)) seeds.add(from);
    if (nextTopology.nodeIds.has(to)) seeds.add(to);
  }

  return seeds;
}

export function expandReheatNeighborhood(
  nodeIds: readonly string[],
  edges: readonly { from: string; to: string }[],
  seedIds: Iterable<string>,
  hops = COSMOS_LOCAL_REHEAT_HOPS,
): Set<string> {
  const valid = new Set(nodeIds);
  const adj = new Map<string, Set<string>>();
  for (const id of nodeIds) adj.set(id, new Set());
  for (const e of edges) {
    adj.get(e.from)?.add(e.to);
    adj.get(e.to)?.add(e.from);
  }

  const visited = new Set<string>();
  for (const id of seedIds) {
    if (valid.has(id)) visited.add(id);
  }

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

  return visited;
}

export function shouldFallbackToFullWarmReheat(
  activeCount: number,
  totalNodeCount: number,
  diff: TopologyDiff,
): { fallback: boolean; reason: string | null } {
  const edgeOnlyChange =
    (diff.addedEdgeKeys.length > 0 || diff.removedEdgeKeys.length > 0)
    && diff.addedNodeIds.length === 0
    && diff.removedNodeIds.length === 0;

  if (!edgeOnlyChange) {
    return { fallback: true, reason: 'non_edge_topology_change' };
  }
  if (totalNodeCount <= 0) {
    return { fallback: true, reason: 'empty_graph' };
  }
  if (diff.addedNodeIds.length + diff.removedNodeIds.length > COSMOS_LOCAL_REHEAT_BULK_NODE_THRESHOLD) {
    return { fallback: true, reason: 'bulk_node_change' };
  }
  if (activeCount > COSMOS_LOCAL_REHEAT_MAX_NODES) {
    return { fallback: true, reason: 'active_set_too_large' };
  }
  if (activeCount / totalNodeCount > COSMOS_LOCAL_REHEAT_MAX_FRACTION) {
    return { fallback: true, reason: 'active_fraction_exceeded' };
  }
  return { fallback: false, reason: null };
}

export function resolveCosmosLocalReheatPlan(input: CosmosLocalReheatInput): CosmosLocalReheatPlan {
  const hops = input.hops ?? COSMOS_LOCAL_REHEAT_HOPS;

  if (input.totalNodeCount === 0 || input.preservedNodeCount === 0 || input.prevSignature == null) {
    return {
      mode: 'cold_full',
      initialAlpha: 1.0,
      activeNodeIds: null,
      dirtySeedCount: 0,
      hops,
      fallbackReason: input.prevSignature == null ? 'first_mount' : 'no_preserved_nodes',
    };
  }

  if (input.prevSignature === input.nextSignature) {
    return {
      mode: 'warm_full',
      initialAlpha: COSMOS_WARM_REHEAT_ALPHA,
      activeNodeIds: null,
      dirtySeedCount: 0,
      hops,
      fallbackReason: 'no_topology_change',
    };
  }

  const prevTopology = parseGraphTopologySignature(input.prevSignature);
  const nextTopology = parseGraphTopologySignature(input.nextSignature);
  const diff = diffTopologySignatures(input.prevSignature, input.nextSignature);
  const seeds = collectTopologyDirtySeeds(diff, prevTopology, nextTopology);
  const nodeIds = [...nextTopology.nodeIds];
  const edges = [...nextTopology.edgeKeys].map(key => {
    const [from, to] = edgeEndpoints(key);
    return { from, to };
  });
  const activeNodeIds = expandReheatNeighborhood(nodeIds, edges, seeds, hops);
  const fallback = shouldFallbackToFullWarmReheat(activeNodeIds.size, input.totalNodeCount, diff);

  if (fallback.fallback || activeNodeIds.size === 0) {
    return {
      mode: 'warm_full',
      initialAlpha: COSMOS_WARM_REHEAT_ALPHA,
      activeNodeIds: null,
      dirtySeedCount: seeds.size,
      hops,
      fallbackReason: fallback.reason ?? 'empty_active_set',
    };
  }

  return {
    mode: 'local_reheat',
    initialAlpha: COSMOS_WARM_REHEAT_ALPHA,
    activeNodeIds,
    dirtySeedCount: seeds.size,
    hops,
    fallbackReason: null,
  };
}

export function isCosmosSimNodeActive(
  nodeId: string,
  activeNodeIds: ReadonlySet<string> | null,
): boolean {
  return activeNodeIds == null || activeNodeIds.has(nodeId);
}

export function shouldIntegrateCosmosSimPair(
  idA: string,
  idB: string,
  activeNodeIds: ReadonlySet<string> | null,
): boolean {
  if (activeNodeIds == null) return true;
  return activeNodeIds.has(idA) || activeNodeIds.has(idB);
}
