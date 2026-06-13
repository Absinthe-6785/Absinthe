import {
  getTranslator,
  resolveAppLanguage,
  type Language,
  type TranslationKey,
} from '../../../../../lib/i18n';
import type { DatabaseViewPresentation } from './databaseViewModels';

export interface DatabasePresentationOption {
  value: DatabaseViewPresentation;
  label: string;
}

const PRESENTATION_I18N: Record<DatabaseViewPresentation, TranslationKey> = {
  table: 'dbViewTable',
  board: 'dbViewBoard',
  calendar: 'dbViewCalendar',
  timeline: 'dbViewTimeline',
  gallery: 'dbViewGallery',
};

/** @deprecated Use getDatabasePresentationOptions(lang) for localized labels */
export const DATABASE_PRESENTATION_OPTIONS: readonly DatabasePresentationOption[] = [
  { value: 'table', label: 'Table' },
  { value: 'board', label: 'Board' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'gallery', label: 'Gallery' },
];

export function getDatabasePresentationOptions(lang?: Language): DatabasePresentationOption[] {
  const t = getTranslator(resolveAppLanguage(lang));
  return (Object.keys(PRESENTATION_I18N) as DatabaseViewPresentation[]).map(value => ({
    value,
    label: t(PRESENTATION_I18N[value]),
  }));
}

export function presentationLabel(
  presentation: DatabaseViewPresentation,
  lang?: Language,
): string {
  const t = getTranslator(resolveAppLanguage(lang));
  return t(PRESENTATION_I18N[presentation]);
}

export interface DatabasePropertyFieldPreset {
  label: string;
  placeholder: string;
  defaultValue: string;
}

export type DatabasePropertyFieldPresetKey =
  | 'boardGroupBy'
  | 'calendarDate'
  | 'timelineStart'
  | 'timelineEnd'
  | 'galleryCover'
  | 'galleryCardFields'
  | 'tableAddColumn';

const PROPERTY_FIELD_DEFAULTS: Record<DatabasePropertyFieldPresetKey, string> = {
  boardGroupBy: 'status',
  calendarDate: 'reviewDate',
  timelineStart: 'startDate',
  timelineEnd: 'endDate',
  galleryCover: 'coverImage',
  galleryCardFields: 'status, priority, reviewDate',
  tableAddColumn: '',
};

const PROPERTY_FIELD_LABEL_KEYS: Record<DatabasePropertyFieldPresetKey, TranslationKey> = {
  boardGroupBy: 'dbGroupBy',
  calendarDate: 'dbDateProperty',
  timelineStart: 'dbStartDateProperty',
  timelineEnd: 'dbEndDateProperty',
  galleryCover: 'dbCoverProperty',
  galleryCardFields: 'dbCardFields',
  tableAddColumn: 'dbColumns',
};

const PROPERTY_FIELD_PLACEHOLDER_KEYS: Record<
  DatabasePropertyFieldPresetKey,
  TranslationKey
> = {
  boardGroupBy: 'dbPropertyKeyPlaceholder',
  calendarDate: 'dbPropertyKeyPlaceholder',
  timelineStart: 'dbPropertyKeyPlaceholder',
  timelineEnd: 'dbPropertyKeyPlaceholder',
  galleryCover: 'dbPropertyKeyPlaceholder',
  galleryCardFields: 'dbCardFieldsPlaceholder',
  tableAddColumn: 'dbPropertyKeyPlaceholder',
};

export function getDatabasePropertyFieldPreset(
  key: DatabasePropertyFieldPresetKey,
  lang?: Language,
): DatabasePropertyFieldPreset {
  const t = getTranslator(resolveAppLanguage(lang));
  return {
    label: t(PROPERTY_FIELD_LABEL_KEYS[key]),
    placeholder: t(PROPERTY_FIELD_PLACEHOLDER_KEYS[key]),
    defaultValue: PROPERTY_FIELD_DEFAULTS[key],
  };
}

/** English presets retained for tests and defaultValue references */
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

export const TIMELINE_START_DATE_FIELD: DatabasePropertyFieldPreset = {
  label: 'Start date property',
  placeholder: 'Property key (e.g. startDate)',
  defaultValue: 'startDate',
};

export const TIMELINE_END_DATE_FIELD: DatabasePropertyFieldPreset = {
  label: 'End date property',
  placeholder: 'Property key (e.g. endDate)',
  defaultValue: 'endDate',
};

export const GALLERY_COVER_PROPERTY_FIELD: DatabasePropertyFieldPreset = {
  label: 'Cover image property',
  placeholder: 'Property key (e.g. coverImage)',
  defaultValue: 'coverImage',
};

export const GALLERY_CARD_FIELDS_FIELD: DatabasePropertyFieldPreset = {
  label: 'Card fields',
  placeholder: 'Comma-separated keys (e.g. status, priority)',
  defaultValue: 'status, priority, reviewDate',
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
  'startDate',
  'endDate',
  'coverImage',
  'updatedAt',
  'createdAt',
] as const;

/** @deprecated Use getDatabaseEmptyMessage(lang) */
export const DATABASE_EMPTY_MESSAGE = 'No matching notes';

export function getDatabaseEmptyMessage(lang?: Language): string {
  return getTranslator(resolveAppLanguage(lang))('dbEmptyMessage');
}
