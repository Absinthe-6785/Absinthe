import { History, Plus } from 'lucide-react';
import type { Theme } from '../../../../types';

export interface HealthMobileWorkoutActionsProps {
  isMobile: boolean;
  isDesktopPrevious: boolean;
  isWorkoutLocked: boolean;
  previousLabel: string;
  addExerciseLabel: string;
  theme: Pick<Theme, 'border' | 'textMuted'>;
  onPrevious: () => void;
  onAddExercise: () => void;
}

export function HealthMobileWorkoutActions({
  isMobile,
  isDesktopPrevious,
  isWorkoutLocked,
  previousLabel,
  addExerciseLabel,
  theme,
  onPrevious,
  onAddExercise,
}: HealthMobileWorkoutActionsProps) {
  if (!isMobile || isDesktopPrevious) return null;

  return (
    <>
      <button
        type="button"
        onClick={onPrevious}
        className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold ${theme.border} ${theme.textMuted} hover:text-foreground abs-focus-ring`}
        data-health-previous-trigger
      >
        <History size={15} aria-hidden />
        {previousLabel}
      </button>
      {!isWorkoutLocked && (
        <button
          type="button"
          onClick={onAddExercise}
          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold ${theme.border} ${theme.textMuted} hover:text-foreground abs-focus-ring`}
          data-health-quick-add-exercise
        >
          <Plus size={15} aria-hidden />
          {addExerciseLabel}
        </button>
      )}
    </>
  );
}
