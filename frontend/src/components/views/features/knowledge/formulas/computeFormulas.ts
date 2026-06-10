import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { computeFormula } from './computeFormula';
import {
  buildFormulaDependencyGraph,
  type FormulaColumnDefinition,
  type FormulaValue,
} from './formulaModels';

function collectCyclicKeys(cycles: readonly string[][] | undefined): Set<string> {
  const keys = new Set<string>();
  if (!cycles) return keys;
  for (const cycle of cycles) {
    for (const key of cycle) {
      keys.add(key);
    }
  }
  return keys;
}

function formulaDependencySignature(
  column: FormulaColumnDefinition,
  values: ReadonlyMap<string, FormulaValue>,
): string {
  const parts: string[] = [];
  for (const [name, input] of Object.entries(column.formula.inputs)) {
    switch (input.type) {
      case 'field':
        parts.push(`${name}:field:${input.key}`);
        break;
      case 'rollup':
        parts.push(`${name}:rollup:${input.definition.relationKey}:${input.definition.function}:${input.definition.targetField ?? ''}`);
        break;
      case 'metadata':
        parts.push(`${name}:meta:${input.key}`);
        break;
      case 'formula': {
        const ref = values.get(input.formulaKey.trim().toLowerCase());
        parts.push(`${name}:formula:${input.formulaKey}:${ref?.raw ?? 'null'}:${ref?.error ?? ''}`);
        break;
      }
      default:
        parts.push(`${name}:unknown`);
    }
  }
  return parts.join('|');
}

/** Per-render memo cache for formula evaluation */
export type FormulaComputeMemo = Map<string, FormulaValue>;

export function createFormulaComputeMemo(): FormulaComputeMemo {
  return new Map();
}

export function formulaMemoKey(
  noteId: string,
  columnKey: string,
  signature: string,
): string {
  return `${noteId}\0${columnKey.toLowerCase()}\0${signature}`;
}

/** Evaluate all formula columns for one row in dependency order */
export function computeFormulasForNote(
  note: NoteBase,
  columns: readonly FormulaColumnDefinition[],
  service: KnowledgeIndexService,
  notesById: ReadonlyMap<string, NoteBase>,
  memo?: FormulaComputeMemo,
): Map<string, FormulaValue> {
  const results = new Map<string, FormulaValue>();
  if (columns.length === 0) return results;

  const graph = buildFormulaDependencyGraph(columns);
  const cyclicKeys = collectCyclicKeys(graph.cycles);
  const columnByKey = new Map(
    columns.map(column => [column.key.trim().toLowerCase(), column]),
  );
  const order = graph.evaluationOrder ?? columns.map(column => column.key.trim().toLowerCase());

  for (const key of order) {
    const column = columnByKey.get(key);
    if (!column) continue;

    if (cyclicKeys.has(key)) {
      const cyclicValue: FormulaValue = { raw: null, display: '—', error: 'cyclic_dependency' };
      results.set(key, cyclicValue);
      continue;
    }

    const signature = formulaDependencySignature(column, results);
    const cacheKey = formulaMemoKey(note.id, key, signature);
    if (memo?.has(cacheKey)) {
      results.set(key, memo.get(cacheKey)!);
      continue;
    }

    const value = computeFormula(note, column.formula, {
      note,
      service,
      notesById,
      formulaValues: results,
      cyclicKeys,
    });

    results.set(key, value);
    memo?.set(cacheKey, value);
  }

  for (const column of columns) {
    const key = column.key.trim().toLowerCase();
    if (results.has(key)) continue;
    if (cyclicKeys.has(key)) {
      results.set(key, { raw: null, display: '—', error: 'cyclic_dependency' });
    }
  }

  return results;
}

/** Resolve one formula column value from a batch evaluation map */
export function getFormulaColumnValue(
  columnKey: string,
  values: ReadonlyMap<string, FormulaValue>,
): FormulaValue {
  return values.get(columnKey.trim().toLowerCase()) ?? {
    raw: null,
    display: '—',
    error: 'missing_input',
  };
}
