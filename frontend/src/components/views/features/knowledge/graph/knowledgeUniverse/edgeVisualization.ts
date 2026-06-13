import type { GraphRelationshipType } from '../graphModels';

export type EdgeSemanticKind = 'hierarchy' | 'reference' | 'related' | 'temporal' | 'strong' | 'weak';

export interface EdgeVisualStyle {
  kind: EdgeSemanticKind;
  label: string;
  strokeWidth: number;
  strokeDasharray?: string;
  baseOpacity: number;
  hoverOpacity: number;
  activeOpacity: number;
  glow: boolean;
}

export interface EdgeVisualContext {
  isActive: boolean;
  isHovered: boolean;
  isDim: boolean;
  focusOpacity?: number;
}

const STRONG_WEIGHT = 3;
const WEAK_WEIGHT = 1;

function kindForType(type: GraphRelationshipType, weight: number): EdgeSemanticKind {
  if (type === 'mutual-backlink' || weight >= STRONG_WEIGHT + 1) return 'strong';
  if (type === 'backlink') return 'hierarchy';
  if (type === 'mention') return 'reference';
  if (type === 'relation') return 'temporal';
  if (weight <= WEAK_WEIGHT) return 'weak';
  return 'related';
}

/** Semantic edge language for the Knowledge Universe (K-33.1). */
export function getEdgeVisualStyle(
  relationshipType: GraphRelationshipType,
  weight: number,
): EdgeVisualStyle {
  const kind = kindForType(relationshipType, weight);

  switch (kind) {
    case 'hierarchy':
      return {
        kind,
        label: 'Hierarchy',
        strokeWidth: Math.min(2.2 + weight * 0.35, 4),
        baseOpacity: 0.62,
        hoverOpacity: 0.98,
        activeOpacity: 1,
        glow: false,
      };
    case 'reference':
      return {
        kind,
        label: 'Reference',
        strokeWidth: Math.min(1.2 + weight * 0.2, 2.2),
        strokeDasharray: '10 5',
        baseOpacity: 0.48,
        hoverOpacity: 0.92,
        activeOpacity: 0.98,
        glow: false,
      };
    case 'related':
      return {
        kind,
        label: 'Related',
        strokeWidth: 1.15,
        strokeDasharray: '3 6',
        baseOpacity: 0.38,
        hoverOpacity: 0.82,
        activeOpacity: 0.92,
        glow: false,
      };
    case 'temporal':
      return {
        kind,
        label: 'Temporal',
        strokeWidth: 1.1,
        strokeDasharray: '1 5',
        baseOpacity: 0.42,
        hoverOpacity: 0.88,
        activeOpacity: 0.95,
        glow: false,
      };
    case 'strong':
      return {
        kind,
        label: 'Strong',
        strokeWidth: Math.min(2.5 + weight * 0.35, 4.5),
        baseOpacity: 0.78,
        hoverOpacity: 1,
        activeOpacity: 1,
        glow: true,
      };
    case 'weak':
    default:
      return {
        kind: 'weak',
        label: 'Weak',
        strokeWidth: 0.7,
        baseOpacity: 0.2,
        hoverOpacity: 0.55,
        activeOpacity: 0.75,
        glow: false,
      };
  }
}

export function resolveEdgeStrokeOpacity(
  style: EdgeVisualStyle,
  context: EdgeVisualContext,
): number {
  const base = (() => {
    if (context.isDim) return 0.06;
    if (context.isActive) return style.activeOpacity;
    if (context.isHovered) return style.hoverOpacity;
    return style.baseOpacity;
  })();
  if (context.focusOpacity != null) {
    return base * context.focusOpacity;
  }
  return base;
}

export function edgeStrokeColor(
  kind: EdgeSemanticKind,
  dark: boolean,
  accent: string,
): string {
  switch (kind) {
    case 'strong':
      return accent;
    case 'hierarchy':
      return dark ? '#A78BFA' : '#7C3AED';
    case 'reference':
      return dark ? '#67E8F9' : '#0891B2';
    case 'temporal':
      return dark ? '#FBBF24' : '#D97706';
    case 'related':
      return dark ? '#94A3B8' : '#64748B';
    case 'weak':
    default:
      return dark ? '#52525B' : '#A8A29E';
  }
}

export const EDGE_LEGEND: readonly { kind: EdgeSemanticKind; sample: string; label: string }[] = [
  { kind: 'hierarchy', sample: '━━━━', label: 'Hierarchy' },
  { kind: 'reference', sample: '──────', label: 'Reference' },
  { kind: 'related', sample: '┄┄┄┄', label: 'Related' },
  { kind: 'temporal', sample: '······', label: 'Temporal' },
  { kind: 'strong', sample: '◉ glow', label: 'Strong' },
];
