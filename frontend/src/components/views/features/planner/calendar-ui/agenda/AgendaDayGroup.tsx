import type { ReactNode } from 'react';
import type { Theme } from '@/types';
import type { PlannerAgendaItem } from '../../calendar';

export interface AgendaDayGroupProps {
  dateKey: string;
  dateHeader: string;
  items: readonly PlannerAgendaItem[];
  theme: Theme;
  sectionKind: 'events' | 'schedules' | 'todos';
  renderItem: (item: PlannerAgendaItem) => ReactNode;
}

export function AgendaDayGroup({
  dateKey,
  dateHeader,
  items,
  theme,
  sectionKind,
  renderItem,
}: AgendaDayGroupProps) {
  return (
    <div
      className="flex flex-col gap-1.5"
      data-planner-agenda-day-group={dateKey}
      data-planner-agenda-day-group-section={sectionKind}
    >
      <h5
        className={`text-[11px] lg:text-xs font-bold ${theme.textMuted}`}
        data-planner-agenda-day-header
      >
        {dateHeader}
      </h5>
      <ul className="flex flex-col gap-1">
        {items.map(item => (
          <li key={item.id}>{renderItem(item)}</li>
        ))}
      </ul>
    </div>
  );
}
