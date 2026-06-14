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
} from './discoveryScoring';

export type {
  BuildDiscoveryFeedOptions,
  DiscoveryFeed,
  DiscoveryItem,
  DiscoveryKind,
  DiscoverySummary,
} from './discoveryTypes';
