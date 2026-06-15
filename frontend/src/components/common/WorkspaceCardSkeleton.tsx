import type { Theme } from '@/types';

export interface WorkspaceCardSkeletonProps {
  theme: Theme;
  /** Reserved card height to prevent CLS */
  minHeight?: string;
  /** Number of pulse bars below header */
  bars?: number;
  className?: string;
}

/** Dimension-matched loading shell — mirrors ProteinTracker / workout card rhythm (K-69). */
export function WorkspaceCardSkeleton({
  theme,
  minHeight = 'min-h-[360px]',
  bars = 3,
  className = '',
}: WorkspaceCardSkeletonProps) {
  return (
    <div
      className={`rounded-[24px] lg:rounded-[32px] shadow-sm p-5 lg:p-6 flex flex-col gap-4 ${minHeight} ${theme.card} ${className}`}
      data-workspace-card-skeleton
      aria-hidden
    >
      <div className="h-7 w-36 rounded-xl bg-current opacity-10 animate-pulse" />
      <div className="h-10 w-full rounded-2xl bg-current opacity-10 animate-pulse" />
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={`w-full rounded-2xl bg-current opacity-10 animate-pulse ${i === bars - 1 ? 'flex-1 min-h-[120px]' : 'h-16'}`}
        />
      ))}
    </div>
  );
}
