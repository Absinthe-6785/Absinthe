export {
  buildDiscoveryFeed,
  countDiscoveriesForNote,
  isDiscoveryOpportunityNote,
} from './discoveryEngine';

export {
  collectEmergingTopicSignals,
  collectForgottenKnowledgeSignals,
  collectKnowledgeDriftSignals,
  collectMissingConnectionSignals,
  collectWeakHubSignals,
} from './discoverySignals';

export {
  DISCOVERY_WEIGHTS,
  scoreEmergingTopic,
  scoreForgottenKnowledge,
  scoreKnowledgeDrift,
  scoreMissingConnection,
  scoreWeakHub,
  discoveryConfidenceTier,
  type DiscoveryConfidence,
} from './discoveryScoring';

export { formatDiscoveryReasonLines } from './discoveryReasons';

export {
  buildClassificationDistribution,
  evaluateDiscoveryFeedQuality,
  estimateRecommendationUsefulness,
  flagClassificationOutliers,
  isActionableDiscovery,
  CLASSIFICATION_EXPECTED_RANGES,
  type ClassificationDistribution,
  type KindQualityMetrics,
  type RecommendationQualityReport,
} from './validation';

export type {
  BuildDiscoveryFeedOptions,
  DiscoveryFeed,
  DiscoveryItem,
  DiscoveryKind,
  DiscoverySummary,
} from './discoveryTypes';
