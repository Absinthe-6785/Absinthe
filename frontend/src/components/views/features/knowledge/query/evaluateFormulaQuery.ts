import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import {
  computeFormulasForNote,
  createFormulaComputeMemo,
  getFormulaColumnValue,
  type FormulaComputeMemo,
} from '../formulas/computeFormulas';
import type { FormulaColumnDefinition } from '../formulas/formulaModels';
import { formulaColumnsForKeys } from '../formulas/formulaQueryCatalog';
import type { FormulaQueryClause, QueryClause } from './queryModels';

export function isFormulaQueryClause(clause: QueryClause): clause is FormulaQueryClause {
  return clause.type === 'formula';
}

function compareFormulaValue(
  actual: number,
  operator: FormulaQueryClause['operator'],
  expected: number,
): boolean {
  switch (operator) {
    case '>': return actual > expected;
    case '<': return actual < expected;
    case '>=': return actual >= expected;
    case '<=': return actual <= expected;
    case '=': return actual === expected;
    case '!=': return actual !== expected;
  }
}

function noteMatchesFormulaClauses(
  note: NoteBase,
  clauses: readonly FormulaQueryClause[],
  service: KnowledgeIndexService,
  notesById: ReadonlyMap<string, NoteBase>,
  formulaColumns: readonly FormulaColumnDefinition[],
  memo: FormulaComputeMemo,
  valuesCache: Map<string, ReturnType<typeof computeFormulasForNote>>,
): boolean {
  const neededColumns = formulaColumnsForKeys(
    formulaColumns,
    clauses.map(clause => clause.key),
  );

  for (const clause of clauses) {
    const columnKey = clause.key.trim().toLowerCase();
    const hasDefinition = formulaColumns.some(
      column => column.key.trim().toLowerCase() === columnKey,
    );
    if (!hasDefinition) return false;

    let values = valuesCache.get(note.id);
    if (!values) {
      values = computeFormulasForNote(note, neededColumns, service, notesById, memo);
      valuesCache.set(note.id, values);
    }

    const result = getFormulaColumnValue(clause.key, values);
    if (result.error || typeof result.raw !== 'number') {
      return false;
    }

    if (!compareFormulaValue(result.raw, clause.operator, clause.value)) {
      return false;
    }
  }

  return true;
}

/** Post-filter candidate notes using computed formula predicates */
export function filterNotesByFormulaClauses(
  notes: readonly NoteBase[],
  candidateIds: Set<string>,
  clauses: readonly FormulaQueryClause[],
  service: KnowledgeIndexService,
  formulaColumns: readonly FormulaColumnDefinition[],
): Set<string> {
  if (clauses.length === 0) return candidateIds;
  if (formulaColumns.length === 0) return new Set();

  const notesById = new Map(notes.map(note => [note.id, note]));
  const memo = createFormulaComputeMemo();
  const valuesCache = new Map<string, ReturnType<typeof computeFormulasForNote>>();
  const matched = new Set<string>();

  for (const noteId of candidateIds) {
    const note = notesById.get(noteId);
    if (!note) continue;
    if (noteMatchesFormulaClauses(
      note,
      clauses,
      service,
      notesById,
      formulaColumns,
      memo,
      valuesCache,
    )) {
      matched.add(noteId);
    }
  }

  return matched;
}
