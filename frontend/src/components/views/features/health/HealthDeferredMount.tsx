import { memo, type ReactNode } from 'react';
import type { Theme } from '../../../../types';
import { useElementVisible } from '../../../../hooks/useElementVisible';
import { WorkspaceCardSkeleton } from '../../../common/WorkspaceCardSkeleton';

export interface HealthDeferredMountProps {
  children: ReactNode;
  theme: Theme;
  dataHook: string;
  rootMargin?: string;
  skeletonBars?: number;
  skeletonMinHeight?: string;
}

/** K-125C — viewport-triggered mount for heavy health sections. */
export const HealthDeferredMount = memo(function HealthDeferredMount({
  children,
  theme,
  dataHook,
  rootMargin = '120px',
  skeletonBars = 1,
  skeletonMinHeight = 'min-h-[64px]',
}: HealthDeferredMountProps) {
  const { ref, visible } = useElementVisible(rootMargin);

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className="shrink-0"
      data-k125c-health-deferred={dataHook}
    >
      {visible ? children : (
        <WorkspaceCardSkeleton
          bars={skeletonBars}
          theme={theme}
          minHeight={skeletonMinHeight}
          className="!p-3 !gap-2 [&_[data-workspace-card-skeleton]>div:last-child]:min-h-[48px]"
        />
      )}
    </div>
  );
});
