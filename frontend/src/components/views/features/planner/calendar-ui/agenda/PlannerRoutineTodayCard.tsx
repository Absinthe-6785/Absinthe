import { memo } from 'react';
import { Clock } from 'lucide-react';
import type { Theme } from '@/types';
import type { PlannerWeeklySlotRow } from '../../calendar/calendarModels';
import { useTranslation } from '@/lib/i18n';

export interface PlannerRoutineTodayCardProps {
  theme: Theme;
  slots: readonly PlannerWeeklySlotRow[];
  onOpenTimetable?: () => void;
}

/** K-108 — today's weekly routine summary inside Today workspace. */
export const PlannerRoutineTodayCard = memo(function PlannerRoutineTodayCard({
  theme,
  slots,
  onOpenTimetable,
}: PlannerRoutineTodayCardProps) {
  const { t } = useTranslation();

  if (slots.length === 0) return null;

  return (
    <section className="mb-3" data-k108-planner-routine-today>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-1.5">
        {t('k108RoutineToday')}
      </p>
      <button
        type="button"
        onClick={onOpenTimetable}
        className={`w-full rounded-xl border ${theme.border} overflow-hidden text-left hover:bg-muted/30 transition-colors`}
      >
        <ul className="divide-y divide-border/50">
          {slots.slice(0, 6).map(slot => (
            <li
              key={slot.id}
              className="flex items-center gap-2 px-3 py-2 min-h-[40px]"
              data-k108-routine-slot={slot.id}
            >
              <Clock size={12} className="text-primary shrink-0 opacity-70" />
              <span className="text-[11px] font-bold tabular-nums text-muted shrink-0 w-[42px]">
                {slot.startTime}
              </span>
              <span className="text-xs font-semibold truncate">{slot.title}</span>
            </li>
          ))}
        </ul>
        {slots.length > 6 ? (
          <p className="text-[10px] font-bold text-center py-1.5 text-muted">
            +{slots.length - 6}
          </p>
        ) : null}
      </button>
    </section>
  );
});
