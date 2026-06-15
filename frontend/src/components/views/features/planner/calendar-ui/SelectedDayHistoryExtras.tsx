import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { API_URL } from '@/lib/config';
import { useTranslation } from '@/lib/i18n';
import type { ProteinIntakeLog, Theme } from '@/types';
import { sumProteinIntake } from '../../health/nutrition/proteinMetrics';

interface WorkoutRow {
  id: string;
}

export interface SelectedDayHistoryExtrasProps {
  dateKey: string;
  theme: Theme;
}

/** Workout + nutrition summary for month day-history panel. */
export function SelectedDayHistoryExtras({ dateKey, theme }: SelectedDayHistoryExtrasProps) {
  const { t } = useTranslation();
  const { data: workouts = [] } = useSWR<WorkoutRow[]>(
    `${API_URL}/api/workouts?date=${dateKey}`,
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: intake = [] } = useSWR<ProteinIntakeLog[]>(
    `${API_URL}/api/protein_intake?date=${dateKey}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const workoutCount = workouts.length;
  const proteinTotal = sumProteinIntake(intake);
  const hasWorkout = workoutCount > 0;
  const hasNutrition = proteinTotal > 0;

  if (!hasWorkout && !hasNutrition) return null;

  return (
    <section className="flex flex-col gap-1.5" data-planner-day-history-extras>
      <h4 className="text-[10px] lg:text-xs font-bold uppercase tracking-wide text-muted">
        {t('k73DayActivity')}
      </h4>
      <ul className={`flex flex-col gap-1 text-xs lg:text-sm font-semibold ${theme.textMuted}`}>
        {hasWorkout ? (
          <li data-planner-day-history-workout="true">
            {t('k73WorkoutLogged')}: {workoutCount} {workoutCount === 1 ? t('k73Exercise') : t('k73Exercises')}
          </li>
        ) : null}
        {hasNutrition ? (
          <li data-planner-day-history-nutrition="true">
            {t('k73NutritionLogged')}: {proteinTotal}g
          </li>
        ) : null}
      </ul>
    </section>
  );
}
