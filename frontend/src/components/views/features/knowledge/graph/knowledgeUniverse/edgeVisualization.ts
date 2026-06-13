import type { GraphRelationshipType } from '../graphModels';

export type EdgeVisualCategory = 'parent' | 'reference' | 'related' | 'strong' | 'weak';

export interface EdgeVisualStyle {
  category: EdgeVisualCategory;
  strokeWidth: number;
  strokeDasharray?: string;
  baseOpacity: number;
  hoverOpacity: number;
  activeOpacity: number;
}

export interface EdgeVisualContext {
  isActive: boolean;
  isHovered: boolean;
  isDim: boolean;
}

const STRONG_WEIGHT = 3;
const WEAK_WEIGHT = 1;

function categoryForType(type: GraphRelationshipType, weight: number): EdgeVisualCategory {
  if (type === 'mutual-backlink' || weight >= STRONG_WEIGHT + 1) return 'strong';
  if (type === 'backlink') return 'parent';
  if (type === 'mention') return 'reference';
  if (weight <= WEAK_WEIGHT) return 'weak';
  return 'related';
}

/** Relationship-aware edge styling for the Knowledge Universe. */
export function getEdgeVisualStyle(
  relationshipType: GraphRelationshipType,
  weight: number,
): EdgeVisualStyle {
  const category = categoryForType(relationshipType, weight);

  switch (category) {
    case 'parent':
      return {
        category,
        strokeWidth: Math.min(1.5 + weight * 0.35, 3.5),
        baseOpacity: 0.55,
        hoverOpacity: 0.95,
        activeOpacity: 1,
      };
    case 'reference':
      return {
        category,
        strokeWidth: Math.min(1 + weight * 0.25, 2.5),
        strokeDasharray: '6 4',
        baseOpacity: 0.45,
        hoverOpacity: 0.9,
        activeOpacity: 0.98,
      };
    case 'related':
      return {
        category,
        strokeWidth: 1.25,
        strokeDasharray: '2 4',
        baseOpacity: 0.4,
        hoverOpacity: 0.85,
        activeOpacity: 0.95,
      };
    case 'strong':
      return {
        category,
        strokeWidth: Math.min(2 + weight * 0.4, 4),
        baseOpacity: 0.65,
        hoverOpacity: 1,
        activeOpacity: 1,
      };
    case 'weak':
    default:
      return {
        category: 'weak',
        strokeWidth: 0.75,
        baseOpacity: 0.25,
        hoverOpacity: 0.7,
        activeOpacity: 0.9,
      };
  }
}

export function resolveEdgeStrokeOpacity(
  style: EdgeVisualStyle,
  context: EdgeVisualContext,
): number {
  if (context.isDim) return 0.12;
  if (context.isActive) return style.activeOpacity;
  if (context.isHovered) return style.hoverOpacity;
  return style.baseOpacity;
}
