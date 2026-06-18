/**
 * K-104 — Knowledge context panel IA audit.
 */
export const K104_CONTEXT_PRIMARY = ['overview', 'outline', 'links', 'insights'] as const;
export const K104_CONTEXT_MORE = ['timeline', 'actions', 'cosmos', 'properties'] as const;

export function auditKnowledgeContextTabs(): { primary: string[]; more: string[] } {
  return { primary: [...K104_CONTEXT_PRIMARY], more: [...K104_CONTEXT_MORE] };
}

export function formatK104KnowledgeContextReport(tabs: { primary: string[]; more: string[] }): string {
  return [
    'K-104 knowledge context audit',
    '',
    `  primary: ${tabs.primary.join(', ')}`,
    `  more: ${tabs.more.join(', ')}`,
  ].join('\n');
}
