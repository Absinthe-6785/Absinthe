/** K-33 — Star / Planet / Moon node archetypes for the Knowledge Universe graph. */

export type GraphNodeTier = 'star' | 'planet' | 'moon';

export interface ClassifyGraphNodeTierInput {
  /** Incoming wiki-link count (backlinks), excluding self. */
  backlinkCount: number;
  isAreaNote: boolean;
  /** Manual hub pin — starred notes in Absinthe. */
  isPinnedHub: boolean;
}

export function classifyGraphNodeTier(input: ClassifyGraphNodeTierInput): GraphNodeTier {
  if (input.backlinkCount >= 10 || input.isAreaNote || input.isPinnedHub) {
    return 'star';
  }
  if (input.backlinkCount >= 3 && input.backlinkCount <= 9) {
    return 'planet';
  }
  return 'moon';
}

export function isStarTier(tier: GraphNodeTier): boolean {
  return tier === 'star';
}
