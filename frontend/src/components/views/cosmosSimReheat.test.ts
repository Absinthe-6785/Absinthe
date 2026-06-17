import { describe, expect, it } from 'vitest';
import {
  COSMOS_COLD_START_ALPHA,
  COSMOS_WARM_REHEAT_ALPHA,
  countPreservedGraphNodes,
  resolveCosmosSimInitialAlpha,
  type CosmosSimContextSnapshot,
} from './cosmosSimReheat';

const BASE_CONTEXT: CosmosSimContextSnapshot = {
  vaultStructureVersion: 1,
  indexContentVersion: 1,
  sizeW: 800,
  sizeH: 600,
  relationshipFilter: 'all',
  graphViewMode: 'universe',
  reducedMotion: false,
};

describe('cosmosSimReheat', () => {
  it('uses cold alpha on first mount with no preserved nodes', () => {
    expect(resolveCosmosSimInitialAlpha({
      preservedNodeCount: 0,
      totalNodeCount: 100,
      prev: null,
      next: BASE_CONTEXT,
    })).toBe(COSMOS_COLD_START_ALPHA);
  });

  it('uses warm alpha when vault structure changes with preserved positions', () => {
    expect(resolveCosmosSimInitialAlpha({
      preservedNodeCount: 999,
      totalNodeCount: 1000,
      prev: BASE_CONTEXT,
      next: { ...BASE_CONTEXT, vaultStructureVersion: 2 },
    })).toBe(COSMOS_WARM_REHEAT_ALPHA);
  });

  it('uses warm alpha when index content changes with preserved positions', () => {
    expect(resolveCosmosSimInitialAlpha({
      preservedNodeCount: 500,
      totalNodeCount: 500,
      prev: BASE_CONTEXT,
      next: { ...BASE_CONTEXT, indexContentVersion: 2 },
    })).toBe(COSMOS_WARM_REHEAT_ALPHA);
  });

  it('uses warm alpha on panel resize when positions are preserved', () => {
    expect(resolveCosmosSimInitialAlpha({
      preservedNodeCount: 250,
      totalNodeCount: 250,
      prev: BASE_CONTEXT,
      next: { ...BASE_CONTEXT, sizeW: 1024 },
    })).toBe(COSMOS_WARM_REHEAT_ALPHA);
  });

  it('uses cold alpha when graph view mode changes', () => {
    expect(resolveCosmosSimInitialAlpha({
      preservedNodeCount: 1000,
      totalNodeCount: 1000,
      prev: BASE_CONTEXT,
      next: { ...BASE_CONTEXT, graphViewMode: 'network' },
    })).toBe(COSMOS_COLD_START_ALPHA);
  });

  it('uses cold alpha when relationship filter changes', () => {
    expect(resolveCosmosSimInitialAlpha({
      preservedNodeCount: 1000,
      totalNodeCount: 1000,
      prev: BASE_CONTEXT,
      next: { ...BASE_CONTEXT, relationshipFilter: 'links' },
    })).toBe(COSMOS_COLD_START_ALPHA);
  });

  it('counts preserved nodes against prior id set', () => {
    const existing = new Set(['a', 'b', 'c']);
    expect(countPreservedGraphNodes(existing, ['a', 'b', 'd'])).toBe(2);
  });
});
