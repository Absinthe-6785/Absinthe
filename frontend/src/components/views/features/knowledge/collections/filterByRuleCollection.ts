import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { filterNotes, type FilterNotesResult } from '../query/filterNotes';
import type { RuleCollection } from './ruleCollectionModels';

/**
 * Filter notes by a rule collection using the existing query engine.
 * Flow: collection.query → parseQuery → evaluateQuery → filterNotes
 */
export function filterByRuleCollection(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  collection: RuleCollection,
): FilterNotesResult {
  return filterNotes(notes, service, collection.query);
}
