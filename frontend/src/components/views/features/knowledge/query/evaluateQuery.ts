import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { parseQuery } from './parseQuery';
import type { ParsedQuery, QueryClause, QueryEvaluation } from './queryModels';

function intersect(a: Set<string>, b: Set<string>): Set<string> {
  const next = new Set<string>();
  for (const id of a) {
    if (b.has(id)) next.add(id);
  }
  return next;
}

function evaluateClause(service: KnowledgeIndexService, clause: QueryClause): string[] {
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
  }
}

/** Evaluate parsed query against indexed metadata — O(clauses × result size) */
export function evaluateQuery(
  service: KnowledgeIndexService,
  parsed: ParsedQuery,
): Set<string> | null {
  if (parsed.error) return new Set();
  if (parsed.clauses.length === 0) return null;

  let result: Set<string> | null = null;

  for (const clause of parsed.clauses) {
    const ids = evaluateClause(service, clause);
    const bucket = new Set(ids);
    result = result === null ? bucket : intersect(result, bucket);
    if (result.size === 0) break;
  }

  return result ?? new Set();
}

/** Parse and evaluate a query string */
export function evaluateQueryString(
  service: KnowledgeIndexService,
  query: string,
): QueryEvaluation {
  const parsed = parseQuery(query);
  return {
    parsed,
    noteIds: evaluateQuery(service, parsed),
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
