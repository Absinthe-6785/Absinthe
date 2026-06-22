import { useMemo } from 'react';
import { Plus, CalendarDays } from 'lucide-react';
import type { Theme } from '@/types';
import { useTranslation } from '@/lib/i18n';
import { useElementVisible } from '@/hooks/useElementVisible';
import type { UpcomingTierSection } from './buildUpcomingTierGroups';
import { UpcomingTierGroupList } from './UpcomingTierGroupList';
import type { DayScheduleActions, AgendaEventActions } from '../day/dayScheduleActions';
import { ProductEmptyState } from '@/components/common/ProductEmptyState';

export interface UpcomingAgendaPanelProps {
  tierSections: readonly UpcomingTierSection[];
  theme: Theme;
  scheduleActions?: DayScheduleActions;
  eventActions?: AgendaEventActions;
  onDateSelect?: (dateKey: string) => void;
  embedded?: boolean;
  /** K-117 — hide entire panel when there are no upcoming items. */
  collapseWhenEmpty?: boolean;
}

/** K-108 — tiered upcoming (Today / Tomorrow / Later) inside Today workspace. */
export function UpcomingAgendaPanel({
  tierSections,
  theme,
  scheduleActions,
  eventActions,
  onDateSelect,
  embedded = false,
  collapseWhenEmpty = false,
}: UpcomingAgendaPanelProps) {
  const { t } = useTranslation();
  const { ref, visible } = useElementVisible('80px');
  const canAdd = Boolean(scheduleActions?.onAdd);

  const itemCount = useMemo(
    () => tierSections.reduce((n, s) => n + s.days.reduce((m, d) => m + d.items.length, 0), 0),
    [tierSections],
  );

  if (collapseWhenEmpty && itemCount === 0) {
    return null;
  }

  const shellClass = embedded
    ? 'flex flex-col gap-0.5 min-h-0'
    : `rounded-[16px] lg:rounded-[20px] p-2 lg:p-2.5 flex flex-col gap-1.5 min-h-0 h-full ${theme.card}`;

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={shellClass}
      data-planner-upcoming-agenda
      data-k108-planner-upcoming
    >
      <div className="flex items-center justify-between gap-2 shrink-0">
        <h3 className="font-heading text-xs lg:text-sm font-bold">{t('k80UpcomingAgenda')}</h3>
        {canAdd && !embedded ? (
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

      <div className="flex-1 min-h-0 overflow-y-auto max-h-[200px]" data-k102-upcoming-scroll>
        {!visible ? (
          <div className="h-16 rounded-lg bg-muted/20 animate-pulse" aria-hidden />
        ) : itemCount === 0 ? (
          embedded ? (
            <p className={`text-xs py-2 ${theme.textMuted}`} data-k125b-upcoming-empty-compact>
              {t('k103PlannerAgendaEmptyDesc')}
            </p>
          ) : (
          <ProductEmptyState
            variant="tailwind"
            theme={theme}
            icon={CalendarDays}
            title={t('k103PlannerAgendaEmptyTitle')}
            description={t('k103PlannerAgendaEmptyDesc')}
            dataHook="k103-planner-agenda-empty"
            primaryAction={canAdd ? { label: t('k80AddEvent'), onClick: scheduleActions!.onAdd! } : undefined}
          />
          )
        ) : (
          <UpcomingTierGroupList
            sections={tierSections}
            scheduleActions={scheduleActions}
            eventActions={eventActions}
            onDateSelect={onDateSelect}
          />
        )}
      </div>
    </div>
  );
}
