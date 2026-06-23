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

/** K-127 — canonical card radius (matches UI_DENSITY cardRadius*Px). */
export const WORKSPACE_CARD_RADIUS_CLASS = 'rounded-[20px] lg:rounded-[24px]';

/** K-125G / K-127 — shared card surface rhythm across Tailwind workspaces. */
export const WORKSPACE_CARD_SURFACE = `${WORKSPACE_CARD_RADIUS_CLASS} shadow-sm p-4 lg:p-5`;

/** Denser nested cards (analytics tiles, side panels). */
export const WORKSPACE_CARD_SURFACE_COMPACT = `${WORKSPACE_CARD_RADIUS_CLASS} shadow-sm p-3 lg:p-4`;

/** Modal / dialog shells. */
export const WORKSPACE_MODAL_SURFACE = `${WORKSPACE_CARD_RADIUS_CLASS} p-5 lg:p-6 shadow-2xl`;

/** K-127 — primary CTA button rhythm. */
export const WORKSPACE_BTN_PRIMARY_CLASS =
  'inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl font-bold text-sm shadow-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity';

/** K-127 — secondary / outline CTA rhythm. */
export const WORKSPACE_BTN_SECONDARY_CLASS =
  'inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl font-semibold text-sm border border-border hover:bg-muted/50 transition-colors';

/** K-127 — in-card section headings. */
export const WORKSPACE_SECTION_TITLE_CLASS = 'font-heading text-sm font-bold mb-3 shrink-0';
