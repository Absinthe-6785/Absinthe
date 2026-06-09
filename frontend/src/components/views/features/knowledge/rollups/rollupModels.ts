/**
 * Knowledge-15.0 / K-15 — Rollup model types, normalization, and formula stubs.
 *
 * Rollups are computed presentation values — not stored on notes.
 * K-15.0 documents forward-looking types; K-15 adds runtime normalization.
 */

/** Which relation edges participate in the aggregate */
export type RollupDirection = 'outgoing' | 'incoming';

/** Phase 1 rollup functions — K-15 */
export type RollupFunctionPhase1 =
  | 'count'
  | 'list'
  | 'latest'
  | 'sum'
  | 'first'
  | 'last';

/** Phase 2 rollup functions */
export type RollupFunctionPhase2 =
  | 'average'
  | 'min'
  | 'max'
  | 'earliest';

/** Full rollup function union — implementation gated by phase */
export type RollupFunction = RollupFunctionPhase1 | RollupFunctionPhase2;

export const ROLLUP_FUNCTIONS_PHASE1: readonly RollupFunctionPhase1[] = [
  'count',
  'list',
  'latest',
  'sum',
  'first',
  'last',
];

/** Sort key for ordered pick functions (first / last / latest / earliest) */
export type RollupSortKey = 'updatedAt' | 'title' | string;

/**
 * Canonical rollup definition — lives on DatabaseView presentationConfig,
 * not on NoteBase properties.
 */
export interface RollupDefinition {
  /** Relation property key, e.g. "course", "lecture" */
  relationKey: string;
  /** outgoing: targets on this note; incoming: sources pointing to this note */
  direction?: RollupDirection;
  function: RollupFunction;
  /** Property key on linked notes — required for sum / latest / min / max / average */
  targetField?: string;
  /** Sort key for first / last / latest / earliest */
  sortBy?: RollupSortKey;
  /** Whether trashed/missing linked notes count toward aggregates */
  includeMissing?: boolean;
}

/** Table column binding for a rollup — K-15 */
export interface RollupColumnDefinition {
  key: string;
  label?: string;
  visible: boolean;
  rollup: RollupDefinition;
}

/** Computed rollup result for display and formula inputs */
export interface RollupValue {
  raw: number | string | readonly string[] | null;
  display: string;
  /** Linked targets absent from active index (deleted/trashed) */
  missingTargets?: number;
}

/** Input to rollup compute helper — K-15 */
export interface RollupComputeInput {
  noteId: string;
  definition: RollupDefinition;
}

/** Future formula input referencing a rollup — K-16+ */
export interface FormulaRollupInput {
  type: 'rollup';
  definition: RollupDefinition;
}

/** Future formula input referencing a field — K-16+ */
export interface FormulaFieldInput {
  type: 'field';
  key: string;
}

export type FormulaInput = FormulaFieldInput | FormulaRollupInput;

/** Future formula column definition — K-16+ */
export interface FormulaDefinition {
  id: string;
  expression: string;
  inputs: Record<string, FormulaInput>;
}

/** @deprecated Use RollupDefinition — retained for K-12.0 compatibility */
export type RelationRollupAggregate = 'count' | 'latest' | 'sum' | 'list';

/** @deprecated Use RollupDefinition — retained for K-12.0 compatibility */
export interface RelationRollupConfig {
  relationKey: string;
  aggregate: RelationRollupAggregate;
  field?: string;
}

export function isRollupFunctionPhase1(value: string): value is RollupFunctionPhase1 {
  return (ROLLUP_FUNCTIONS_PHASE1 as readonly string[]).includes(value);
}

export function isRollupDefinition(value: unknown): value is RollupDefinition {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<RollupDefinition>;
  const direction = record.direction;
  return (
    typeof record.relationKey === 'string'
    && record.relationKey.trim().length > 0
    && (direction === undefined || direction === 'outgoing' || direction === 'incoming')
    && typeof record.function === 'string'
    && record.function.trim().length > 0
  );
}

/** Normalize persisted rollup definition — Phase 1 functions only */
export function normalizeRollupDefinition(raw: unknown): RollupDefinition | null {
  if (!isRollupDefinition(raw)) return null;
  const record = raw as RollupDefinition;
  const fn = record.function.trim();
  if (!isRollupFunctionPhase1(fn)) return null;

  const direction = record.direction === 'outgoing' ? 'outgoing' : 'incoming';
  const definition: RollupDefinition = {
    relationKey: record.relationKey.trim(),
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

/** Map legacy RelationRollupConfig to canonical RollupDefinition */
export function rollupDefinitionFromLegacy(config: RelationRollupConfig): RollupDefinition {
  const fn = config.aggregate === 'list' ? 'list' : config.aggregate;
  return {
    relationKey: config.relationKey,
    direction: 'incoming',
    function: fn,
    targetField: config.field,
  };
}
