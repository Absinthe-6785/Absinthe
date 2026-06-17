import { describe, expect, it } from 'vitest';
import { buildGraphTopologySignature } from './cosmosGraphSignature';
import {
  collectTopologyDirtySeeds,
  diffTopologySignatures,
  expandReheatNeighborhood,
  parseGraphTopologySignature,
  resolveCosmosLocalReheatPlan,
  shouldIntegrateCosmosSimPair,
} from './cosmosLocalReheat';

const BASE = {
  nodeIds: ['a', 'b', 'c', 'd'],
  edges: [
    { sourceId: 'a', targetId: 'b', relationshipType: 'backlink' },
    { sourceId: 'b', targetId: 'c', relationshipType: 'mention' },
    { sourceId: 'c', targetId: 'd', relationshipType: 'backlink' },
  ],
};

function sig(input: typeof BASE): string {
  return buildGraphTopologySignature({
    nodeIds: input.nodeIds,
    edges: input.edges.map(e => ({
      sourceId: e.sourceId,
      targetId: e.targetId,
      relationshipType: e.relationshipType,
    })),
  });
}

describe('cosmosLocalReheat', () => {
  it('diffs added link endpoints only', () => {
    const before = sig(BASE);
    const after = sig({
      ...BASE,
      edges: [...BASE.edges, { sourceId: 'a', targetId: 'd', relationshipType: 'backlink' }],
    });
    const diff = diffTopologySignatures(before, after);
    expect(diff.addedNodeIds).toEqual([]);
    expect(diff.addedEdgeKeys).toHaveLength(1);
    const seeds = collectTopologyDirtySeeds(
      diff,
      parseGraphTopologySignature(before),
      parseGraphTopologySignature(after),
    );
    expect([...seeds].sort()).toEqual(['a', 'd']);
  });

  it('expands 2-hop neighborhood from link endpoints', () => {
    const active = expandReheatNeighborhood(
      BASE.nodeIds,
      BASE.edges.map(e => ({ from: e.sourceId, to: e.targetId })),
      ['a', 'd'],
      2,
    );
    expect(active.size).toBe(4);
  });

  it('uses 1-hop for tighter local set', () => {
    const active = expandReheatNeighborhood(
      BASE.nodeIds,
      BASE.edges.map(e => ({ from: e.sourceId, to: e.targetId })),
      ['a', 'd'],
      1,
    );
    expect(active.has('a')).toBe(true);
    expect(active.has('d')).toBe(true);
    expect(active.has('b')).toBe(true);
    expect(active.has('c')).toBe(true);
  });

  it('selects local reheat for single link add on preserved graph', () => {
    const before = sig(BASE);
    const after = sig({
      ...BASE,
      edges: [...BASE.edges, { sourceId: 'a', targetId: 'd', relationshipType: 'backlink' }],
    });
    const plan = resolveCosmosLocalReheatPlan({
      prevSignature: before,
      nextSignature: after,
      totalNodeCount: 100,
      preservedNodeCount: 100,
    });
    expect(plan.mode).toBe('local_reheat');
    expect(plan.activeNodeIds?.size).toBeGreaterThan(0);
    expect(plan.fallbackReason).toBeNull();
  });

  it('falls back to warm full when a node is added', () => {
    const before = sig(BASE);
    const after = sig({
      nodeIds: [...BASE.nodeIds, 'new'],
      edges: [...BASE.edges, { sourceId: 'a', targetId: 'new', relationshipType: 'backlink' }],
    });
    const plan = resolveCosmosLocalReheatPlan({
      prevSignature: before,
      nextSignature: after,
      totalNodeCount: 5,
      preservedNodeCount: 4,
    });
    expect(plan.mode).toBe('warm_full');
    expect(plan.fallbackReason).toBe('non_edge_topology_change');
  });

  it('falls back to warm full on bulk node change', () => {
    const before = sig(BASE);
    const manyAdded = sig({
      nodeIds: [...BASE.nodeIds, 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10', 'n11'],
      edges: BASE.edges,
    });
    const plan = resolveCosmosLocalReheatPlan({
      prevSignature: before,
      nextSignature: manyAdded,
      totalNodeCount: 15,
      preservedNodeCount: 4,
    });
    expect(plan.mode).toBe('warm_full');
    expect(plan.fallbackReason).toBe('non_edge_topology_change');
  });

  it('skips inactive-inactive pair integration in local mode', () => {
    const active = new Set(['a', 'b']);
    expect(shouldIntegrateCosmosSimPair('a', 'b', active)).toBe(true);
    expect(shouldIntegrateCosmosSimPair('c', 'd', active)).toBe(false);
    expect(shouldIntegrateCosmosSimPair('a', 'c', active)).toBe(true);
  });
});
