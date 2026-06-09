/** View-model types for knowledge queries — AND semantics only */

export type QueryClause =
  | { type: 'tag'; value: string }
  | { type: 'property'; key: string; value: string };

export interface ParsedQuery {
  clauses: QueryClause[];
  error?: string;
}

export interface QueryEvaluation {
  noteIds: Set<string> | null;
  parsed: ParsedQuery;
}
