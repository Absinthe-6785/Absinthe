import { useMemo } from 'react';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import type { NoteChromeColors } from '../../../../noteEditorTheme';
import type { NoteBase } from '../../../../noteUtils';
import type { NoteIntelligenceSnapshot } from '../intelligence';
import { buildAreaHealthSummaries } from '../intelligence';
import type { KnowledgeIndexService } from '../../KnowledgeIndexService';
import { buildNoteGalaxyMap } from '../../graph/knowledgeUniverse/galaxyClustering';
import { KnowledgePanelSection, KnowledgePanelEmpty } from '../../components/KnowledgePanelSection';
import { buildCosmosActionPlan, type CosmosActionItem } from './actionEngine';
import { OpportunityActions } from './OpportunityActions';
import { AreaGuidance } from './AreaGuidance';
import { HubCreationAssistant } from './HubCreationAssistant';
import { ConnectionRecommendationList } from './ConnectionRecommendationCard';
import { ActionButton, ActionCard } from './actionUi';
import { CosmosSuiteHeader } from '../cosmosPanelUi';

export interface CosmosActionsPanelProps {
  colors: NoteChromeColors;
  note: NoteBase;
  snapshot: NoteIntelligenceSnapshot;
  notes: readonly NoteBase[];
  service: KnowledgeIndexService;
  onConnect: (targetTitle: string) => void;
  onViewCandidates: () => void;
  onAssignArea: (areaLabel: string, areaNoteId?: string) => void;
  onCreateHub: (areaLabel: string) => void;
  onCreateRelation: (targetNoteId: string) => void;
  onNavigateToNote: (noteId: string) => void;
  onOpenDiscover?: () => void;
  onExecuteAction?: (action: CosmosActionItem) => void;
}

export function CosmosActionsPanel({
  colors: c,
  note,
  snapshot,
  notes,
  service,
  onConnect,
  onViewCandidates,
  onAssignArea,
  onCreateHub,
  onCreateRelation,
  onNavigateToNote,
  onOpenDiscover,
}: CosmosActionsPanelProps) {
  const { t } = useTranslation();

  const plan = useMemo(() => {
    const galaxyMap = buildNoteGalaxyMap(notes, service);
    const areaHealthRows = buildAreaHealthSummaries(notes, service, galaxyMap);
    return buildCosmosActionPlan(note, snapshot, notes, service, areaHealthRows, {
      connectDesc: target => t('k37ActionConnectTo').replace('{target}', target),
      backlinkDesc: t('k37ActionViewCandidatesHint'),
      assignDesc: t('k37ActionAssignAreaHint'),
      createHubDesc: t('k37ActionCreateHubHint'),
      resolveDesc: t('k37ActionResolveHint'),
      relationDesc: target => t('k37ActionRelationHint').replace('{target}', target),
    });
  }, [note, snapshot, notes, service, t]);

  const checklistActions = plan.actions.filter(
    a => a.kind === 'assign-area' || a.kind === 'create-hub' || a.kind === 'add-relation' || a.kind === 'resolve-isolated',
  );

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <CosmosSuiteHeader c={c} active="actions" t={t} />
      <KnowledgePanelSection colors={c} first title={t('k37RecommendedActions')} count={plan.actions.length}>
        {plan.actions.length === 0 ? (
          <KnowledgePanelEmpty
            colors={c}
            actionLabel={t('k52ContextOpenLinks')}
            onAction={onViewCandidates}
            secondaryActionLabel={onOpenDiscover ? t('k53ContextOpenDiscover') : undefined}
            onSecondaryAction={onOpenDiscover}
          >
            {t('k37NoActions')}
          </KnowledgePanelEmpty>
        ) : (
          checklistActions.slice(0, 8).map(action => (
            <ActionCard
              key={action.id}
              c={c}
              title={action.title}
              description={action.description}
              actions={renderActionButton(c, action, t, {
                onConnect: () => action.targetNoteTitle && onConnect(action.targetNoteTitle),
                onViewCandidates,
                onAssignArea: () => action.areaLabel && onAssignArea(action.areaLabel, action.areaNoteId),
                onCreateHub: () => action.areaLabel && onCreateHub(action.areaLabel),
                onCreateRelation: () => action.targetNoteId && onCreateRelation(action.targetNoteId),
                onResolve: () => onViewCandidates(),
              })}
            />
          ))
        )}
      </KnowledgePanelSection>

      <KnowledgePanelSection colors={c} title={t('k36KnowledgeOpportunities')} count={snapshot.opportunities.length}>
        <OpportunityActions
          colors={c}
          actions={plan.actions}
          onConnect={(title) => onConnect(title)}
          onViewCandidates={onViewCandidates}
          onAssignArea={onAssignArea}
        />
      </KnowledgePanelSection>

      <KnowledgePanelSection colors={c} title={t('k37AreaGuidance')}>
        <AreaGuidance
          colors={c}
          guidance={plan.areaGuidance}
          suggestedArea={plan.suggestedArea}
          onAssignArea={onAssignArea}
        />
        <HubCreationAssistant colors={c} hub={plan.hubAssistant} onCreateHub={onCreateHub} />
      </KnowledgePanelSection>

      <KnowledgePanelSection colors={c} title={t('k36SuggestedConnections')} count={plan.connections.length}>
        <ConnectionRecommendationList
          colors={c}
          connections={plan.connections}
          onCreateRelation={onCreateRelation}
          onNavigate={onNavigateToNote}
        />
      </KnowledgePanelSection>
    </div>
  );
}

function renderActionButton(
  c: NoteChromeColors,
  action: CosmosActionItem,
  t: (key: TranslationKey) => string,
  handlers: {
    onConnect: () => void;
    onViewCandidates: () => void;
    onAssignArea: () => void;
    onCreateHub: () => void;
    onCreateRelation: () => void;
    onResolve: () => void;
  },
) {
  switch (action.kind) {
    case 'connect':
      return <ActionButton c={c} onClick={handlers.onConnect}>{t('k37ActionConnect')}</ActionButton>;
    case 'view-candidates':
      return <ActionButton c={c} onClick={handlers.onViewCandidates}>{t('k37ActionViewCandidates')}</ActionButton>;
    case 'assign-area':
      return <ActionButton c={c} onClick={handlers.onAssignArea}>{t('k37ActionAssign')}</ActionButton>;
    case 'create-hub':
      return <ActionButton c={c} onClick={handlers.onCreateHub}>{t('k37ActionCreateHub')}</ActionButton>;
    case 'add-relation':
      return <ActionButton c={c} onClick={handlers.onCreateRelation}>{t('k37ActionCreateRelation')}</ActionButton>;
    case 'resolve-isolated':
      return <ActionButton c={c} onClick={handlers.onResolve}>{t('k37ActionResolve')}</ActionButton>;
    default:
      return null;
  }
}
