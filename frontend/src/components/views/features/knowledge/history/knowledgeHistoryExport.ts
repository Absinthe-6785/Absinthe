import type { Language } from '../../../../../lib/i18n';
import type { KnowledgeMilestone } from '../timeline/timelineTypes';
import type { ExpandedCosmosEvolutionStory } from './historyEvolutionQueries';
import type { CosmosEvolutionSummary } from './historyEvolutionQueries';

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

export async function copyCosmosEvolutionMarkdown(markdown: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(markdown);
    return true;
  } catch {
    return false;
  }
}
