import type { NoteBase } from '../../../noteUtils';
import { setProperty } from '../properties/noteProperties';
import { addTag } from '../tags/noteTags';
import { createInboxNote } from './quickCapture';
import {
  DEFAULT_TASK_TEMPLATE_ID,
  type TaskTemplateDefinition,
} from './taskTemplateModels';

export interface BuildTaskNoteOptions {
  title?: string;
  toInbox?: boolean;
}

export function applyTaskProperties(
  note: NoteBase,
  template: TaskTemplateDefinition,
): NoteBase {
  let result = note;
  for (const [key, value] of Object.entries(template.properties)) {
    result = setProperty(result, key, value);
  }
  for (const tag of template.tags) {
    result = addTag(result, tag);
  }
  return result;
}

export function buildTaskNote(
  note: NoteBase,
  template: TaskTemplateDefinition,
  options: BuildTaskNoteOptions = {},
): NoteBase {
  const titled: NoteBase = {
    ...note,
    title: options.title?.trim() || template.defaultTitle,
  };
  const tagged = options.toInbox
    ? createInboxNote(titled, { captureType: 'task' })
    : addTag(titled, 'task');
  return applyTaskProperties(tagged, template);
}

export function findTaskTemplate(
  templateId: string,
  templates: readonly TaskTemplateDefinition[],
): TaskTemplateDefinition | undefined {
  const key = templateId.trim();
  return templates.find(template => template.id === key);
}

export function resolveTaskTemplateId(
  templateId: string | undefined,
  templates: readonly TaskTemplateDefinition[],
): TaskTemplateDefinition | undefined {
  if (templateId) {
    return findTaskTemplate(templateId, templates);
  }
  return findTaskTemplate(DEFAULT_TASK_TEMPLATE_ID, templates) ?? templates[0];
}
