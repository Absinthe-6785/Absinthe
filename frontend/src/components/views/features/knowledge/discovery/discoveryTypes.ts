import type { ImportanceClassification } from '../cosmos/intelligence/knowledgeImportance';
import type { SuggestionSignal } from '../cosmos/intelligence/suggestedConnections';
import type { DiscoveryConfidence } from './discoveryScoring';

export type DiscoveryKind =
  | 'forgotten-knowledge'
  | 'missing-connection'
  | 'emerging-topic'
  | 'weak-hub'
  | 'knowledge-drift'
  | 'isolated-notes'
  | 'recently-active-area'
  | 'stale-area';

export interface DiscoveryItem {
  id: string;
  kind: DiscoveryKind;
  score: number;
  title: string;
  subtitle: string;
  noteId?: string;
  targetNoteId?: string;
  targetNoteTitle?: string;
  galaxyId?: string;
  areaLabel?: string;
  daysSinceActivity?: number;
  noteCount?: number;
  importanceClass?: ImportanceClassification;
  signals?: readonly SuggestionSignal[];
  confidence?: DiscoveryConfidence;
}

export interface DiscoverySummary {
  forgottenCount: number;
  missingConnectionCount: number;
  emergingTopicCount: number;
  weakHubCount: number;
  knowledgeDriftCount: number;
  isolatedNotesCount: number;
  recentlyActiveAreaCount: number;
  staleAreaCount: number;
  totalCount: number;
}

export interface DiscoveryFeed {
  items: DiscoveryItem[];
  sections: Record<DiscoveryKind, DiscoveryItem[]>;
  summary: DiscoverySummary;
}

export interface BuildDiscoveryFeedOptions {
  limit?: number;
  perSectionLimit?: number;
  now?: number;
  historyEvents?: readonly import('../history/eventTypes').KnowledgeHistoryEvent[];
  /** Vault structure generation — shared galaxy map cache key (K-83A). */
  galaxyCacheKey?: string;
}
