import type { Theme } from '../../../../../types';
import { useTranslation } from '../../../../../../lib/i18n';

export interface AgendaHeaderProps {
  horizonLabel: string;
  theme: Theme;
}

export function AgendaHeader({ horizonLabel, theme }: AgendaHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1 mb-4">
      <h3 className="font-heading text-base lg:text-lg font-bold">{t('agendaView')}</h3>
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
