import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import {
  bucketNotesByDate,
  type CalendarDateBucket,
} from './bucketNotesByDate';
import { getCalendarConfig, withPresentationDefaults } from './databasePresentationConfig';
import { filterByDatabaseView } from './filterByDatabaseView';
import type { DatabaseView } from './databaseViewModels';

/**
 * Full database view calendar pipeline: filter via query engine, then bucket by date.
 * Query semantics are unchanged — date bucketing is post-filter only.
 */
export function prepareDatabaseCalendarBuckets(
  view: DatabaseView,
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
): CalendarDateBucket[] {
  const configured = withPresentationDefaults(view);
  const calendarConfig = getCalendarConfig(configured);
  const filtered = filterByDatabaseView(
    notes.filter(note => !note.deletedAt),
    service,
    configured,
  ).notes;
  return bucketNotesByDate(
    filtered,
    calendarConfig.dateProperty,
    service,
    calendarConfig.unscheduledLabel,
  );
}

export type { CalendarDateBucket };
