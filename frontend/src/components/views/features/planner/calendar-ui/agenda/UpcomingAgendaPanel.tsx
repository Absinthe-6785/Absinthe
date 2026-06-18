import { useMemo } from 'react';
import { Plus, CalendarDays } from 'lucide-react';
import type { Theme } from '@/types';
import { useTranslation } from '@/lib/i18n';
import type { PlannerCalendarPresentation, PlannerCalendarProjection } from '../../calendar';
import { useCountdownReviewed } from '../../hooks/useCountdownReviewed';
import { buildUpcomingAgendaGroups } from './buildUpcomingAgendaGroups';
import { UpcomingAgendaGroupList } from './UpcomingAgendaGroupList';
import type { DayScheduleActions, AgendaEventActions } from '../day/dayScheduleActions';
import { ProductEmptyState } from '@/components/common/ProductEmptyState';

export interface UpcomingAgendaPanelProps {
  projection: PlannerCalendarProjection;
  presentation: PlannerCalendarPresentation;
  theme: Theme;
  todayKey: string;
  scheduleActions?: DayScheduleActions;
  eventActions?: AgendaEventActions;
  onDateSelect?: (dateKey: string) => void;
}

/** K-80 right panel — chronological upcoming timeline (not selected-day only). */
export function UpcomingAgendaPanel({
  projection,
  presentation,
  theme,
  todayKey,
  scheduleActions,
  eventActions,
  onDateSelect,
}: UpcomingAgendaPanelProps) {
  const { t } = useTranslation();
  const { isReviewed } = useCountdownReviewed();

  const groups = useMemo(
    () => buildUpcomingAgendaGroups(projection, presentation, todayKey, isReviewed),
    [projection, presentation, todayKey, isReviewed],
  );

  const canAdd = Boolean(scheduleActions?.onAdd);

  return (
    <div
      className={`rounded-[16px] lg:rounded-[20px] p-2 lg:p-2.5 flex flex-col gap-1.5 min-h-0 h-full ${theme.card}`}
      data-planner-upcoming-agenda
    >
      <div className="flex items-center justify-between gap-2 shrink-0">
        <h3 className="font-heading text-xs lg:text-sm font-bold">{t('k80UpcomingAgenda')}</h3>
        {canAdd ? (
          <button
            type="button"
            onClick={scheduleActions!.onAdd}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-primary text-primary-foreground hover:opacity-90"
            data-planner-day-schedule-add="true"
          >
            <Plus size={12} strokeWidth={2.5} />
            {t('k80AddEvent')}
          </button>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto max-h-[420px] lg:max-h-none lg:min-h-[280px]" data-k102-upcoming-scroll>
        {groups.length === 0 ? (
          <ProductEmptyState
            variant="tailwind"
            theme={theme}
            icon={CalendarDays}
            title={t('k103PlannerAgendaEmptyTitle')}
            description={t('k103PlannerAgendaEmptyDesc')}
            dataHook="k103-planner-agenda-empty"
            primaryAction={canAdd ? { label: t('k80AddEvent'), onClick: scheduleActions!.onAdd! } : undefined}
          />
        ) : (
          <UpcomingAgendaGroupList
            groups={groups}
            presentation={presentation}
            scheduleActions={scheduleActions}
            eventActions={eventActions}
            onDateSelect={onDateSelect}
          />
        )}
      </div>
    </div>
  );
}
