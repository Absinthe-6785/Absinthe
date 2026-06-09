import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { getNoteDateValue } from './databaseFieldValues';
import { formatCalendarDayLabel, toDateKey } from './parseDatabaseDate';

export const NO_DATE_KEY = '__no_date__';
export const DEFAULT_NO_DATE_LABEL = 'No Date';

export interface CalendarDateBucket {
  dateKey: string;
  label: string;
  notes: NoteBase[];
}

/**
 * Bucket filtered notes by calendar date derived from a property key.
 * Notes with missing or invalid dates go to the no-date bucket.
 */
export function bucketNotesByDate(
  notes: readonly NoteBase[],
  dateProperty: string,
  service: KnowledgeIndexService,
  unscheduledLabel = DEFAULT_NO_DATE_LABEL,
): CalendarDateBucket[] {
  const trimmedProperty = dateProperty.trim();
  const buckets = new Map<string, NoteBase[]>();
  const labels = new Map<string, string>();

  const ensureBucket = (key: string, label: string) => {
    if (!buckets.has(key)) {
      buckets.set(key, []);
      labels.set(key, label);
    }
  };

  if (!trimmedProperty) {
    return [{
      dateKey: NO_DATE_KEY,
      label: unscheduledLabel,
      notes: [...notes],
    }];
  }

  for (const note of notes) {
    const date = getNoteDateValue(note, trimmedProperty, service);
    if (!date) {
      ensureBucket(NO_DATE_KEY, unscheduledLabel);
      buckets.get(NO_DATE_KEY)!.push(note);
      continue;
    }
    const key = toDateKey(date);
    ensureBucket(key, formatCalendarDayLabel(key));
    buckets.get(key)!.push(note);
  }

  const dateKeys = [...buckets.keys()]
    .filter(key => key !== NO_DATE_KEY)
    .sort();
  if (buckets.has(NO_DATE_KEY)) {
    dateKeys.push(NO_DATE_KEY);
  }

  if (dateKeys.length === 0) {
    return [];
  }

  return dateKeys.map(key => ({
    dateKey: key,
    label: labels.get(key) ?? key,
    notes: buckets.get(key) ?? [],
  }));
}

export function calendarBucketsToMap(
  buckets: readonly CalendarDateBucket[],
): Map<string, NoteBase[]> {
  return new Map(buckets.map(bucket => [bucket.dateKey, [...bucket.notes]]));
}
