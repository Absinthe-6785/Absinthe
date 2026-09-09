import { forwardRef, type ReactNode } from 'react';
import { classifyViewportWidth, type ViewportCategory } from '@/lib/responsiveLayout';

export const HEALTH_COMPOSITION = {
  primary: 'active-workout',
  secondary: 'setup',
  tertiary: 'support',
  compactOrder: ['setup', 'active-workout', 'support'],
} as const;

export interface HealthCompositionLayout {
  category: ViewportCategory;
  composition: 'natural-flow' | 'wide-workout-first';
  rootScroll: 'health-workspace' | 'bounded-regions';
}

/** UI-06 derives Health's wide transition from the shared UI-01 authority. */
export function resolveHealthCompositionLayout(width: number): HealthCompositionLayout {
  const category = classifyViewportWidth(width);
  const wide = category === 'wide';

  return {
    category,
    composition: wide ? 'wide-workout-first' : 'natural-flow',
    rootScroll: wide ? 'bounded-regions' : 'health-workspace',
  };
}

export function HealthWorkoutComposition({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex flex-col gap-3 pb-8 min-h-0 lg:gap-4 xl:grid xl:flex-1 xl:h-full xl:pb-0 xl:overflow-hidden xl:grid-cols-[minmax(300px,0.34fr)_minmax(0,1fr)]"
      data-k129b-health-overview
      data-k134a-health-flow
      data-k134b-health-natural-scroll
      data-k136a-health-workspace-flow
      data-health-composition="workout-first"
      data-health-wide-allocation="setup-column-active-workout"
    >
      {children}
    </div>
  );
}

export function HealthSetupColumn({ children }: { children: ReactNode }) {
  return (
    <aside
      className="flex flex-col gap-2.5 shrink-0 min-h-0 xl:grid xl:grid-rows-[minmax(0,0.52fr)_minmax(0,0.48fr)] xl:gap-3 xl:h-full xl:min-w-0 xl:overflow-hidden"
      data-k129b-health-secondary
      data-k136a-health-left
      data-health-composition-role="setup"
      data-health-hierarchy-level="secondary"
    >
      {children}
    </aside>
  );
}

export function HealthExecutionColumn({
  children,
  showOnCompact,
}: {
  children: ReactNode;
  showOnCompact: boolean;
}) {
  return (
    <section
      className={`lg:min-w-0 min-h-0 shrink-0 pb-3 lg:pb-0 lg:pr-1 flex flex-col gap-2.5 xl:grid xl:grid-rows-[minmax(360px,0.68fr)_minmax(200px,0.32fr)] xl:gap-3 xl:h-full xl:overflow-hidden ${
        showOnCompact ? 'flex xl:grid' : 'hidden lg:flex xl:grid'
      }`}
      data-k129b-health-primary
      data-k136a-health-center
      data-k138-health-right-grid
      data-health-composition-role="execution"
    >
      {children}
    </section>
  );
}

export const HealthSupportRegion = forwardRef<HTMLDivElement, { children: ReactNode }>(
  function HealthSupportRegion({ children }, ref) {
    return (
      <div
        ref={ref}
        className="flex min-w-0 min-h-0 flex-col gap-2.5 pb-4 xl:h-full xl:pb-0 xl:overflow-y-auto xl:overscroll-contain xl:pr-1"
        data-k136a-health-right
        data-k138-support-row
        data-health-composition-role="support"
        data-health-hierarchy-level="tertiary"
        data-health-scroll-owner="wide-support"
      >
        {children}
      </div>
    );
  },
);
