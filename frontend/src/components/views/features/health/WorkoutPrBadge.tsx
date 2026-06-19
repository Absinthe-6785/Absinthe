import { memo } from 'react';
import type { WorkoutPrBadgeData } from './computeWorkoutPrBadge';

export interface WorkoutPrBadgeProps {
  badge: WorkoutPrBadgeData | null;
  darkMode: boolean;
}

/** Precomputed PR badge — avoids per-render filter/reduce in HealthView. */
export const WorkoutPrBadge = memo(function WorkoutPrBadge({ badge, darkMode }: WorkoutPrBadgeProps) {
  if (!badge) return null;
  const { isPR, diff, prevMax, showDiff, unit } = badge;
  return (
    <div className="flex items-center gap-1.5 shrink-0" data-k107-workout-pr-badge>
      {isPR && (
        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-amber-900 tracking-wider">
          PR 🏆
        </span>
      )}
      {showDiff && (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
          diff > 0
            ? 'bg-green-500/15 text-green-500'
            : diff < 0
              ? 'bg-red-500/15 text-red-400'
              : darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
        }`}>
          {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : `=${prevMax}`}{unit}
        </span>
      )}
    </div>
  );
});
