export {
  evaluateKnowledgeImportance,
  buildNoteIntelligenceSnapshot,
  buildCosmosVaultAnalysis,
  buildKnowledgeOpportunities,
  buildSuggestedConnections,
  buildAreaHealthSummaries,
  buildKnowledgeGaps,
  buildImportanceInputForNote,
  type ImportanceClassification,
  type NoteIntelligenceSnapshot,
  type CosmosVaultAnalysis,
  type KnowledgeOpportunity,
  type SuggestedConnection,
  type AreaHealthSummary,
  type KnowledgeGap,
} from './intelligence';

export { CosmosInsightsPanel, type CosmosInsightsPanelProps } from '../components/CosmosInsightsPanel';

export {
  CosmosActionsPanel,
  buildCosmosActionPlan,
  countActionsForNote,
  enrichConnectionRecommendations,
  formatConnectionReasons,
  suggestAreaForNote,
  buildAreaAssignmentPatch,
  buildConnectPatch,
  buildHubCreationPatch,
  buildHubNoteTemplate,
  type CosmosActionsPanelProps,
  type CosmosActionItem,
  type CosmosActionPlan,
  type EnrichedConnectionRecommendation,
} from './actions';

export {
  resolveCosmosVaultPhase,
  countActiveNotes,
  countVaultLinks,
  CosmosProductTour,
  CosmosStartDashboard,
  WhyThisRecommendation,
  WhyThisTier,
  CosmosTermTooltip,
  type CosmosVaultPhase,
} from './onboarding';

export { buildNoteGalaxyMap } from '../graph/knowledgeUniverse/galaxyClustering';
