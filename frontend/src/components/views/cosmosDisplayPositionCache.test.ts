import { describe, expect, it } from 'vitest';
import {
  countCachedDisplayPosComputationsPerCommit,
  countIndexedParentLookupsPerCommit,
  countLegacyDisplayPosComputationsPerCommit,
  countLegacyParentScanStepsPerCommit,
  createCosmosDisplayPositionResolver,
} from './cosmosDisplayPositionCache';

describe('cosmosDisplayPositionCache', () => {
  it('caches repeated node lookups within one resolver', () => {
    const parent = {
      id: 'p',
      x: 10,
      y: 10,
      orbitParentId: null,
      orbitRadius: 0,
      orbitAngle: 0,
      orbitSpeed: 0,
    };
    const child = {
      id: 'c',
      x: 20,
      y: 20,
      orbitParentId: 'p',
      orbitRadius: 10,
      orbitAngle: 0,
      orbitSpeed: 0,
    };
    const renderMap = new Map([
      ['p', parent],
      ['c', child],
    ]);
    const resolve = createCosmosDisplayPositionResolver({
      renderMap,
      timeMs: 0,
      reducedMotion: true,
      universeMode: true,
    });
    const first = resolve(child);
    const second = resolve(child);
    expect(second).toBe(first);
    expect(resolve.cache.size).toBe(1);
  });

  it('models parent scan reduction', () => {
    expect(countLegacyParentScanStepsPerCommit(996, 50, 1000)).toBeGreaterThan(1000);
    expect(countIndexedParentLookupsPerCommit(996, 50)).toBeLessThan(100);
  });

  it('models cache compute reduction', () => {
    expect(countLegacyDisplayPosComputationsPerCommit(500, 250)).toBe(1000);
    expect(countCachedDisplayPosComputationsPerCommit(500)).toBe(500);
  });
});
