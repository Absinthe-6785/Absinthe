import type { TranslationKey } from '../../../../../lib/i18n';

export type TimelinePeriodMode = 'month' | 'quarter' | 'all';

export interface TimelinePeriodBucket {
  id: string;
  label: string;
  startMs: number;
  endMs: number;
}

export interface TimelineSnapshot {
  periodId: string;
  label: string;
  noteCount: number;
  linkCount: number;
  hubCount: number;
  galaxyCount: number;
  areaCount: number;
  connectionDensity: number;
  discoveriesOpen: number;
}

export interface VaultGrowthMetrics {
  notesCreated: number;
  linksCreated: number;
  areasCreated: number;
}

export interface StructuralGrowthMetrics {
  hubCount: number;
  galaxyCount: number;
  connectionDensity: number;
}

export interface DiscoveryGrowthMetrics {
  discoveriesGenerated: number;
  discoveriesResolved: number;
  connectionsAdded: number;
}

export interface TimelineGrowthMetrics {
  vault: VaultGrowthMetrics;
  structural: StructuralGrowthMetrics;
  discovery: DiscoveryGrowthMetrics;
  periodLabel: string;
}

export interface AreaEvolutionRow {
  areaLabel: string;
  periods: readonly { label: string; noteCount: number }[];
  trend: 'growing' | 'stable' | 'dormant';
}

export interface KnowledgeMilestone {
  id: string;
  titleKey: TranslationKey;
  achieved: boolean;
  achievedAt: number | null;
  detail?: string;
}

export interface DiscoveryHistorySummary {
  missingConnectionsResolved: number;
  weakHubsCreated: number;
  forgottenNotesRevisited: number;
}

export interface RecentEvolutionSummary {
  notesAdded: number;
  linksAdded: number;
  periodDays: number;
  fastestGrowingArea: string | null;
}

export interface KnowledgeTimeline {
  mode: TimelinePeriodMode;
  periods: TimelinePeriodBucket[];
  snapshots: TimelineSnapshot[];
  growth: TimelineGrowthMetrics;
  areaEvolution: AreaEvolutionRow[];
  milestones: KnowledgeMilestone[];
  discoveryHistory: DiscoveryHistorySummary;
  recentEvolution: RecentEvolutionSummary;
  /** True when growth metrics use recorded events instead of estimates only. */
  usesEventHistory: boolean;
}

export interface BuildKnowledgeTimelineOptions {
  mode?: TimelinePeriodMode;
  now?: number;
  recentDays?: number;
  historyEvents?: readonly import('../history/eventTypes').KnowledgeHistoryEvent[];
  galaxyCacheKey?: string;
}
