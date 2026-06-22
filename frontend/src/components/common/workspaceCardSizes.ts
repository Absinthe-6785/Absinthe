/** K-71 workspace card height tiers — use one tier per card surface. */
export const WORKSPACE_CARD = {
  sm: 'min-h-[120px]',
  md: 'min-h-[200px]',
  lg: 'min-h-[360px]',
  hero: 'min-h-[420px]',
  /** K-76 — today's workout panel; list-focused, not oversized hero. */
  workoutHero: 'min-h-[280px] lg:min-h-0',
} as const;

export type WorkspaceCardSize = keyof typeof WORKSPACE_CARD;

/** K-125G — shared card surface rhythm across Tailwind workspaces. */
export const WORKSPACE_CARD_SURFACE = 'rounded-[20px] lg:rounded-[24px] shadow-sm p-4 lg:p-5';
