/**
 * Knowledge-12.0 — Forward-looking relation model types.
 *
 * Documents the recommended Option C (Hybrid) model for K-12.5+ implementation.
 * Relations are first-class indexed edges with property-key typing.
 * No runtime behavior in K-12.0 — types only.
 */

/** Normalized relation edge stored in the knowledge index */
export interface RelationEdge {
  sourceId: string;
  targetId: string;
  /** Property key defining relation semantics, e.g. "course", "project" */
  propertyKey: string;
}

/** Relation record persisted on a note (authoring shape) */
export interface RelationRecord {
  propertyKey: string;
  targetId: string;
}

/** Authoring input before title → id resolution */
export interface RelationAuthoringInput {
  propertyKey: string;
  targetId?: string;
  targetTitle?: string;
}

/** Proposed query clause shapes — K-13+ */
export type RelationQueryClause =
  | { type: 'relation'; key: string; target: string }
  | { type: 'hasRelation'; key: string }
  | { type: 'linkedTo'; target: string };

/** Graph extension — K-14+ */
export type ExplicitGraphRelationshipType = 'relation';

/** Rollup config placeholder — K-15+ */
export type RelationRollupAggregate = 'count' | 'latest' | 'sum' | 'list';

export interface RelationRollupConfig {
  relationKey: string;
  aggregate: RelationRollupAggregate;
  /** Property on linked notes — for sum/latest aggregates */
  field?: string;
}

export function isRelationEdge(value: unknown): value is RelationEdge {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<RelationEdge>;
  return (
    typeof record.sourceId === 'string'
    && typeof record.targetId === 'string'
    && typeof record.propertyKey === 'string'
    && record.propertyKey.trim().length > 0
  );
}

export function isRelationRecord(value: unknown): value is RelationRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<RelationRecord>;
  return (
    typeof record.propertyKey === 'string'
    && record.propertyKey.trim().length > 0
    && typeof record.targetId === 'string'
    && record.targetId.trim().length > 0
  );
}
