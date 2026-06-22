import type { Theme } from '../../../../types';
import { useTranslation } from '../../../../lib/i18n';

export type HealthMobileTab = 'blocks' | 'routine' | 'workout';

export interface HealthNavigationProps {
  active: HealthMobileTab;
  onChange: (tab: HealthMobileTab) => void;
  theme: Theme;
}

/** K-125F — mobile health sub-navigation (blocks / routine / workout). */
export function HealthNavigation({ active, onChange, theme }: HealthNavigationProps) {
  const { t } = useTranslation();

  return (
    <div className="flex lg:hidden gap-2" data-k125f-health-navigation>
      {(['blocks', 'routine', 'workout'] as const).map(tab => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={`flex-1 min-h-[44px] py-2.5 rounded-2xl text-xs font-bold transition-colors
            ${active === tab
              ? 'bg-primary text-primary-foreground'
              : `${theme.input} ${theme.textMuted}`}`}
          data-k125f-health-nav={tab}
        >
          {tab === 'blocks' ? t('tabBlocks') : tab === 'routine' ? t('tabRoutine') : t('tabWorkout')}
        </button>
      ))}
    </div>
  );
}
