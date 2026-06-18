import { CalendarDays } from 'lucide-react';
import type { Theme } from '@/types';
import { useTranslation } from '@/lib/i18n';

export interface PlannerTimetableSummaryProps {
  theme: Theme;
  activityCount: number;
  onOpenTimetable?: () => void;
}

/** K-104 — compact weekly timetable summary for planner right column. */
export function PlannerTimetableSummary({
  theme,
  activityCount,
  onOpenTimetable,
}: PlannerTimetableSummaryProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`rounded-[12px] lg:rounded-[16px] p-2.5 flex items-center gap-2 shrink-0 ${theme.card}`}
      data-k104-timetable-summary
    >
      <CalendarDays size={16} className="text-primary shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{t('k104TimetableSummary')}</p>
        <p className="text-xs font-semibold truncate">
          {activityCount > 0
            ? t('k104TimetableCount').replace('{count}', String(activityCount))
            : t('k104TimetableEmpty')}
        </p>
      </div>
      {onOpenTimetable ? (
        <button
          type="button"
          onClick={onOpenTimetable}
          className="text-[10px] font-bold px-2 py-1 rounded-lg bg-primary/10 text-primary shrink-0"
        >
          {t('k104TimetableOpen')}
        </button>
      ) : null}
    </div>
  );
}
