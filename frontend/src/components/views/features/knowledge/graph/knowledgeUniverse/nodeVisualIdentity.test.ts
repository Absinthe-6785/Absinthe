import { describe, expect, it } from 'vitest';
import { getTierVisualStyle } from './nodeVisualIdentity';

describe('nodeVisualIdentity', () => {
  it('differentiates star, planet, and moon silhouettes', () => {
    const star = getTierVisualStyle(14, 'star', true);
    const planet = getTierVisualStyle(14, 'planet', true);
    const moon = getTierVisualStyle(14, 'moon', true);

    expect(star.renderRadius).toBeGreaterThan(planet.renderRadius);
    expect(planet.renderRadius).toBeGreaterThan(moon.renderRadius);
    expect(star.showCorona).toBe(true);
    expect(planet.showOrbitRing).toBe(true);
    expect(moon.bodyOpacity).toBeLessThan(planet.bodyOpacity);
  });
});
