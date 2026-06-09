import type { DatabaseViewPresentation } from './databaseViewModels';

export interface DatabasePresentationOption {
  value: DatabaseViewPresentation;
  label: string;
}

/** Canonical presentation options — single source for controls and create form */
export const DATABASE_PRESENTATION_OPTIONS: readonly DatabasePresentationOption[] = [
  { value: 'table', label: 'Table' },
  { value: 'board', label: 'Board' },
  { value: 'calendar', label: 'Calendar' },
];

export function presentationLabel(presentation: DatabaseViewPresentation): string {
  return DATABASE_PRESENTATION_OPTIONS.find(option => option.value === presentation)?.label ?? presentation;
}

export interface DatabasePropertyFieldPreset {
  label: string;
  placeholder: string;
  defaultValue: string;
}

export const BOARD_GROUP_BY_FIELD: DatabasePropertyFieldPreset = {
  label: 'Group by',
  placeholder: 'Property key (e.g. status)',
  defaultValue: 'status',
};

export const CALENDAR_DATE_PROPERTY_FIELD: DatabasePropertyFieldPreset = {
  label: 'Date property',
  placeholder: 'Property key (e.g. reviewDate)',
  defaultValue: 'reviewDate',
};

export const TABLE_ADD_COLUMN_FIELD: DatabasePropertyFieldPreset = {
  label: 'Columns',
  placeholder: 'Property key (e.g. status)',
  defaultValue: '',
};

/** Suggested property keys shown as datalist hints */
export const SUGGESTED_PROPERTY_KEYS = [
  'status',
  'priority',
  'source',
  'reviewDate',
  'dueDate',
  'examDate',
  'updatedAt',
  'createdAt',
] as const;

export const DATABASE_EMPTY_MESSAGE = 'No matching notes';
