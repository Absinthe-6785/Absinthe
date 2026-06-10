import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import type { FormulaColumnDefinition } from '../formulas/formulaModels';
import { filterNotesByPostFilterClauses } from './evaluateCompareQuery';
import { splitQueryClauses } from './evaluateCompareQuery';
import { filterNotesByFormulaClauses } from './evaluateFormulaQuery';
import { parseQuery } from './parseQuery';
import type { ParsedQuery, QueryClause, QueryEvaluation } from './queryModels';

export interface QueryEvaluationContext {
  notes?: readonly NoteBase[];
  formulaColumns?: readonly FormulaColumnDefinition[];
}

function intersect(a: Set<string>, b: Set<string>): Set<string> {
  const next = new Set<string>();
  for (const id of a) {
    if (b.has(id)) next.add(id);
  }
  return next;
}

function evaluateIndexedClause(service: KnowledgeIndexService, clause: QueryClause): string[] {
  switch (clause.type) {
    case 'tag':
      return service.getNotesWithTag(clause.value);
    case 'property':
      return service.getNotesWithProperty(clause.key, clause.value);
    case 'hasRelation':
      return service.getNotesWithOutgoingRelation(clause.propertyKey);
    case 'linkedTo':
      return service.getNotesLinkedTo(clause.title);
    case 'relation':
      return service.getNotesWithRelationToTitle(clause.propertyKey, clause.title);
    case 'formula':
      return [];
  }
}

function evaluateIndexedClauses(
  service: KnowledgeIndexService,
  clauses: readonly QueryClause[],
): Set<string> | null {
  if (clauses.length === 0) return null;

  let result: Set<string> | null = null;

  for (const clause of clauses) {
    const ids = evaluateIndexedClause(service, clause);
    const bucket = new Set(ids);
    result = result === null ? bucket : intersect(result, bucket);
    if (result.size === 0) break;
  }

  return result ?? new Set();
}

/** Evaluate parsed query — indexed clauses via KIS, formula clauses via post-filter */
export function evaluateQuery(
  service: KnowledgeIndexService,
  parsed: ParsedQuery,
  context: QueryEvaluationContext = {},
): Set<string> | null {
  if (parsed.error) return new Set();
  if (parsed.clauses.length === 0) return null;

  const { indexed, formula, postFilter } = splitQueryClauses(parsed.clauses);
  const indexedResult = evaluateIndexedClauses(service, indexed);

  const notes = context.notes;
  const needsPostFilter = formula.length > 0 || postFilter.length > 0;
  if (!needsPostFilter) {
    return indexedResult;
  }

  if (!notes || notes.length === 0) {
    return new Set();
  }

  let candidateIds = indexedResult ?? new Set(notes.map(note => note.id));
  if (candidateIds.size === 0) {
    return new Set();
  }

  if (postFilter.length > 0) {
    candidateIds = filterNotesByPostFilterClauses(notes, candidateIds, postFilter, service);
    if (candidateIds.size === 0) {
      return new Set();
    }
  }

  if (formula.length === 0) {
    return candidateIds;
  }

  const formulaColumns = context.formulaColumns ?? [];
  return filterNotesByFormulaClauses(
    notes,
    candidateIds,
    formula,
    service,
    formulaColumns,
  );
}

/** Parse and evaluate a query string */
export function evaluateQueryString(
  service: KnowledgeIndexService,
  query: string,
  context: QueryEvaluationContext = {},
): QueryEvaluation {
  const parsed = parseQuery(query);
  return {
    parsed,
    noteIds: evaluateQuery(service, parsed, context),
  };
}

/** Case-insensitive property match helper for tests */
export function noteMatchesPropertyClause(
  service: KnowledgeIndexService,
  noteId: string,
  key: string,
  value: string,
): boolean {
  return service.getNotesWithProperty(key, value).includes(noteId);
}
