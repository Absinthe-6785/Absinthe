/** View-model types for knowledge queries — AND semantics only */

export type FormulaQueryOperator = '>' | '<' | '>=' | '<=' | '=' | '!=';

export type QueryClause =
  | { type: 'tag'; value: string }
  | { type: 'property'; key: string; value: string }
  | { type: 'hasRelation'; propertyKey: string }
  | { type: 'linkedTo'; title: string }
  | { type: 'relation'; propertyKey: string; title: string }
  | { type: 'formula'; key: string; operator: FormulaQueryOperator; value: number };

export type FormulaQueryClause = Extract<QueryClause, { type: 'formula' }>;

export interface ParsedQuery {
  clauses: QueryClause[];
  error?: string;
}

export interface QueryEvaluation {
  noteIds: Set<string> | null;
  parsed: ParsedQuery;
}
