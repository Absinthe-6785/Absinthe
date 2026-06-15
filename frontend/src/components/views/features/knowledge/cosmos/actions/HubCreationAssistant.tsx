import { useTranslation } from '@/lib/i18n';
import type { NoteChromeColors } from '../../../../noteEditorTheme';
import type { HubAssistantState } from './actionEngine';
import { ActionButton, ActionCard } from './actionUi';

export interface HubCreationAssistantProps {
  colors: NoteChromeColors;
  hub: HubAssistantState | null;
  onCreateHub: (areaLabel: string) => void;
}

export function HubCreationAssistant({ colors: c, hub, onCreateHub }: HubCreationAssistantProps) {
  const { t } = useTranslation();
  if (!hub) return null;

  return (
    <ActionCard
      c={c}
      title={t('k37NoHubDetected')}
      description={`${hub.suggestedTitle}\n# Overview\n## Timeline\n## Key Concepts\n## Important Notes`}
      actions={(
        <ActionButton c={c} onClick={() => onCreateHub(hub.areaLabel)}>
          {t('k37ActionCreateHub')}
        </ActionButton>
      )}
    />
  );
}
