import type { Language } from '../../../../../lib/i18n';
import type { KnowledgeMilestone } from '../timeline/timelineTypes';
import type { ExpandedCosmosEvolutionStory } from './historyEvolutionQueries';
import type { CosmosEvolutionSummary } from './historyEvolutionQueries';
import type { KnowledgeHistoryEvent } from './eventTypes';
import type { KnowledgeJourney } from './historyJourneyQueries';
import { groupEventsByDate, presentHistoryEvent } from './historyEventPresentation';
import type { NoteBase } from '../../../noteUtils';
import { generateKnowledgeEvolutionReport, type EvolutionReportOptions } from './KnowledgeEvolutionReport';

export type ExportKind = 'evolution' | 'report' | 'activity' | 'journey';

function formatDate(ts: number | null, lang: Language): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString(
    lang === 'ko' ? 'ko-KR' : lang === 'ja' ? 'ja-JP' : undefined,
    { year: 'numeric', month: 'short', day: 'numeric' },
  );
}

export interface CosmosEvolutionMarkdownOptions {
  summary: CosmosEvolutionSummary;
  story: ExpandedCosmosEvolutionStory;
  milestones: readonly KnowledgeMilestone[];
  lang?: Language;
}

/** Deterministic markdown export of cosmos evolution. */
export function exportCosmosEvolutionMarkdown(options: CosmosEvolutionMarkdownOptions): string {
  const { summary, story, milestones, lang = 'en' } = options;
  const lines: string[] = ['# Cosmos Evolution', ''];

  lines.push('## Milestones', '');
  if (summary.firstNoteAt) {
    lines.push(`- First Note: ${formatDate(summary.firstNoteAt, lang)}`);
  }
  if (summary.firstLinkAt) {
    lines.push(`- First Link: ${formatDate(summary.firstLinkAt, lang)}`);
  }
  if (summary.firstHubAt) {
    lines.push(`- First Hub: ${formatDate(summary.firstHubAt, lang)}`);
  }

  const achieved = milestones.filter(m => m.achieved);
  for (const m of achieved) {
    if (['first-note', 'first-link', 'first-hub'].includes(m.id)) continue;
    lines.push(`- ${m.id.replace(/-/g, ' ')}: ${m.achievedAt ? formatDate(m.achievedAt, lang) : '—'}`);
  }

  lines.push('', '## Current', '');
  lines.push(`- ${summary.currentNotes} Notes`);
  lines.push(`- ${summary.currentLinks} Links`);
  lines.push(`- ${summary.currentHubs} Hubs`);

  if (story.notesAdded > 0 || story.linksAdded > 0 || story.hubsAdded > 0) {
    lines.push('', '## Growth', '');
    if (story.notesAdded > 0) lines.push(`- +${story.notesAdded} notes`);
    if (story.linksAdded > 0) lines.push(`- +${story.linksAdded} links`);
    if (story.hubsAdded > 0) lines.push(`- +${story.hubsAdded} hubs`);
  }

  if (story.fastestGrowingArea || story.longestActiveArea || story.mostConnectedArea) {
    lines.push('', '## Highlights', '');
    if (story.fastestGrowingArea) lines.push(`- Fastest growing area: ${story.fastestGrowingArea}`);
    if (story.longestActiveArea) lines.push(`- Longest active area: ${story.longestActiveArea}`);
    if (story.mostConnectedArea) lines.push(`- Most connected area: ${story.mostConnectedArea}`);
    if (story.recentMilestoneTitleKey) {
      lines.push(`- Recent milestone: ${story.recentMilestoneTitleKey}`);
    }
  }

  if (summary.importedOnly) {
    lines.push('', '_Includes imported history inferred from existing notes._');
  }

  return lines.join('\n');
}

export function exportActivityFeedMarkdown(
  events: readonly KnowledgeHistoryEvent[],
  notes: readonly NoteBase[],
  lang: Language = 'en',
  limit = 200,
): string {
  const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  const groups = groupEventsByDate(sorted, lang);
  const lines: string[] = ['# Activity Feed', ''];
  for (const group of groups) {
    lines.push(`## ${group.label}`, '');
    for (const event of group.events) {
      const row = presentHistoryEvent(event, notes);
      lines.push(`- ${row.actionKey}: ${row.detail}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function exportJourneySummaryMarkdown(
  journey: KnowledgeJourney,
  lang: Language = 'en',
): string {
  const lines: string[] = ['# Knowledge Journey', ''];
  for (const step of journey.steps) {
    const date = step.achievedAt ? formatDate(step.achievedAt, lang) : '—';
    const status = step.achieved ? '✓' : '○';
    lines.push(`${status} ${step.titleKey}`, date);
    if (step.daysSincePrevious != null && step.daysSincePrevious > 0) {
      lines.push(`  (${step.daysSincePrevious} days since previous)`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function exportMarkdownByKind(
  kind: ExportKind,
  options: {
    evolution?: CosmosEvolutionMarkdownOptions;
    report?: EvolutionReportOptions;
    activity?: { events: readonly KnowledgeHistoryEvent[]; notes: readonly NoteBase[]; lang?: Language };
    journey?: { journey: KnowledgeJourney; lang?: Language };
  },
): string {
  switch (kind) {
    case 'evolution':
      return exportCosmosEvolutionMarkdown(options.evolution!);
    case 'report':
      return generateKnowledgeEvolutionReport(options.report!);
    case 'activity':
      return exportActivityFeedMarkdown(
        options.activity!.events,
        options.activity!.notes,
        options.activity!.lang,
      );
    case 'journey':
      return exportJourneySummaryMarkdown(options.journey!.journey, options.journey!.lang);
    default:
      return '';
  }
}

export function downloadMarkdownFile(filename: string, content: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function copyMarkdownToClipboard(markdown: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(markdown);
    return true;
  } catch {
    return false;
  }
}

/** @deprecated Use copyMarkdownToClipboard */
export async function copyCosmosEvolutionMarkdown(markdown: string): Promise<boolean> {
  return copyMarkdownToClipboard(markdown);
}

export function exportFilename(kind: ExportKind): string {
  const stamp = new Date().toISOString().slice(0, 10);
  switch (kind) {
    case 'evolution': return `cosmos-evolution-${stamp}.md`;
    case 'report': return `knowledge-evolution-report-${stamp}.md`;
    case 'activity': return `activity-feed-${stamp}.md`;
    case 'journey': return `knowledge-journey-${stamp}.md`;
  }
}
