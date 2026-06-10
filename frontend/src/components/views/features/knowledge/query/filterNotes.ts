import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import type { FormulaColumnDefinition } from '../formulas/formulaModels';
import { evaluateQuery, type QueryEvaluationContext } from './evaluateQuery';
import { hasKnowledgeQuerySyntax, isKnowledgeQuery, parseQuery } from './parseQuery';
import type { ParsedQuery } from './queryModels';

export interface FilterNotesOptions {
  formulaColumns?: readonly FormulaColumnDefinition[];
}

export interface FilterNotesResult {
  notes: NoteBase[];
  parsed: ParsedQuery;
  matchedIds: Set<string> | null;
  usedKnowledgeQuery: boolean;
}

/** Filter notes using indexed metadata and optional formula post-filter */
export function filterNotes(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  query: string,
  options: FilterNotesOptions = {},
): FilterNotesResult {
  const trimmed = query.trim();
  const parsed = parseQuery(trimmed);

  if (!trimmed) {
    return { notes: [...notes], parsed, matchedIds: null, usedKnowledgeQuery: false };
  }

  if (!hasKnowledgeQuerySyntax(trimmed)) {
    return { notes: [...notes], parsed, matchedIds: null, usedKnowledgeQuery: false };
  }

  if (!isKnowledgeQuery(trimmed)) {
    return { notes: [], parsed, matchedIds: new Set(), usedKnowledgeQuery: true };
  }

  if (parsed.error) {
    return { notes: [], parsed, matchedIds: new Set(), usedKnowledgeQuery: true };
  }

  const context: QueryEvaluationContext = {
    notes,
    formulaColumns: options.formulaColumns ?? [],
  };

  const matchedIds = evaluateQuery(service, parsed, context);
  if (!matchedIds) {
    return { notes: [...notes], parsed, matchedIds: null, usedKnowledgeQuery: true };
  }

  const filtered = notes.filter(note => matchedIds.has(note.id));
  return { notes: filtered, parsed, matchedIds, usedKnowledgeQuery: true };
}
