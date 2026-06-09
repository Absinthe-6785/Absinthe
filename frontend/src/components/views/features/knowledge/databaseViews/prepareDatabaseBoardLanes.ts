import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { filterByDatabaseView } from './filterByDatabaseView';
import { getBoardConfig, withPresentationDefaults } from './databasePresentationConfig';
import { groupNotesByProperty, type BoardLane } from './groupNotesByProperty';
import type { DatabaseView } from './databaseViewModels';

/**
 * Full database view board pipeline: filter via query engine, then group by property.
 * Query semantics are unchanged — grouping is post-filter only.
 */
export function prepareDatabaseBoardLanes(
  view: DatabaseView,
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
): BoardLane[] {
  const configured = withPresentationDefaults(view);
  const boardConfig = getBoardConfig(configured);
  const filtered = filterByDatabaseView(
    notes.filter(note => !note.deletedAt),
    service,
    configured,
  ).notes;
  return groupNotesByProperty(
    filtered,
    boardConfig.groupBy,
    service,
    boardConfig.lanes,
  );
}

export type { BoardLane };
