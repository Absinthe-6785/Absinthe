import type { PlannerWeeklySlotRow } from '../../calendar';
import { useTranslation } from '../../../../../../lib/i18n';
import { formatDayTimeRange } from './dayCalendarPresentation';

export interface DayTemplateHintsProps {
  templateSlots: readonly PlannerWeeklySlotRow[];
}

export function DayTemplateHints({ templateSlots }: DayTemplateHintsProps) {
  const { t } = useTranslation();

  return (
    <section className="flex flex-col gap-1.5" data-planner-day-template-hints>
      <h4 className="text-[10px] lg:text-xs font-bold uppercase tracking-wide text-muted">
        {t('scheduleSectionTemplate')}
      </h4>
      {templateSlots.length === 0 ? (
        <p className="text-[10px] lg:text-xs text-muted px-1">{t('scheduleSectionEmpty')}</p>
      ) : (
        <div className="flex flex-col gap-1">
          {templateSlots.map(slot => (
            <div
              key={slot.id}
              className="px-2 py-1 text-xs lg:text-sm font-medium truncate rounded-md border border-dashed border-border/80 text-muted"
              data-planner-day-template={slot.id}
              title={slot.title}
            >
              {formatDayTimeRange(slot.startTime, slot.endTime)} {slot.title}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
