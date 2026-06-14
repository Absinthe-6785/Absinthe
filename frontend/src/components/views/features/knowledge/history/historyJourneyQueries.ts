import type { TranslationKey } from '../../../../../lib/i18n';
import type { KnowledgeMilestone } from '../timeline/timelineTypes';
import type { KnowledgeHistoryEvent } from './eventTypes';
import { getMilestoneNoteId } from './historyEvolutionQueries';
import { loadKnowledgeHistoryEvents } from './historyStorage';

export interface KnowledgeJourneyStep {
  milestoneId: string;
  titleKey: TranslationKey;
  achieved: boolean;
  achievedAt: number | null;
  noteId: string | null;
  source: 'event' | 'estimate';
  daysSincePrevious: number | null;
}

export interface KnowledgeJourney {
  steps: readonly KnowledgeJourneyStep[];
}

const DAY_MS = 86_400_000;

export function buildKnowledgeJourney(
  milestones: readonly KnowledgeMilestone[],
  events: readonly KnowledgeHistoryEvent[] = loadKnowledgeHistoryEvents(),
): KnowledgeJourney {
  let previousAchievedAt: number | null = null;
  const steps: KnowledgeJourneyStep[] = milestones.map(m => {
    const noteId = m.achieved ? getMilestoneNoteId(m.id, events) : null;
    const daysSincePrevious = m.achieved && m.achievedAt && previousAchievedAt != null
      ? Math.max(0, Math.round((m.achievedAt - previousAchievedAt) / DAY_MS))
      : m.achieved && m.achievedAt && previousAchievedAt == null
        ? null
        : null;

    if (m.achieved && m.achievedAt) previousAchievedAt = m.achievedAt;

    return {
      milestoneId: m.id,
      titleKey: m.titleKey,
      achieved: m.achieved,
      achievedAt: m.achievedAt,
      noteId,
      source: m.achieved && noteId ? 'event' : 'estimate',
      daysSincePrevious,
    };
  });

  return { steps };
}
