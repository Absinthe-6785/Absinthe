export { evaluateQuery, evaluateQueryString, noteMatchesPropertyClause } from './evaluateQuery';
export { filterNotes, type FilterNotesResult } from './filterNotes';
export {
  formatParsedQuery,
  hasKnowledgeQuerySyntax,
  isKnowledgeQuery,
  normalizeQueryValue,
  parseQuery,
  tokenizeQuery,
} from './parseQuery';
export type { ParsedQuery, QueryClause, QueryEvaluation } from './queryModels';
