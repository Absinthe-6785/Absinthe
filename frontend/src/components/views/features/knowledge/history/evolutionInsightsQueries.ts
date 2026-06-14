import type { TranslationKey } from '../../../../../lib/i18n';
import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeTimeline } from '../timeline/timelineTypes';
import type { KnowledgeHistoryEvent } from './eventTypes';
import { analyzeDormantAreas, type DormantAreaInsight } from './DormantAreaAnalyzer';
import { getMilestoneNoteId, latestAchievedMilestone } from './historyEvolutionQueries';
import { buildKnowledgeMomentumSnapshot, type KnowledgeMomentumSnapshot } from './knowledgeMomentum';
import { loadKnowledgeHistoryEvents } from './historyStorage';

export interface EvolutionInsightsSummary {
  momentum: KnowledgeMomentumSnapshot;
  dormantAreas: readonly DormantAreaInsight[];
  latestMilestoneTitleKey: TranslationKey | null;
  latestMilestoneNoteId: string | null;
  latestMilestoneAt: number | null;
}

/** Combined momentum, dormant, and milestone insights for dashboard/timeline. */
export function buildEvolutionInsightsSummary(
  notes: readonly NoteBase[],
  timeline: KnowledgeTimeline,
  events: readonly KnowledgeHistoryEvent[] = loadKnowledgeHistoryEvents(),
  periodDays = 30,
  now = Date.now(),
): EvolutionInsightsSummary {
  const momentum = buildKnowledgeMomentumSnapshot(notes, events, timeline, periodDays, now);
  const dormantAreas = analyzeDormantAreas(notes, events, timeline.areaEvolution, now);
  const latest = latestAchievedMilestone(timeline.milestones);

  return {
    momentum,
    dormantAreas,
    latestMilestoneTitleKey: latest?.titleKey ?? null,
    latestMilestoneNoteId: latest ? getMilestoneNoteId(latest.id, events) : null,
    latestMilestoneAt: latest?.achievedAt ?? null,
  };
}
