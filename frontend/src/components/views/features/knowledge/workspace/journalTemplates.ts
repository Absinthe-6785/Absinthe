import type { NoteBase } from '../../../noteUtils';
import { addTag } from '../tags/noteTags';
import { JOURNAL_TAG, type JournalTemplateDefinition } from './journalTemplateModels';

export interface BuildJournalNoteOptions {
  title?: string;
}

export function buildJournalNote(
  note: NoteBase,
  template: JournalTemplateDefinition,
  options: BuildJournalNoteOptions = {},
): NoteBase {
  let result: NoteBase = {
    ...note,
    title: options.title?.trim() || template.defaultTitle,
    body: template.body,
  };
  result = addTag(result, JOURNAL_TAG);
  for (const tag of template.tags) {
    result = addTag(result, tag);
  }
  return result;
}

export function findJournalTemplate(
  templateId: string,
  templates: readonly JournalTemplateDefinition[],
): JournalTemplateDefinition | undefined {
  const key = templateId.trim();
  return templates.find(template => template.id === key);
}

export function resolveJournalTemplateId(
  templateId: string | undefined,
  templates: readonly JournalTemplateDefinition[],
): JournalTemplateDefinition | undefined {
  if (templateId) {
    return findJournalTemplate(templateId, templates);
  }
  return findJournalTemplate('daily-review', templates) ?? templates[0];
}
