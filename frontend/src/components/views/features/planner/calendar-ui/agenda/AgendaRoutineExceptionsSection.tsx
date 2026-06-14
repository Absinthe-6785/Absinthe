import { AlertCircle } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export interface AgendaRoutineExceptionsSectionProps {
  exceptionDates: readonly string[];
}

export function AgendaRoutineExceptionsSection({
  exceptionDates,
}: AgendaRoutineExceptionsSectionProps) {
  const { t } = useTranslation();
  if (exceptionDates.length === 0) return null;

  return (
    <section className="flex flex-col gap-2" data-planner-agenda-routine-exceptions>
      <h4 className="text-xs lg:text-sm font-bold uppercase tracking-wide text-muted flex items-center gap-1.5">
        <AlertCircle size={14} strokeWidth={2.25} className="text-blue-500" />
        {t('scheduleAgendaRoutineExceptions')}
      </h4>
      <ul className="flex flex-col gap-1.5">
        {exceptionDates.map(dateKey => (
          <li
            key={dateKey}
            className="px-2 py-1.5 rounded-md border border-blue-500/30 bg-blue-500/10 text-xs lg:text-sm font-medium"
            data-planner-agenda-routine-exception={dateKey}
          >
            {dateKey} — {t('scheduleRoutineException')}
          </li>
        ))}
      </ul>
    </section>
  );
}
