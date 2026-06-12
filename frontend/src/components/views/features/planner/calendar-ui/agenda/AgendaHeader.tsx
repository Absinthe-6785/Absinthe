import type { Theme } from '../../../../../types';

export interface AgendaHeaderProps {
  horizonLabel: string;
  theme: Theme;
}

export function AgendaHeader({ horizonLabel, theme }: AgendaHeaderProps) {
  return (
    <div className="flex flex-col gap-1 mb-4">
      <h3 className="font-heading text-base lg:text-lg font-bold">Agenda View</h3>
      {horizonLabel ? (
        <p
          className={`text-sm font-semibold ${theme.textMuted}`}
          data-planner-calendar-period-label
        >
          {horizonLabel}
        </p>
      ) : null}
    </div>
  );
}
