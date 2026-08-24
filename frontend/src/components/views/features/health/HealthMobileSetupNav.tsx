import { useTranslation } from '../../../../lib/i18n';
import type { Theme } from '../../../../types';

export type HealthMobileSurface = 'workout' | 'setup';
export type HealthSetupSection = 'routine' | 'blocks';

export interface HealthMobileSetupNavProps {
  activeSurface: HealthMobileSurface;
  onSurfaceChange: (surface: HealthMobileSurface) => void;
  activeSection: HealthSetupSection;
  onSectionChange: (section: HealthSetupSection) => void;
  theme: Theme;
}

/** Mobile-only execution/configuration navigation for HEALTH_09B. */
export function HealthMobileSetupNav({
  activeSurface,
  onSurfaceChange,
  activeSection,
  onSectionChange,
  theme,
}: HealthMobileSetupNavProps) {
  const { t } = useTranslation();
  const tabClass = (selected: boolean) => `flex-1 min-h-[44px] rounded-xl px-3 py-2.5 text-xs font-bold transition-colors ${
    selected ? 'bg-primary text-primary-foreground' : `${theme.input} ${theme.textMuted}`
  }`;
  const sectionClass = (selected: boolean) => `min-h-[40px] flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
    selected ? 'bg-primary text-primary-foreground' : `${theme.input} ${theme.textMuted}`
  }`;

  return (
    <div className="flex flex-col gap-2 lg:hidden" data-health-09b-mobile-navigation>
      <div className="flex gap-2" role="tablist" aria-label={t('healthMobileTaskNavigation')}>
        <button
          type="button"
          role="tab"
          aria-selected={activeSurface === 'workout'}
          className={tabClass(activeSurface === 'workout')}
          onClick={() => onSurfaceChange('workout')}
          data-health-mobile-tab="workout"
        >
          {t('tabWorkout')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSurface === 'setup'}
          className={tabClass(activeSurface === 'setup')}
          onClick={() => onSurfaceChange('setup')}
          data-health-mobile-tab="setup"
        >
          {t('tabSetup')}
        </button>
      </div>
      {activeSurface === 'setup' && (
        <div className={`flex gap-1 rounded-xl border p-1 ${theme.border}`} role="tablist" aria-label={t('healthSetupNavigation')} data-health-09b-setup-navigation>
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'routine'}
            className={sectionClass(activeSection === 'routine')}
            onClick={() => onSectionChange('routine')}
            data-health-setup-section="routine"
          >
            {t('tabRoutine')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'blocks'}
            className={sectionClass(activeSection === 'blocks')}
            onClick={() => onSectionChange('blocks')}
            data-health-setup-section="blocks"
          >
            {t('tabBlocks')}
          </button>
        </div>
      )}
    </div>
  );
}
