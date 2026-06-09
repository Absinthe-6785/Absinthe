import { describe, it, expect } from 'vitest';
import {
  buildFormulaDependencyGraph,
  isFormulaColumnDefinition,
  isFormulaDefinition,
  isFormulaInput,
  normalizeFormulaDefinition,
  type FormulaColumnDefinition,
  type FormulaDefinition,
} from './formulaModels';

describe('formulaModels', () => {
  it('narrows valid formula definitions', () => {
    const definition: FormulaDefinition = {
      id: 'completion-rate',
      expression: 'completed / total',
      inputs: {
        completed: { type: 'rollup', definition: { relationKey: 'course', function: 'count' } },
        total: { type: 'rollup', definition: { relationKey: 'course', function: 'count' } },
      },
      returnType: 'number',
    };
    expect(isFormulaDefinition(definition)).toBe(true);
    expect(isFormulaDefinition({ id: 'x', expression: 'a', inputs: {} })).toBe(false);
  });

  it('narrows valid formula inputs', () => {
    expect(isFormulaInput({ type: 'field', key: 'priority' })).toBe(true);
    expect(isFormulaInput({ type: 'metadata', key: 'updatedAt' })).toBe(true);
    expect(isFormulaInput({ type: 'formula', formulaKey: 'progress' })).toBe(true);
    expect(isFormulaInput({ type: 'field', key: '' })).toBe(false);
  });

  it('normalizes formula definitions', () => {
    const normalized = normalizeFormulaDefinition({
      id: ' progress ',
      expression: ' completed / total ',
      inputs: {
        completed: { type: 'field', key: 'done' },
        total: { type: 'field', key: 'all' },
      },
    });
    expect(normalized).toEqual({
      id: 'progress',
      expression: 'completed / total',
      inputs: {
        completed: { type: 'field', key: 'done' },
        total: { type: 'field', key: 'all' },
      },
    });
  });

  it('narrows valid formula column definitions', () => {
    const column: FormulaColumnDefinition = {
      key: 'completionRate',
      label: 'Completion %',
      visible: true,
      formula: {
        id: 'completion-rate',
        expression: 'completed / total',
        inputs: {
          completed: { type: 'field', key: 'completed' },
          total: { type: 'field', key: 'total' },
        },
      },
    };
    expect(isFormulaColumnDefinition(column)).toBe(true);
    expect(isFormulaColumnDefinition({ key: 'x', visible: true, formula: {} })).toBe(false);
  });

  it('builds acyclic dependency graph with evaluation order', () => {
    const columns: FormulaColumnDefinition[] = [
      {
        key: 'progress',
        visible: true,
        formula: {
          id: 'progress',
          expression: 'completed / total',
          inputs: {
            completed: { type: 'field', key: 'completed' },
            total: { type: 'field', key: 'total' },
          },
        },
      },
      {
        key: 'weightedProgress',
        visible: true,
        formula: {
          id: 'weighted',
          expression: 'progress * 1.5',
          inputs: {
            progress: { type: 'formula', formulaKey: 'progress' },
          },
        },
      },
    ];

    const graph = buildFormulaDependencyGraph(columns);
    expect(graph.cycles).toBeUndefined();
    expect(graph.evaluationOrder).toEqual(['progress', 'weightedprogress']);
  });

  it('detects cyclic formula dependencies', () => {
    const columns: FormulaColumnDefinition[] = [
      {
        key: 'a',
        visible: true,
        formula: {
          id: 'a',
          expression: 'b + 1',
          inputs: { b: { type: 'formula', formulaKey: 'b' } },
        },
      },
      {
        key: 'b',
        visible: true,
        formula: {
          id: 'b',
          expression: 'a + 1',
          inputs: { a: { type: 'formula', formulaKey: 'a' } },
        },
      },
    ];

    const graph = buildFormulaDependencyGraph(columns);
    expect(graph.evaluationOrder).toBeUndefined();
    expect(graph.cycles?.length).toBeGreaterThan(0);
  });
});
