import { Clock } from 'lucide-react';
import { useTranslation } from '../../../../../../lib/i18n';
import type { DayActivityItem } from './dayCalendarPresentation';

export interface DayActivitySectionProps {
  items: readonly DayActivityItem[];
}

export function DayActivitySection({ items }: DayActivitySectionProps) {
  const { t } = useTranslation();
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-1.5" data-planner-day-activity>
      <h4 className="text-[10px] lg:text-xs font-bold uppercase tracking-wide text-muted flex items-center gap-1">
        <Clock size={12} strokeWidth={2.25} />
        {t('scheduleSectionActivity')}
      </h4>
      <ul className="flex flex-col gap-0.5 max-h-[120px] overflow-y-auto">
        {items.map(item => (
          <li
            key={item.id}
            className="flex items-center gap-2 px-2 py-0.5 text-[10px] lg:text-xs text-muted"
            data-planner-day-activity-item={item.id}
          >
            <span className="shrink-0 tabular-nums font-medium w-12">{item.timeLabel}</span>
            <span className={`truncate ${item.kind === 'event' ? 'text-primary font-medium' : ''}`}>
              {item.title}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
