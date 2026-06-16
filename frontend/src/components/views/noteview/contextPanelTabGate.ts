import type { KnowledgeContextTab } from '../features/knowledge/components/KnowledgeContextPanel';

/** Tabs that require Links panel data (backlinks, related, concept hub, etc.). */
export function isLinksContextTabActive(
  panelOpen: boolean,
  tab: KnowledgeContextTab,
): boolean {
  return panelOpen && tab === 'links';
}

export function isGraphContextTabActive(
  panelOpen: boolean,
  tab: KnowledgeContextTab,
): boolean {
  return panelOpen && tab === 'graph';
}

export function isInsightsContextTabActive(
  panelOpen: boolean,
  tab: KnowledgeContextTab,
): boolean {
  return panelOpen && tab === 'insights';
}

export function isPropertiesContextTabActive(
  panelOpen: boolean,
  tab: KnowledgeContextTab,
): boolean {
  return panelOpen && (tab === 'properties' || tab === 'actions');
}

export function isRelationsContextTabActive(
  panelOpen: boolean,
  tab: KnowledgeContextTab,
): boolean {
  return panelOpen && tab === 'relations';
}

export function isTagsContextTabActive(
  panelOpen: boolean,
  tab: KnowledgeContextTab,
): boolean {
  return panelOpen && tab === 'tags';
}

export function isStatsContextTabActive(
  panelOpen: boolean,
  tab: KnowledgeContextTab,
): boolean {
  return panelOpen && tab === 'stats';
}

export function isDiscoverContextTabActive(
  panelOpen: boolean,
  tab: KnowledgeContextTab,
): boolean {
  return panelOpen && tab === 'discover';
}

export function isTimelineContextTabActive(
  panelOpen: boolean,
  tab: KnowledgeContextTab,
): boolean {
  return panelOpen && tab === 'timeline';
}

export type DashboardLoadScope = {
  workspace: boolean;
  discover: boolean;
  timeline: boolean;
};

export function resolveDashboardLoadScope(params: {
  isDashboardMode: boolean;
  showRightPanel: boolean;
  rightPanel: KnowledgeContextTab;
  viewMode: 'edit' | 'reading' | 'graph';
}): DashboardLoadScope {
  const panelOpen = params.showRightPanel && params.viewMode !== 'graph';
  return {
    workspace: params.isDashboardMode,
    discover: params.isDashboardMode || (panelOpen && params.rightPanel === 'discover'),
    timeline: params.isDashboardMode
      || (panelOpen && params.rightPanel === 'timeline')
      || params.viewMode === 'graph',
  };
}
