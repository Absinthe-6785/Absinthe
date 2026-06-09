/**
 * Knowledge-15 — Rollup model types and normalization.
 */

export type RollupDirection = 'outgoing' | 'incoming';

export type RollupFunctionPhase1 =
  | 'count'
  | 'list'
  | 'latest'
  | 'sum'
  | 'first'
  | 'last';

export type RollupFunctionPhase2 =
  | 'average'
  | 'min'
  | 'max'
  | 'earliest';

export type RollupFunction = RollupFunctionPhase1 | RollupFunctionPhase2;

export const ROLLUP_FUNCTIONS_PHASE1: readonly RollupFunctionPhase1[] = [
  'count',
  'list',
  'latest',
  'sum',
  'first',
  'last',
];

export type RollupSortKey = 'updatedAt' | 'title' | string;

export interface RollupDefinition {
  relationKey: string;
  direction?: RollupDirection;
  function: RollupFunctionPhase1;
  targetField?: string;
  sortBy?: RollupSortKey;
  includeMissing?: boolean;
}

export interface RollupColumnDefinition {
  key: string;
  label?: string;
  visible: boolean;
  rollup: RollupDefinition;
}

export interface RollupValue {
  raw: number | string | readonly string[] | null;
  display: string;
  missingTargets?: number;
}

export interface RollupComputeInput {
  noteId: string;
  definition: RollupDefinition;
}

export function isRollupFunctionPhase1(value: string): value is RollupFunctionPhase1 {
  return (ROLLUP_FUNCTIONS_PHASE1 as readonly string[]).includes(value);
}

export function normalizeRollupDefinition(raw: unknown): RollupDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Partial<RollupDefinition>;
  const relationKey = typeof record.relationKey === 'string' ? record.relationKey.trim() : '';
  const fn = typeof record.function === 'string' ? record.function.trim() : '';
  if (!relationKey || !isRollupFunctionPhase1(fn)) return null;

  const direction = record.direction === 'outgoing' ? 'outgoing' : 'incoming';
  const definition: RollupDefinition = {
    relationKey,
    direction,
    function: fn,
  };

  if (typeof record.targetField === 'string' && record.targetField.trim()) {
    definition.targetField = record.targetField.trim();
  }
  if (typeof record.sortBy === 'string' && record.sortBy.trim()) {
    definition.sortBy = record.sortBy.trim();
  }
  if (record.includeMissing === true) {
    definition.includeMissing = true;
  }

  return definition;
}

export function normalizeRollupColumns(raw: unknown): RollupColumnDefinition[] {
  if (!Array.isArray(raw)) return [];

  const columns: RollupColumnDefinition[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Partial<RollupColumnDefinition>;
    const key = typeof record.key === 'string' ? record.key.trim() : '';
    if (!key || seen.has(key.toLowerCase())) continue;

    const rollup = normalizeRollupDefinition(record.rollup);
    if (!rollup) continue;

    seen.add(key.toLowerCase());
    columns.push({
      key,
      visible: record.visible !== false,
      rollup,
      ...(typeof record.label === 'string' && record.label.trim()
        ? { label: record.label.trim() }
        : {}),
    });
  }

  return columns;
}

export function rollupColumnLabel(column: RollupColumnDefinition): string {
  if (column.label?.trim()) return column.label.trim();
  const fn = column.rollup.function;
  const key = column.rollup.relationKey;
  switch (fn) {
    case 'count': return `${key} count`;
    case 'list': return `${key} list`;
    case 'sum': return `${key} sum`;
    case 'latest': return `Latest ${key}`;
    case 'first': return `First ${key}`;
    case 'last': return `Last ${key}`;
    default: return column.key;
  }
}

export function isRollupColumnDefinition(value: unknown): value is RollupColumnDefinition {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<RollupColumnDefinition>;
  return (
    typeof record.key === 'string'
    && record.key.trim().length > 0
    && typeof record.visible === 'boolean'
    && normalizeRollupDefinition(record.rollup) !== null
  );
}
