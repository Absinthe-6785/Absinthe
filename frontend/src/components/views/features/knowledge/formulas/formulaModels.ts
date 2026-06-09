/**
 * Knowledge-16.0 — Formula model types and dependency graph helpers.
 *
 * Formulas are computed presentation values — not stored on notes.
 * Architecture-only in K-16.0; evaluation lands in K-16.5+.
 */

import type { RollupDefinition } from '../rollups/rollupModels';

/** Expected result type for display and coercion policy */
export type FormulaReturnType = 'number' | 'string' | 'boolean' | 'date';

/** Built-in note metadata available as formula inputs */
export type FormulaMetadataKey = 'updatedAt' | 'createdAt' | 'title';

export interface FormulaFieldInput {
  type: 'field';
  key: string;
}

export interface FormulaRollupInput {
  type: 'rollup';
  definition: RollupDefinition;
}

export interface FormulaMetadataInput {
  type: 'metadata';
  key: FormulaMetadataKey;
}

/** Reference another formula column in the same database view */
export interface FormulaFormulaInput {
  type: 'formula';
  formulaKey: string;
}

export type FormulaInput =
  | FormulaFieldInput
  | FormulaRollupInput
  | FormulaMetadataInput
  | FormulaFormulaInput;

/**
 * Canonical formula definition — lives on DatabaseView presentationConfig,
 * not on NoteBase properties.
 */
export interface FormulaDefinition {
  id: string;
  expression: string;
  inputs: Record<string, FormulaInput>;
  returnType?: FormulaReturnType;
}

/** Table column binding for a formula — K-16.5+ */
export interface FormulaColumnDefinition {
  key: string;
  label?: string;
  visible: boolean;
  formula: FormulaDefinition;
}

export type FormulaValueRaw = number | string | boolean | null;

/** Computed formula result for display and future query filters */
export interface FormulaValue {
  raw: FormulaValueRaw;
  display: string;
  error?: FormulaErrorCode;
}

export type FormulaErrorCode =
  | 'missing_input'
  | 'missing_property'
  | 'missing_rollup'
  | 'division_by_zero'
  | 'invalid_expression'
  | 'type_mismatch'
  | 'cyclic_dependency'
  | 'unsupported_function';

export interface FormulaDependencyNode {
  id: string;
  dependsOn: readonly string[];
}

/** Dependency graph over formula columns in a database view */
export interface FormulaDependencyGraph {
  nodes: readonly FormulaDependencyNode[];
  /** Topologically sorted column keys when acyclic */
  evaluationOrder?: readonly string[];
  /** Cycle member groups when cyclic */
  cycles?: readonly string[][];
}

const METADATA_KEYS: readonly FormulaMetadataKey[] = ['updatedAt', 'createdAt', 'title'];

export function isFormulaFieldInput(value: unknown): value is FormulaFieldInput {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<FormulaFieldInput>;
  return record.type === 'field'
    && typeof record.key === 'string'
    && record.key.trim().length > 0;
}

export function isFormulaRollupInput(value: unknown): value is FormulaRollupInput {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<FormulaRollupInput>;
  return record.type === 'rollup'
    && !!record.definition
    && typeof record.definition === 'object';
}

export function isFormulaMetadataInput(value: unknown): value is FormulaMetadataInput {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<FormulaMetadataInput>;
  return record.type === 'metadata'
    && typeof record.key === 'string'
    && (METADATA_KEYS as readonly string[]).includes(record.key);
}

export function isFormulaFormulaInput(value: unknown): value is FormulaFormulaInput {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<FormulaFormulaInput>;
  return record.type === 'formula'
    && typeof record.formulaKey === 'string'
    && record.formulaKey.trim().length > 0;
}

export function isFormulaInput(value: unknown): value is FormulaInput {
  return (
    isFormulaFieldInput(value)
    || isFormulaRollupInput(value)
    || isFormulaMetadataInput(value)
    || isFormulaFormulaInput(value)
  );
}

export function isFormulaDefinition(value: unknown): value is FormulaDefinition {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<FormulaDefinition>;
  if (typeof record.id !== 'string' || !record.id.trim()) return false;
  if (typeof record.expression !== 'string' || !record.expression.trim()) return false;
  if (!record.inputs || typeof record.inputs !== 'object') return false;

  let inputCount = 0;
  for (const [name, input] of Object.entries(record.inputs)) {
    if (typeof name !== 'string' || !name.trim()) return false;
    if (!isFormulaInput(input)) return false;
    inputCount += 1;
  }
  if (inputCount === 0) return false;

  if (record.returnType !== undefined) {
    const allowed: readonly FormulaReturnType[] = ['number', 'string', 'boolean', 'date'];
    if (!(allowed as readonly string[]).includes(record.returnType)) return false;
  }

  return true;
}

/** Normalize persisted formula definition — structure validation only */
export function normalizeFormulaDefinition(raw: unknown): FormulaDefinition | null {
  if (!isFormulaDefinition(raw)) return null;
  const record = raw as FormulaDefinition;

  const inputs: Record<string, FormulaInput> = {};
  for (const [name, input] of Object.entries(record.inputs)) {
    const key = name.trim();
    if (!key) continue;
    inputs[key] = input;
  }

  if (Object.keys(inputs).length === 0) return null;

  const definition: FormulaDefinition = {
    id: record.id.trim(),
    expression: record.expression.trim(),
    inputs,
  };

  if (record.returnType) {
    definition.returnType = record.returnType;
  }

  return definition;
}

export function normalizeFormulaColumns(raw: unknown): FormulaColumnDefinition[] {
  if (!Array.isArray(raw)) return [];

  const columns: FormulaColumnDefinition[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Partial<FormulaColumnDefinition>;
    const key = typeof record.key === 'string' ? record.key.trim() : '';
    if (!key || seen.has(key.toLowerCase())) continue;

    const formula = normalizeFormulaDefinition(record.formula);
    if (!formula) continue;

    seen.add(key.toLowerCase());
    columns.push({
      key,
      visible: record.visible !== false,
      formula,
      ...(typeof record.label === 'string' && record.label.trim()
        ? { label: record.label.trim() }
        : {}),
    });
  }

  return columns;
}

export function formulaColumnLabel(column: FormulaColumnDefinition): string {
  if (column.label?.trim()) return column.label.trim();
  return column.key;
}

export function isFormulaColumnDefinition(value: unknown): value is FormulaColumnDefinition {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<FormulaColumnDefinition>;
  return (
    typeof record.key === 'string'
    && record.key.trim().length > 0
    && typeof record.visible === 'boolean'
    && normalizeFormulaDefinition(record.formula) !== null
  );
}

function formulaDependencies(definition: FormulaDefinition): string[] {
  const deps: string[] = [];
  for (const input of Object.values(definition.inputs)) {
    if (input.type === 'formula') {
      deps.push(input.formulaKey.trim().toLowerCase());
    }
  }
  return deps;
}

function detectCycles(
  nodes: Map<string, string[]>,
): string[][] {
  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function dfs(nodeId: string): void {
    if (visited.has(nodeId)) return;
    if (visiting.has(nodeId)) {
      const start = stack.indexOf(nodeId);
      if (start >= 0) {
        cycles.push(stack.slice(start));
      }
      return;
    }

    visiting.add(nodeId);
    stack.push(nodeId);

    for (const dep of nodes.get(nodeId) ?? []) {
      if (nodes.has(dep)) {
        dfs(dep);
      }
    }

    stack.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
  }

  for (const nodeId of nodes.keys()) {
    dfs(nodeId);
  }

  return cycles;
}

function topologicalOrder(nodes: Map<string, string[]>): string[] | undefined {
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const id of nodes.keys()) {
    inDegree.set(id, 0);
    dependents.set(id, []);
  }

  for (const [nodeId, deps] of nodes) {
    let count = 0;
    for (const dep of deps) {
      if (!nodes.has(dep)) continue;
      count += 1;
      dependents.get(dep)!.push(nodeId);
    }
    inDegree.set(nodeId, count);
  }

  const queue = [...nodes.keys()].filter(id => inDegree.get(id) === 0);
  const order: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    for (const dependent of dependents.get(current) ?? []) {
      const next = inDegree.get(dependent)! - 1;
      inDegree.set(dependent, next);
      if (next === 0) {
        queue.push(dependent);
      }
    }
  }

  return order.length === nodes.size ? order : undefined;
}

/** Build dependency graph from formula columns — no evaluation */
export function buildFormulaDependencyGraph(
  columns: readonly FormulaColumnDefinition[],
): FormulaDependencyGraph {
  const adjacency = new Map<string, string[]>();
  const nodeList: FormulaDependencyNode[] = [];

  for (const column of columns) {
    const id = column.key.trim().toLowerCase();
    const dependsOn = formulaDependencies(column.formula);
    adjacency.set(id, dependsOn);
    nodeList.push({ id, dependsOn });
  }

  const cycles = detectCycles(adjacency);
  const evaluationOrder = cycles.length === 0 ? topologicalOrder(adjacency) : undefined;

  return {
    nodes: nodeList,
    ...(evaluationOrder ? { evaluationOrder } : {}),
    ...(cycles.length > 0 ? { cycles } : {}),
  };
}
