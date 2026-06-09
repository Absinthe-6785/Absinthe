import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { filterNotes } from '../query/filterNotes';
import type { RuleCollection } from './ruleCollectionModels';

/** Evaluate a rule collection against indexed metadata via the query engine */
export function evaluateRuleCollection(
  collection: RuleCollection,
  service: KnowledgeIndexService,
  notes: readonly NoteBase[],
): string[] {
  return filterNotes(
    notes.filter(note => !note.deletedAt),
    service,
    collection.query,
  ).notes.map(note => note.id);
}
