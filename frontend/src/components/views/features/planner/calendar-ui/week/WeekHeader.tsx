import type { Theme } from '../../../../../../types';
import { useTranslation } from '../../../../../../lib/i18n';

export interface WeekHeaderProps {
  periodLabel: string;
  theme: Theme;
}

export function WeekHeader({ periodLabel, theme }: WeekHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1 mb-4">
      <h3 className="font-heading text-base lg:text-lg font-bold">{t('weekView')}</h3>
      {periodLabel ? (
        <p
          className={`text-sm font-semibold ${theme.textMuted}`}
          data-planner-calendar-period-label
        >
          {periodLabel}
        </p>
      ) : null}
    </div>
  );
}
