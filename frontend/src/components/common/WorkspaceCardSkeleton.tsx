import type { Theme } from '@/types';
import { WORKSPACE_CARD, WORKSPACE_CARD_SURFACE } from './workspaceCardSizes';

export interface WorkspaceCardSkeletonProps {
  theme: Theme;
  /** Reserved card height to prevent CLS */
  minHeight?: string;
  /** Number of pulse bars below header */
  bars?: number;
  className?: string;
}

/** K-69 / K-127 — dimension-matched loading shell using shared card surface tokens. */
export function WorkspaceCardSkeleton({
  theme,
  minHeight = WORKSPACE_CARD.lg,
  bars = 3,
  className = '',
}: WorkspaceCardSkeletonProps) {
  return (
    <div
      className={`${WORKSPACE_CARD_SURFACE} flex flex-col gap-4 ${minHeight} ${theme.card} ${className}`}
      data-workspace-card-skeleton
      data-k127-card-skeleton
      aria-hidden
    >
      <div className="h-7 w-36 rounded-xl bg-current opacity-10 animate-pulse" />
      <div className="h-10 w-full rounded-xl bg-current opacity-10 animate-pulse" />
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={`w-full rounded-xl bg-current opacity-10 animate-pulse ${i === bars - 1 ? `flex-1 ${WORKSPACE_CARD.sm}` : 'h-16'}`}
        />
      ))}
    </div>
  );
}
