import { describe, expect, it } from 'vitest';
import { buildGalaxyVisuals } from './galaxyVisualization';

describe('galaxyVisualization', () => {
  it('builds titled nebula clusters with anchor metadata', () => {
    const visuals = buildGalaxyVisuals([
      { id: 's', x: 100, y: 100, galaxyId: 'g1', galaxyLabel: 'History', tier: 'star' },
      { id: 'p', x: 130, y: 120, galaxyId: 'g1', galaxyLabel: 'History', tier: 'planet' },
      { id: 'm', x: 400, y: 400, galaxyId: 'g2', galaxyLabel: 'Japanese', tier: 'moon' },
    ], new Map([['g1', 's']]));

    expect(visuals).toHaveLength(2);
    expect(visuals[0]?.displayTitle).toBe('History Galaxy');
    expect(visuals[0]?.anchorNodeId).toBe('s');
    expect(visuals[0]?.boundaryRadius).toBeGreaterThan(40);
  });
});
