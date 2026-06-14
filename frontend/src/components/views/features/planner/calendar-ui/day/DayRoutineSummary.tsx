import type { Routine, Theme } from '../../../../../types';
import { useTranslation } from '../../../../../../lib/i18n';
import { formatDayRoutineSummary } from './dayCalendarPresentation';
import type { DayRoutineActions } from './dayRoutineActions';
import { dayRoutineActionsEnabled } from './dayRoutineActions';

export interface DayRoutineSummaryProps {
  routines: readonly Routine[];
  isRoutineException: boolean;
  theme: Theme;
  routineActions?: DayRoutineActions;
}

export function DayRoutineSummary({
  routines,
  isRoutineException,
  theme,
  routineActions,
}: DayRoutineSummaryProps) {
  const { t } = useTranslation();
  const summaryLabel = formatDayRoutineSummary(routines);
  const interactive = dayRoutineActionsEnabled(routineActions);

  return (
    <section className="flex flex-col gap-1.5" data-planner-day-routines>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[10px] lg:text-xs font-bold uppercase tracking-wide text-muted">
          {t('scheduleSectionRoutines')}
        </h4>
        {summaryLabel ? (
          <span className={`text-[10px] lg:text-xs font-semibold ${theme.textMuted}`}>
            {summaryLabel}
          </span>
        ) : null}
      </div>

      {isRoutineException ? (
        <p className={`text-[10px] lg:text-xs ${theme.textMuted}`} data-planner-day-routine-exception>
          {t('scheduleRoutineException')}
        </p>
      ) : null}

      {routines.length === 0 ? (
        <p className="text-[10px] lg:text-xs text-muted px-1">{t('scheduleSectionEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {routines.map(routine => (
            <li key={routine.id}>
              {interactive && routineActions?.onToggle ? (
                <button
                  type="button"
                  onClick={() => routineActions.onToggle!(routine.id, routine.done)}
                  className={`w-full text-left px-2 py-1 text-xs lg:text-sm rounded-md border ${theme.border}
                    flex items-center gap-2 min-h-[32px]
                    ${routine.done ? 'opacity-60 line-through' : 'font-medium'}
                    hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary`}
                  data-planner-day-routine={routine.id}
                  data-planner-day-routine-done={routine.done ? 'true' : 'false'}
                >
                  <input
                    type="checkbox"
                    checked={routine.done}
                    readOnly
                    tabIndex={-1}
                    className="w-4 h-4 accent-primary pointer-events-none shrink-0"
                  />
                  <span className="truncate">{routine.text}</span>
                </button>
              ) : (
                <div
                  className={`px-2 py-1 text-xs lg:text-sm rounded-md border ${theme.border}
                    ${routine.done ? 'opacity-60 line-through' : 'font-medium'}`}
                  data-planner-day-routine={routine.id}
                  data-planner-day-routine-done={routine.done ? 'true' : 'false'}
                >
                  {routine.text}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
