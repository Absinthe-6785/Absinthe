export {
  countActiveNotes,
  countVaultLinks,
  formatFirstDiscoveryMessage,
  resolveCosmosEmptyScenario,
  resolveCosmosVaultPhase,
  type CosmosEmptyScenario,
  type CosmosVaultPhase,
} from './cosmosVaultState';

export {
  advanceProductTour,
  completeProductTour,
  loadCosmosOnboardingState,
  markFirstDiscoveryCelebrated,
  shouldShowFirstDiscoveryBanner,
  shouldShowProductTour,
  type CosmosOnboardingState,
} from './cosmosOnboardingStorage';

export {
  buildTierExplanationLines,
  tierExplanationForClassification,
  type TierExplanationLine,
} from './tierExplanation';

export { CosmosEmptyStatePanel } from './CosmosEmptyStatePanel';
export { CosmosProductTour } from './CosmosProductTour';
export { CosmosStartDashboard } from './CosmosStartDashboard';
export { CosmosTermTooltip, type CosmosGlossaryTerm } from './CosmosTermTooltip';
export { FirstDiscoveryBanner } from './FirstDiscoveryBanner';
export {
  WhyThisRecommendation,
  buildSignalReasonLines,
  buildTierReasonLine,
} from './WhyThisRecommendation';
export { WhyThisTier } from './WhyThisTier';
