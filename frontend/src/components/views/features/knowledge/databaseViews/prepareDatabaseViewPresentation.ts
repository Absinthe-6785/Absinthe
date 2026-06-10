import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import type { DatabaseView } from './databaseViewModels';
import type { CalendarDateBucket } from './bucketNotesByDate';
import type { BoardLane } from './groupNotesByProperty';
import { prepareDatabaseBoardLanes } from './prepareDatabaseBoardLanes';
import { prepareDatabaseCalendarBuckets } from './prepareDatabaseCalendarBuckets';
import { prepareDatabaseTimelineItems } from './prepareDatabaseTimelineItems';
import type { TimelineItem } from './timelineModels';
import { prepareDatabaseViewRows } from './prepareDatabaseViewRows';
import { withPresentationDefaults } from './databasePresentationConfig';

export type DatabaseViewPresentationData =
  | { type: 'table'; notes: NoteBase[] }
  | { type: 'board'; lanes: BoardLane[] }
  | { type: 'calendar'; buckets: CalendarDateBucket[] }
  | { type: 'timeline'; items: TimelineItem[] };

/**
 * Unified post-filter presentation dispatch.
 * Query semantics unchanged — each branch applies its own transform.
 */
export function prepareDatabaseViewPresentation(
  view: DatabaseView,
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
): DatabaseViewPresentationData {
  const configured = withPresentationDefaults(view);
  const safeNotes = notes.filter(note => !note.deletedAt);

  switch (configured.presentation) {
    case 'board':
      return {
        type: 'board',
        lanes: prepareDatabaseBoardLanes(configured, safeNotes, service),
      };
    case 'calendar':
      return {
        type: 'calendar',
        buckets: prepareDatabaseCalendarBuckets(configured, safeNotes, service),
      };
    case 'timeline':
      return {
        type: 'timeline',
        items: prepareDatabaseTimelineItems(configured, safeNotes, service),
      };
    default:
      return {
        type: 'table',
        notes: prepareDatabaseViewRows(configured, safeNotes, service),
      };
  }
}
