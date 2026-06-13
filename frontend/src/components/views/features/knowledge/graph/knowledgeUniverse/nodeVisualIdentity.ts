import type { GraphNodeTier } from './graphNodeTier';

export interface TierVisualStyle {
  renderRadius: number;
  bodyOpacity: number;
  strokeWidth: number;
  showCorona: boolean;
  showOrbitRing: boolean;
  simplifiedOutline: boolean;
  fillTint: string | null;
  glowFilter: 'star' | 'planet' | null;
}

export function getTierVisualRadius(baseRadius: number, tier: GraphNodeTier): number {
  if (tier === 'star') return baseRadius * 1.2;
  if (tier === 'moon') return baseRadius * 0.82;
  return baseRadius;
}

/** K-33.1 stellar hierarchy — distinct silhouettes without reading labels. */
export function getTierVisualStyle(
  baseRadius: number,
  tier: GraphNodeTier,
  dark: boolean,
): TierVisualStyle {
  const renderRadius = getTierVisualRadius(baseRadius, tier);

  switch (tier) {
    case 'star':
      return {
        renderRadius,
        bodyOpacity: 1,
        strokeWidth: 2.5,
        showCorona: true,
        showOrbitRing: false,
        simplifiedOutline: false,
        fillTint: dark ? '#C4B5FD' : '#EDE9FE',
        glowFilter: 'star',
      };
    case 'planet':
      return {
        renderRadius,
        bodyOpacity: 0.94,
        strokeWidth: 2,
        showCorona: false,
        showOrbitRing: true,
        simplifiedOutline: false,
        fillTint: dark ? '#6366F1' : '#E0E7FF',
        glowFilter: 'planet',
      };
    case 'moon':
    default:
      return {
        renderRadius,
        bodyOpacity: 0.62,
        strokeWidth: 1,
        showCorona: false,
        showOrbitRing: false,
        simplifiedOutline: true,
        fillTint: null,
        glowFilter: null,
      };
  }
}
