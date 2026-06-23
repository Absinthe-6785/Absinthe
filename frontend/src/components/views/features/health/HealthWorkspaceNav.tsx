import { Apple, Dumbbell, TrendingUp } from 'lucide-react';
import { useTranslation } from '../../../../lib/i18n';
import type { Theme } from '../../../../types';
import { WorkspaceSectionNav } from '../../../common/WorkspaceSectionNav';

export type HealthWorkspaceSection = 'workout' | 'nutrition' | 'analysis';

export const HEALTH_WORKSPACE_SECTIONS: readonly { id: HealthWorkspaceSection; icon: typeof Dumbbell }[] = [
  { id: 'workout', icon: Dumbbell },
  { id: 'nutrition', icon: Apple },
  { id: 'analysis', icon: TrendingUp },
];

export interface HealthWorkspaceNavProps {
  active: HealthWorkspaceSection;
  onChange: (section: HealthWorkspaceSection) => void;
  theme: Theme;
  compact?: boolean;
}

const SECTIONS = HEALTH_WORKSPACE_SECTIONS;

/** Top-level Health workspace navigation — Workout + Nutrition (K-68). */
export function HealthWorkspaceNav({ active, onChange, theme, compact }: HealthWorkspaceNavProps) {
  const { t } = useTranslation();

  const labelFor = (id: HealthWorkspaceSection): string => {
    switch (id) {
      case 'workout': return t('healthNavOverview');
      case 'nutrition': return t('healthNavNutrition');
      case 'analysis': return t('healthNavAnalysis');
    }
  };

  return (
    <WorkspaceSectionNav
      mode="toggle"
      variant="tailwind"
      theme={theme}
      compact={compact}
      active={active}
      onSelect={id => onChange(id as HealthWorkspaceSection)}
      ariaLabel={t('healthWorkspaceNav')}
      dataHook="health-workspace"
      legacyHook="data-health-workspace-nav"
      items={SECTIONS.map(({ id, icon }) => {
        return { id, icon, label: labelFor(id) };
      })}
    />
  );
}
