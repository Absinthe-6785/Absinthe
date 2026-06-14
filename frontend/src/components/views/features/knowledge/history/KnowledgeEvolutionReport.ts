import type { Language, TranslationKey } from '../../../../../lib/i18n';
import type { KnowledgeMilestone } from '../timeline/timelineTypes';
import type { DormantAreaInsight } from './DormantAreaAnalyzer';
import type { KnowledgeMomentumSnapshot } from './knowledgeMomentum';
import { getActivitySummary } from './historyQueries';
import type { KnowledgeHistoryEvent } from './eventTypes';
import { loadKnowledgeHistoryEvents } from './historyStorage';

function formatDate(ts: number | null, lang: Language): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString(
    lang === 'ko' ? 'ko-KR' : lang === 'ja' ? 'ja-JP' : undefined,
    { year: 'numeric', month: 'short', day: 'numeric' },
  );
}

export interface EvolutionReportOptions {
  momentum: KnowledgeMomentumSnapshot;
  dormantAreas: readonly DormantAreaInsight[];
  latestMilestoneTitleKey: TranslationKey | null;
  latestMilestoneAt: number | null;
  lang?: Language;
  events?: readonly KnowledgeHistoryEvent[];
}

/** Deterministic markdown evolution report for a period. */
export function generateKnowledgeEvolutionReport(options: EvolutionReportOptions): string {
  const {
    momentum,
    dormantAreas,
    latestMilestoneTitleKey,
    latestMilestoneAt,
    lang = 'en',
    events = loadKnowledgeHistoryEvents(),
  } = options;

  const activity = getActivitySummary(momentum.periodDays, Date.now(), events);
  const lines: string[] = [
    '# Knowledge Evolution Report',
    '',
    '## Period',
    `Last ${momentum.periodDays} Days`,
    '',
    '## Growth',
    `+${activity.notesCreated} Notes`,
    `+${activity.linksCreated} Links`,
    '',
  ];

  if (momentum.fastestGrowingArea) {
    lines.push('## Fastest Growing Area', '', momentum.fastestGrowingArea, '');
  }
  if (momentum.mostActiveArea) {
    lines.push('## Most Active Area', '', momentum.mostActiveArea, '');
  }
  if (momentum.mostConnectedArea) {
    lines.push('## Most Connected Area', '', momentum.mostConnectedArea, '');
  }
  if (momentum.mostImprovedArea) {
    lines.push('## Most Improved Area', '', momentum.mostImprovedArea, '');
  }
  if (latestMilestoneTitleKey) {
    lines.push(
      '## Latest Milestone',
      '',
      latestMilestoneTitleKey,
      latestMilestoneAt ? formatDate(latestMilestoneAt, lang) : '',
      '',
    );
  }
  if (dormantAreas.length > 0) {
    lines.push('## Dormant Areas', '');
    for (const d of dormantAreas.slice(0, 5)) {
      lines.push(`- ${d.areaLabel}: last activity ${d.daysSinceActivity} days ago`);
    }
    lines.push('');
  }

  lines.push('## Cosmos Momentum', '', `Score: ${momentum.cosmosMomentumScore}`, '');
  return lines.filter(l => l !== undefined).join('\n');
}
