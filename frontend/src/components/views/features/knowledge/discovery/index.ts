export {
  buildDiscoveryFeed,
  buildDiscoveryRefreshBundle,
  countDiscoveriesForNote,
  isDiscoveryOpportunityNote,
  type DiscoveryRefreshBundle,
} from './discoveryEngine';

export {
  createDiscoveryFeedContext,
  getCandidatePool,
  getDiscoveryAreaHealth,
  getDiscoveryImportance,
  type ConnectionCandidateIndex,
  type DiscoveryFeedContext,
} from './discoveryFeedContext';

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

export { DiscoveryPanel, type DiscoveryPanelProps } from '../components/DiscoveryPanel';
export { DiscoveryDashboardCard, type DiscoveryDashboardCardProps } from '../components/DiscoveryDashboardCard';
