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

export type {
  BuildDiscoveryFeedOptions,
  DiscoveryFeed,
  DiscoveryItem,
  DiscoveryKind,
  DiscoverySummary,
} from './discoveryTypes';
