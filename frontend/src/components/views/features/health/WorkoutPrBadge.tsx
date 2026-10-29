import { memo, useId } from 'react';
import type { WorkoutPrBadgeData } from './computeWorkoutPrBadge';

export interface WorkoutPrBadgeProps {
  badge: WorkoutPrBadgeData | null;
  darkMode: boolean;
  legacyScopeLabel: string;
  prDescription: string;
  diffDescription: string;
}

/** Precomputed PR badge — avoids per-render filter/reduce in HealthView. */
export const WorkoutPrBadge = memo(function WorkoutPrBadge({ badge, darkMode, legacyScopeLabel, prDescription, diffDescription }: WorkoutPrBadgeProps) {
  const descriptionId = useId();
  if (!badge) return null;
  const { isPR, diff, prevMax, showDiff, unit } = badge;
  return (
    <div className="flex items-center gap-1 shrink-0" data-k107-workout-pr-badge>
      {(isPR || showDiff) && (
        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${darkMode ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-600'}`} title={isPR ? prDescription : diffDescription}>
          {legacyScopeLabel}
        </span>
      )}
      {isPR && (
        <span aria-describedby={`${descriptionId}-pr`} className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-amber-900 tracking-wider">
          PR 🏆
        </span>
      )}
      {showDiff && (
        <span aria-describedby={`${descriptionId}-diff`} className={`text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
          diff > 0
            ? 'bg-green-500/15 text-green-500'
            : diff < 0
              ? 'bg-red-500/15 text-red-400'
              : darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
        }`}>
          {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : `=${prevMax}`}{unit}
        </span>
      )}
      {isPR && <span id={`${descriptionId}-pr`} className="sr-only">{prDescription}</span>}
      {showDiff && <span id={`${descriptionId}-diff`} className="sr-only">{diffDescription}</span>}
    </div>
  );
});
