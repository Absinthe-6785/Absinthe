import type { Theme } from '../../../../../../types';
import { useTranslation } from '../../../../../../lib/i18n';

export interface DayHeaderProps {
  dayHeading: string;
  isToday: boolean;
  milestoneCount: number;
  theme: Theme;
}

export function DayHeader({
  dayHeading,
  isToday,
  milestoneCount,
  theme,
}: DayHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1 mb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <h3 className="font-heading text-base lg:text-lg font-bold">{t('dayView')}</h3>
          {dayHeading ? (
            <p
              className={`text-sm font-semibold ${theme.textMuted}`}
              data-planner-calendar-period-label
            >
              {dayHeading}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isToday ? (
            <span
              className="px-2 py-0.5 rounded-full text-[10px] lg:text-xs font-bold bg-primary/15 text-primary"
              data-planner-day-today-badge
            >
              {t('plannerToday')}
            </span>
          ) : null}
          {milestoneCount > 0 ? (
            <span
              className="w-2 h-2 rounded-full bg-amber-500"
              data-planner-day-milestone-dot
              aria-label={t('plannerMilestone')}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
