export {
  IMPORTANCE_WEIGHTS,
  IMPORTANCE_CLASS_THRESHOLDS,
  SUGGESTION_WEIGHTS,
  OPPORTUNITY_LIMITS,
  AREA_HEALTH_WEIGHTS,
  AREA_HEALTH_CATEGORY_THRESHOLDS,
} from './importanceWeights';

export {
  calculateKnowledgeImportanceScore,
  classifyKnowledgeImportance,
  evaluateKnowledgeImportance,
  type ImportanceClassification,
  type KnowledgeImportanceInput,
  type KnowledgeImportanceResult,
} from './knowledgeImportance';

export {
  buildImportanceInputForNote,
  buildKnowledgeOpportunities,
  type KnowledgeOpportunity,
  type KnowledgeOpportunityKind,
} from './knowledgeOpportunities';

export {
  buildSuggestedConnections,
  type SuggestedConnection,
  type SuggestionSignal,
} from './suggestedConnections';

export {
  buildAreaHealthSummaries,
  type AreaHealthSummary,
  type AreaHealthCategory,
} from './areaHealth';

export {
  buildKnowledgeGaps,
  type KnowledgeGap,
  type KnowledgeGapKind,
} from './knowledgeGaps';

export {
  buildNoteIntelligenceSnapshot,
  buildCosmosVaultAnalysis,
  countNotesByClassification,
  type NoteIntelligenceSnapshot,
  type CosmosVaultAnalysis,
} from './cosmosAnalysis';
