import { Activity, Apple, BedDouble, Dumbbell, LayoutDashboard } from 'lucide-react';
import { useTranslation } from '../../../../lib/i18n';
import type { Theme } from '../../../../types';

export type HealthWorkspaceSection = 'dashboard' | 'nutrition' | 'workout' | 'habits' | 'recovery';

export const HEALTH_WORKSPACE_SECTIONS: readonly { id: HealthWorkspaceSection; icon: typeof Dumbbell }[] = [
  { id: 'dashboard', icon: LayoutDashboard },
  { id: 'nutrition', icon: Apple },
  { id: 'workout', icon: Dumbbell },
  { id: 'habits', icon: Activity },
  { id: 'recovery', icon: BedDouble },
];

export interface HealthWorkspaceNavProps {
  active: HealthWorkspaceSection;
  onChange: (section: HealthWorkspaceSection) => void;
  theme: Theme;
  compact?: boolean;
}

const SECTIONS = HEALTH_WORKSPACE_SECTIONS;

/** Top-level Health workspace navigation — extensible shell for K-48+. */
export function HealthWorkspaceNav({ active, onChange, theme, compact }: HealthWorkspaceNavProps) {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t('healthWorkspaceNav')}
      className={`flex gap-1.5 shrink-0 ${compact ? 'overflow-x-auto pb-1' : ''}`}
      data-health-workspace-nav
    >
      {SECTIONS.map(({ id, icon: Icon }) => {
        const selected = active === id;
        const labelKey = `healthNav${id.charAt(0).toUpperCase()}${id.slice(1)}` as 'healthNavDashboard';
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={selected ? 'page' : undefined}
            data-health-workspace-section={id}
            className={`flex items-center gap-1.5 rounded-xl font-bold transition-colors whitespace-nowrap
              ${compact ? 'flex-1 min-w-0 min-h-[44px] px-2 py-2.5 text-[10px] justify-center' : 'px-3 py-2 text-xs'}
              ${selected
                ? 'bg-primary text-primary-foreground shadow-sm'
                : `${theme.input} ${theme.textMuted} hover:text-foreground`}`}
          >
            <Icon size={compact ? 14 : 15} strokeWidth={2.25} className="shrink-0" />
            <span className="truncate">{t(labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}
