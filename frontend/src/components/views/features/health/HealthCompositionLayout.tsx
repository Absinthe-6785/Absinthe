import { forwardRef, type ReactNode } from 'react';

export function HealthWorkoutComposition({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex flex-col gap-3 pb-8 min-h-0 lg:gap-4 xl:grid xl:flex-1 xl:h-full xl:pb-0 xl:overflow-hidden xl:grid-cols-[minmax(300px,0.34fr)_minmax(0,1fr)] xl:grid-rows-[minmax(360px,68fr)_minmax(200px,32fr)]"
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
      className="flex flex-col gap-2.5 shrink-0 min-h-0 xl:col-start-1 xl:row-start-1 xl:row-span-2 xl:grid xl:grid-rows-[minmax(0,0.52fr)_minmax(0,0.48fr)] xl:gap-3 xl:h-full xl:min-w-0 xl:overflow-hidden"
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
      className={`lg:min-w-0 min-h-0 shrink-0 pb-3 lg:pb-0 lg:pr-1 flex-col gap-2.5 xl:col-start-2 xl:row-start-1 xl:h-full xl:overflow-hidden ${
        showOnCompact ? 'flex' : 'hidden lg:flex'
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

export const HealthSupportRegion = forwardRef<HTMLDivElement, { children: ReactNode; showOnCompact: boolean }>(
  function HealthSupportRegion({ children, showOnCompact }, ref) {
    return (
      <div
        ref={ref}
        className={`${showOnCompact ? 'flex' : 'hidden lg:flex'} min-w-0 min-h-0 flex-col gap-2.5 pb-4 xl:col-start-2 xl:row-start-2 xl:h-full xl:pb-0 xl:overflow-y-auto xl:overscroll-contain xl:pr-1`}
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
