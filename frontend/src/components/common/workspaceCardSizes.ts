/** K-71 workspace card height tiers — use one tier per card surface. */
export const WORKSPACE_CARD = {
  sm: 'min-h-[120px]',
  md: 'min-h-[200px]',
  lg: 'min-h-[360px]',
  hero: 'min-h-[420px]',
  /** K-76 — today's workout panel; list-focused, not oversized hero. */
  workoutHero: 'min-h-[280px] lg:min-h-0',
} as const;

/** K-127 — responsive radius retained for intentional local/workspace-specific shells. */
export const WORKSPACE_CARD_RADIUS_CLASS = 'rounded-[20px] lg:rounded-[24px]';

/**
 * UI-02 — semantic shared-surface authority.
 *
 * These roles own color, radius, and shadow as one deterministic visual contract.
 * Their current values reproduce the browser-resolved pre-UI-02 appearance while
 * keeping future theme replacement centralized. Spacing remains role-specific.
 */
export const WORKSPACE_SURFACE_ROLE = {
  card: {
    colorClass: 'bg-surface-elevated text-foreground',
    radiusClass: 'rounded-absinthe-xl',
    shadowClass: 'shadow-sm',
  },
  modal: {
    colorClass: 'bg-surface-elevated text-foreground',
    radiusClass: 'rounded-absinthe-xl',
    shadowClass: 'shadow-absinthe-md',
  },
} as const;

function composeSurfaceVisual(role: keyof typeof WORKSPACE_SURFACE_ROLE): string {
  const { colorClass, radiusClass, shadowClass } = WORKSPACE_SURFACE_ROLE[role];
  return `${colorClass} ${radiusClass} ${shadowClass}`;
}

export const WORKSPACE_CARD_VISUAL_CLASS = composeSurfaceVisual('card');

/** K-125G / K-127 — complete shared card surface across Tailwind workspaces. */
export const WORKSPACE_CARD_SURFACE = `${WORKSPACE_CARD_VISUAL_CLASS} p-4 lg:p-5`;

/** Denser nested cards (analytics tiles, side panels). */
export const WORKSPACE_CARD_SURFACE_COMPACT = `${WORKSPACE_CARD_VISUAL_CLASS} p-3 lg:p-4`;

/** Modal / dialog shells. */
export const WORKSPACE_MODAL_SURFACE = `${composeSurfaceVisual('modal')} p-5 lg:p-6`;

/** K-127 — primary CTA button rhythm. */
export const WORKSPACE_BTN_PRIMARY_CLASS =
  'inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl font-bold text-sm shadow-sm bg-primary text-primary-foreground hover:opacity-90 disabled:bg-surface-muted disabled:text-disabled disabled:shadow-none disabled:hover:opacity-100 transition-opacity';

/** K-127 — secondary / outline CTA rhythm. */
export const WORKSPACE_BTN_SECONDARY_CLASS =
  'inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl font-semibold text-sm border border-border hover:bg-muted/50 transition-colors';

/** K-127 — in-card section headings. */
export const WORKSPACE_SECTION_TITLE_CLASS = 'font-heading text-sm font-bold mb-3 shrink-0';
