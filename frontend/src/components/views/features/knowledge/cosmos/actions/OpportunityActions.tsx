import { useTranslation } from '../../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../../noteEditorTheme';
import type { CosmosActionItem } from './actionEngine';
import { ActionButton, ActionCard } from './actionUi';

export interface OpportunityActionsProps {
  colors: NoteChromeColors;
  actions: readonly CosmosActionItem[];
  onConnect: (targetNoteTitle: string, targetNoteId?: string) => void;
  onViewCandidates: () => void;
  onAssignArea: (areaLabel: string, areaNoteId?: string) => void;
}

const OPPORTUNITY_KINDS = new Set(['connect', 'view-candidates', 'assign-area']);

export function OpportunityActions({
  colors: c,
  actions,
  onConnect,
  onViewCandidates,
  onAssignArea,
}: OpportunityActionsProps) {
  const { t } = useTranslation();
  const rows = actions.filter(a => OPPORTUNITY_KINDS.has(a.kind));

  if (rows.length === 0) return null;

  return (
    <div style={{ paddingBottom: 4 }}>
      {rows.map(action => {
        let button = null;
        if (action.kind === 'connect' && action.targetNoteTitle) {
          button = (
            <ActionButton c={c} onClick={() => onConnect(action.targetNoteTitle!, action.targetNoteId)}>
              {t('k37ActionConnect')}
            </ActionButton>
          );
        } else if (action.kind === 'view-candidates') {
          button = (
            <ActionButton c={c} onClick={onViewCandidates}>
              {t('k37ActionViewCandidates')}
            </ActionButton>
          );
        } else if (action.kind === 'assign-area' && action.areaLabel) {
          button = (
            <ActionButton c={c} onClick={() => onAssignArea(action.areaLabel!, action.areaNoteId)}>
              {t('k37ActionAssign')}
            </ActionButton>
          );
        }

        return (
          <ActionCard
            key={action.id}
            c={c}
            title={action.title}
            description={action.description}
            actions={button}
          />
        );
      })}
    </div>
  );
}
