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
}

export interface KnowledgeJourney {
  steps: readonly KnowledgeJourneyStep[];
}

export function buildKnowledgeJourney(
  milestones: readonly KnowledgeMilestone[],
  events: readonly KnowledgeHistoryEvent[] = loadKnowledgeHistoryEvents(),
): KnowledgeJourney {
  const steps: KnowledgeJourneyStep[] = milestones.map(m => ({
    milestoneId: m.id,
    titleKey: m.titleKey,
    achieved: m.achieved,
    achievedAt: m.achievedAt,
    noteId: m.achieved ? getMilestoneNoteId(m.id, events) : null,
    source: m.achieved && getMilestoneNoteId(m.id, events) ? 'event' : 'estimate',
  }));

  return { steps };
}
