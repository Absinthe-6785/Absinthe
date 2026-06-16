import type { DiscoveryFeed } from './discovery/discoveryTypes';
import type { KnowledgeTimeline, RecentEvolutionSummary } from './timeline/timelineTypes';
import type { CosmosVaultPhase } from './cosmos/onboarding/cosmosVaultState';

const EMPTY_DISCOVERY_SUMMARY = {
  forgottenCount: 0,
  missingConnectionCount: 0,
  emergingTopicCount: 0,
  weakHubCount: 0,
  knowledgeDriftCount: 0,
  isolatedNotesCount: 0,
  recentlyActiveAreaCount: 0,
  staleAreaCount: 0,
  totalCount: 0,
} as const;

export const EMPTY_DISCOVERY_FEED: DiscoveryFeed = {
  items: [],
  sections: {
    'isolated-notes': [],
    'recently-active-area': [],
    'stale-area': [],
    'forgotten-knowledge': [],
    'missing-connection': [],
    'emerging-topic': [],
    'weak-hub': [],
    'knowledge-drift': [],
  },
  summary: { ...EMPTY_DISCOVERY_SUMMARY },
};

export const EMPTY_RECENT_EVOLUTION: RecentEvolutionSummary = {
  notesAdded: 0,
  linksAdded: 0,
  periodDays: 30,
  fastestGrowingArea: null,
};

export const EMPTY_KNOWLEDGE_TIMELINE: KnowledgeTimeline = {
  mode: 'month',
  periods: [],
  snapshots: [],
  growth: {
    vault: { notesCreated: 0, linksCreated: 0, areasCreated: 0 },
    structural: { hubCount: 0, galaxyCount: 0, connectionDensity: 0 },
    discovery: { discoveriesGenerated: 0, discoveriesResolved: 0, connectionsAdded: 0 },
    periodLabel: '',
  },
  areaEvolution: [],
  milestones: [],
  discoveryHistory: {
    missingConnectionsResolved: 0,
    weakHubsCreated: 0,
    forgottenNotesRevisited: 0,
  },
  recentEvolution: EMPTY_RECENT_EVOLUTION,
  usesEventHistory: false,
};

export const EMPTY_COSMOS_VAULT_PHASE: CosmosVaultPhase = 'no-notes';
