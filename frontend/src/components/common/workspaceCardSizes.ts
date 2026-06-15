/** K-71 workspace card height tiers — use one tier per card surface. */
export const WORKSPACE_CARD = {
  sm: 'min-h-[120px]',
  md: 'min-h-[200px]',
  lg: 'min-h-[360px]',
  hero: 'min-h-[420px]',
} as const;

export type WorkspaceCardSize = keyof typeof WORKSPACE_CARD;
