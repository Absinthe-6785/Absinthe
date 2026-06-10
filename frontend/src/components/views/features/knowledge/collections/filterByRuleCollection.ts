import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import type { FormulaColumnDefinition } from '../formulas/formulaModels';
import { filterNotes, type FilterNotesOptions, type FilterNotesResult } from '../query/filterNotes';
import type { RuleCollection } from './ruleCollectionModels';

/**
 * Filter notes by a rule collection using the query engine.
 * Flow: collection.query → parseQuery → evaluateQuery → formula post-filter → filterNotes
 */
export function filterByRuleCollection(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  collection: RuleCollection,
  options: FilterNotesOptions = {},
): FilterNotesResult {
  return filterNotes(notes, service, collection.query, options);
}
