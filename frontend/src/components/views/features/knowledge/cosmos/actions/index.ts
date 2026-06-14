export { CosmosActionsPanel, type CosmosActionsPanelProps } from './CosmosActionsPanel';

export {
  appendWikiLinkIfMissing,
  buildAreaAssignmentPatch,
  buildConnectPatch,
  buildHubCreationPatch,
  buildHubNoteTemplate,
  type NoteMutationPatch,
} from './noteMutations';

export {
  buildCosmosActionPlan,
  countActionsForNote,
  enrichConnectionRecommendations,
  formatConnectionReasons,
  suggestAreaForNote,
  type AreaGuidanceItem,
  type AreaGuidanceRecommendation,
  type CosmosActionItem,
  type CosmosActionKind,
  type CosmosActionPlan,
  type EnrichedConnectionRecommendation,
  type HubAssistantState,
  type SuggestedAreaAssignment,
} from './actionEngine';
