import type { Routine, Theme } from '../../../../../types';
import { formatDayRoutineSummary } from './dayCalendarPresentation';

export interface DayRoutineSummaryProps {
  routines: readonly Routine[];
  isRoutineException: boolean;
  theme: Theme;
}

export function DayRoutineSummary({
  routines,
  isRoutineException,
  theme,
}: DayRoutineSummaryProps) {
  const summaryLabel = formatDayRoutineSummary(routines);
  if (!summaryLabel) return null;

  return (
    <section className="flex flex-col gap-2" data-planner-day-routines>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs lg:text-sm font-bold uppercase tracking-wide text-muted">
          Routines
        </h4>
        <span className={`text-[10px] lg:text-xs font-semibold ${theme.textMuted}`}>
          {summaryLabel}
        </span>
      </div>

      {isRoutineException ? (
        <p className={`text-[10px] lg:text-xs ${theme.textMuted}`} data-planner-day-routine-exception>
          Routine exception day
        </p>
      ) : null}

      <ul className="flex flex-col gap-1">
        {routines.map(routine => (
          <li
            key={routine.id}
            className={`px-2 py-1.5 text-xs lg:text-sm rounded-md border ${theme.border}
              ${routine.done ? 'opacity-60 line-through' : 'font-medium'}`}
            data-planner-day-routine={routine.id}
            data-planner-day-routine-done={routine.done ? 'true' : 'false'}
          >
            {routine.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
