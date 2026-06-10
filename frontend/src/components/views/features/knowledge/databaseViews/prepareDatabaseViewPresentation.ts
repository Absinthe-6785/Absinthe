import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import type { DatabaseView } from './databaseViewModels';
import type { DatabaseViewFilterOptions } from './resolveDatabaseViewQuery';
import type { CalendarDateBucket } from './bucketNotesByDate';
import type { BoardLane } from './groupNotesByProperty';
import { prepareDatabaseBoardLanes } from './prepareDatabaseBoardLanes';
import { prepareDatabaseCalendarBuckets } from './prepareDatabaseCalendarBuckets';
import { prepareDatabaseTimelineItems } from './prepareDatabaseTimelineItems';
import { prepareDatabaseGalleryItems } from './prepareDatabaseGalleryItems';
import type { TimelineItem } from './timelineModels';
import type { GalleryItem } from './galleryModels';
import { prepareDatabaseViewRows } from './prepareDatabaseViewRows';
import { withPresentationDefaults } from './databasePresentationConfig';

export type DatabaseViewPresentationData =
  | { type: 'table'; notes: NoteBase[] }
  | { type: 'board'; lanes: BoardLane[] }
  | { type: 'calendar'; buckets: CalendarDateBucket[] }
  | { type: 'timeline'; items: TimelineItem[] }
  | { type: 'gallery'; items: GalleryItem[] };

/**
 * Unified post-filter presentation dispatch.
 * Query semantics unchanged — each branch applies its own transform.
 */
export function prepareDatabaseViewPresentation(
  view: DatabaseView,
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  filterOptions: DatabaseViewFilterOptions = {},
): DatabaseViewPresentationData {
  const configured = withPresentationDefaults(view);
  const safeNotes = notes.filter(note => !note.deletedAt);

  switch (configured.presentation) {
    case 'board':
      return {
        type: 'board',
        lanes: prepareDatabaseBoardLanes(configured, safeNotes, service, filterOptions),
      };
    case 'calendar':
      return {
        type: 'calendar',
        buckets: prepareDatabaseCalendarBuckets(configured, safeNotes, service, filterOptions),
      };
    case 'timeline':
      return {
        type: 'timeline',
        items: prepareDatabaseTimelineItems(configured, safeNotes, service, filterOptions),
      };
    case 'gallery':
      return {
        type: 'gallery',
        items: prepareDatabaseGalleryItems(configured, safeNotes, service, filterOptions),
      };
    default:
      return {
        type: 'table',
        notes: prepareDatabaseViewRows(configured, safeNotes, service, filterOptions),
      };
  }
}
