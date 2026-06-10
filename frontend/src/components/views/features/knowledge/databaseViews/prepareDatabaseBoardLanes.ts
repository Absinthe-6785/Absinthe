import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { filterByDatabaseView } from './filterByDatabaseView';
import type { DatabaseViewFilterOptions } from './resolveDatabaseViewQuery';
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
  filterOptions: DatabaseViewFilterOptions = {},
): BoardLane[] {
  const configured = withPresentationDefaults(view);
  const boardConfig = getBoardConfig(configured);
  const filtered = filterByDatabaseView(
    notes.filter(note => !note.deletedAt),
    service,
    configured,
    filterOptions,
  ).notes;
  return groupNotesByProperty(
    filtered,
    boardConfig.groupBy,
    service,
    boardConfig.lanes,
  );
}

export type { BoardLane };
