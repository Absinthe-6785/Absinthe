/**
 * Knowledge-18.0 — Visual filter architecture types (authoring model only).
 *
 * Compiles to existing QueryClause / query strings. No runtime evaluation here —
 * filterNotes remains the single evaluation path when wired in K-18+.
 */

import type { FormulaQueryOperator, ParsedQuery, QueryClause } from './queryModels';
import { formatParsedQuery } from './parseQuery';

/** Visual filter field kinds — maps 1:1 to QueryClause variants (AND-only) */
export type FilterFieldKind =
  | 'tag'
  | 'property'
  | 'formula'
  | 'metadata'
  | 'hasRelation'
  | 'linkedTo'
  | 'relation';

export type FilterComparisonOperator = FormulaQueryOperator | '=' | '!=';

/** Single visual filter row — not persisted until compiled to query string */
export interface FilterCondition {
  kind: FilterFieldKind;
  /** Property key, formula column key, or relation property key */
  field?: string;
  operator?: FilterComparisonOperator;
  /** Tag name, property value, relation title, or numeric formula threshold */
  value: string | number;
}

/** AND group of conditions — matches current query engine semantics */
export interface FilterGroup {
  logic: 'and';
  conditions: FilterCondition[];
}

/** Root visual filter document — groups are ANDed (flat AND today) */
export interface VisualFilterModel {
  groups: FilterGroup[];
}

const FORMULA_OPERATORS: readonly FormulaQueryOperator[] = ['>', '<', '>=', '<=', '=', '!='];

export function isFilterFieldKind(value: unknown): value is FilterFieldKind {
  return value === 'tag'
    || value === 'property'
    || value === 'formula'
    || value === 'metadata'
    || value === 'hasRelation'
    || value === 'linkedTo'
    || value === 'relation';
}

export function isFilterCondition(value: unknown): value is FilterCondition {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<FilterCondition>;
  if (!isFilterFieldKind(record.kind)) return false;
  if (record.value === undefined || record.value === null) return false;
  if (typeof record.value === 'number' && !Number.isFinite(record.value)) return false;
  if (typeof record.value === 'string' && !record.value.trim()) return false;
  return true;
}

export function isFilterGroup(value: unknown): value is FilterGroup {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<FilterGroup>;
  if (record.logic !== 'and') return false;
  if (!Array.isArray(record.conditions)) return false;
  return record.conditions.every(isFilterCondition);
}

export function isVisualFilterModel(value: unknown): value is VisualFilterModel {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<VisualFilterModel>;
  if (!Array.isArray(record.groups)) return false;
  return record.groups.every(isFilterGroup);
}

/** Normalize a visual filter model — drops invalid rows, defaults logic to AND */
export function normalizeVisualFilterModel(raw: unknown): VisualFilterModel | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Partial<VisualFilterModel>;
  if (!Array.isArray(record.groups)) return null;

  const groups: FilterGroup[] = [];
  for (const groupRaw of record.groups) {
    if (!groupRaw || typeof groupRaw !== 'object') continue;
    const groupRecord = groupRaw as Partial<FilterGroup>;
    if (!Array.isArray(groupRecord.conditions)) continue;

    const conditions: FilterCondition[] = [];
    for (const conditionRaw of groupRecord.conditions) {
      if (!isFilterCondition(conditionRaw)) continue;
      const field = typeof conditionRaw.field === 'string' ? conditionRaw.field.trim() : '';
      if (
        conditionRaw.kind !== 'tag'
        && conditionRaw.kind !== 'linkedTo'
        && conditionRaw.kind !== 'hasRelation'
        && !field
      ) {
        continue;
      }

      if (conditionRaw.kind === 'formula') {
        const operator = conditionRaw.operator;
        if (!operator || !(FORMULA_OPERATORS as readonly string[]).includes(operator)) continue;
        const numeric = typeof conditionRaw.value === 'number'
          ? conditionRaw.value
          : Number(String(conditionRaw.value).trim());
        if (!Number.isFinite(numeric)) continue;
        conditions.push({
          kind: 'formula',
          field,
          operator,
          value: numeric,
        });
        continue;
      }

      if (conditionRaw.kind === 'metadata') {
        const operator = conditionRaw.operator;
        if (!operator || !(FORMULA_OPERATORS as readonly string[]).includes(operator)) continue;
        const value = typeof conditionRaw.value === 'number'
          ? String(conditionRaw.value)
          : String(conditionRaw.value).trim();
        if (!field || !value) continue;
        conditions.push({
          kind: 'metadata',
          field,
          operator,
          value,
        });
        continue;
      }

      const value = typeof conditionRaw.value === 'number'
        ? conditionRaw.value
        : String(conditionRaw.value).trim();
      if (!value && conditionRaw.kind !== 'hasRelation') continue;

      conditions.push({
        kind: conditionRaw.kind,
        ...(field ? { field } : {}),
        ...(conditionRaw.operator ? { operator: conditionRaw.operator } : {}),
        value,
      });
    }

    if (conditions.length > 0) {
      groups.push({ logic: 'and', conditions });
    }
  }

  return groups.length > 0 ? { groups } : null;
}

/** Compile one visual row to an existing query clause — null when invalid */
export function compileFilterConditionToClause(condition: FilterCondition): QueryClause | null {
  switch (condition.kind) {
    case 'tag': {
      const value = String(condition.value).trim();
      return value ? { type: 'tag', value } : null;
    }
    case 'property': {
      const key = condition.field?.trim();
      const value = String(condition.value).trim();
      if (!key || !value) return null;
      const operator = condition.operator ?? '=';
      if (operator === '=') {
        return { type: 'property', key, value };
      }
      return { type: 'propertyCompare', key, operator, value };
    }
    case 'metadata': {
      const key = condition.field?.trim();
      const operator = condition.operator;
      const value = String(condition.value).trim();
      if (!key || !operator || !(FORMULA_OPERATORS as readonly string[]).includes(operator)) {
        return null;
      }
      if (!value) return null;
      return { type: 'metadata', key, operator, value };
    }
    case 'hasRelation': {
      const propertyKey = condition.field?.trim();
      return propertyKey ? { type: 'hasRelation', propertyKey } : null;
    }
    case 'linkedTo': {
      const title = String(condition.value).trim();
      return title ? { type: 'linkedTo', title } : null;
    }
    case 'relation': {
      const propertyKey = condition.field?.trim();
      const title = String(condition.value).trim();
      if (!propertyKey || !title) return null;
      return { type: 'relation', propertyKey, title };
    }
    case 'formula': {
      const key = condition.field?.trim();
      const operator = condition.operator;
      const numeric = typeof condition.value === 'number'
        ? condition.value
        : Number(String(condition.value).trim());
      if (!key || !operator || !(FORMULA_OPERATORS as readonly string[]).includes(operator)) {
        return null;
      }
      if (!Number.isFinite(numeric)) return null;
      return { type: 'formula', key, operator, value: numeric };
    }
    default:
      return null;
  }
}

/** Flatten visual model to ParsedQuery — AND semantics only */
export function compileVisualFilterToParsedQuery(model: VisualFilterModel): ParsedQuery {
  const clauses: QueryClause[] = [];
  for (const group of model.groups) {
    for (const condition of group.conditions) {
      const clause = compileFilterConditionToClause(condition);
      if (clause) clauses.push(clause);
    }
  }
  return { clauses };
}

/** Canonical query string for persistence on DatabaseView / SavedView / RuleCollection */
export function compileVisualFilterToQueryString(model: VisualFilterModel): string {
  return formatParsedQuery(compileVisualFilterToParsedQuery(model));
}

/** Alias for compileVisualFilterToQueryString — K-18.2 naming */
export function compileVisualFilters(model: VisualFilterModel): string {
  return compileVisualFilterToQueryString(model);
}

/** Flatten visual filter conditions from the first AND group */
export function getVisualFilterConditions(
  model: VisualFilterModel | null | undefined,
): FilterCondition[] {
  if (!model?.groups.length) return [];
  return [...model.groups[0].conditions];
}

/** Build a visual filter model from a flat condition list */
export function visualFilterFromConditions(
  conditions: readonly FilterCondition[],
): VisualFilterModel | null {
  const normalized = normalizeVisualFilterModel({
    groups: [{ logic: 'and', conditions: [...conditions] }],
  });
  return normalized;
}

/** Merge base query with visual filter — both ANDed via space-separated tokens */
export function mergeQueryWithVisualFilter(baseQuery: string, model: VisualFilterModel): string {
  const base = baseQuery.trim();
  const filterQuery = compileVisualFilterToQueryString(model).trim();
  if (!base) return filterQuery;
  if (!filterQuery) return base;
  return `${base} ${filterQuery}`;
}
