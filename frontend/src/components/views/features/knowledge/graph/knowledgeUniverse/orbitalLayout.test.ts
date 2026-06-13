import { describe, expect, it } from 'vitest';
import { assignOrbitHierarchy, computeDisplayPosition } from './orbitalLayout';

describe('orbitalLayout', () => {
  it('assigns planets to galaxy anchor and moons to planets', () => {
    const nodes = [
      { id: 'star', tier: 'star' as const, importance: 50, galaxyId: 'g1' },
      { id: 'planet', tier: 'planet' as const, importance: 20, galaxyId: 'g1' },
      { id: 'moon', tier: 'moon' as const, importance: 5, galaxyId: 'g1' },
    ];
    const edges = [{ from: 'moon', to: 'planet' }];
    const map = assignOrbitHierarchy(nodes, edges, 'star');

    expect(map.get('star')?.parentId).toBeNull();
    expect(map.get('planet')?.parentId).toBe('star');
    expect(map.get('moon')?.parentId).toBe('planet');
  });

  it('returns physics position when orbit is disabled or reduced motion', () => {
    const base = computeDisplayPosition({
      x: 50,
      y: 50,
      parentX: 10,
      parentY: 10,
      orbitRadius: 20,
      orbitAngle: 0,
      orbitSpeed: 0.001,
      timeMs: 1000,
      reducedMotion: true,
      enabled: true,
    });
    expect(base).toEqual({ x: 50, y: 50 });
  });

  it('applies subtle offset when orbit enabled', () => {
    const moved = computeDisplayPosition({
      x: 50,
      y: 50,
      parentX: 10,
      parentY: 10,
      orbitRadius: 20,
      orbitAngle: 0,
      orbitSpeed: 0.001,
      timeMs: 1000,
      reducedMotion: false,
      enabled: true,
    });
    expect(moved.x).not.toBe(50);
    expect(moved.y).not.toBe(50);
  });
});
