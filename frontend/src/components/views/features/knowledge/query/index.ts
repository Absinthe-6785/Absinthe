export { evaluateQuery, evaluateQueryString, noteMatchesPropertyClause, type QueryEvaluationContext } from './evaluateQuery';
export {
  filterNotesByPostFilterClauses,
  isMetadataQueryClause,
  isPostFilterQueryClause,
  isPropertyCompareQueryClause,
  splitQueryClauses,
} from './evaluateCompareQuery';
export { filterNotesByFormulaClauses, isFormulaQueryClause } from './evaluateFormulaQuery';
export { filterNotes, type FilterNotesOptions, type FilterNotesResult } from './filterNotes';
export {
  formatParsedQuery,
  hasKnowledgeQuerySyntax,
  isKnowledgeQuery,
  normalizeQueryValue,
  parseQuery,
  tokenizeQuery,
} from './parseQuery';
export type { ParsedQuery, QueryClause, QueryEvaluation, FormulaQueryClause, FormulaQueryOperator } from './queryModels';
export {
  compileFilterConditionToClause,
  compileVisualFilterToParsedQuery,
  compileVisualFilterToQueryString,
  compileVisualFilters,
  getVisualFilterConditions,
  isFilterCondition,
  isFilterGroup,
  isVisualFilterModel,
  mergeQueryWithVisualFilter,
  normalizeVisualFilterModel,
  visualFilterFromConditions,
  type FilterComparisonOperator,
  type FilterCondition,
  type FilterFieldKind,
  type FilterGroup,
  type VisualFilterModel,
} from './visualFilterModels';
