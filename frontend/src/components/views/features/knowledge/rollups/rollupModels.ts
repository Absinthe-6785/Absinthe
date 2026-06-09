/**
 * Knowledge-15.0 — Forward-looking rollup model types.
 *
 * Documents recommended rollup architecture for K-15.5+ implementation.
 * Rollups are computed presentation values — not stored on notes.
 * No runtime behavior in K-15.0 — types only.
 */

/** Which relation edges participate in the aggregate */
export type RollupDirection = 'outgoing' | 'incoming';

/** Phase 1 rollup functions — K-15.5 */
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
  direction: RollupDirection;
  function: RollupFunction;
  /** Property key on linked notes — required for sum / latest / min / max / average */
  targetField?: string;
  /** Sort key for first / last / latest / earliest */
  sortBy?: RollupSortKey;
  /** Whether trashed/missing linked notes count toward aggregates */
  includeMissing?: boolean;
}

/** Table column binding for a rollup — K-15.5+ */
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

/** Input to rollup compute helper — K-15.5+ */
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

export function isRollupDefinition(value: unknown): value is RollupDefinition {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<RollupDefinition>;
  return (
    typeof record.relationKey === 'string'
    && record.relationKey.trim().length > 0
    && (record.direction === 'outgoing' || record.direction === 'incoming')
    && typeof record.function === 'string'
    && record.function.trim().length > 0
  );
}

export function isRollupColumnDefinition(value: unknown): value is RollupColumnDefinition {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<RollupColumnDefinition>;
  return (
    typeof record.key === 'string'
    && record.key.trim().length > 0
    && typeof record.visible === 'boolean'
    && isRollupDefinition(record.rollup)
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
