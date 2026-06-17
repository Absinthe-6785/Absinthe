import { describe, expect, it } from 'vitest';
import {
  buildCosmosRenderMapFromNodes,
  countLegacyRenderMapBuildsDuringSettle,
  countMemoizedRenderMapBuildsDuringSettle,
} from './cosmosRenderMapMemo';

describe('cosmosRenderMapMemo', () => {
  it('builds id map from node refs', () => {
    const nodes = [{ id: 'a', x: 1 }, { id: 'b', x: 2 }];
    const map = buildCosmosRenderMapFromNodes(nodes);
    expect(map.get('a')).toBe(nodes[0]);
    expect(map.size).toBe(2);
  });

  it('models settle build reduction', () => {
    expect(countMemoizedRenderMapBuildsDuringSettle()).toBe(1);
    expect(countLegacyRenderMapBuildsDuringSettle(34)).toBe(34);
  });
});
