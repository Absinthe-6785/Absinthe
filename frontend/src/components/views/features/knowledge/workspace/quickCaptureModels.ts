/** Quick capture type — maps to optional type tag on ordinary notes */
export type QuickCaptureType = 'note' | 'idea' | 'vocabulary' | 'task' | 'research';

export interface QuickCaptureTypeOption {
  id: QuickCaptureType;
  label: string;
  typeTag?: string;
}

export interface QuickCaptureModel {
  inboxTag: string;
  types: readonly QuickCaptureTypeOption[];
}

export const INBOX_TAG = 'inbox';

export const QUICK_CAPTURE_TYPES: readonly QuickCaptureTypeOption[] = [
  { id: 'note', label: 'Note' },
  { id: 'idea', label: 'Idea', typeTag: 'idea' },
  { id: 'vocabulary', label: 'Vocabulary', typeTag: 'vocabulary' },
  { id: 'task', label: 'Task', typeTag: 'task' },
  { id: 'research', label: 'Research', typeTag: 'research' },
];

export const DEFAULT_QUICK_CAPTURE_MODEL: QuickCaptureModel = {
  inboxTag: INBOX_TAG,
  types: QUICK_CAPTURE_TYPES,
};

export function getCaptureTypeTag(type: QuickCaptureType): string | undefined {
  return QUICK_CAPTURE_TYPES.find(option => option.id === type)?.typeTag;
}
