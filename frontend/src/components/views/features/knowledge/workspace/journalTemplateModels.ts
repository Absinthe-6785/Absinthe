export interface JournalTemplateDefinition {
  id: string;
  name: string;
  description: string;
  defaultTitle: string;
  body: string;
  tags: readonly string[];
}

export const DEFAULT_JOURNAL_TEMPLATE_ID = 'daily-review';

export const JOURNAL_TAG = 'journal';
